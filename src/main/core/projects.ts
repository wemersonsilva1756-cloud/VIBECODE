import { join } from 'node:path'
import type {
  BackupSummary,
  CreateProjectInput,
  ProgressEvent,
  ProjectStatus,
  ProjectSummary,
  RestoreResult,
  UpdateProjectInput
} from '@shared/contract'
import { execute, queryAll, queryOne } from './database'
import {
  copyDirectory,
  directorySize,
  ensureDir,
  isDirectory,
  moveToTrash,
  pathExists
} from './filesystem'
import { slugify, timestampSlug } from './naming'
import { logActivity } from './activity'
import { readSettings, updateSettings } from './settings-store'
import { buildManifest, writeManifest, writeProjectFiles } from './project-template'

/**
 * Serviço de projetos: cria, abre, duplica, faz backup e restaura.
 *
 * Regras de segurança aplicadas aqui:
 * - nada do usuário é apagado definitivamente: o que sai do lugar vai para a
 *   lixeira interna do Studio (`dataDir/lixeira`);
 * - restaurar sempre cria um backup de segurança antes de tocar no projeto.
 */

interface ProjectRow {
  id: string
  name: string
  slug: string
  description: string
  path: string
  status: string
  created_at: string
  updated_at: string
  last_opened_at: string | null
  asset_count?: number
  backup_count?: number
}

interface BackupRow {
  id: string
  project_id: string
  label: string
  path: string
  size_bytes: number
  kind: string
  created_at: string
}

interface ProjectsContext {
  dataDir: string
  trashDir: string
  studioVersion: string
}

let context: ProjectsContext | null = null
let progressEmitter: ((event: ProgressEvent) => void) | null = null

export function configureProjects(next: ProjectsContext): void {
  context = next
}

export function setProgressEmitter(emitter: ((event: ProgressEvent) => void) | null): void {
  progressEmitter = emitter
}

function ctx(): ProjectsContext {
  if (!context) throw new Error('Serviço de projetos não configurado.')
  return context
}

function emitProgress(operationId: string, label: string, percent: number, done = false): void {
  progressEmitter?.({
    operationId,
    label,
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    done
  })
}

function backupsRoot(): string {
  return join(ctx().dataDir, 'backups')
}

function projectBackupsDir(projectId: string): string {
  return join(backupsRoot(), projectId)
}

function toSummary(row: ProjectRow, sizeBytes: number): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    path: row.path,
    status: (row.status === 'arquivado' ? 'arquivado' : 'ativo') as ProjectStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
    assetCount: Number(row.asset_count ?? 0),
    backupCount: Number(row.backup_count ?? 0),
    sizeBytes,
    folderExists: isDirectory(row.path)
  }
}

const PROJECT_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*) FROM assets a WHERE a.project_id = p.id) AS asset_count,
    (SELECT COUNT(*) FROM backups b WHERE b.project_id = p.id) AS backup_count
  FROM projects p
