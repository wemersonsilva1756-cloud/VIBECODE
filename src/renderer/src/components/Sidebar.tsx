import clsx from 'clsx'
import { ChevronRight, Gamepad2, Sparkles } from 'lucide-react'
import { NAV_GROUPS, type Route } from '../navigation'
import { useApp } from '../state/store'

/** Navegação lateral fixa: agrupada por área e com etapa de cada módulo. */

function isActive(route: Route, item: Route): boolean {
  if (item.name === 'projetos') return route.name === 'projetos' || route.name === 'projeto'
  if (route.name !== item.name) return false
  if (route.name === 'modulo' && item.name === 'modulo') {
    return route.moduleId === item.moduleId
  }
  return true
}

export function Sidebar(): React.JSX.Element {
  const { route, navigate, paths, activeProject, settings } = useApp()

  return (
    <aside className="flex w-[268px] shrink-0 flex-col border-r border-base-800 bg-gradient-to-b from-base-900 to-base-950">
      <div className="flex items-center gap-3 border-b border-base-800/80 px-5 py-4">
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-700 text-white shadow-lg shadow-accent-700/30">
          <Gamepad2 className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Pixel Strike Studio</p>
          <p className="truncate text-[11px] text-ink-500">Criação de jogos 2D com IA</p>
        </div>
      </div>

      <nav className="scroll-area min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-2 px-2 text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = isActive(route, item.route)
                return (
                  <li key={`${group.label}-${item.label}`}>
                    <button
                      type="button"
                      onClick={() => navigate(item.route)}
                      className={clsx(
                        'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors',
                        active
                          ? 'border border-accent-500/30 bg-accent-500/12 text-white'
                          : 'border border-transparent text-ink-300 hover:bg-white/5 hover:text-ink-100'
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon
                        className={clsx(
                          'size-4 shrink-0',
                          active ? 'text-accent-300' : 'text-ink-400 group-hover:text-ink-200'
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className="shrink-0 rounded-md border border-base-700 bg-base-850 px-1.5 py-0.5 text-[10px] font-medium text-ink-400">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-base-800/80 px-3 py-3">
        {activeProject ? (
          <button
            type="button"
            onClick={() => navigate({ name: 'projeto', projectId: activeProject.id })}
            className="flex w-full items-center gap-2.5 rounded-xl border border-base-800 bg-base-900/80 px-2.5 py-2 text-left transition-colors hover:border-accent-500/40 hover:bg-base-850"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-500/15 text-accent-300">
              <Sparkles className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold tracking-wide text-ink-500 uppercase">
                Projeto ativo
              </span>
              <span className="block truncate text-xs text-ink-200">{activeProject.name}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-500" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate({ name: 'projetos' })}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-base-700 px-2.5 py-2 text-left text-xs text-ink-400 transition-colors hover:border-accent-500/40 hover:text-ink-200"
          >
            <Sparkles className="size-3.5" aria-hidden />
            Nenhum projeto aberto
          </button>
        )}

        <p className="mt-2.5 px-1 text-[10px] text-ink-500">
          Versão {paths?.appVersion ?? '—'} · Dados salvos só nesta máquina
        </p>
        {settings?.workspaceRoot && (
          <p className="mt-1 truncate px-1 text-[10px] text-ink-500" title={settings.workspaceRoot}>
            {settings.workspaceRoot}
          </p>
        )}
      </div>
    </aside>
  )
}
