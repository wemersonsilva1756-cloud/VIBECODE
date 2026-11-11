import { AlertTriangle, Database, Gamepad2, HelpCircle, Loader2, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { moduleById, ROUTE_LABELS, type StaticRouteName } from './navigation'
import { useApp } from './state/store'
import { Sidebar } from './components/Sidebar'
import { ToastHost } from './components/ToastHost'
import { Button, ProgressBar } from './components/ui'
import { AnimationsPage } from './pages/AnimationsPage'
import { CharactersPage } from './pages/CharactersPage'
import { Dashboard } from './pages/Dashboard'
import { FilesPage } from './pages/FilesPage'
import { GodotPage } from './pages/GodotPage'
import { HelpPage } from './pages/HelpPage'
import { ModulePage } from './pages/ModulePage'
import { Onboarding } from './pages/Onboarding'
import { ProjectDetail } from './pages/ProjectDetail'
import { ProjectsPage } from './pages/ProjectsPage'
import { RoadmapPage } from './pages/RoadmapPage'
import { SettingsPage } from './pages/SettingsPage'

function BootScreen(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-base-950">
      <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-700 text-white shadow-xl shadow-accent-700/30">
        <Gamepad2 className="size-7" aria-hidden />
      </div>
      <div className="flex items-center gap-2 text-sm text-ink-300">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Preparando seu estúdio…
      </div>
      <p className="text-xs text-ink-500">Abrindo banco de dados local</p>
    </div>
  )
}

function FatalScreen({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-base-900 p-6">
        <div className="flex items-center gap-2.5 text-red-300">
          <AlertTriangle className="size-5" aria-hidden />
          <h1 className="text-base font-semibold">Não foi possível iniciar o Studio</h1>
        </div>
        <p className="mt-3 rounded-xl border border-base-800 bg-base-950/60 px-3 py-2.5 text-xs leading-relaxed text-ink-300">
          {message}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-ink-500">
          Seus projetos e backups não foram alterados. Tente abrir novamente. Caso o problema continue,
          verifique o espaço em disco e as permissões da pasta de dados do aplicativo.
        </p>
        <div className="mt-4 flex gap-2">
          <Button icon={RefreshCw} onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    </div>
  )
}

function TopBar(): React.JSX.Element {
  const { route, busy, navigate } = useApp()

  const title =
    route.name === 'projeto'
      ? 'Projeto'
      : route.name === 'modulo'
        ? (moduleById(route.moduleId)?.title ?? 'Módulo')
        : ROUTE_LABELS[route.name as StaticRouteName]

  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-base-800 bg-base-900/50 px-6">
      <div className="flex min-w-0 items-center gap-2 text-xs text-ink-500">
        <span>Pixel Strike Studio</span>
        <span aria-hidden>/</span>
        <span className="truncate text-ink-200">{title}</span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {busy && (
          <span className="flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3 py-1 text-[11px] text-accent-200">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            {busy}…
          </span>
        )}
        <button
          type="button"
          onClick={() => navigate({ name: 'ajuda' })}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-ink-400 transition-colors hover:bg-white/5 hover:text-ink-100"
        >
          <HelpCircle className="size-3.5" aria-hidden />
          Ajuda
        </button>
      </div>
    </div>
  )
}

function StatusBar(): React.JSX.Element {
  const { stats, paths, projects } = useApp()

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between gap-4 border-t border-base-800 bg-base-900/70 px-4 text-[11px] text-ink-500">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
          Banco local conectado
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <Database className="size-3" aria-hidden />
          {stats?.projectCount ?? projects.length} projeto(s)
        </span>
        <span className="hidden truncate md:inline" title={paths?.dbPath}>
          {paths?.dbPath}
        </span>
      </div>
      <span className="shrink-0">v{paths?.appVersion ?? '0.1.0'}</span>
    </footer>
  )
}

function CurrentPage(): React.JSX.Element {
  const { route } = useApp()

  switch (route.name) {
    case 'painel':
      return <Dashboard />
    case 'projetos':
      return <ProjectsPage />
    case 'arquivos':
      return <FilesPage />
    case 'projeto':
      return <ProjectDetail projectId={route.projectId} />
    case 'modulo':
      if (route.moduleId === 'godot') return <GodotPage />
      if (route.moduleId === 'personagens') return <CharactersPage category="personagem" />
      if (route.moduleId === 'monstros') return <CharactersPage category="monstro" />
      if (route.moduleId === 'animacoes') return <AnimationsPage />
      return <ModulePage moduleId={route.moduleId} />
    case 'configuracoes':
      return <SettingsPage />
    case 'ajuda':
      return <HelpPage />
    case 'roadmap':
      return <RoadmapPage />
    default:
      return <Dashboard />
  }
}

export default function App(): React.JSX.Element {
  const { booted, fatalError, settings, progress } = useApp()

  // Avisa o processo principal que a interface renderizou (usado nos testes automáticos).
  useEffect(() => {
    if (!booted) return undefined
    const timer = window.setTimeout(() => {
      window.studio?.app.smokeTestReady()
    }, 700)
    return () => window.clearTimeout(timer)
  }, [booted])

  if (!booted) return <BootScreen />
  if (fatalError) return <FatalScreen message={fatalError} />
  if (!settings) return <BootScreen />
  if (!settings.onboardingDone) return <Onboarding />

  return (
    <div className="flex h-full">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main className="scroll-area min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <CurrentPage />
        </main>

        <StatusBar />
      </div>

      {progress && !progress.done && (
        <div className="fixed bottom-12 left-4 z-40 w-[320px] rounded-xl border border-base-700 bg-base-900/95 p-3 shadow-2xl backdrop-blur">
          <ProgressBar value={progress.percent} label={progress.label} />
        </div>
      )}

      <ToastHost />
    </div>
  )
}
