import { BrowserWindow, shell } from 'electron'

/**
 * Proteções da janela principal.
 *
 * O usuário nunca deve conseguir abrir uma página externa dentro da janela do
 * Studio, nem executar comandos do sistema a partir da interface. Links externos
 * abrem no navegador padrão.
 */

const SAFE_PROTOCOLS = new Set(['https:', 'mailto:'])

export function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'file:') return true
    if (parsed.protocol === 'http:' && parsed.hostname === 'localhost') return true
    return false
  } catch {
    return false
  }
}

export function openExternalSafely(url: string): void {
  try {
    const parsed = new URL(url)
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return
    void shell.openExternal(parsed.toString())
  } catch {
    // URL inválida: ignora silenciosamente.
  }
}

export function hardenWindow(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (!isInternalUrl(url)) {
      event.preventDefault()
      openExternalSafely(url)
    }
  })

  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
}
