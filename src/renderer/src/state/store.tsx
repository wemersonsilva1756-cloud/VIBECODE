import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type {
  ActivityEntry,
  CreateProjectInput,
  ProgressEvent,
  ProjectSummary,
  StudioPaths,
  StudioSettings,
  StudioStats,
  UpdateProjectInput
} from '@shared/contract'
import type { Route } from '../navigation'

export type ToastKind = 'sucesso' | 'erro' | 'atencao' | 'info'

export interface ToastItem {
  id: string
  kind: ToastKind
  title: string
  description?: string
}

interface AppStore {
  booted: boolean
  fatalError: string | null
  settings: StudioSettings | null
  paths: StudioPaths | null
  projects: ProjectSummary[]
  stats: StudioStats | null
  activity: ActivityEntry[]
  activeProject: ProjectSummary | null
  progress: ProgressEvent | null
  busy: string | null
  route: Route
  toasts: ToastItem[]
  navigate: (route: Route) => void
  notify: (kind: ToastKind, title: string, description?: string) => void
  dismissToast: (id: string) => void
  refresh: () => Promise<void>
  refreshProjects: () => Promise<void>
  createProject: (input: CreateProjectInput) => Promise<ProjectSummary | null>
  openProject: (id: string) => Promise<ProjectSummary | null>
  duplicateProject: (id: string, newName?: string) => Promise<ProjectSummary | null>
  backupProject: (id: string, label?: string) => Promise<boolean>
  restoreBackup: (backupId: string) => Promise<boolean>
  removeProject: (id: string, deleteFiles: boolean) => Promise<boolean>
  updateProjectDetails: (id: string, patch: UpdateProjectInput) => Promise<boolean>
  updateSettings: (patch: Partial<StudioSettings>) => Promise<void>
  chooseWorkspace: () => Promise<void>
  completeOnboarding: () => Promise<void>
  resetOnboarding: () => Promise<void>
}

const AppContext = createContext<AppStore | null>(null)

/** Páginas que podem ser reabertas automaticamente ao iniciar o Studio. */
const RESTORABLE_ROUTES: Record<string, Route> = {
  painel: { name: 'painel' },
  projetos: { name: 'projetos' },
  arquivos: { name: 'arquivos' },
  configuracoes: { name: 'configuracoes' },
  ajuda: { name: 'ajuda' },
  roadmap: { name: 'roadmap' }
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Não foi possível concluir a operação. Tente novamente.'
}

