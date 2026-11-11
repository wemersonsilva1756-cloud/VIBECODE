import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { initializeCore, shutdownCore } from './core'
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc'
import { hardenWindow } from './security'
import { runSmokeTest } from './smoke'

/**
 * Processo principal do Pixel Strike Studio.
 *
 * Responsabilidades: abrir a janela, inicializar o banco de dados local,
 * registrar os canais de comunicação e encerrar tudo com segurança.
 */

const isSmokeTest = process.argv.includes('--smoke-test')
const devServerUrl = process.env['ELECTRON_RENDERER_URL']

app.setName('Pixel Strike Studio')
app.setAppUserModelId('com.pixelstrike.studio')

if (isSmokeTest) {
  // Execução automática de verificação: usa uma pasta temporária para não
  // interferir nos dados reais do usuário.
  app.setPath('userData', join(tmpdir(), `pixel-strike-smoke-${Date.now()}`))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null
  let smokeTimer: NodeJS.Timeout | null = null
  let smokeStarted = false

  const rendererFile = join(__dirname, '../renderer/index.html')
  const preloadFile = join(__dirname, '../preload/index.js')

  function rendererOrigin(): string | null {
    if (devServerUrl) return devServerUrl.endsWith('/') ? devServerUrl : `${devServerUrl}/`
    return pathToFileURL(rendererFile).toString()
  }

  function finishSmokeTest(success: boolean, detail: string): void {
    if (smokeTimer) {
      clearTimeout(smokeTimer)
      smokeTimer = null
    }
    if (success) {
      console.log(`[smoke] OK - ${detail}`)
      app.exit(0)
    } else {
      console.error(`[smoke] FALHA - ${detail}`)
      app.exit(1)
    }
  }

  async function createWindow(): Promise<void> {
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1080,
      minHeight: 700,
      show: false,
      title: 'Pixel Strike Studio',
      backgroundColor: '#080d16',
      autoHideMenuBar: true,
      webPreferences: {
        preload: preloadFile,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        spellcheck: false
      }
    })

    hardenWindow(mainWindow)

    mainWindow.once('ready-to-show', () => {
      mainWindow?.show()
    })

    mainWindow.on('closed', () => {
      mainWindow = null
    })

    if (devServerUrl) {
      await mainWindow.loadURL(devServerUrl)
    } else {
      await mainWindow.loadFile(rendererFile)
    }
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    unregisterIpcHandlers()
    void shutdownCore()
  })

  app.whenReady().then(async () => {
    const dataDir = app.getPath('userData')
    const dbPath = join(dataDir, 'studio.db')
    // No teste automático, os projetos também ficam na pasta temporária para não
    // criar arquivos na pasta Documentos do usuário.
    const workspaceRoot = isSmokeTest
      ? join(dataDir, 'Projetos')
      : join(app.getPath('documents'), 'Pixel Strike Studio', 'Projetos')

    try {
      await initializeCore({
        dataDir,
        dbPath,
        workspaceRoot,
        studioVersion: app.getVersion()
      })
    } catch (error) {
      dialog.showErrorBox(
        'Não foi possível iniciar o Pixel Strike Studio',
        `O banco de dados local não pôde ser aberto.\n\nLocal: ${dbPath}\n\nDetalhe: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      app.exit(1)
      return
    }

    registerIpcHandlers({
      dataDir,
      dbPath,
      appVersion: app.getVersion(),
      rendererOrigin,
      onSmokeReady: () => {
        if (!isSmokeTest || smokeStarted) return
        smokeStarted = true
        const window = mainWindow
        if (!window) {
          finishSmokeTest(false, 'janela principal não encontrada')
          return
        }

        void runSmokeTest(window)
          .then((outcome) => finishSmokeTest(outcome.ok, outcome.detail))
          .catch((error: unknown) => {
            finishSmokeTest(false, `erro ao inspecionar a interface: ${String(error)}`)
          })
      }
    })

    try {
      await createWindow()
    } catch (error) {
      dialog.showErrorBox(
        'Erro ao abrir a janela',
        error instanceof Error ? error.message : String(error)
      )
      app.exit(1)
      return
    }

    if (isSmokeTest) {
      smokeTimer = setTimeout(() => {
        finishSmokeTest(false, 'a interface não respondeu em 60 segundos')
      }, 60_000)
    }
  })
}
