import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient, type Client } from '@libsql/client'

/**
 * Camada de banco de dados local (SQLite).
 *
 * O arquivo fica em `%APPDATA%/Pixel Strike Studio/studio.db` (ou em um diretório
 * temporário durante os testes automatizados). Nenhum dado do usuário é enviado
 * para fora da máquina.
 */

export type SqlValue = string | number | null

let client: Client | null = null
let currentDbPath = ''

function toFileUrl(dbPath: string): string {
  return `file:${dbPath.replace(/\\/g, '/')}`
}

interface Migration {
  version: number
  statements: string[]
}

/**
 * Migrações são aplicadas em ordem e nunca são editadas depois de publicadas.
 * Para mudar o esquema, adicione uma nova entrada no final da lista.
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        path TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'ativo',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_opened_at TEXT
      )`,
      `CREATE TABLE assets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        origin TEXT NOT NULL DEFAULT 'gerado',
        relative_path TEXT,
        data TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX idx_assets_project ON assets(project_id, kind)`,
      `CREATE TABLE backups (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        kind TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX idx_backups_project ON backups(project_id, created_at DESC)`,
      `CREATE TABLE activity (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX idx_activity_created ON activity(created_at DESC)`
    ]
  },
  {
    version: 2,
    statements: [
      `CREATE TABLE godot_links (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        linked_at TEXT NOT NULL,
        last_export_at TEXT
      )`
    ]
  }
]

async function migrate(db: Client): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`
  )

  const applied = await db.execute('SELECT version FROM schema_migrations ORDER BY version')
  const appliedVersions = new Set(applied.rows.map((row) => Number(row['version'])))

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue

    for (const statement of migration.statements) {
      await db.execute(statement)
    }
    await db.execute({
      sql: 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      args: [migration.version, new Date().toISOString()]
    })
  }
}

export async function openDatabase(dbPath: string): Promise<Client> {
  if (client) {
    throw new Error('O banco de dados já foi aberto. Feche antes de abrir novamente.')
  }

  mkdirSync(dirname(dbPath), { recursive: true })
  const db = createClient({ url: toFileUrl(dbPath) })

  await db.execute('PRAGMA journal_mode = WAL')
  await db.execute('PRAGMA foreign_keys = ON')
  await migrate(db)

  client = db
  currentDbPath = dbPath
  return db
}

export function getDatabase(): Client {
  if (!client) {
    throw new Error('Banco de dados não inicializado.')
  }
  return client
}

export function getDatabasePath(): string {
  return currentDbPath
}

export async function closeDatabase(): Promise<void> {
  if (!client) return
  client.close()
  client = null
  currentDbPath = ''
}

/** Lê várias linhas já tipadas. */
export async function queryAll<T>(sql: string, args: SqlValue[] = []): Promise<T[]> {
  const result = await getDatabase().execute({ sql, args })
  return result.rows as unknown as T[]
}

/** Lê uma única linha, ou null quando não existe. */
export async function queryOne<T>(sql: string, args: SqlValue[] = []): Promise<T | null> {
  const rows = await queryAll<T>(sql, args)
  return rows[0] ?? null
}

/** Executa uma instrução de escrita. */
export async function execute(sql: string, args: SqlValue[] = []): Promise<void> {
  await getDatabase().execute({ sql, args })
}
