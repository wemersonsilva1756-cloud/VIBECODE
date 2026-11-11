import type { StudioStats } from '@shared/contract'
import { queryAll, queryOne } from './database'
import { directorySize, isDirectory } from './filesystem'
import { readSettings } from './settings-store'

/** Indicadores exibidos no painel inicial. */

function count(value: unknown): number {
  return Number(value ?? 0)
}

export async function getStats(): Promise<StudioStats> {
  const projectCount = count(
    (await queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM projects'))?.total
  )
  const assetCount = count(
    (await queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM assets'))?.total
  )
  const backupCount = count(
    (await queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM backups'))?.total
  )

  const paths = await queryAll<{ path: string }>('SELECT path FROM projects')
  const totalSizeBytes = paths.reduce(
    (total, row) => total + (isDirectory(row.path) ? directorySize(row.path) : 0),
    0
  )

  const settings = await readSettings()
  let activeProjectName: string | null = null
  if (settings.activeProjectId) {
    const row = await queryOne<{ name: string }>('SELECT name FROM projects WHERE id = ?', [
      settings.activeProjectId
    ])
    activeProjectName = row?.name ?? null
  }

  return { projectCount, assetCount, backupCount, totalSizeBytes, activeProjectName }
}
