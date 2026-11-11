import type {
  CharacterAsset,
  CharacterCategory,
  CharacterDirection,
  CharacterSpec,
  DescriptionSuggestion
} from './characters'
import type { AnimationAsset, AnimationConfig, AnimationPreview } from './animations'

/**
 * Contrato compartilhado entre o processo principal (Node) e a interface (React).
 * Tudo aqui é serializável: nenhuma função, classe ou objeto nativo atravessa o IPC.
 */

export type ProjectStatus = 'ativo' | 'arquivado'

export interface ProjectSummary {
  id: string
  name: string
  slug: string
  description: string
  path: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  lastOpenedAt: string | null
  assetCount: number
  backupCount: number
  sizeBytes: number
  folderExists: boolean
}

export interface BackupSummary {
  id: string
  projectId: string
  label: string
  path: string
  sizeBytes: number
  kind: 'manual' | 'automatico' | 'seguranca'
  createdAt: string
}

export interface ActivityEntry {
  id: string
  projectId: string | null
  type: string
  message: string
  createdAt: string
}

export interface StudioSettings {
  workspaceRoot: string
  activeProjectId: string | null
  onboardingDone: boolean
  maxBackups: number
  lastOpenedPage: string
  /** Caminho do executável da Godot 4 (opcional, só para conferir a versão). */
  godotExecutable: string
}

export interface StudioPaths {
  dataDir: string
  dbPath: string
  workspaceRoot: string
  backupsDir: string
  appVersion: string
}

export interface StudioStats {
  projectCount: number
  backupCount: number
  assetCount: number
  totalSizeBytes: number
  activeProjectName: string | null
}

export interface CreateProjectInput {
  name: string
  description?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  status?: ProjectStatus
}

export interface RestoreResult {
  restoredFrom: BackupSummary
  safetyBackup: BackupSummary | null
}

/* ------------------------------------------------------- gerenciador de arquivos */

export type FileCategory =
  | 'pasta'
  | 'imagem'
  | 'audio'
  | 'cena'
  | 'codigo'
  | 'dados'
  | 'texto'
  | 'outro'

export interface FileEntry {
  name: string
  relativePath: string
  isDirectory: boolean
  sizeBytes: number
  modifiedAt: string
  category: FileCategory
  extension: string
  childCount: number
}

export interface FilePreview {
  relativePath: string
  name: string
  category: FileCategory
  sizeBytes: number
  modifiedAt: string
  text: string | null
  dataUrl: string | null
  truncated: boolean
}

export interface ImportedFile {
  name: string
  relativePath: string
}

export interface ImportFilesResult {
  imported: ImportedFile[]
  renamed: ImportedFile[]
  skipped: Array<{ name: string; reason: string }>
}

/* ---------------------------------------------------------------- Godot 4 */

export interface GodotProjectInfo {
  path: string
  valid: boolean
  problem: string | null
  name: string
  engineVersion: string | null
  configVersion: number | null
  features: string[]
  mainScene: string | null
  autoloads: string[]
  counts: {
    scenes: number
    scripts: number
    images: number
    resources: number
    other: number
  }
  scenes: string[]
  scripts: string[]
}

export interface GodotLink {
  path: string
  linkedAt: string
  lastExportAt: string | null
}

export interface GodotExecutableInfo {
  path: string | null
  version: string | null
  ok: boolean
  message: string
}

export interface ProjectGodotState {
  link: GodotLink | null
  info: GodotProjectInfo | null
  executable: GodotExecutableInfo
}

export type GodotPlanAction = 'criar' | 'sobrescrever' | 'igual'

export interface GodotFilePlan {
  relativePath: string
  action: GodotPlanAction
  bytes: number
  language: 'gdscript' | 'json' | 'markdown' | 'binario'
  preview: string | null
}

export interface GodotExportPlan {
  targetPath: string
  files: GodotFilePlan[]
  assetCount: number
  warnings: string[]
}

export interface GodotExportResult {
  written: number
  unchanged: number
  backupPath: string | null
  targetPath: string
}

export interface ProgressEvent {
  operationId: string
  label: string
  percent: number
  done: boolean
}

/**
 * Envelope de resposta usado em todo o IPC.
 * Em caso de erro, `message` já vem em português e pronta para exibição.
 */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; message: string }

