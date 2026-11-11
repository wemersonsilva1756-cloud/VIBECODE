import { existsSync, mkdirSync, readdirSync, renameSync, statSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

/** Operações de arquivo usadas pelo Studio. Nunca apagam conteúdo do usuário. */

export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true })
}

export function pathExists(targetPath: string): boolean {
  return existsSync(targetPath)
}

export function isDirectory(targetPath: string): boolean {
  try {
    return statSync(targetPath).isDirectory()
  } catch {
    return false
  }
}

/** Soma o tamanho de todos os arquivos de uma pasta (ignora erros de permissão). */
export function directorySize(dirPath: string): number {
  if (!isDirectory(dirPath)) return 0
  let total = 0

  const walk = (current: string): void => {
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      try {
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile()) {
          total += statSync(fullPath).size
        }
      } catch {
        // Arquivo bloqueado ou removido durante a leitura: ignora e continua.
      }
    }
  }

  walk(dirPath)
  return total
}

export function countFiles(dirPath: string): number {
  if (!isDirectory(dirPath)) return 0
  let total = 0

  const walk = (current: string): void => {
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile()) {
        total += 1
      }
    }
  }

  walk(dirPath)
  return total
}

export interface CopyProgress {
  (percent: number): void
}

/** Copia uma pasta inteira, informando o progresso de 0 a 100. */
export function copyDirectory(source: string, destination: string, onProgress?: CopyProgress): void {
  ensureDir(destination)
  const total = Math.max(countFiles(source), 1)
  let copied = 0

  const walk = (from: string, to: string): void => {
    let entries
    try {
      entries = readdirSync(from, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fromPath = join(from, entry.name)
      const toPath = join(to, entry.name)

      if (entry.isDirectory()) {
        ensureDir(toPath)
        walk(fromPath, toPath)
      } else if (entry.isFile()) {
        copyFileSync(fromPath, toPath)
        copied += 1
        if (onProgress && copied % 25 === 0) {
          onProgress(Math.min(99, Math.round((copied / total) * 100)))
        }
      }
    }
  }

  walk(source, destination)
  onProgress?.(100)
}

/**
 * Remove uma pasta movendo-a para a lixeira interna do Studio.
 * A pasta é renomeada para um nome único dentro de `trashDir`, então nada é
 * apagado de forma definitiva sem o usuário saber.
 */
export function moveToTrash(targetPath: string, trashDir: string, stampedName: string): string {
  ensureDir(trashDir)
  let candidate = join(trashDir, stampedName)
  let counter = 2
  while (pathExists(candidate)) {
    candidate = join(trashDir, `${stampedName}-${counter}`)
    counter += 1
  }
  renameSync(targetPath, candidate)
  return candidate
}
