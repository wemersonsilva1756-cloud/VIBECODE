import type { ActivityEntry } from '@shared/contract'
import { execute, queryAll } from './database'

/** Histórico de ações do Studio: mostra ao usuário o que foi feito e quando. */

export async function logActivity(
  projectId: string | null,
  type: string,
  message: string
): Promise<void> {
  const now = new Date().toISOString()
  await execute('INSERT INTO activity (id, project_id, type, message, created_at) VALUES (?, ?, ?, ?, ?)', [
    crypto.randomUUID(),
    projectId,
    type,
    message,
    now
  ])

  // Mantém o histórico leve: guardamos as 500 ações mais recentes.
  await execute(
    `DELETE FROM activity WHERE id NOT IN (
       SELECT id FROM activity ORDER BY created_at DESC LIMIT 500
     )`
  )
}

export async function listActivity(limit = 30): Promise<ActivityEntry[]> {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)))
  const rows = await queryAll<{
    id: string
    project_id: string | null
    type: string
    message: string
    created_at: string
  }>('SELECT id, project_id, type, message, created_at FROM activity ORDER BY created_at DESC LIMIT ?', [
    safeLimit
  ])

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    message: row.message,
    createdAt: row.created_at
  }))
}
