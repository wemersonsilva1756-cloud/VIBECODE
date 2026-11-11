import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { IPC, type IpcResult, type StudioPaths, type StudioSettings } from '@shared/contract'
import type { AnimationConfig } from '@shared/animations'
import {
  applyGodotExport,
  backupProject,
  listAnimations,
  previewAnimation,
  removeAnimation,
  saveAnimation,
  buildGodotExportPlan,
  createProject,
  interpretDescription,
  listCharacters,
  previewCharacter,
  removeCharacter,
  saveCharacter,
  createProjectFolder,
  duplicateProject,
  getProject,
  getProjectGodotState,
  getStats,
  importFilesIntoProject,
  inspectGodotProject,
  linkProjectToGodot,
  listActivity,
  listBackups,
  listProjectDirectory,
  listProjects,
  openProject,
  previewProjectFile,
  readGodotExecutable,
  readSettings,
  removeGodotLink,
  removeProject,
  resolveInside,
  restoreBackup,
  setGodotExecutable,
  setProgressEmitter,
  trashProjectItem,
  updateProject,
  updateSettings
} from './core'

/**
 * Ponte entre a interface (renderer) e o backend local.
 *
 * - Toda chamada devolve um envelope `{ ok, data | message }`.
 * - Os argumentos vindos da interface são validados antes de chegar aos serviços.
 * - Somente a janela do próprio Studio pode chamar estes canais.
 */

export interface IpcContext {
  dataDir: string
  dbPath: string
  appVersion: string
  rendererOrigin: () => string | null
  onSmokeReady?: () => void
}

let context: IpcContext | null = null

function ctx(): IpcContext {
  if (!context) throw new Error('IPC não inicializado.')
  return context
}

function isTrustedSender(senderUrl: string | undefined): boolean {
  if (!senderUrl) return false
  const allowed = ctx().rendererOrigin()
  if (!allowed) return true
  return senderUrl.startsWith(allowed)
}

