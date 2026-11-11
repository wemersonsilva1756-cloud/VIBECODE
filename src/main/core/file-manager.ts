import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import type {
  FileCategory,
  FileEntry,
  FilePreview,
  ImportFilesResult
} from '@shared/contract'
import { getProject } from './projects'
import { copyDirectory, ensureDir, isDirectory, pathExists } from './filesystem'
import { timestampSlug } from './naming'

/**
 * Gerenciador de arquivos dos projetos.
 *
 * Regras:
 * - Nenhum caminho vindo da interface é usado diretamente: tudo é resolvido
 *   dentro da pasta do projeto (qualquer tentativa de sair dela é recusada).
 * - Importar nunca sobrescreve: arquivos com o mesmo nome ganham sufixo.
 * - Excluir move para a lixeira interna do Studio.
 */

const CATEGORY_BY_EXTENSION: Record<string, FileCategory> = {
  '.png': 'imagem',
  '.jpg': 'imagem',
  '.jpeg': 'imagem',
  '.webp': 'imagem',
  '.gif': 'imagem',
  '.bmp': 'imagem',
  '.svg': 'imagem',
  '.wav': 'audio',
  '.ogg': 'audio',
  '.mp3': 'audio',
  '.flac': 'audio',
  '.tscn': 'cena',
  '.scn': 'cena',
  '.escn': 'cena',
  '.gd': 'codigo',
  '.cs': 'codigo',
  '.json': 'dados',
  '.tres': 'dados',
  '.res': 'dados',
  '.cfg': 'dados',
  '.godot': 'dados',
  '.import': 'dados',
  '.txt': 'texto',
  '.md': 'texto'
}

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.json',
  '.gd',
  '.cs',
  '.tscn',
  '.tres',
  '.cfg',
  '.godot',
  '.import',
  '.csv',
  '.ts',
  '.js',
  '.html',
  '.css'
])

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])

const MAX_TEXT_BYTES = 200 * 1024
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export function categorize(fileName: string, isDirectoryEntry = false): FileCategory {
  if (isDirectoryEntry) return 'pasta'
  const category = CATEGORY_BY_EXTENSION[extname(fileName).toLowerCase()]
  return category ?? 'outro'
}

/** Normaliza um caminho relativo digitado/derivado, recusando sair da pasta. */
export function normalizeRelative(relativePath: string): string {
  const cleaned = relativePath.replace(/\\/g, '/').replace(/^\.?\/*/, '').replace(/\/+$/, '')
  if (!cleaned) return ''
  const parts = cleaned.split('/')
  if (parts.some((part) => part === '..' || part === '.' || part === '')) {
    throw new Error('Caminho inválido.')
  }
  if (/[:*?"<>|]/.test(cleaned)) {
    throw new Error('O caminho contém caracteres não permitidos.')
  }
  return cleaned
}

/** Resolve um caminho relativo garantindo que ele fique dentro da raiz. */
export function resolveInside(root: string, relativePath: string): string {
  const normalized = normalizeRelative(relativePath)
  const rootResolved = resolve(root)
  const target = normalized ? resolve(rootResolved, normalized) : rootResolved
  if (target !== rootResolved && !target.startsWith(rootResolved + sep)) {
    throw new Error('Caminho fora da pasta do projeto.')
  }
  return target
}

async function projectRoot(projectId: string): Promise<string> {
  const project = await getProject(projectId)
  if (!project.folderExists) {
    throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
  }
  return project.path
}

function entryFor(root: string, folder: string, name: string): FileEntry | null {
  const absolute = join(folder, name)
  const relativePath = absolute.slice(root.length + 1).replace(/\\/g, '/')

  try {
    const info = statSync(absolute)
    if (info.isDirectory()) {
      let childCount = 0
      try {
        childCount = readdirSync(absolute).length
      } catch {
        childCount = 0
      }
      return {
        name,
        relativePath,
        isDirectory: true,
        sizeBytes: 0,
        modifiedAt: info.mtime.toISOString(),
        category: 'pasta',
        extension: '',
        childCount
      }
    }
    return {
      name,
      relativePath,
      isDirectory: false,
      sizeBytes: info.size,
      modifiedAt: info.mtime.toISOString(),
      category: categorize(name),
      extension: extname(name).toLowerCase(),
      childCount: 0
    }
  } catch {
    return null
  }
}

/** Lista o conteúdo de uma pasta do projeto (pastas primeiro, depois A-Z). */
export async function listProjectDirectory(
  projectId: string,
  relativePath: string
): Promise<FileEntry[]> {
  const root = await projectRoot(projectId)
  const folder = resolveInside(root, relativePath)

  if (!isDirectory(folder)) {
    throw new Error('Esta pasta não existe no projeto.')
  }

  const entries: FileEntry[] = []
  for (const name of readdirSync(folder)) {
    if (name === 'thumbs.db' || name === 'desktop.ini') continue
    const entry = entryFor(root, folder, name)
    if (entry) entries.push(entry)
  }

  return entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
  })
}