export function AppProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [booted, setBooted] = useState(false)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [settings, setSettings] = useState<StudioSettings | null>(null)
  const [paths, setPaths] = useState<StudioPaths | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [stats, setStats] = useState<StudioStats | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [activeProject, setActiveProject] = useState<ProjectSummary | null>(null)
  const [progress, setProgress] = useState<ProgressEvent | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [route, setRoute] = useState<Route>({ name: 'painel' })
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const toastTimers = useRef<Map<string, number>>(new Map())
  const progressTimer = useRef<number | null>(null)

  const notify = useCallback((kind: ToastKind, title: string, description?: string) => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current.slice(-3), { id, kind, title, description }])
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
      toastTimers.current.delete(id)
    }, kind === 'erro' ? 9000 : 6000)
    toastTimers.current.set(id, timer)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = toastTimers.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      toastTimers.current.delete(id)
    }
  }, [])

  useEffect(() => {
    return () => {
      for (const timer of toastTimers.current.values()) window.clearTimeout(timer)
      if (progressTimer.current) window.clearTimeout(progressTimer.current)
    }
  }, [])

  const navigate = useCallback((next: Route) => {
    setRoute(next)
    if (next.name !== 'projeto' && next.name !== 'modulo') {
      setSettings((current) => (current ? { ...current, lastOpenedPage: next.name } : current))
      void window.studio?.settings
        .update({ lastOpenedPage: next.name })
        .catch(() => undefined)
    }
  }, [])

  const loadProjects = useCallback(async () => {
    const list = await window.studio.projects.list()
    setProjects(list)
    return list
  }, [])

  const refresh = useCallback(async () => {
    const [nextProjects, nextStats, nextActivity, nextSettings, nextPaths] = await Promise.all([
      window.studio.projects.list(),
      window.studio.stats.get(),
      window.studio.activity.list(12),
      window.studio.settings.get(),
      window.studio.app.paths()
    ])

    setProjects(nextProjects)
    setStats(nextStats)
    setActivity(nextActivity)
    setSettings(nextSettings)
    setPaths(nextPaths)

    const activeId = nextSettings.activeProjectId
    const active = activeId ? nextProjects.find((project) => project.id === activeId) ?? null : null
    setActiveProject(active)
  }, [])

  const refreshProjects = useCallback(async () => {
    const list = await loadProjects()
    const [nextStats, nextActivity] = await Promise.all([
      window.studio.stats.get(),
      window.studio.activity.list(12)
    ])
    setStats(nextStats)
    setActivity(nextActivity)
    setActiveProject((current) => {
      if (!current) return null
      return list.find((project) => project.id === current.id) ?? current
    })
  }, [loadProjects])

  // Carregamento inicial
  useEffect(() => {
    let cancelled = false

    async function boot(): Promise<void> {
      if (!window.studio) {
        setFatalError(
          'A interface do Pixel Strike Studio precisa ser executada dentro do aplicativo desktop. Abra o programa pelo executável do Studio.'
        )
        setBooted(true)
        return
      }

      try {
        await refresh()
        if (cancelled) return

        const saved = await window.studio.settings.get()
        const restored = RESTORABLE_ROUTES[saved.lastOpenedPage]
        if (restored) setRoute(restored)
      } catch (error) {
        if (!cancelled) setFatalError(messageOf(error))
      } finally {
        if (!cancelled) setBooted(true)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [refresh])

  // Progresso de operações longas vindo do processo principal
  useEffect(() => {
    if (!window.studio) return undefined
    return window.studio.events.onProgress((event) => {
      setProgress(event)
      if (progressTimer.current) window.clearTimeout(progressTimer.current)
      if (event.done || event.percent >= 100) {
        progressTimer.current = window.setTimeout(() => setProgress(null), 1500)
      }
    })
  }, [])

  const withBusy = useCallback(
    async <T,>(label: string, task: () => Promise<T>): Promise<T | null> => {
      setBusy(label)
      try {
        return await task()
      } catch (error) {
        notify('erro', 'Não foi possível concluir', messageOf(error))
        return null
      } finally {
        setBusy(null)
      }
    },
    [notify]
  )

  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<ProjectSummary | null> => {
      const result = await withBusy('Criando projeto', () => window.studio.projects.create(input))
      if (result) {
        await refresh()
        setActiveProject(result)
        notify('sucesso', 'Projeto criado', `"${result.name}" está pronto em ${result.path}`)
        navigate({ name: 'projeto', projectId: result.id })
      }
      return result
    },
    [withBusy, refresh, notify, navigate]
  )

  const openProject = useCallback(
    async (id: string): Promise<ProjectSummary | null> => {
      const result = await withBusy('Abrindo projeto', () => window.studio.projects.open(id))
      if (result) {
        setActiveProject(result)
        await refreshProjects()
        navigate({ name: 'projeto', projectId: result.id })
      }
      return result
    },
    [withBusy, refreshProjects, navigate]
  )

  const duplicateProject = useCallback(
    async (id: string, newName?: string): Promise<ProjectSummary | null> => {
      const result = await withBusy('Duplicando projeto', () =>
        window.studio.projects.duplicate(id, newName)
      )
      if (result) {
        await refreshProjects()
        notify('sucesso', 'Projeto duplicado', `Criado como "${result.name}"`)
      }
      return result
    },
    [withBusy, refreshProjects, notify]
  )

  const backupProject = useCallback(
    async (id: string, label?: string): Promise<boolean> => {
      const result = await withBusy('Criando backup', () =>
        window.studio.projects.backup(id, label)
      )
      if (result) {
        await refreshProjects()
        notify('sucesso', 'Backup concluído', result.path)
        return true
      }
      return false
    },
    [withBusy, refreshProjects, notify]
  )

  const restoreBackup = useCallback(
    async (backupId: string): Promise<boolean> => {
      const result = await withBusy('Restaurando backup', () =>
        window.studio.projects.restoreBackup(backupId)
      )
      if (result) {
        await refresh()
        notify(
          'sucesso',
          'Projeto restaurado',
          result.safetyBackup
            ? 'Um backup de segurança do estado anterior também foi criado.'
            : 'Os arquivos foram restaurados.'
        )
        return true
      }
      return false
    },
    [withBusy, refresh, notify]
  )

  const removeProject = useCallback(
    async (id: string, deleteFiles: boolean): Promise<boolean> => {
      const ok = await withBusy('Removendo projeto', async () => {
        await window.studio.projects.remove(id, deleteFiles)
        return true
      })
      if (ok) {
        await refresh()
        setActiveProject((current) => (current?.id === id ? null : current))
        setRoute({ name: 'projetos' })
        notify(
          'info',
          'Projeto removido do Studio',
          deleteFiles
            ? 'Os arquivos foram movidos para a lixeira do Studio e podem ser recuperados na pasta de dados.'
            : 'Os arquivos continuam no disco, apenas fora do Studio.'
        )
        return true
      }
      return false
    },
    [withBusy, refresh, notify]
  )

  const updateProjectDetails = useCallback(
    async (id: string, patch: UpdateProjectInput): Promise<boolean> => {
      const result = await withBusy('Salvando alterações', () =>
        window.studio.projects.update(id, patch)
      )
      if (result) {
        await refreshProjects()
        setActiveProject((current) => (current?.id === id ? result : current))
        notify('sucesso', 'Alterações salvas', `Projeto "${result.name}" atualizado.`)
        return true
      }
      return false
    },
    [withBusy, refreshProjects, notify]
  )

  const updateSettings = useCallback(
    async (patch: Partial<StudioSettings>): Promise<void> => {
      const next = await withBusy('Salvando preferências', () =>
        window.studio.settings.update(patch)
      )
      if (next) {
        setSettings(next)
        setPaths(await window.studio.app.paths())
      }
    },
    [withBusy]
  )

  const chooseWorkspace = useCallback(async (): Promise<void> => {
    const previous = settings?.workspaceRoot
    const next = await withBusy('Alterando pasta dos projetos', () =>
      window.studio.settings.chooseWorkspace()
    )
    if (next) {
      setSettings(next)
      setPaths(await window.studio.app.paths())
      notify(
        'sucesso',
        'Pasta de projetos atualizada',
        previous && previous !== next.workspaceRoot
          ? `Novos projetos serão criados em ${next.workspaceRoot}. Os projetos antigos continuam onde estavam.`
          : `Novos projetos serão criados em ${next.workspaceRoot}.`
      )
    }
  }, [settings, withBusy, notify])

  const completeOnboarding = useCallback(async (): Promise<void> => {
    try {
      const next = await window.studio.settings.update({ onboardingDone: true })
      setSettings(next)
    } catch (error) {
      notify('erro', 'Não foi possível salvar', messageOf(error))
    }
  }, [notify])

  const resetOnboarding = useCallback(async (): Promise<void> => {
    try {
      const next = await window.studio.settings.resetOnboarding()
      setSettings(next)
      setRoute({ name: 'painel' })
      notify('info', 'Tutorial reativado', 'O guia inicial será exibido novamente.')
    } catch (error) {
      notify('erro', 'Não foi possível reativar o tutorial', messageOf(error))
    }
  }, [notify])

  const value = useMemo<AppStore>(
    () => ({
      booted,
      fatalError,
      settings,
      paths,
      projects,
      stats,
      activity,
      activeProject,
      progress,
      busy,
      route,
      toasts,
      navigate,
      notify,
      dismissToast,
      refresh,
      refreshProjects,
      createProject,
      openProject,
      duplicateProject,
      backupProject,
      restoreBackup,
      removeProject,
      updateProjectDetails,
      updateSettings,
      chooseWorkspace,
      completeOnboarding,
      resetOnboarding
    }),
    [
      booted,
      fatalError,
      settings,
      paths,
      projects,
      stats,
      activity,
      activeProject,
      progress,
      busy,
      route,
      toasts,
      navigate,
      notify,
      dismissToast,
      refresh,
      refreshProjects,
      createProject,
      openProject,
      duplicateProject,
      backupProject,
      restoreBackup,
      removeProject,
      updateProjectDetails,
      updateSettings,
      chooseWorkspace,
      completeOnboarding,
      resetOnboarding
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppStore {
  const store = useContext(AppContext)
  if (!store) throw new Error('useApp precisa ser usado dentro de AppProvider.')
  return store
}