export interface StudioApi {
  app: {
    paths(): Promise<StudioPaths>
    openDataFolder(): Promise<void>
    openProjectFolder(projectId: string): Promise<void>
    smokeTestReady(): void
  }
  settings: {
    get(): Promise<StudioSettings>
    update(patch: Partial<StudioSettings>): Promise<StudioSettings>
    chooseWorkspace(): Promise<StudioSettings | null>
    resetOnboarding(): Promise<StudioSettings>
  }
  projects: {
    list(): Promise<ProjectSummary[]>
    create(input: CreateProjectInput): Promise<ProjectSummary>
    get(id: string): Promise<ProjectSummary>
    update(id: string, patch: UpdateProjectInput): Promise<ProjectSummary>
    open(id: string): Promise<ProjectSummary>
    duplicate(id: string, newName?: string): Promise<ProjectSummary>
    remove(id: string, deleteFiles: boolean): Promise<void>
    backup(id: string, label?: string): Promise<BackupSummary>
    listBackups(id: string): Promise<BackupSummary[]>
    restoreBackup(backupId: string): Promise<RestoreResult>
  }
  activity: {
    list(limit?: number): Promise<ActivityEntry[]>
  }
  stats: {
    get(): Promise<StudioStats>
  }
  files: {
    list(projectId: string, relativePath: string): Promise<FileEntry[]>
    preview(projectId: string, relativePath: string): Promise<FilePreview>
    importFiles(projectId: string, relativePath: string): Promise<ImportFilesResult | null>
    createFolder(projectId: string, relativePath: string, name: string): Promise<FileEntry>
    trash(projectId: string, relativePath: string): Promise<void>
    openFolder(projectId: string, relativePath: string): Promise<void>
  }
  characters: {
    preview(spec: CharacterSpec): Promise<Partial<Record<CharacterDirection, string>>>
    interpret(description: string): Promise<DescriptionSuggestion>
    save(projectId: string, spec: CharacterSpec): Promise<CharacterAsset>
    list(projectId: string, category?: CharacterCategory): Promise<CharacterAsset[]>
    remove(assetId: string): Promise<void>
  }
  animations: {
    preview(config: AnimationConfig): Promise<AnimationPreview>
    save(projectId: string, config: AnimationConfig): Promise<AnimationAsset>
    list(projectId: string): Promise<AnimationAsset[]>
    remove(assetId: string): Promise<void>
  }
  godot: {
    state(projectId: string): Promise<ProjectGodotState>
    link(projectId: string): Promise<ProjectGodotState | null>
    unlink(projectId: string): Promise<ProjectGodotState>
    plan(projectId: string): Promise<GodotExportPlan>
    exportProject(projectId: string): Promise<GodotExportResult>
    chooseExecutable(): Promise<GodotExecutableInfo>
    checkExecutable(): Promise<GodotExecutableInfo>
  }
  events: {
    onProgress(callback: (event: ProgressEvent) => void): () => void
  }
}

export const IPC = {
  appPaths: 'studio:app:paths',
  appOpenDataFolder: 'studio:app:open-data-folder',
  appOpenProjectFolder: 'studio:app:open-project-folder',
  appSmokeReady: 'studio:app:smoke-ready',
  settingsGet: 'studio:settings:get',
  settingsUpdate: 'studio:settings:update',
  settingsChooseWorkspace: 'studio:settings:choose-workspace',
  settingsResetOnboarding: 'studio:settings:reset-onboarding',
  projectsList: 'studio:projects:list',
  projectsCreate: 'studio:projects:create',
  projectsGet: 'studio:projects:get',
  projectsUpdate: 'studio:projects:update',
  projectsOpen: 'studio:projects:open',
  projectsDuplicate: 'studio:projects:duplicate',
  projectsRemove: 'studio:projects:remove',
  projectsBackup: 'studio:projects:backup',
  projectsListBackups: 'studio:projects:list-backups',
  projectsRestoreBackup: 'studio:projects:restore-backup',
  activityList: 'studio:activity:list',
  statsGet: 'studio:stats:get',
  filesList: 'studio:files:list',
  filesPreview: 'studio:files:preview',
  filesImport: 'studio:files:import',
  filesCreateFolder: 'studio:files:create-folder',
  filesTrash: 'studio:files:trash',
  filesOpenFolder: 'studio:files:open-folder',
  godotState: 'studio:godot:state',
  godotLink: 'studio:godot:link',
  godotUnlink: 'studio:godot:unlink',
  godotPlan: 'studio:godot:plan',
  godotExport: 'studio:godot:export',
  godotChooseExecutable: 'studio:godot:choose-executable',
  godotCheckExecutable: 'studio:godot:check-executable',
  charactersPreview: 'studio:characters:preview',
  charactersInterpret: 'studio:characters:interpret',
  charactersSave: 'studio:characters:save',
  charactersList: 'studio:characters:list',
  charactersRemove: 'studio:characters:remove',
  animationsPreview: 'studio:animations:preview',
  animationsSave: 'studio:animations:save',
  animationsList: 'studio:animations:list',
  animationsRemove: 'studio:animations:remove',
  eventProgress: 'studio:event:progress'
} as const
