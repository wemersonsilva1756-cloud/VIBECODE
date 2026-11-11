import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type {
  CharacterAsset,
  CharacterCategory,
  CharacterDirection,
  CharacterSpec,
  DescriptionSuggestion,
  MonsterArchetype,
  SpritePalette
} from '../../shared/characters'
import { DIRECTIONS, paletteById } from '../../shared/characters'
import { execute, queryAll, queryOne } from './database'
import { getProject } from './projects'
import { ensureDir, moveToTrash, pathExists, isDirectory } from './filesystem'
import { slugify, timestampSlug } from './naming'
import { renderAllDirections, renderSprite, toDataUrl } from './sprites'
import { logActivity } from './activity'

/**
 * Serviço do gerador de personagens e monstros.
 *
 * Nesta etapa não há IA: a descrição é interpretada por palavras-chave para
 * sugerir paleta, arquétipo, papel e equipamento. Tudo o que o gerador cria é
 * determinístico e fica salvo nas pastas do projeto, disponível no gerenciador
 * de arquivos e na exportação para a Godot.
 */

interface CharacterOptions {
  trashDir: string
}

let options: CharacterOptions = { trashDir: '' }

export function configureCharacters(next: CharacterOptions): void {
  options = next
}

const FOLDERS: Record<CharacterCategory, string> = {
  personagem: 'personagens',
  monstro: 'monstros'
}

const MAX_NAME = 60

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

/** Valida e normaliza a especificação vinda da interface. */
export function validateSpec(input: CharacterSpec): CharacterSpec {
  const name = (input.name ?? '').trim()
  if (name.length < 2) throw new Error('O nome precisa ter pelo menos 2 caracteres.')
  if (name.length > MAX_NAME) {
    throw new Error(`O nome pode ter no máximo ${MAX_NAME} caracteres.`)
  }

  const category: CharacterCategory = input.category === 'monstro' ? 'monstro' : 'personagem'
  const size = input.size === 96 ? 96 : input.size === 64 ? 64 : 32

  const requested = Array.isArray(input.directions) ? input.directions : DIRECTIONS
  const directions = DIRECTIONS.filter((direction) => requested.includes(direction))
  if (directions.length === 0) {
    throw new Error('Escolha pelo menos uma direção para gerar o sprite.')
  }

  const basePalette = paletteById(input.paletteId)
  const palette: SpritePalette = {
    pele: normalizeColor(input.palette?.pele, basePalette.pele),
    cabelo: normalizeColor(input.palette?.cabelo, basePalette.cabelo),
    roupa: normalizeColor(input.palette?.roupa, basePalette.roupa),
    detalhe: normalizeColor(input.palette?.detalhe, basePalette.detalhe),
    calca: normalizeColor(input.palette?.calca, basePalette.calca),
    bota: normalizeColor(input.palette?.bota, basePalette.bota),
    contorno: normalizeColor(input.palette?.contorno, basePalette.contorno)
  }

  const drops = (Array.isArray(input.drops) ? input.drops : [])
    .map((drop) => ({
      item: String(drop.item ?? '').trim().slice(0, 60),
      chance: clamp(Number(drop.chance) || 0, 0, 100),
      quantidade: clamp(Number(drop.quantidade) || 1, 1, 999)
    }))
    .filter((drop) => drop.item.length > 0)
    .slice(0, 20)

  return {
    category,
    name,
    description: String(input.description ?? '').slice(0, 600),
    role: input.role,
    archetype: input.archetype,
    size,
    paletteId: input.paletteId,
    palette,
    seed: Math.abs(Math.floor(Number(input.seed) || 1)) % 2147483647 || 1,
    equipment: input.equipment,
    directions,
    stats: {
      vida: clamp(Number(input.stats?.vida) || 1, 1, 99999),
      dano: clamp(Number(input.stats?.dano) || 0, 0, 9999),
      velocidade: clamp(Number(input.stats?.velocidade) || 0, 0, 999),
      alcance: clamp(Number(input.stats?.alcance) || 0, 0, 9999)
    },
    abilities: (Array.isArray(input.abilities) ? input.abilities : [])
      .map((ability) => String(ability).trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 12),
    drops
  }
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    ? value.toLowerCase()
    : fallback
}

/** Pré-visualização em memória: nenhum arquivo é gravado. */
export function previewCharacter(
  spec: CharacterSpec
): Record<CharacterDirection, string> | Partial<Record<CharacterDirection, string>> {
  const valid = validateSpec(spec)
  const previews: Partial<Record<CharacterDirection, string>> = {}
  for (const direction of valid.directions) {
    previews[direction] = toDataUrl(renderSprite(valid, direction))
  }
  return previews
}

