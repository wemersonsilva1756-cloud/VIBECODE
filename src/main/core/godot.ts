import { copyFileSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import type {
  GodotExecutableInfo,
  GodotExportPlan,
  GodotExportResult,
  GodotFilePlan,
  GodotLink,
  GodotProjectInfo,
  ProjectGodotState
} from '@shared/contract'
import { execute, queryOne } from './database'
import { getProject } from './projects'
import { ensureDir, isDirectory, pathExists } from './filesystem'
import { readSettings, updateSettings } from './settings-store'
import { timestampSlug } from './naming'
import { logActivity } from './activity'

/**
 * Integração com Godot 4.
 *
 * O Studio nunca escreve na pasta da Godot sem mostrar antes a lista de arquivos
 * e sem criar uma cópia de segurança dos arquivos que serão substituídos.
 */

interface GodotOptions {
  studioVersion: string
}

let options: GodotOptions = { studioVersion: '0.0.0' }

export function configureGodot(next: GodotOptions): void {
  options = next
}

const GODOT_FOLDER = 'addons/pixel_strike'
const HELPER_PATH = `${GODOT_FOLDER}/pixel_strike.gd`
const MANIFEST_PATH = `${GODOT_FOLDER}/pixel_strike_manifest.json`
const README_PATH = `${GODOT_FOLDER}/LEIA-ME.md`
const RESOURCE_ROOT = 'pixel_strike/recursos'

/** ------------------------------- leitura do projeto.godot ------------------ */

function stripComment(line: string): string {
  let inString = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"' && line[index - 1] !== '\\') inString = !inString
    if (char === ';' && !inString) return line.slice(0, index)
  }
  return line
}

/** Lê `project.godot` (formato INI da Godot) em um mapa "seção/chave" -> valor. */
export function parseGodotConfig(content: string): Map<string, string> {
  const values = new Map<string, string>()
  let section = ''

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim()
    if (!line) continue
    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim()
      continue
    }
    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (!key) continue
    values.set(section ? `${section}/${key}` : key, value)
  }

  return values
}

function unquote(value: string | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"')
  }
  return trimmed
}

/** Extrai os itens de PackedStringArray("4.3", "Forward Plus"). */
export function parsePackedStringArray(value: string | undefined): string[] {
  if (!value) return []
  const start = value.indexOf('(')
  const end = value.lastIndexOf(')')
  if (start === -1 || end <= start) return []
  const inside = value.slice(start + 1, end)
  const items: string[] = []
  const pattern = /"((?:[^"\\]|\\.)*)"/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(inside)) !== null) {
    items.push((match[1] ?? '').replace(/\\"/g, '"'))
  }
  return items
}

const SCENE_EXTENSIONS = new Set(['.tscn', '.scn', '.escn'])
const SCRIPT_EXTENSIONS = new Set(['.gd', '.cs'])
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.bmp'])
const RESOURCE_EXTENSIONS = new Set(['.tres', '.res', '.import', '.material', '.theme'])

export interface GodotScan {
  counts: GodotProjectInfo['counts']
  scenes: string[]
  scripts: string[]
}

/** Percorre o projeto Godot contando recursos (sem entrar em pastas ocultas). */
export function scanGodotProject(root: string): GodotScan {
  const counts = { scenes: 0, scripts: 0, images: 0, resources: 0, other: 0 }
  const scenes: string[] = []
  const scripts: string[] = []
  let visited = 0

  const walk = (current: string): void => {
    if (visited > 8000) return
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (!entry.isFile()) continue

      visited += 1
      const extension = extname(entry.name).toLowerCase()
      const relativePath = relative(root, fullPath).replace(/\\/g, '/')

      if (SCENE_EXTENSIONS.has(extension)) {
        counts.scenes += 1
        if (scenes.length < 100) scenes.push(relativePath)
      } else if (SCRIPT_EXTENSIONS.has(extension)) {
        counts.scripts += 1
        if (scripts.length < 100) scripts.push(relativePath)
      } else if (IMAGE_EXTENSIONS.has(extension)) {
        counts.images += 1
      } else if (RESOURCE_EXTENSIONS.has(extension)) {
        counts.resources += 1
      } else if (extension !== '.godot' && extension !== '.uid') {
        counts.other += 1
      }
    }
  }

  walk(root)
  scenes.sort((a, b) => a.localeCompare(b, 'pt-BR'))
  scripts.sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return { counts, scenes, scripts }
}