`

function toBackup(row: BackupRow): BackupSummary {
  const kind = row.kind === 'automatico' || row.kind === 'seguranca' ? row.kind : 'manual'
  return {
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    path: row.path,
    sizeBytes: row.size_bytes,
    kind,
    createdAt: row.created_at
  }
}

async function findProjectRow(id: string): Promise<ProjectRow> {
  const row = await queryOne<ProjectRow>(`${PROJECT_SELECT} WHERE p.id = ?`, [id])
  if (!row) throw new Error('Projeto não encontrado. Ele pode ter sido removido.')
  return row
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base)
  let candidate = root
  let counter = 2

  // Garante que o nome da pasta não colida com outro projeto nem com uma pasta
  // que o usuário já tenha criado na área de trabalho.
  const settings = await readSettings()
  while (true) {
    const taken = await queryOne<{ id: string }>('SELECT id FROM projects WHERE slug = ?', [candidate])
    if (!taken && !pathExists(join(settings.workspaceRoot, candidate))) return candidate
    candidate = `${root}-${counter}`
    counter += 1
  }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const rows = await queryAll<ProjectRow>(
    `${PROJECT_SELECT} ORDER BY COALESCE(p.last_opened_at, p.updated_at) DESC`
  )
  return rows.map((row) => toSummary(row, isDirectory(row.path) ? directorySize(row.path) : 0))
}

export async function getProject(id: string): Promise<ProjectSummary> {
  const row = await findProjectRow(id)
  return toSummary(row, isDirectory(row.path) ? directorySize(row.path) : 0)
}

export async function createProject(input: CreateProjectInput): Promise<ProjectSummary> {
  const name = input.name.trim()
  if (name.length < 2) {
    throw new Error('O nome do projeto precisa ter pelo menos 2 caracteres.')
  }
  if (name.length > 60) {
    throw new Error('O nome do projeto pode ter no máximo 60 caracteres.')
  }

  const settings = await readSettings()
  const workspaceRoot = settings.workspaceRoot
  ensureDir(workspaceRoot)

  const slug = await uniqueSlug(name)
  const projectPath = join(workspaceRoot, slug)

  if (pathExists(projectPath)) {
    throw new Error(`A pasta "${slug}" já existe. Escolha outro nome para o projeto.`)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const description = (input.description ?? '').trim()

  const manifest = buildManifest({
    id,
    name,
    description,
    studioVersion: ctx().studioVersion,
    createdAt: now
  })

  try {
    ensureDir(projectPath)
    writeProjectFiles(projectPath, manifest)
  } catch (error) {
    throw new Error(
      `Não foi possível criar a pasta do projeto em "${projectPath}". Detalhe: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  await execute(
    `INSERT INTO projects (id, name, slug, description, path, status, created_at, updated_at, last_opened_at)
     VALUES (?, ?, ?, ?, ?, 'ativo', ?, ?, ?)`,
    [id, name, slug, description, projectPath, now, now, now]
  )

  await logActivity(id, 'projeto.criado', `Projeto "${name}" criado em ${projectPath}`)

  if (!settings.activeProjectId) {
    await updateSettings({ activeProjectId: id })
  }

  return getProject(id)
}

export async function updateProject(id: string, patch: UpdateProjectInput): Promise<ProjectSummary> {
  const row = await findProjectRow(id)
  const name = patch.name !== undefined ? patch.name.trim() : row.name
  if (name.length < 2) {
    throw new Error('O nome do projeto precisa ter pelo menos 2 caracteres.')
  }

  const description = patch.description !== undefined ? patch.description.trim() : row.description
  const status: ProjectStatus =
    patch.status === 'arquivado' || patch.status === 'ativo'
      ? patch.status
      : (row.status as ProjectStatus)

  const now = new Date().toISOString()
  await execute(
    'UPDATE projects SET name = ?, description = ?, status = ?, updated_at = ? WHERE id = ?',
    [name, description, status, now, id]
  )

  if (isDirectory(row.path)) {
    try {
      const manifest = buildManifest({
        id,
        name,
        description,
        studioVersion: ctx().studioVersion,
        createdAt: row.created_at
      })
      writeManifest(row.path, manifest)
    } catch {
      // O projeto continua válido mesmo se o arquivo de descrição não puder
      // ser atualizado (por exemplo, pasta somente leitura).
    }
  }

  await logActivity(id, 'projeto.atualizado', `Projeto "${name}" atualizado`)
  return getProject(id)
}

export async function openProject(id: string): Promise<ProjectSummary> {
  const row = await findProjectRow(id)
  const now = new Date().toISOString()
  await execute('UPDATE projects SET last_opened_at = ? WHERE id = ?', [now, id])
  await updateSettings({ activeProjectId: id })

  if (!isDirectory(row.path)) {
    throw new Error(
      `A pasta deste projeto não foi encontrada em "${row.path}". Verifique se ela foi movida ou renomeada.`
    )
  }

  return getProject(id)
}