interface KeywordRule {
  words: string[]
  apply: Partial<{
    paletteId: string
    archetype: MonsterArchetype
    role: CharacterSpec['role']
    equipment: CharacterSpec['equipment']
  }>
}

const RULES: KeywordRule[] = [
  { words: ['deserto', 'areia', 'árido'], apply: { paletteId: 'deserto' } },
  { words: ['neve', 'gelo', 'gelad', 'inverno', 'frio', 'ártic', 'artic'], apply: { paletteId: 'neve' } },
  { words: ['neon', 'cyber', 'ciber', 'hacker'], apply: { paletteId: 'neon' } },
  { words: ['sangue', 'ferido', 'vermelho', 'sangrento'], apply: { paletteId: 'ferido' } },
  { words: ['militar', 'camuflagem', 'selva', 'soldado', 'exército'], apply: { paletteId: 'militar' } },
  { words: ['cidade', 'urbano', 'policial', 'prédio'], apply: { paletteId: 'urbano' } },
  { words: ['gosma', 'slime', 'limo', 'veneno'], apply: { paletteId: 'gosma', archetype: 'slime' } },
  { words: ['sombra', 'noite', 'noturno', 'escuridão'], apply: { paletteId: 'sombra' } },
  { words: ['lobo', 'cachorro', 'cão', 'fera', 'besta', 'quadrúpede'], apply: { archetype: 'quadrupede' } },
  { words: ['morcego', 'pássaro', 'ave', 'voador', 'drone', 'abutre'], apply: { archetype: 'voador' } },
  { words: ['goblin', 'orc', 'zumbi', 'esqueleto', 'humanoide', 'monstro'], apply: { archetype: 'humanoide' } },
  { words: ['chefe', 'boss', 'titã', 'titan', 'gigante'], apply: { role: 'chefe' } },
  { words: ['raro', 'lendário', 'lendario'], apply: { role: 'raro' } },
  { words: ['elite', 'especial', 'elite'], apply: { role: 'especial' } },
  { words: ['fuzil', 'rifle', 'ak', 'metralhadora'], apply: { equipment: 'rifle' } },
  { words: ['pistola', 'revolver', 'revólver'], apply: { equipment: 'pistola' } },
  { words: ['espada', 'katana', 'faca'], apply: { equipment: 'espada' } },
  { words: ['escudo'], apply: { equipment: 'escudo' } }
]

/** Interpreta a descrição por palavras-chave (sem IA nesta etapa). */
export function interpretDescription(description: string): DescriptionSuggestion {
  const text = description.toLowerCase()
  const suggestion: DescriptionSuggestion = {
    paletteId: null,
    archetype: null,
    role: null,
    equipment: null,
    matches: []
  }

  for (const rule of RULES) {
    const hit = rule.words.find((word) => text.includes(word))
    if (!hit) continue
    suggestion.matches.push(hit)
    if (rule.apply.paletteId && !suggestion.paletteId) suggestion.paletteId = rule.apply.paletteId
    if (rule.apply.archetype && !suggestion.archetype) suggestion.archetype = rule.apply.archetype
    if (rule.apply.role && !suggestion.role) suggestion.role = rule.apply.role
    if (rule.apply.equipment && !suggestion.equipment) suggestion.equipment = rule.apply.equipment
  }

  return suggestion
}

function uniqueFolder(parent: string, slug: string): string {
  let candidate = join(parent, slug)
  let counter = 2
  while (pathExists(candidate)) {
    candidate = join(parent, `${slug}-${counter}`)
    counter += 1
  }
  return candidate
}