/** Lê as informações de um projeto Godot 4 sem alterar nada. */
export function inspectGodotProject(folderPath: string): GodotProjectInfo {
  const base: GodotProjectInfo = {
    path: folderPath,
    valid: false,
    problem: null,
    name: '',
    engineVersion: null,
    configVersion: null,
    features: [],
    mainScene: null,
    autoloads: [],
    counts: { scenes: 0, scripts: 0, images: 0, resources: 0, other: 0 },
    scenes: [],
    scripts: []
  }

  if (!pathExists(folderPath) || !isDirectory(folderPath)) {
    return { ...base, problem: 'A pasta escolhida não existe ou não é uma pasta.' }
  }

  const configPath = join(folderPath, 'project.godot')
  if (!pathExists(configPath)) {
    return {
      ...base,
      problem:
        'Esta pasta não tem um arquivo project.godot. Escolha a pasta raiz de um projeto Godot (a que contém project.godot).'
    }
  }

  let content = ''
  try {
    content = readFileSync(configPath, 'utf8')
  } catch {
    return { ...base, problem: 'Não foi possível ler o arquivo project.godot.' }
  }

  const values = parseGodotConfig(content)
  const features = parsePackedStringArray(values.get('application/config/features'))
  const configVersionRaw = values.get('config_version')
  const configVersion = configVersionRaw ? Number(configVersionRaw) : null
  const engineVersion = features.find((feature) => /^\d+\.\d+/.test(feature)) ?? null

  const autoloadSection = new Map<string, string>()
  for (const [key, value] of values) {
    if (key.startsWith('autoload/')) autoloadSection.set(key.slice('autoload/'.length), value)
  }

  const scan = scanGodotProject(folderPath)
  const mainScene = unquote(values.get('application/run/main_scene')) || null

  const problem =
    configVersion !== null && configVersion < 5
      ? `Este projeto usa o formato Godot ${configVersion} (Godot 3). O Studio trabalha com Godot 4.`
      : null

  return {
    path: folderPath,
    valid: problem === null,
    problem,
    name: unquote(values.get('application/config/name')) || 'Projeto Godot sem nome',
    engineVersion,
    configVersion,
    features,
    mainScene,
    autoloads: [...autoloadSection.keys()],
    counts: scan.counts,
    scenes: scan.scenes,
    scripts: scan.scripts
  }
}

/** ------------------------------- vínculo com o projeto --------------------- */

export async function readGodotLink(projectId: string): Promise<GodotLink | null> {
  const row = await queryOne<{ path: string; linked_at: string; last_export_at: string | null }>(
    'SELECT path, linked_at, last_export_at FROM godot_links WHERE project_id = ?',
    [projectId]
  )
  if (!row) return null

  return {
    path: row.path,
    linkedAt: row.linked_at,
    lastExportAt: row.last_export_at
  }
}

export async function saveGodotLink(projectId: string, godotPath: string): Promise<GodotLink> {
  const now = new Date().toISOString()
  const existing = await readGodotLink(projectId)

  await execute(
    `INSERT INTO godot_links (project_id, path, linked_at, last_export_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET path = excluded.path, linked_at = excluded.linked_at`,
    [projectId, godotPath, now, existing?.lastExportAt ?? null]
  )

  return { path: godotPath, linkedAt: now, lastExportAt: existing?.lastExportAt ?? null }
}

export async function removeGodotLink(projectId: string): Promise<void> {
  await execute('DELETE FROM godot_links WHERE project_id = ?', [projectId])
}

export async function getProjectGodotState(
  projectId: string,
  executable: GodotExecutableInfo
): Promise<ProjectGodotState> {
  const link = await readGodotLink(projectId)
  if (!link) return { link: null, info: null, executable }

  const info = inspectGodotProject(link.path)
  return { link, info, executable }
}

