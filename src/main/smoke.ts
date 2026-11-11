import type { BrowserWindow } from 'electron'

/**
 * Teste automático do aplicativo (--smoke-test).
 *
 * Executa o código real dentro da janela: preload, IPC, validação de argumentos,
 * SQLite, sistema de arquivos e interface React. Usa uma pasta temporária como
 * `userData` (ver index.ts), então não toca nos dados do usuário.
 *
 * Fase 1: renderização, criação de projeto, backup, gerenciador de arquivos e
 *         estado inicial da integração com a Godot.
 * Fase 2: a janela é recarregada (como um reinício) e conferimos que o projeto
 *         continua aberto, que a página de arquivos lista as pastas e que a
 *         remoção segura funciona.
 */

const PHASE_ONE = `(async () => {
  const info = {
    title: document.title,
    chars: document.body.innerText.trim().length,
    hasRoot: Boolean(document.querySelector('#root')?.firstElementChild),
    projects: -1,
    created: '',
    createdId: '',
    backups: -1,
    dbPath: '',
    raizItens: 0,
    manifestoLegivel: false,
    godotSemVinculo: false,
    spritePreview: false,
    spriteImagens: 0,
    spriteSalvo: false,
    animQuadros: 0,
    animFolha: false,
    animSalva: false
  }

  try {
    const paths = await window.studio.app.paths()
    info.dbPath = paths.dbPath

    const created = await window.studio.projects.create({ name: 'Teste de fumaça' })
    info.created = created.path
    info.createdId = created.id
    await window.studio.projects.backup(created.id, 'Backup automático de teste')
    info.projects = (await window.studio.projects.list()).length
    info.backups = (await window.studio.projects.listBackups(created.id)).length

    info.raizItens = (await window.studio.files.list(created.id, '')).length
    await window.studio.files.createFolder(created.id, '', 'pasta-de-teste')
    const manifesto = await window.studio.files.preview(created.id, 'projeto.json')
    info.manifestoLegivel = (manifesto.text ?? '').includes('Pixel Strike')

    const godot = await window.studio.godot.state(created.id)
    info.godotSemVinculo = godot.link === null && godot.info === null

    const spec = {
      category: 'personagem',
      name: 'Sprite de teste',
      description: 'soldado do deserto',
      role: 'soldado',
      archetype: 'humanoide',
      size: 32,
      paletteId: 'militar',
      palette: {
        pele: '#c98d63',
        cabelo: '#3a2a1d',
        roupa: '#4a5d3a',
        detalhe: '#2f3b25',
        calca: '#3c4a30',
        bota: '#22261c',
        contorno: '#141a12'
      },
      seed: 5,
      equipment: 'rifle',
      directions: ['frente', 'costas', 'esquerda', 'direita'],
      stats: { vida: 100, dano: 10, velocidade: 90, alcance: 200 },
      abilities: [],
      drops: []
    }

    const preview = await window.studio.characters.preview(spec)
    info.spritePreview = String(preview.frente ?? '').startsWith('data:image/png;base64,')
    const asset = await window.studio.characters.save(created.id, spec)
    info.spriteImagens = asset.images.length
    info.spriteSalvo = (await window.studio.characters.list(created.id, 'personagem')).length === 1

    const animConfig = {
      characterId: asset.id,
      name: 'Sprite de teste Andando',
      kind: 'walk',
      direction: 'frente',
      fps: 8,
      loop: true,
      frames: Array.from({ length: 6 }, () => ({ hold: 1 }))
    }
    const animPreview = await window.studio.animations.preview(animConfig)
    info.animQuadros = animPreview.frames.length
    info.animFolha = String(animPreview.sheet).startsWith('data:image/png;base64,')
    await window.studio.animations.save(created.id, animConfig)
    info.animSalva = (await window.studio.animations.list(created.id)).length === 1

    await window.studio.settings.update({ onboardingDone: true })
  } catch (error) {
    info.error = String(error && error.message ? error.message : error)
  }

  return info
})()`

