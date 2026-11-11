import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle, type LucideIcon } from 'lucide-react'
import {
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes
} from 'react'
import { createPortal } from 'react-dom'

/* ------------------------------------------------------------------ Botão */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: LucideIcon
  loading?: boolean
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-500 text-white shadow-lg shadow-accent-600/25 hover:bg-accent-400 active:bg-accent-600 border border-accent-400/40',
  secondary:
    'bg-base-800 text-ink-100 border border-base-700 hover:bg-base-750 hover:border-base-600',
  ghost: 'bg-transparent text-ink-200 border border-transparent hover:bg-white/5 hover:text-ink-100',
  danger:
    'bg-red-600/90 text-white border border-red-500/40 hover:bg-red-500 active:bg-red-700'
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2.5 text-sm',
        BUTTON_VARIANTS[variant],
        className
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className="size-4" aria-hidden />
      ) : null}
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ Cartão */

export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  bodyClassName?: string
}): React.JSX.Element {
  return (
    <section
      className={clsx(
        'rounded-2xl border border-base-800 bg-base-900/70 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.9)]',
        className
      )}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-base-800/80 px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-wide text-ink-100">{title}</h2>}
            {description && <p className="mt-1 text-xs leading-relaxed text-ink-400">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------------ Etiqueta */

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-base-800 text-ink-300 border-base-700',
  accent: 'bg-accent-500/15 text-accent-300 border-accent-500/30',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  danger: 'bg-red-500/15 text-red-300 border-red-500/30'
}

export function Badge({
  tone = 'neutral',
  children,
  icon: Icon,
  className
}: {
  tone?: BadgeTone
  children: ReactNode
  icon?: LucideIcon
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        BADGE_TONES[tone],
        className
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ Campos */

export function Field({
  label,
  hint,
  error,
  children
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-200 uppercase">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1.5 text-xs text-red-300">
          <XCircle className="size-3.5" aria-hidden /> {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs leading-relaxed text-ink-500">{hint}</span>
      ) : null}
    </label>
  )
}

const FIELD_CLASSES =
  'w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 transition-colors focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25'

export function Input(props: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return <input {...props} className={clsx(FIELD_CLASSES, props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return <textarea {...props} className={clsx(FIELD_CLASSES, 'resize-y', props.className)} />
}

/* ------------------------------------------------------------------ Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md'
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
}): React.JSX.Element | null {
  const titleId = useId()

  useEffect(() => {
    if (!open) return undefined
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-base-950/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx(
          'relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-base-700 bg-base-900 shadow-2xl',
          width === 'sm' ? 'max-w-md' : width === 'lg' ? 'max-w-3xl' : 'max-w-xl'
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-base-800 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink-100">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-ink-400">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-white/5 hover:text-ink-100"
          >
            <XCircle className="size-5" aria-hidden />
          </button>
        </header>
        <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-base-800 bg-base-850/60 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'primary',
  loading,
  onConfirm,
  onCancel,
  children
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}): React.JSX.Element | null {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}

/* ------------------------------------------------------------------ Progresso */

export function ProgressBar({
  value,
  label
}: {
  value: number
  label?: string
}): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-ink-300">
          <span>{label}</span>
          <span className="font-mono text-ink-400">{Math.round(clamped)}%</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-base-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-300 transition-[width] duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Vazio */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-base-700 bg-base-900/40 px-6 py-12 text-center">
      <div className="mb-4 rounded-2xl border border-base-700 bg-base-850 p-3 text-accent-400">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-ink-100">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-ink-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ Avisos */

const NOTE_STYLES = {
  info: { wrapper: 'border-accent-500/25 bg-accent-500/10 text-ink-100', icon: Info },
  warning: { wrapper: 'border-amber-500/25 bg-amber-500/10 text-amber-100', icon: AlertTriangle },
  success: {
    wrapper: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
    icon: CheckCircle2
  }
} as const

export function Note({
  tone = 'info',
  children
}: {
  tone?: keyof typeof NOTE_STYLES
  children: ReactNode
}): React.JSX.Element {
  const style = NOTE_STYLES[tone]
  const Icon = style.icon
  return (
    <div className={clsx('flex gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-relaxed', style.wrapper)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ Cabeçalho de página */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}): React.JSX.Element {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-base-800/70 pb-5">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold tracking-[0.16em] text-accent-400 uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function StatTile({
  icon: Icon,
  label,
  value,
  hint
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
}): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-base-800 bg-base-900/60 px-4 py-3.5">
      <div className="flex items-center gap-2 text-ink-400">
        <Icon className="size-4" aria-hidden />
        <span className="text-[11px] font-semibold tracking-wide uppercase">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-ink-500">{hint}</p>}
    </div>
  )
}
