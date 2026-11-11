import type { StudioSettings } from '@shared/contract'
import { execute, queryAll } from './database'

/** Preferências locais do Studio, guardadas no banco de dados do aplicativo. */

let defaultWorkspaceRoot = ''

export function configureSettingsDefaults(paths: { workspaceRoot: string }): void {
  defaultWorkspaceRoot = paths.workspaceRoot
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

export async function readSettings(): Promise<StudioSettings> {
  const rows = await queryAll<{ key: string; value: string }>('SELECT key, value FROM settings')
  const stored = new Map<string, unknown>()

  for (const row of rows) {
    try {
      stored.set(row.key, JSON.parse(row.value))
    } catch {
      stored.set(row.key, row.value)
    }
  }

  return {
    workspaceRoot: asString(stored.get('workspaceRoot'), defaultWorkspaceRoot),
    activeProjectId: stored.get('activeProjectId') === null
      ? null
      : typeof stored.get('activeProjectId') === 'string'
        ? (stored.get('activeProjectId') as string)
        : null,
    onboardingDone: asBoolean(stored.get('onboardingDone'), false),
    maxBackups: Math.max(1, Math.min(100, asNumber(stored.get('maxBackups'), 10))),
    lastOpenedPage: asString(stored.get('lastOpenedPage'), '/painel'),
    godotExecutable: typeof stored.get('godotExecutable') === 'string'
      ? (stored.get('godotExecutable') as string)
      : ''
  }
}

async function writeKey(key: string, value: unknown): Promise<void> {
  await execute(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), new Date().toISOString()]
  )
}

export async function updateSettings(patch: Partial<StudioSettings>): Promise<StudioSettings> {
  const allowed: Array<keyof StudioSettings> = [
    'workspaceRoot',
    'activeProjectId',
    'onboardingDone',
    'maxBackups',
    'lastOpenedPage',
    'godotExecutable'
  ]

  for (const key of allowed) {
    if (patch[key] !== undefined) {
      await writeKey(key, patch[key])
    }
  }

  return readSettings()
}