function phaseTwoScript(projectId: string): string {
  return `(async () => {
    const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const info = {
      panel: false,
      sidebar: false,
      filesNavFound: false,
      filesPage: false,
      filesListed: false,
      godotPage: false,
      characterPage: false,
      spriteImages: 0,
      animationPage: false,
      removed: false
    }

    await esperar(1500)
    const initial = document.body.innerText
    info.panel = initial.includes('Painel')
    info.sidebar = initial.includes('Gerador de Personagens')

    const nav = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Arquivos do projeto'
    )
    info.filesNavFound = Boolean(nav)
    nav?.click()
    await esperar(1500)

    const filesText = document.body.innerText
    info.filesPage = filesText.includes('Raiz do projeto')
    info.filesListed = filesText.includes('personagens')

    const godotNav = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Integração com Godot 4'
    )
    godotNav?.click()
    await esperar(1200)
    const godotText = document.body.innerText
    info.godotPage =
      godotText.includes('Escolha a pasta do seu projeto Godot 4') ||
      godotText.includes('O que existe no projeto Godot')

    const charNav = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Gerador de Personagens'
    )
    charNav?.click()
    await esperar(1800)
    const charText = document.body.innerText
    info.characterPage =
      charText.includes('Gerador de personagens') && charText.includes('Salvar no projeto')
    info.spriteImages = document.querySelectorAll('img').length

    const animNav = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Editor de Animações'
    )
    animNav?.click()
    await esperar(2200)
    const animText = document.body.innerText
    info.animationPage =
      animText.includes('Linha do tempo') && animText.includes('Animações salvas')

    await window.studio.projects.remove(${JSON.stringify(projectId)}, true)
    info.removed = (await window.studio.projects.list()).length === 0
    return info
  })()`
}

type Report = Record<string, unknown>

export interface SmokeOutcome {
  ok: boolean
  detail: string
}

export async function runSmokeTest(window: BrowserWindow): Promise<SmokeOutcome> {
  const phaseOne = (await window.webContents.executeJavaScript(PHASE_ONE)) as Report

  if (!phaseOne['hasRoot'] || (phaseOne['chars'] as number) < 80) {
    return { ok: false, detail: `interface sem conteúdo: ${JSON.stringify(phaseOne)}` }
  }
  if (phaseOne['error']) {
    return {
      ok: false,
      detail: `falha na comunicação com o núcleo: ${String(phaseOne['error'])}`
    }
  }
  if (phaseOne['projects'] !== 1 || phaseOne['backups'] !== 1) {
    return {
      ok: false,
      detail: `projeto/backup não confirmados: ${JSON.stringify(phaseOne)}`
    }
  }
  if ((phaseOne['raizItens'] as number) < 10 || !phaseOne['manifestoLegivel']) {
    return {
      ok: false,
      detail: `gerenciador de arquivos falhou: ${JSON.stringify(phaseOne)}`
    }
  }
  if (!phaseOne['godotSemVinculo']) {
    return {
      ok: false,
      detail: `estado inicial da Godot inesperado: ${JSON.stringify(phaseOne)}`
    }
  }
  if (!phaseOne['spritePreview'] || phaseOne['spriteImagens'] !== 4 || !phaseOne['spriteSalvo']) {
    return { ok: false, detail: `gerador de sprites falhou: ${JSON.stringify(phaseOne)}` }
  }
  if (phaseOne['animQuadros'] !== 6 || !phaseOne['animFolha'] || !phaseOne['animSalva']) {
    return { ok: false, detail: `editor de animações falhou: ${JSON.stringify(phaseOne)}` }
  }

  const projectId = String(phaseOne['createdId'])

  const reloaded = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('a interface não recarregou')), 20_000)
    window.webContents.once('did-finish-load', () => {
      clearTimeout(timer)
      resolve()
    })
  })
  window.webContents.reload()
  await reloaded

  const phaseTwo = (await window.webContents.executeJavaScript(
    phaseTwoScript(projectId)
  )) as Report

  if (!phaseTwo['panel'] || !phaseTwo['sidebar']) {
    return { ok: false, detail: `o app não reabriu no painel: ${JSON.stringify(phaseTwo)}` }
  }
  if (!phaseTwo['filesNavFound'] || !phaseTwo['filesPage'] || !phaseTwo['filesListed']) {
    return { ok: false, detail: `a página de arquivos não abriu: ${JSON.stringify(phaseTwo)}` }
  }
  if (!phaseTwo['godotPage']) {
    return { ok: false, detail: `a página da Godot não abriu: ${JSON.stringify(phaseTwo)}` }
  }
  if (!phaseTwo['characterPage'] || (phaseTwo['spriteImages'] as number) < 1) {
    return {
      ok: false,
      detail: `a página de personagens não abriu: ${JSON.stringify(phaseTwo)}`
    }
  }
  if (!phaseTwo['animationPage']) {
    return { ok: false, detail: `a página de animações não abriu: ${JSON.stringify(phaseTwo)}` }
  }
  if (!phaseTwo['removed']) {
    return {
      ok: false,
      detail: `o projeto de teste não foi removido: ${JSON.stringify(phaseTwo)}`
    }
  }

  return {
    ok: true,
    detail:
      `interface renderizada (${phaseOne['chars']} caracteres), projeto criado em ` +
      `${phaseOne['created']}, backup registrado, arquivos, personagens, animações e Godot ` +
      `respondendo, banco em ${phaseOne['dbPath']}`
  }
}