/** Versão do executável da Godot, quando o usuário escolheu um caminho. */
export function readGodotExecutable(executablePath: string): GodotExecutableInfo {
  if (!executablePath) {
    return {
      path: null,
      version: null,
      ok: false,
      message: 'Nenhum executável da Godot configurado. Isso é opcional.'
    }
  }

  if (!pathExists(executablePath)) {
    return {
      path: executablePath,
      version: null,
      ok: false,
      message: 'O executável configurado não foi encontrado. Escolha o arquivo novamente.'
    }
  }

  try {
    const result = spawnSync(executablePath, ['--version'], {
      encoding: 'utf8',
      timeout: 12000,
      windowsHide: true
    })

    if (result.error) {
      return {
        path: executablePath,
        version: null,
        ok: false,
        message: `Não foi possível executar a Godot: ${result.error.message}`
      }
    }

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    const match = output.match(/(\d+\.\d+(?:\.\d+)?)/)
    const version = match?.[1] ?? null
    if (!version) {
      return {
        path: executablePath,
        version: null,
        ok: false,
        message: 'O programa respondeu, mas não informou uma versão da Godot.'
      }
    }

    return {
      path: executablePath,
      version,
      ok: true,
      message: `Godot ${version} encontrada.`
    }
  } catch (error) {
    return {
      path: executablePath,
      version: null,
      ok: false,
      message:
        error instanceof Error ? error.message : 'Não foi possível executar a Godot configurada.'
    }
  }
}

/** ------------------------------- conteúdo exportado ------------------------ */

function helperScript(projectName: string): string {
  return `extends Node

## Pixel Strike Studio - utilitário de integração com a Godot 4.
##
## Gerado automaticamente para o projeto "${projectName}".
## Este arquivo pode ser editado à vontade: o Studio só substitui depois de
## mostrar a prévia e criar uma cópia de segurança.
##
## COMO USAR
## 1. Abra o projeto na Godot 4.
## 2. Em Projeto > Configurações do projeto > Autoload, adicione
##    res://addons/pixel_strike/pixel_strike.gd com o nome PixelStrike.
## 3. No código: PixelStrike.recursos("imagem") devolve a lista de recursos.

const MANIFEST_PATH: String = "res://addons/pixel_strike/pixel_strike_manifest.json"

var _manifesto: Dictionary = {}


func _ready() -> void:
	print("[Pixel Strike] Integração carregada: ", nome_do_projeto())


## Nome do projeto registrado no manifesto.
func nome_do_projeto() -> String:
	return String(projeto().get("projeto", {}).get("nome", ""))


## Manifesto completo (vazio se o arquivo não existir).
func projeto() -> Dictionary:
	if _manifesto.is_empty():
		_manifesto = _ler_manifesto()
	return _manifesto


## Lista de recursos; "tipo" aceita "", "imagem", "audio", "cena" ou "dados".
func recursos(tipo: String = "") -> Array:
	var lista: Array = projeto().get("recursos", []) as Array
	if tipo.is_empty():
		return lista

	var filtrados: Array = []
	for recurso in lista:
		if String(recurso.get("tipo", "")) == tipo:
			filtrados.append(recurso)
	return filtrados


## Carrega uma textura a partir do caminho relativo registrado no manifesto.
func textura(caminho_relativo: String) -> Texture2D:
	var destino := "res://pixel_strike/recursos/" + caminho_relativo
	if not ResourceLoader.exists(destino):
		push_warning("[Pixel Strike] Recurso não encontrado: " + destino)
		return null
	return load(destino) as Texture2D


func _ler_manifesto() -> Dictionary:
	if not FileAccess.file_exists(MANIFEST_PATH):
		push_warning("[Pixel Strike] Manifesto ausente: " + MANIFEST_PATH)
		return {}

	var arquivo := FileAccess.open(MANIFEST_PATH, FileAccess.READ)
	if arquivo == null:
		push_error("[Pixel Strike] Não foi possível abrir o manifesto.")
		return {}

	var texto := arquivo.get_as_text()
	arquivo.close()

	var dados: Variant = JSON.parse_string(texto)
	if typeof(dados) != TYPE_DICTIONARY:
		push_error("[Pixel Strike] Manifesto inválido.")
		return {}

	return dados
`
}