function handle<T>(
  channel: string,
  handler: (...args: unknown[]) => Promise<T> | T
): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]): Promise<IpcResult<T>> => {
    try {
      if (!isTrustedSender(event.senderFrame?.url)) {
        return { ok: false, message: 'Origem não autorizada.' }
      }
      const data = await handler(...args)
      return { ok: true, data }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Ocorreu um erro inesperado. Tente novamente.'
      console.error(`[IPC] ${channel}:`, error)
      return { ok: false, message }
    }
  })
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Parâmetro inválido: ${field}.`)
  }
  return value
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function sanitizeSettingsPatch(value: unknown): Partial<StudioSettings> {
  if (!value || typeof value !== 'object') return {}
  const input = value as Record<string, unknown>
  const patch: Partial<StudioSettings> = {}

  if (typeof input['workspaceRoot'] === 'string' && input['workspaceRoot'].trim()) {
    patch.workspaceRoot = input['workspaceRoot']
  }
  if (typeof input['onboardingDone'] === 'boolean') {
    patch.onboardingDone = input['onboardingDone']
  }
  if (typeof input['maxBackups'] === 'number' && Number.isFinite(input['maxBackups'])) {
    patch.maxBackups = Math.max(1, Math.min(100, Math.round(input['maxBackups'])))
  }
  if (typeof input['lastOpenedPage'] === 'string') {
    patch.lastOpenedPage = input['lastOpenedPage']
  }
  if (typeof input['godotExecutable'] === 'string') {
    patch.godotExecutable = input['godotExecutable']
  }
  if (input['activeProjectId'] === null || typeof input['activeProjectId'] === 'string') {
    patch.activeProjectId = input['activeProjectId'] as string | null
  }

  return patch
}

export function registerIpcHandlers(ipcContext: IpcContext): void {
  context = ipcContext

  setProgressEmitter((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC.eventProgress, event)
    }
  })

  // ---------------------------------------------------------------- aplicativo
  handle<StudioPaths>(IPC.appPaths, async () => {
    const settings = await readSettings()
    return {
      dataDir: ctx().dataDir,
      dbPath: ctx().dbPath,
      workspaceRoot: settings.workspaceRoot,
      backupsDir: join(ctx().dataDir, 'backups'),
      appVersion: ctx().appVersion
    }
  })

  handle<null>(IPC.appOpenDataFolder, async () => {
    const error = await shell.openPath(ctx().dataDir)
    if (error) throw new Error(`Não foi possível abrir a pasta de dados: ${error}`)
    return null
  })

  handle<null>(IPC.appOpenProjectFolder, async (projectId) => {
    const project = await getProject(requireString(projectId, 'projectId'))
    if (!project.folderExists) {
      throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
    }
    const error = await shell.openPath(project.path)
    if (error) throw new Error(`Não foi possível abrir a pasta: ${error}`)
    return null
  })

  ipcMain.on(IPC.appSmokeReady, (event) => {
    if (!isTrustedSender(event.senderFrame?.url)) return
    ctx().onSmokeReady?.()
  })

  // ---------------------------------------------------------------- preferências
  handle<StudioSettings>(IPC.settingsGet, async () => readSettings())

  handle<StudioSettings>(IPC.settingsUpdate, async (patch) =>
    updateSettings(sanitizeSettingsPatch(patch))
  )

  handle<StudioSettings | null>(IPC.settingsChooseWorkspace, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Escolha a pasta onde os projetos serão salvos',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Usar esta pasta'
    })
    if (result.canceled || !result.filePaths[0]) return null
    const workspaceRoot = result.filePaths[0]
    return updateSettings({ workspaceRoot })
  })

  handle<StudioSettings>(IPC.settingsResetOnboarding, async () =>
    updateSettings({ onboardingDone: false })
  )

  // ---------------------------------------------------------------- projetos
  handle(IPC.projectsList, async () => listProjects())

  handle(IPC.projectsCreate, async (input) => {
    if (!input || typeof input !== 'object') throw new Error('Dados do projeto inválidos.')
    const data = input as Record<string, unknown>
    return createProject({
      name: requireString(data['name'], 'nome'),
      description: optionalString(data['description']) ?? ''
    })
  })

  handle(IPC.projectsGet, async (id) => getProject(requireString(id, 'id')))

  handle(IPC.projectsUpdate, async (id, patch) => {
    if (!patch || typeof patch !== 'object') throw new Error('Dados inválidos.')
    const data = patch as Record<string, unknown>
    return updateProject(requireString(id, 'id'), {
      name: optionalString(data['name']),
      description: optionalString(data['description']),
      status:
        data['status'] === 'arquivado' || data['status'] === 'ativo' ? data['status'] : undefined
    })
  })

  handle(IPC.projectsOpen, async (id) => openProject(requireString(id, 'id')))

  handle(IPC.projectsDuplicate, async (id, newName) =>
    duplicateProject(requireString(id, 'id'), optionalString(newName))
  )

  handle<null>(IPC.projectsRemove, async (id, deleteFiles) => {
    await removeProject(requireString(id, 'id'), deleteFiles === true)
    return null
  })

  handle(IPC.projectsBackup, async (id, label) =>
    backupProject(requireString(id, 'id'), optionalString(label))
  )

  handle(IPC.projectsListBackups, async (id) => listBackups(requireString(id, 'id')))

  handle(IPC.projectsRestoreBackup, async (backupId) =>
    restoreBackup(requireString(backupId, 'backupId'))
  )

  // ---------------------------------------------------------------- histórico
  handle(IPC.activityList, async (limit) =>
    listActivity(typeof limit === 'number' ? limit : 30)
  )

  handle(IPC.statsGet, async () => getStats())

  // ---------------------------------------------------------------- arquivos
  handle(IPC.filesList, async (projectId, relativePath) =>
    listProjectDirectory(
      requireString(projectId, 'projectId'),
      optionalString(relativePath) ?? ''
    )
  )

  handle(IPC.filesPreview, async (projectId, relativePath) =>
    previewProjectFile(
      requireString(projectId, 'projectId'),
      requireString(relativePath, 'caminho')
    )
  )

  handle(IPC.filesImport, async (projectId, relativePath) => {
    const id = requireString(projectId, 'projectId')
    const project = await getProject(id)
    const result = await dialog.showOpenDialog({
      title: 'Escolha arquivos ou pastas para copiar para o projeto',
      defaultPath: project.path,
      properties: ['openFile', 'openDirectory', 'multiSelections'],
      buttonLabel: 'Copiar para o projeto'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return importFilesIntoProject(id, optionalString(relativePath) ?? '', result.filePaths)
  })

  handle(IPC.filesCreateFolder, async (projectId, relativePath, name) =>
    createProjectFolder(
      requireString(projectId, 'projectId'),
      optionalString(relativePath) ?? '',
      requireString(name, 'nome')
    )
  )

  handle<null>(IPC.filesTrash, async (projectId, relativePath) => {
    await trashProjectItem(
      requireString(projectId, 'projectId'),
      requireString(relativePath, 'caminho'),
      join(ctx().dataDir, 'lixeira')
    )
    return null
  })

  handle<null>(IPC.filesOpenFolder, async (projectId, relativePath) => {
    const id = requireString(projectId, 'projectId')
    const project = await getProject(id)
    const target = resolveInside(project.path, optionalString(relativePath) ?? '')
    const error = await shell.openPath(target)
    if (error) throw new Error(`Não foi possível abrir a pasta: ${error}`)
    return null
  })

  // ---------------------------------------------------------------- Godot 4
  handle(IPC.godotState, async (projectId) => {
    const settings = await readSettings()
    return getProjectGodotState(
      requireString(projectId, 'projectId'),
      readGodotExecutable(settings.godotExecutable)
    )
  })

  handle(IPC.godotLink, async (projectId) => {
    const id = requireString(projectId, 'projectId')
    const result = await dialog.showOpenDialog({
      title: 'Escolha a pasta do projeto Godot (a que contém project.godot)',
      properties: ['openDirectory'],
      buttonLabel: 'Vincular projeto'
    })
    if (result.canceled || !result.filePaths[0]) return null

    const info = inspectGodotProject(result.filePaths[0])
    if (!info.valid) throw new Error(info.problem ?? 'Projeto Godot inválido.')
    return linkProjectToGodot(id, result.filePaths[0])
  })

  handle(IPC.godotUnlink, async (projectId) => {
    const id = requireString(projectId, 'projectId')
    await removeGodotLink(id)
    const settings = await readSettings()
    return getProjectGodotState(id, readGodotExecutable(settings.godotExecutable))
  })

  handle(IPC.godotPlan, async (projectId) =>
    buildGodotExportPlan(requireString(projectId, 'projectId'))
  )

  handle(IPC.godotExport, async (projectId) =>
    applyGodotExport(requireString(projectId, 'projectId'))
  )

  handle(IPC.godotChooseExecutable, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Escolha o executável da Godot 4 (opcional)',
      properties: ['openFile'],
      buttonLabel: 'Usar este executável',
      filters:
        process.platform === 'win32'
          ? [{ name: 'Executável', extensions: ['exe'] }]
          : [{ name: 'Todos os arquivos', extensions: ['*'] }]
    })
    if (result.canceled || !result.filePaths[0]) {
      const settings = await readSettings()
      return readGodotExecutable(settings.godotExecutable)
    }

    const info = readGodotExecutable(result.filePaths[0])
    if (info.ok) await setGodotExecutable(result.filePaths[0])
    return info
  })

  handle(IPC.godotCheckExecutable, async () => {
    const settings = await readSettings()
    return readGodotExecutable(settings.godotExecutable)
  })

  // ------------------------------------------------- personagens e monstros
  handle(IPC.charactersPreview, async (spec) => {
    if (!spec || typeof spec !== 'object') throw new Error('Dados do sprite inválidos.')
    return previewCharacter(spec as Parameters<typeof previewCharacter>[0])
  })

  handle(IPC.charactersInterpret, async (description) =>
    interpretDescription(typeof description === 'string' ? description : '')
  )

  handle(IPC.charactersSave, async (projectId, spec) => {
    if (!spec || typeof spec !== 'object') throw new Error('Dados do sprite inválidos.')
    return saveCharacter(
      requireString(projectId, 'projectId'),
      spec as Parameters<typeof saveCharacter>[1]
    )
  })

  handle(IPC.charactersList, async (projectId, category) =>
    listCharacters(
      requireString(projectId, 'projectId'),
      category === 'monstro' || category === 'personagem' ? category : undefined
    )
  )

  handle<null>(IPC.charactersRemove, async (assetId) => {
    await removeCharacter(requireString(assetId, 'assetId'))
    return null
  })

  // ------------------------------------------------------------- animações
  handle(IPC.animationsPreview, async (config) => {
    if (!config || typeof config !== 'object') throw new Error('Dados da animação inválidos.')
    return previewAnimation(config as AnimationConfig)
  })

  handle(IPC.animationsSave, async (projectId, config) => {
    if (!config || typeof config !== 'object') throw new Error('Dados da animação inválidos.')
    return saveAnimation(requireString(projectId, 'projectId'), config as AnimationConfig)
  })

  handle(IPC.animationsList, async (projectId) =>
    listAnimations(requireString(projectId, 'projectId'))
  )

  handle<null>(IPC.animationsRemove, async (assetId) => {
    await removeAnimation(requireString(assetId, 'assetId'))
    return null
  })
}

export function unregisterIpcHandlers(): void {
  setProgressEmitter(null)
  for (const channel of Object.values(IPC)) {
    if (channel === IPC.appSmokeReady || channel === IPC.eventProgress) continue
    ipcMain.removeHandler(channel)
  }
  context = null
}
