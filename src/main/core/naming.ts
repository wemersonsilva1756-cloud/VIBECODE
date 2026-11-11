/** Utilitários de nomes: transformam nomes livres em nomes de pasta seguros. */

const ACCENTS = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ'

const REPLACEMENTS: Record<string, string> = {
  á: 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
  é: 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
  'ç': 'c', 'ñ': 'n'
}

export function stripAccents(text: string): string {
  let output = ''
  for (const char of text) {
    const replacement = REPLACEMENTS[char]
    if (replacement) {
      output += replacement
    } else if (ACCENTS.includes(char)) {
      output += char.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    } else {
      output += char
    }
  }
  return output
}

/** "Base Militar Abandonada!" -> "base-militar-abandonada" */
export function slugify(text: string): string {
  const slug = stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  return slug || 'projeto'
}

export function timestampSlug(date = new Date()): string {
  const pad = (value: number): string => value.toString().padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  const decimals = value >= 10 || exponent === 0 ? 0 : 1
  return `${value.toFixed(decimals).replace('.', ',')} ${units[exponent] ?? 'B'}`
}