function readmeMarkdown(projectName: string): string {
  return `# Integração com o Pixel Strike Studio

Arquivos gerados automaticamente para o projeto **${projectName}**.

## O que foi criado

| Arquivo | Para que serve |
| --- | --- |
| \`addons/pixel_strike/pixel_strike.gd\` | Utilitário que lê o manifesto e carrega os recursos |
| \`addons/pixel_strike/pixel_strike_manifest.json\` | Lista dos recursos exportados |
| \`pixel_strike/recursos/\` | Arquivos copiados da pasta \`godot/\` do projeto no Studio |

## Como ativar (uma vez só)

1. Abra o projeto na Godot 4.
2. Menu **Projeto → Configurações do projeto → Autoload**.
3. Caminho: \`res://addons/pixel_strike/pixel_strike.gd\`, nome \`PixelStrike\`.
4. Clique em **Adicionar** e salve.

Depois disso, em qualquer script:

\`\`\`gdscript
var imagens := PixelStrike.recursos("imagem")
var textura := PixelStrike.textura("personagens/heroi.png")

func _ready() -> void:
    $Sprite2D.texture = textura
\`\`\`

## Avisos

- O Studio **não** altera cenas existentes nem arquivos que você criou.
- Arquivos substituídos ficam guardados em \`.pixel_strike/backups/\` dentro do
  projeto Godot, com data e hora; nada é apagado.
- Se o projeto estiver aberto na Godot, feche antes de exportar para evitar que a
  Godot reescreva os arquivos importados.
`
}

interface CollectedFile {
  relativePath: string
  sourcePath: string
  bytes: number
  language: GodotFilePlan['language']
  content: Buffer
}

function collectFolderFiles(
  root: string,
  targetRoot: string,
  files: CollectedFile[]
): void {
  if (!isDirectory(root)) return

  const walk = (current: string): void => {
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      const relativePath = relative(root, fullPath).replace(/\\/g, '/')
      const extension = extname(entry.name).toLowerCase()
      files.push({
        relativePath: `${targetRoot}/${relativePath}`,
        sourcePath: fullPath,
        bytes: statSync(fullPath).size,
        language:
          extension === '.json'
            ? 'json'
            : extension === '.gd'
              ? 'gdscript'
              : extension === '.md'
                ? 'markdown'
                : 'binario',
        content: readFileSync(fullPath)
      })
    }
  }

  walk(root)
}

/**
 * Junta o que será copiado para a Godot: a pasta `godot/` do projeto e os
 * personagens/monstros gerados (sprites PNG e fichas JSON).
 */
function collectResourceFiles(studioProjectPath: string, warnings: string[]): CollectedFile[] {
  const files: CollectedFile[] = []

  collectFolderFiles(join(studioProjectPath, 'godot'), RESOURCE_ROOT, files)
  for (const folder of ['personagens', 'monstros', 'animacoes']) {
    collectFolderFiles(join(studioProjectPath, folder), `${RESOURCE_ROOT}/${folder}`, files)
  }

  if (files.length === 0) {
    warnings.push(
      'Nenhum recurso encontrado: as pastas godot/, personagens/, monstros/ e animacoes/ estão vazias. Apenas a preparação (script, manifesto e instruções) será enviada.'
    )
  }

  return files
}

function resourceType(fileName: string): string {
  const extension = extname(fileName).toLowerCase()
  if (IMAGE_EXTENSIONS.has(extension)) return 'imagem'
  if (['.wav', '.ogg', '.mp3', '.flac'].includes(extension)) return 'audio'
  if (SCENE_EXTENSIONS.has(extension)) return 'cena'
  return 'dados'
}

function languageOf(relativePath: string): GodotFilePlan['language'] {
  const extension = extname(relativePath).toLowerCase()
  if (extension === '.gd') return 'gdscript'
  if (extension === '.json') return 'json'
  if (extension === '.md') return 'markdown'
  return 'binario'
}