/** Grava os sprites e a ficha do personagem/monstro no projeto. */
export async function saveCharacter(
  projectId: string,
  input: CharacterSpec
): Promise<CharacterAsset> {
  const project = await getProject(projectId)
  if (!project.folderExists) {
    throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
  }

  const spec = validateSpec(input)
  const baseFolder = FOLDERS[spec.category]
  const parent = join(project.path, baseFolder)
  ensureDir(parent)

  const folder = uniqueFolder(parent, slugify(spec.name))
  ensureDir(folder)

  const slug = folder.split(/[\\/]/).pop() ?? slugify(spec.name)
  const rendered = renderAllDirections(spec, spec.directions)
  const images: CharacterAsset['images'] = []

  for (const item of rendered) {
    const fileName = `${slug}_${item.direction}.png`
    writeFileSync(join(folder, fileName), item.png)
    images.push({
      direction: item.direction,
      relativePath: `${baseFolder}/${slug}/${fileName}`
    })
  }

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const jsonPath = `${baseFolder}/${slug}/${slug}.json`

  const sheet = {
    formato: 1,
    id,
    geradoPor: 'Pixel Strike Studio',
    geradoEm: createdAt,
    categoria: spec.category,
    nome: spec.name,
    descricao: spec.description,
    papel: spec.role,
    arquetipo: spec.archetype,
    tamanho: spec.size,
    semente: spec.seed,
    equipamento: spec.equipment,
    paleta: spec.palette,
    atributos: spec.stats,
    habilidades: spec.abilities,
    drops: spec.drops,
    imagens: images.map((image) => ({
      direcao: image.direction,
      arquivo: image.relativePath
    }))
  }

  writeFileSync(join(folder, `${slug}.json`), `${JSON.stringify(sheet, null, 2)}\n`, 'utf8')

  const data = JSON.stringify({ spec, folder: `${baseFolder}/${slug}`, images })

  await execute(
    `INSERT INTO assets (id, project_id, kind, name, origin, relative_path, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'gerado', ?, ?, ?, ?)`,
    [id, projectId, spec.category, spec.name, jsonPath, data, createdAt, createdAt]
  )

  await logActivity(
    projectId,
    'personagem.criado',
    `${spec.category === 'monstro' ? 'Monstro' : 'Personagem'} "${spec.name}" gerado em ${baseFolder}/${slug}.`
  )

  return {
    id,
    projectId,
    category: spec.category,
    name: spec.name,
    folder: `${baseFolder}/${slug}`,
    jsonPath,
    images,
    createdAt,
    spec
  }
}

interface AssetRow {
  id: string
  project_id: string
  kind: string
  name: string
  relative_path: string
  data: string
  created_at: string
}

function toAsset(row: AssetRow): CharacterAsset | null {
  try {
    const parsed = JSON.parse(row.data) as {
      spec: CharacterSpec
      folder: string
      images: CharacterAsset['images']
    }
    return {
      id: row.id,
      projectId: row.project_id,
      category: row.kind === 'monstro' ? 'monstro' : 'personagem',
      name: row.name,
      folder: parsed.folder,
      jsonPath: row.relative_path,
      images: parsed.images,
      createdAt: row.created_at,
      spec: parsed.spec
    }
  } catch {
    return null
  }
}

/** Lista os personagens e monstros já gerados no projeto. */
export async function listCharacters(
  projectId: string,
  category?: CharacterCategory
): Promise<CharacterAsset[]> {
  const rows = category
    ? await queryAll<AssetRow>(
        `SELECT id, project_id, kind, name, relative_path, data, created_at
         FROM assets WHERE project_id = ? AND kind = ? ORDER BY created_at DESC`,
        [projectId, category]
      )
    : await queryAll<AssetRow>(
        `SELECT id, project_id, kind, name, relative_path, data, created_at
         FROM assets WHERE project_id = ? AND kind IN ('personagem', 'monstro')
         ORDER BY created_at DESC`,
        [projectId]
      )

  return rows.map(toAsset).filter((asset): asset is CharacterAsset => asset !== null)
}

/** Move a pasta do personagem para a lixeira e remove o registro. */
export async function removeCharacter(assetId: string): Promise<void> {
  const row = await queryOne<AssetRow & { project_id: string; data: string }>(
    'SELECT id, project_id, kind, name, relative_path, data, created_at FROM assets WHERE id = ?',
    [assetId]
  )
  if (!row) throw new Error('Este personagem não existe mais.')

  const asset = toAsset(row)
  const project = await getProject(row.project_id)

  if (asset && project.folderExists) {
    const folder = join(project.path, asset.folder)
    if (isDirectory(folder)) {
      if (!options.trashDir) throw new Error('A lixeira do Studio não está configurada.')
      moveToTrash(folder, options.trashDir, `${timestampSlug(new Date())}_${slugify(asset.name)}`)
    }
  }

  await execute('DELETE FROM assets WHERE id = ?', [assetId])
  await logActivity(row.project_id, 'personagem.removido', `Personagem "${row.name}" movido para a lixeira.`)
}

/** Leitura da ficha salva em disco (para conferir integridade nos testes). */
export function readCharacterSheet(projectPath: string, jsonPath: string): unknown {
  return JSON.parse(readFileSync(resolve(projectPath, jsonPath), 'utf8'))
}
