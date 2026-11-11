/** Formatação de datas e tamanhos em português do Brasil. */

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
})

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

const relativeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return dateTimeFormatter.format(date)
}

export function formatRelative(iso: string | null): string {
  if (!iso) return 'nunca'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'nunca'

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const abs = Math.abs(diffSeconds)

  if (abs < 60) return relativeFormatter.format(diffSeconds, 'second')
  if (abs < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), 'minute')
  if (abs < 86400) return relativeFormatter.format(Math.round(diffSeconds / 3600), 'hour')
  if (abs < 2592000) return relativeFormatter.format(Math.round(diffSeconds / 86400), 'day')
  return formatDate(iso)
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  const decimals = value >= 10 || exponent === 0 ? 0 : 1
  return `${value.toFixed(decimals).replace('.', ',')} ${units[exponent] ?? 'B'}`
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}