function truncatePreview(content: Buffer): string | null {
  const text = content.toString('utf8')
  if (text.includes('\u0000')) return null
  return text.length > 4000 ? `${text.slice(0, 4000)}\n…` : text
}

/** Manifesto lido pelo script utilitário dentro da Godot. */
function manifestJson(input: {
  project: { id: string; name: string; description: string }
  info: GodotProjectInfo
  godotPath: string
  resources: Array<{ relativePath: string; bytes: number }>
}): string {
  const manifest = {
    studio: 'Pixel Strike Studio',
    studioVersion: options.studioVersion,
    formato: 1,
    projeto: {
      id: input.project.id,
      nome: input.project.name,
      descricao: input.project.description
    },
    godot: {
      caminho: input.godotPath,
      nome: input.info.name,
      versao: input.info.engineVersion
    },
    recursos: input.resources.map((file) => ({
      tipo: resourceType(file.relativePath),
      nome: file.relativePath.split('/').pop() ?? file.relativePath,
      caminho_godot: `res://${file.relativePath}`,
      caminho_relativo: file.relativePath.replace(`${RESOURCE_ROOT}/`, ''),
      bytes: file.bytes
    }))
  }

  return `${JSON.stringify(manifest, null, 2)}\n`
}

function planAction(targetPath: string, content: Buffer): GodotFilePlan['action'] {
  if (!pathExists(targetPath)) return 'criar'
  try {
    const current = readFileSync(targetPath)
    return current.equals(content) ? 'igual' : 'sobrescrever'
  } catch {
    return 'sobrescrever'
  }
}

/** Monta a lista de arquivos que a exportação criaria, sem escrever nada. */
export async function buildGodotExportPlan(projectId: string): Promise<GodotExportPlan> {
  const project = await getProject(projectId)
  const link = await readGodotLink(projectId)
  if (!link) {
    throw new Error('Nenhum projeto Godot está vinculado. Escolha a pasta da Godot primeiro.')
  }

  const info = inspectGodotProject(link.path)
  if (!info.valid) {
    throw new Error(info.problem ?? 'O projeto Godot vinculado não é válido.')
  }

  const warnings: string[] = []
  const collected = collectResourceFiles(project.path, warnings)

  if (info.mainScene === null) {
    warnings.push('O projeto Godot não define uma cena principal (run/main_scene).')
  }

  const manifestText = manifestJson({
    project,
    info,
    godotPath: link.path,
    resources: collected.map((file) => ({ relativePath: file.relativePath, bytes: file.bytes }))
  })

  const generated: CollectedFile[] = [
    {
      relativePath: HELPER_PATH,
      sourcePath: '',
      bytes: Buffer.byteLength(helperScript(project.name)),
      language: 'gdscript',
      content: Buffer.from(helperScript(project.name), 'utf8')
    },
    {
      relativePath: MANIFEST_PATH,
      sourcePath: '',
      bytes: Buffer.byteLength(manifestText),
      language: 'json',
      content: Buffer.from(manifestText, 'utf8')
    },
    {
      relativePath: README_PATH,
      sourcePath: '',
      bytes: Buffer.byteLength(readmeMarkdown(project.name)),
      language: 'markdown',
      content: Buffer.from(readmeMarkdown(project.name), 'utf8')
    }
  ]

  const files: GodotFilePlan[] = [...generated, ...collected].map((file) => {
    const target = resolve(link.path, file.relativePath)
    return {
      relativePath: file.relativePath,
      action: planAction(target, file.content),
      bytes: file.bytes,
      language: file.language,
      preview: truncatePreview(file.content)
    }
  })

  return {
    targetPath: link.path,
    files,
    assetCount: collected.length,
    warnings
  }
}