async function copyProjectToBackup(
  project: ProjectRow,
  label: string,
  kind: BackupSummary['kind'],
  operationId: string
): Promise<BackupSummary> {
  const createdAt = new Date().toISOString()
  const targetDir = projectBackupsDir(project.id)
  ensureDir(targetDir)

  const backupId = crypto.randomUUID()
  const backupPath = join(targetDir, `${timestampSlug()}_${backupId.slice(0, 6)}`)

  emitProgress(operationId, `Copiando arquivos de "${project.name}"`, 5)
  copyDirectory(project.path, backupPath, (percent) => {
    emitProgress(operationId, `Copiando arquivos de "${project.name}"`, 5 + percent * 0.9)
  })

  const sizeBytes = directorySize(backupPath)
  await execute(
    `INSERT INTO backups (id, project_id, label, path, size_bytes, kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [backupId, project.id, label, backupPath, sizeBytes, kind, createdAt]
  )
  emitProgress(operationId, 'Backup concluído', 100, true)

  return {
    id: backupId,
    projectId: project.id,
    label,
    path: backupPath,
    sizeBytes,
    kind,
    createdAt
  }
}

export async function backupProject(id: string, label?: string): Promise<BackupSummary> {
  const row = await findProjectRow(id)
  if (!isDirectory(row.path)) {
    throw new Error(`A pasta do projeto não foi encontrada em "${row.path}".`)
  }

  const operationId = crypto.randomUUID()
  const backupLabel = (label ?? '').trim() || `Backup manual ${new Date().toLocaleString('pt-BR')}`
  const backup = await copyProjectToBackup(row, backupLabel, 'manual', operationId)

  await logActivity(id, 'backup.criado', `Backup "${backupLabel}" criado (${backup.path})`)
  await enforceBackupLimit(id)
  return backup
}

/**
 * Mantém o limite de backups automáticos.
 * Backups manuais nunca são reciclados; apenas os automáticos/segurança excedentes
 * são movidos para a lixeira interna do Studio.
 */
async function enforceBackupLimit(projectId: string): Promise<void> {
  const settings = await readSettings()
  const rows = await queryAll<BackupRow>(
    "SELECT * FROM backups WHERE project_id = ? AND kind <> 'manual' ORDER BY created_at DESC",
    [projectId]
  )

  for (const row of rows.slice(settings.maxBackups)) {
    try {
      moveToTrash(
        row.path,
        join(ctx().trashDir, 'backups'),
        `${pathName(row.path)}-${row.id.slice(0, 6)}`
      )
    } catch {
      // Se não for possível mover, mantemos o arquivo e o registro.
      continue
    }
    await execute('DELETE FROM backups WHERE id = ?', [row.id])
  }
}

function pathName(fullPath: string): string {
  const parts = fullPath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? 'backup'
}

export async function listBackups(projectId: string): Promise<BackupSummary[]> {
  const rows = await queryAll<BackupRow>(
    'SELECT * FROM backups WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  )
  return rows.map(toBackup)
}

export async function restoreBackup(backupId: string): Promise<RestoreResult> {
  const backupRow = await queryOne<BackupRow>('SELECT * FROM backups WHERE id = ?', [backupId])
  if (!backupRow) throw new Error('Backup não encontrado.')

  const project = await findProjectRow(backupRow.project_id)
  if (!isDirectory(backupRow.path)) {
    throw new Error(`Os arquivos deste backup não estão mais em "${backupRow.path}".`)
  }

  const operationId = crypto.randomUUID()
  emitProgress(operationId, 'Criando backup de segurança', 5)

  // 1) Backup de segurança do estado atual (quando existe algo para salvar).
  const safetyBackup: BackupSummary | null = isDirectory(project.path)
    ? await copyProjectToBackup(
        project,
        `Antes de restaurar (${new Date().toLocaleString('pt-BR')})`,
        'seguranca',
        operationId
      )
    : null

  // 2) O projeto atual vai para a lixeira interna (nunca é apagado).
  emitProgress(operationId, 'Preparando restauração', 55)
  if (isDirectory(project.path)) {
    ensureDir(ctx().trashDir)
    moveToTrash(project.path, join(ctx().trashDir, 'projetos'), `${project.slug}-${timestampSlug()}`)
  }

  // 3) O conteúdo do backup volta para o lugar do projeto.
  emitProgress(operationId, 'Restaurando arquivos', 65)
  copyDirectory(backupRow.path, project.path, (percent) => {
    emitProgress(operationId, 'Restaurando arquivos', 65 + percent * 0.3)
  })

  await execute('UPDATE projects SET updated_at = ? WHERE id = ?', [
    new Date().toISOString(),
    project.id
  ])
  await logActivity(
    project.id,
    'backup.restaurado',
    `Projeto "${project.name}" restaurado a partir de ${backupRow.label}`
  )
  emitProgress(operationId, 'Restauração concluída', 100, true)

  return { restoredFrom: toBackup(backupRow), safetyBackup }
}

export async function duplicateProject(id: string, newName?: string): Promise<ProjectSummary> {
  const row = await findProjectRow(id)
  if (!isDirectory(row.path)) {
    throw new Error(`A pasta do projeto não foi encontrada em "${row.path}".`)
  }

  const name = (newName ?? '').trim() || `${row.name} (cópia)`
  const slug = await uniqueSlug(name)
  const settings = await readSettings()
  const newPath = join(settings.workspaceRoot, slug)
  const newId = crypto.randomUUID()
  const operationId = crypto.randomUUID()

  emitProgress(operationId, `Duplicando "${row.name}"`, 5)
  copyDirectory(row.path, newPath, (percent) => {
    emitProgress(operationId, `Duplicando "${row.name}"`, 5 + percent * 0.85)
  })

  const now = new Date().toISOString()
  const manifest = buildManifest({
    id: newId,
    name,
    description: row.description,
    studioVersion: ctx().studioVersion,
    createdAt: now
  })
  writeManifest(newPath, manifest)

  await execute(
    `INSERT INTO projects (id, name, slug, description, path, status, created_at, updated_at, last_opened_at)
     VALUES (?, ?, ?, ?, ?, 'ativo', ?, ?, NULL)`,
    [newId, name, slug, row.description, newPath, now, now]
  )

  // Duplica também os registros de recursos que pertenciam ao projeto original.
  const assets = await queryAll<{
    id: string
    kind: string
    name: string
    origin: string
    relative_path: string | null
    data: string
  }>('SELECT id, kind, name, origin, relative_path, data FROM assets WHERE project_id = ?', [id])

  for (const asset of assets) {
    await execute(
      `INSERT INTO assets (id, project_id, kind, name, origin, relative_path, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        newId,
        asset.kind,
        asset.name,
        asset.origin,
        asset.relative_path,
        asset.data,
        now,
        now
      ]
    )
  }

  await logActivity(newId, 'projeto.duplicado', `Projeto "${name}" criado a partir de "${row.name}"`)
  emitProgress(operationId, 'Duplicação concluída', 100, true)

  return getProject(newId)
}

export async function removeProject(id: string, deleteFiles: boolean): Promise<void> {
  const row = await findProjectRow(id)
  const settings = await readSettings()

  if (deleteFiles && isDirectory(row.path)) {
    moveToTrash(row.path, join(ctx().trashDir, 'projetos'), `${row.slug}-${timestampSlug()}`)
  }

  const backupDir = projectBackupsDir(id)
  if (isDirectory(backupDir)) {
    moveToTrash(backupDir, join(ctx().trashDir, 'backups'), `${row.slug}-${timestampSlug()}`)
  }

  await execute('DELETE FROM projects WHERE id = ?', [id])
  await logActivity(null, 'projeto.removido', `Projeto "${row.name}" removido do Studio`)

  if (settings.activeProjectId === id) {
    const next = await queryOne<{ id: string }>(
      'SELECT id FROM projects ORDER BY updated_at DESC LIMIT 1'
    )
    await updateSettings({ activeProjectId: next?.id ?? null })
  }
}