/** Lê um arquivo para pré-visualização (texto ou imagem em base64). */
export async function previewProjectFile(
  projectId: string,
  relativePath: string
): Promise<FilePreview> {
  const root = await projectRoot(projectId)
  const target = resolveInside(root, relativePath)

  if (!pathExists(target) || isDirectory(target)) {
    throw new Error('Arquivo não encontrado.')
  }

  const info = statSync(target)
  const extension = extname(target).toLowerCase()
  const base: FilePreview = {
    relativePath: normalizeRelative(relativePath),
    name: basename(target),
    category: categorize(basename(target)),
    sizeBytes: info.size,
    modifiedAt: info.mtime.toISOString(),
    text: null,
    dataUrl: null,
    truncated: false
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    if (info.size > MAX_IMAGE_BYTES) {
      return { ...base, truncated: true }
    }
    const mime =
      extension === '.jpg' || extension === '.jpeg'
        ? 'image/jpeg'
        : extension === '.webp'
          ? 'image/webp'
          : extension === '.gif'
            ? 'image/gif'
            : extension === '.bmp'
              ? 'image/bmp'
              : 'image/png'
    return {
      ...base,
      dataUrl: `data:${mime};base64,${readFileSync(target).toString('base64')}`
    }
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    const buffer = readFileSync(target)
    const slice = buffer.subarray(0, MAX_TEXT_BYTES)
    return {
      ...base,
      text: slice.toString('utf8'),
      truncated: buffer.length > MAX_TEXT_BYTES
    }
  }

  return base
}

/** Cria uma pasta vazia dentro do projeto. */
export async function createProjectFolder(
  projectId: string,
  relativePath: string,
  name: string
): Promise<FileEntry> {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Informe um nome para a pasta.')
  if (/[\\/:*?"<>|]/.test(cleanName)) {
    throw new Error('O nome da pasta não pode conter \\ / : * ? " < > |')
  }
  if (cleanName === '.' || cleanName === '..') {
    throw new Error('Nome de pasta inválido.')
  }

  const root = await projectRoot(projectId)
  const parent = resolveInside(root, relativePath)
  if (!isDirectory(parent)) throw new Error('A pasta de destino não existe.')

  const target = resolveInside(root, relativePath ? `${relativePath}/${cleanName}` : cleanName)
  if (pathExists(target)) {
    throw new Error(`Já existe um item chamado "${cleanName}" aqui.`)
  }

  mkdirSync(target)
  const entry = entryFor(root, parent, cleanName)
  if (!entry) throw new Error('A pasta foi criada, mas não pôde ser lida.')
  return entry
}

function uniqueName(folder: string, fileName: string): { name: string; renamed: boolean } {
  if (!pathExists(join(folder, fileName))) return { name: fileName, renamed: false }

  const extension = extname(fileName)
  const stem = extension ? fileName.slice(0, -extension.length) : fileName
  let counter = 2
  while (pathExists(join(folder, `${stem}-${counter}${extension}`))) {
    counter += 1
  }
  return { name: `${stem}-${counter}${extension}`, renamed: true }
}

/** Copia arquivos escolhidos pelo usuário para dentro da pasta indicada. */
export async function importFilesIntoProject(
  projectId: string,
  relativePath: string,
  sourcePaths: string[]
): Promise<ImportFilesResult> {
  const root = await projectRoot(projectId)
  const destination = resolveInside(root, relativePath)
  if (!isDirectory(destination)) throw new Error('A pasta de destino não existe.')

  const result: ImportFilesResult = { imported: [], renamed: [], skipped: [] }

  for (const source of sourcePaths) {
    try {
      if (!pathExists(source)) {
        result.skipped.push({ name: basename(source), reason: 'arquivo não encontrado' })
        continue
      }

      const { name, renamed } = uniqueName(destination, basename(source))
      const target = join(destination, name)
      const targetRelative = relativePath ? `${relativePath}/${name}` : name

      if (isDirectory(source)) {
        copyDirectory(source, target)
      } else {
        copyFileSync(source, target)
      }

      const item = { name, relativePath: targetRelative }
      if (renamed) {
        result.renamed.push(item)
      } else {
        result.imported.push(item)
      }
    } catch (error) {
      result.skipped.push({
        name: basename(source),
        reason: error instanceof Error ? error.message : 'erro ao copiar'
      })
    }
  }

  return result
}

/**
 * Envia um arquivo ou pasta do projeto para a lixeira interna do Studio.
 * Devolve o caminho na lixeira, para que a interface possa informar o usuário.
 */
export async function trashProjectItem(
  projectId: string,
  relativePath: string,
  trashDir: string
): Promise<string> {
  const normalized = normalizeRelative(relativePath)
  if (!normalized) throw new Error('Não é possível remover a raiz do projeto.')

  const root = await projectRoot(projectId)
  const target = resolveInside(root, normalized)
  if (!pathExists(target)) throw new Error('Este item não existe mais.')

  ensureDir(trashDir)
  const stamp = timestampSlug(new Date())
  const name = `${stamp}_${basename(target)}`
  let candidate = join(trashDir, name)
  let counter = 2
  while (pathExists(candidate)) {
    candidate = join(trashDir, `${name}-${counter}`)
    counter += 1
  }

  // rename pode falhar entre discos diferentes; nesse caso copia e move.
  try {
    const { renameSync } = await import('node:fs')
    renameSync(target, candidate)
  } catch {
    copyDirectory(target, candidate)
    const { rmSync } = await import('node:fs')
    rmSync(target, { recursive: true, force: true })
  }

  return candidate
}

/** Usado pelos testes: grava um arquivo de texto dentro do projeto. */
export function writeProjectTextFile(root: string, relativePath: string, content: string): string {
  const target = resolveInside(root, relativePath)
  ensureDir(dirname(target))
  writeFileSync(target, content, 'utf8')
  return target
}