/** Aplica a exportação: copia os arquivos substituídos para backup e escreve. */
export async function applyGodotExport(projectId: string): Promise<GodotExportResult> {
  const project = await getProject(projectId)
  const link = await readGodotLink(projectId)
  if (!link) {
    throw new Error('Nenhum projeto Godot está vinculado. Escolha a pasta da Godot primeiro.')
  }

  const info = inspectGodotProject(link.path)
  if (!info.valid) {
    throw new Error(info.problem ?? 'O projeto Godot vinculado não é válido.')
  }

  const plan = await buildGodotExportPlan(projectId)
  const stamp = timestampSlug(new Date())
  const backupRoot = join(link.path, '.pixel_strike', 'backups', stamp)

  let written = 0
  let unchanged = 0
  let backupPath: string | null = null

  for (const file of plan.files) {
    const target = resolve(link.path, file.relativePath)

    if (file.action === 'igual') {
      unchanged += 1
      continue
    }

    if (file.action === 'sobrescrever') {
      ensureDir(dirname(join(backupRoot, file.relativePath)))
      copyFileSync(target, join(backupRoot, file.relativePath))
      backupPath = backupRoot
    }

    const content = await rebuildFileContent({
      project,
      info,
      godotPath: link.path,
      plan,
      relativePath: file.relativePath
    })
    ensureDir(dirname(target))
    writeFileSync(target, content)
    written += 1
  }

  const now = new Date().toISOString()
  await execute('UPDATE godot_links SET last_export_at = ? WHERE project_id = ?', [
    now,
    projectId
  ])

  await logActivity(
    projectId,
    'godot-export',
    `Exportação para a Godot em "${link.path}": ${written} arquivo(s) gravado(s), ${unchanged} já estavam iguais.`
  )

  return { written, unchanged, backupPath, targetPath: link.path }
}

/**
 * Reconstrói o conteúdo de um arquivo do plano na hora de gravar.
 * Para os arquivos vindos da pasta `godot/` do projeto, copia o original; os
 * arquivos gerados são montados novamente com a data atual do manifesto.
 */
async function rebuildFileContent(input: {
  project: { id: string; name: string; description: string; path: string }
  info: GodotProjectInfo
  godotPath: string
  plan: GodotExportPlan
  relativePath: string
}): Promise<Buffer> {
  const { project, info, godotPath, plan, relativePath } = input

  if (relativePath === HELPER_PATH) return Buffer.from(helperScript(project.name), 'utf8')
  if (relativePath === README_PATH) return Buffer.from(readmeMarkdown(project.name), 'utf8')

  if (relativePath === MANIFEST_PATH) {
    const resourceFiles = plan.files.filter((file) =>
      file.relativePath.startsWith(`${RESOURCE_ROOT}/`)
    )
    return Buffer.from(
      manifestJson({
        project,
        info,
        godotPath,
        resources: resourceFiles.map((file) => ({
          relativePath: file.relativePath,
          bytes: file.bytes
        }))
      }),
      'utf8'
    )
  }

  const stripped = relativePath.replace(`${RESOURCE_ROOT}/`, '')
  // Recursos gerados ficam em personagens/ e monstros/; o resto vem de godot/.
  const fromProject = ['personagens/', 'monstros/', 'animacoes/'].some((prefix) =>
    stripped.startsWith(prefix)
  )
  const source = fromProject ? join(project.path, stripped) : join(project.path, 'godot', stripped)
  return readFileSync(source)
}

/** Vincula a pasta escolhida e devolve o estado completo para a interface. */
export async function linkProjectToGodot(
  projectId: string,
  godotPath: string
): Promise<ProjectGodotState> {
  const info = inspectGodotProject(godotPath)
  if (!info.valid) {
    throw new Error(info.problem ?? 'A pasta escolhida não é um projeto Godot 4 válido.')
  }

  const link = await saveGodotLink(projectId, godotPath)
  await logActivity(projectId, 'godot-link', `Projeto Godot vinculado: ${godotPath}`)

  const settings = await readSettings()
  return { link, info, executable: readGodotExecutable(settings.godotExecutable) }
}

/** Guarda o caminho do executável da Godot escolhido pelo usuário. */
export async function setGodotExecutable(executablePath: string): Promise<void> {
  await updateSettings({ godotExecutable: executablePath })
}
