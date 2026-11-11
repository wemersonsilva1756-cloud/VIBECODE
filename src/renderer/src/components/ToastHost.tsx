import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useApp, type ToastKind } from '../state/store'

/** Notificações do sistema: sempre explicam o que aconteceu. */

const STYLES: Record<ToastKind, { icon: typeof Info; accent: string; iconColor: string }> = {
  sucesso: { icon: CheckCircle2, accent: 'border-emerald-500/30', iconColor: 'text-emerald-400' },
  erro: { icon: XCircle, accent: 'border-red-500/30', iconColor: 'text-red-400' },
  atencao: { icon: AlertTriangle, accent: 'border-amber-500/30', iconColor: 'text-amber-400' },
  info: { icon: Info, accent: 'border-accent-500/30', iconColor: 'text-accent-300' }
}

export function ToastHost(): React.JSX.Element {
  const { toasts, dismissToast } = useApp()

  return (
    <div
      className="pointer-events-none fixed right-5 bottom-12 z-40 flex w-[380px] flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => {
        const style = STYLES[toast.kind]
        const Icon = style.icon
        return (
          <div
            key={toast.id}
            className={clsx(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-base-900/95 px-3.5 py-3 shadow-2xl backdrop-blur',
              style.accent
            )}
          >
            <Icon className={clsx('mt-0.5 size-4 shrink-0', style.iconColor)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-100">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs leading-relaxed break-words text-ink-400">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Fechar notificação"
              className="rounded-md p-0.5 text-ink-500 transition-colors hover:text-ink-200"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        )
      })}
    </div>
  )
}
