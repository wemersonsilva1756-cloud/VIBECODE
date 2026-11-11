/**
 * Testes do núcleo local (banco de dados, projetos e backups).
 *
 * Executam o mesmo código usado pelo aplicativo, mas fora do Electron, em uma
 * pasta temporária. Rodar com: npm run test:core
 */

import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
  mkdtempSync
} from 'node:fs'
import { inflateSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  applyGodotExport,
  backupProject,
  buildGodotExportPlan,
  listAnimations,
  previewAnimation,
  removeAnimation,
  saveAnimation,
  validateAnimationConfig,
  createProject,
  interpretDescription,
  listCharacters,
  previewCharacter,
  removeCharacter,
  renderSprite,
  saveCharacter,
  validateSpec,
  createProjectFolder,
  duplicateProject,
  getProject,
  getProjectGodotState,
  getStats,
  importFilesIntoProject,
  initializeCore,
  inspectGodotProject,
  linkProjectToGodot,
  listActivity,
  listBackups,
  listProjectDirectory,
  listProjects,
  openProject,
  previewProjectFile,
  readGodotExecutable,
  readSettings,
  removeProject,
  restoreBackup,
  shutdownCore,
  trashProjectItem,
  updateProject,
  updateSettings
} from '../src/main/core/index'
import { defaultSpec } from '../src/shared/characters'

const root = mkdtempSync(join(tmpdir(), 'pixel-strike-test-'))
const dataDir = join(root, 'dados')
const workspaceRoot = join(root, 'projetos')
let checks = 0

function ok(condition: boolean, message: string): void {
  assert.ok(condition, message)
  checks += 1
  console.log(`  ok  ${message}`)
}

async function main(): Promise<void> {
  console.log('Pixel Strike Studio - testes do núcleo')

  await initializeCore({
    dataDir,
    dbPath: join(dataDir, 'studio.db'),
    workspaceRoot,
    studioVersion: '0.1.0-test'
  })
  ok(existsSync(join(dataDir, 'studio.db')), 'banco de dados criado no disco')

  const initialSettings = await readSettings()
  ok(initialSettings.workspaceRoot === workspaceRoot, 'pasta de projetos padrão aplicada')
  ok(initialSettings.onboardingDone === false, 'guia inicial pendente no primeiro uso')

  // --- Criação de projeto -------------------------------------------------
  const project = await createProject({
    name: 'Pixel Strike',
    description: 'Jogo de tiro 2D em pixel art'
  })
  ok(existsSync(project.path), 'pasta do projeto criada')
  ok(project.slug === 'pixel-strike', 'nome da pasta gerado sem acentos')

  for (const folder of ['personagens', 'monstros', 'mapas', 'originais', 'gerados', 'godot']) {
    ok(existsSync(join(project.path, folder)), `subpasta "${folder}" criada`)
  }

  const manifest = JSON.parse(readFileSync(join(project.path, 'projeto.json'), 'utf8')) as {
    nome: string
    studio: string
  }
  ok(manifest.nome === 'Pixel Strike', 'projeto.json registra o nome do projeto')
  ok(manifest.studio === 'Pixel Strike Studio', 'projeto.json identifica o Studio')
  ok(existsSync(join(project.path, 'LEIA-ME.txt')), 'arquivo LEIA-ME criado no projeto')

  // --- Nome duplicado ganha sufixo ---------------------------------------
  const secondProject = await createProject({ name: 'Pixel Strike' })
  ok(secondProject.path !== project.path, 'projetos com o mesmo nome não se sobrescrevem')
  ok(secondProject.slug === 'pixel-strike-2', 'segunda pasta recebe sufixo numérico')

  // --- Abrir e atualizar --------------------------------------------------
  const opened = await openProject(project.id)
  ok(opened.lastOpenedAt !== null, 'abrir projeto registra a data de acesso')
  ok((await readSettings()).activeProjectId === project.id, 'projeto ativo salvo nas preferências')

  await updateProject(project.id, { name: 'Pixel Strike Arena', description: 'Nova descrição' })
  const updated = await getProject(project.id)
  ok(updated.name === 'Pixel Strike Arena', 'nome do projeto atualizado')
  const updatedManifest = JSON.parse(
    readFileSync(join(project.path, 'projeto.json'), 'utf8')
  ) as { nome: string }
  ok(updatedManifest.nome === 'Pixel Strike Arena', 'projeto.json atualizado junto com o banco')

  // --- Backups ------------------------------------------------------------
  const sourceFile = join(project.path, 'originais', 'exemplo.txt')
  writeFileSync(sourceFile, 'conteudo original', 'utf8')

  const backup = await backupProject(project.id, 'Antes de testar')
  ok(existsSync(backup.path), 'pasta do backup criada fora do projeto')
  ok(backup.sizeBytes > 0, 'backup registra tamanho em bytes')
  ok(!backup.path.startsWith(project.path), 'backup não é criado dentro do projeto')
  ok((await listBackups(project.id)).length === 1, 'backup aparece no histórico')

  writeFileSync(sourceFile, 'conteudo alterado', 'utf8')
  const restore = await restoreBackup(backup.id)
  ok(restore.safetyBackup !== null, 'restauração cria backup de segurança')
  ok(
    readFileSync(sourceFile, 'utf8') === 'conteudo original',
    'restauração devolve o conteúdo original'
  )
  ok((await listBackups(project.id)).length === 2, 'backup de segurança fica no histórico')
  ok(existsSync(project.path), 'projeto continua no mesmo lugar após restaurar')

  // --- Duplicação ---------------------------------------------------------
  const duplicate = await duplicateProject(project.id, 'Pixel Strike Cópia')
  ok(duplicate.id !== project.id, 'duplicação gera um novo projeto')
  ok(existsSync(join(duplicate.path, 'originais', 'exemplo.txt')), 'duplicação copia os arquivos')
  const duplicateManifest = JSON.parse(
    readFileSync(join(duplicate.path, 'projeto.json'), 'utf8')
  ) as { id: string }
  ok(duplicateManifest.id === duplicate.id, 'duplicação gera um novo identificador no manifesto')
  ok((await listProjects()).length === 3, 'lista contém os três projetos')

  // --- Preferências -------------------------------------------------------
  const settings = await updateSettings({ maxBackups: 5 })
  ok(settings.maxBackups === 5, 'limite de backups salvo')

  // --- Histórico ----------------------------------------------------------
  const activity = await listActivity(50)
  ok(activity.length >= 5, 'histórico registra as ações realizadas')
  ok(
    activity.some((entry) => entry.type === 'backup.restaurado'),
    'histórico registra restauração de backup'
  )

  // --- Estatísticas -------------------------------------------------------
  const stats = await getStats()
  ok(stats.projectCount === 3, 'estatísticas contam os projetos')
  ok(stats.backupCount >= 2, 'estatísticas contam os backups')
  ok(stats.totalSizeBytes > 0, 'estatísticas calculam o espaço usado')

  // --- Gerenciador de arquivos -------------------------------------------
  const rootEntries = await listProjectDirectory(project.id, '')
  ok(
    rootEntries.some((entry) => entry.name === 'originais' && entry.isDirectory),
    'listagem mostra as pastas do projeto'
  )

  const originals = await listProjectDirectory(project.id, 'originais')
  ok(
    originals.some((entry) => entry.name === 'exemplo.txt' && entry.category === 'texto'),
    'listagem classifica arquivos de texto'
  )

  const createdFolder = await createProjectFolder(project.id, '', 'cenarios')
  ok(createdFolder.isDirectory && existsSync(join(project.path, 'cenarios')), 'pasta criada no projeto')
  await assert.rejects(() => createProjectFolder(project.id, '', 'cenarios'), /Já existe/)
  checks += 1
  console.log('  ok  pasta duplicada é recusada com mensagem clara')

  const importSourceDir = join(root, 'entrada')
  mkdirSync(importSourceDir, { recursive: true })
  const importSource = join(importSourceDir, 'heroi.png')
  writeFileSync(importSource, Buffer.from('89504e470d0a1a0a', 'hex'))

  const firstImport = await importFilesIntoProject(project.id, 'personagens', [importSource])
  ok(firstImport.imported.length === 1, 'importação copia o arquivo para o projeto')
  ok(
    existsSync(join(project.path, 'personagens', 'heroi.png')),
    'arquivo importado existe na pasta escolhida'
  )

  const secondImport = await importFilesIntoProject(project.id, 'personagens', [importSource])
  ok(secondImport.renamed.length === 1, 'arquivo repetido é renomeado em vez de sobrescrito')
  ok(
    existsSync(join(project.path, 'personagens', 'heroi-2.png')),
    'arquivo renomeado recebe sufixo numérico'
  )

  const previewText = await previewProjectFile(project.id, 'originais/exemplo.txt')
  ok(previewText.text === 'conteudo original', 'pré-visualização devolve o texto do arquivo')

  const previewImage = await previewProjectFile(project.id, 'personagens/heroi.png')
  ok(
    previewImage.dataUrl?.startsWith('data:image/png;base64,') ?? false,
    'pré-visualização devolve imagem como data URL'
  )

  await assert.rejects(() => previewProjectFile(project.id, '../studio.db'), /Caminho/)
  checks += 1
  console.log('  ok  caminhos fora do projeto são recusados')

  const trashDir = join(dataDir, 'lixeira')
  const trashedPath = await trashProjectItem(project.id, 'originais/exemplo.txt', trashDir)
  ok(existsSync(trashedPath), 'item removido vai para a lixeira interna')
  ok(
    !existsSync(join(project.path, 'originais', 'exemplo.txt')),
    'item removido sai da pasta do projeto'
  )

  // --- Integração com Godot 4 --------------------------------------------
  const godotDir = join(root, 'JogoGodot')
  mkdirSync(godotDir, { recursive: true })
  writeFileSync(
    join(godotDir, 'project.godot'),
    [
      'config_version=5',
      '',
      '[application]',
      '',
      'config/name="Jogo de Teste"',
      'run/main_scene="res://main.tscn"',
      'config/features=PackedStringArray("4.3", "Forward Plus")',
      '',
      '[autoload]',
      '',
      'Game="*res://game.gd"'
    ].join('\n'),
    'utf8'
  )
  writeFileSync(join(godotDir, 'main.tscn'), '[gd_scene format=3]\n', 'utf8')
  writeFileSync(join(godotDir, 'game.gd'), 'extends Node\n', 'utf8')
  writeFileSync(join(godotDir, 'icon.svg'), '<svg/>', 'utf8')

  const detected = inspectGodotProject(godotDir)
  ok(detected.valid, 'projeto Godot 4 reconhecido')
  ok(detected.name === 'Jogo de Teste', 'nome lido do project.godot')
  ok(detected.engineVersion === '4.3', 'versão da engine lida das features')
  ok(detected.mainScene === 'res://main.tscn', 'cena principal identificada')
  ok(detected.autoloads.includes('Game'), 'autoloads listados')
  ok(detected.counts.scenes === 1 && detected.counts.scripts === 1, 'cenas e scripts contados')
  ok(detected.counts.images === 1, 'imagens contadas')

  const notGodot = inspectGodotProject(join(root, 'entrada'))
  ok(!notGodot.valid && (notGodot.problem ?? '').includes('project.godot'), 'pasta sem project.godot é recusada')

  const linked = await linkProjectToGodot(project.id, godotDir)
  ok(linked.link?.path === godotDir, 'projeto Godot fica vinculado ao projeto do Studio')
  const godotState = await getProjectGodotState(project.id, readGodotExecutable(''))
  ok(godotState.info?.name === 'Jogo de Teste', 'estado do vínculo devolve o projeto Godot')
  ok(godotState.executable.ok === false, 'executável da Godot é opcional')

  const emptyPlan = await buildGodotExportPlan(project.id)
  ok(
    emptyPlan.files.filter((file) => file.relativePath.startsWith('addons/pixel_strike/')).length ===
      3,
    'plano inclui script, manifesto e instruções'
  )
  ok(
    emptyPlan.assetCount === 2,
    'arquivos importados na pasta personagens/ entram no plano'
  )
  ok(
    emptyPlan.files.find((file) => file.relativePath.endsWith('pixel_strike.gd'))?.action === 'criar',
    'script utilitário marcado como novo'
  )

  writeFileSync(join(project.path, 'godot', 'heroi.png'), Buffer.from('89504e470d0a1a0a', 'hex'))
  const planWithAsset = await buildGodotExportPlan(project.id)
  ok(planWithAsset.assetCount === 3, 'arquivo da pasta godot/ entra no plano')
  ok(
    planWithAsset.files.some(
      (file) => file.relativePath === 'pixel_strike/recursos/heroi.png'
    ),
    'arquivo é planejado com caminho relativo na Godot'
  )

  const firstExport = await applyGodotExport(project.id)
  ok(firstExport.written === 6, 'exportação grava todos os arquivos planejados')
  ok(existsSync(join(godotDir, 'addons', 'pixel_strike', 'pixel_strike.gd')), 'script criado na Godot')
  ok(
    readFileSync(join(godotDir, 'addons', 'pixel_strike', 'pixel_strike.gd'), 'utf8').startsWith(
      'extends Node'
    ),
    'script gerado é GDScript válido na estrutura'
  )
  ok(
    existsSync(join(godotDir, 'pixel_strike', 'recursos', 'heroi.png')),
    'recurso copiado para a pasta do projeto Godot'
  )

  const manifestOnGodot = JSON.parse(
    readFileSync(join(godotDir, 'addons', 'pixel_strike', 'pixel_strike_manifest.json'), 'utf8')
  ) as { projeto: { nome: string }; recursos: Array<{ caminho_godot: string }> }
  ok(manifestOnGodot.projeto.nome === 'Pixel Strike Arena', 'manifesto registra o projeto do Studio')
  ok(
    manifestOnGodot.recursos.some((item) => item.caminho_godot === 'res://pixel_strike/recursos/heroi.png'),
    'manifesto lista o recurso exportado'
  )
  ok(
    readFileSync(join(godotDir, 'project.godot'), 'utf8').includes('config/name="Jogo de Teste"'),
    'project.godot não é alterado'
  )

  const helperOnGodot = join(godotDir, 'addons', 'pixel_strike', 'pixel_strike.gd')
  writeFileSync(helperOnGodot, 'extends Node\n# modificado pelo usuário\n', 'utf8')
  const secondPlan = await buildGodotExportPlan(project.id)
  ok(
    secondPlan.files.find((file) => file.relativePath.endsWith('pixel_strike.gd'))?.action ===
      'sobrescrever',
    'arquivo diferente é marcado como substituição'
  )

  const secondExport = await applyGodotExport(project.id)
  ok(secondExport.backupPath !== null, 'exportação cria backup dos arquivos substituídos')
  ok(
    secondExport.backupPath !== null && existsSync(secondExport.backupPath),
    'pasta de backup da Godot existe no disco'
  )
  ok(
    (await readSettings()).godotExecutable === '',
    'executável da Godot começa vazio'
  )

  const thirdPlan = await buildGodotExportPlan(project.id)
  ok(
    thirdPlan.files.every((file) => file.action === 'igual'),
    'reexportar sem mudanças não marca arquivos para gravar'
  )

  // --- Gerador de personagens e monstros ----------------------------------
  const soldier = defaultSpec('personagem', {
    name: 'Soldado Alfa',
    description: 'soldado do deserto com fuzil',
    seed: 42,
    size: 64
  })

  const front = renderSprite(soldier, 'frente')
  ok(front.subarray(1, 4).toString('ascii') === 'PNG', 'gerador produz um arquivo PNG real')

  function pngInfo(buffer: Buffer): {
    width: number
    height: number
    colorType: number
    raw: Buffer
  } {
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)
    const colorType = buffer[25] ?? 0
    let offset = 8
    const parts: Buffer[] = []
    while (offset < buffer.length) {
      const length = buffer.readUInt32BE(offset)
      const type = buffer.toString('ascii', offset + 4, offset + 8)
      if (type === 'IDAT') parts.push(buffer.subarray(offset + 8, offset + 8 + length))
      offset += 12 + length
    }
    return { width, height, colorType, raw: inflateSync(Buffer.concat(parts)) }
  }

  const frontInfo = pngInfo(front)
  ok(frontInfo.width === 64 && frontInfo.height === 64, 'sprite sai no tamanho escolhido')
  ok(frontInfo.colorType === 6, 'PNG é RGBA (aceita transparência)')
  ok(frontInfo.raw[0] === 0 && frontInfo.raw[4] === 0, 'canto do sprite é transparente')

  const sameAgain = renderSprite(soldier, 'frente')
  ok(front.equals(sameAgain), 'mesma semente gera exatamente o mesmo sprite')

  const otherSeed = renderSprite({ ...soldier, seed: 43 }, 'frente')
  ok(!front.equals(otherSeed), 'semente diferente muda o sprite')

  const side = renderSprite(soldier, 'direita')
  const mirrored = renderSprite(soldier, 'esquerda')
  ok(!side.equals(mirrored), 'lado esquerdo e direito são espelhados')

  const preview = previewCharacter(soldier)
  ok(
    preview.frente?.startsWith('data:image/png;base64,') ?? false,
    'pré-visualização devolve imagem pronta para a tela'
  )
  ok(Object.keys(preview).length === 4, 'pré-visualização cobre as quatro direções')

  const suggestion = interpretDescription('lobo gigante das montanhas geladas, chefe')
  ok(suggestion.archetype === 'quadrupede', 'descrição reconhece animal quadrúpede')
  ok(suggestion.paletteId === 'neve', 'descrição reconhece ambiente gelado')
  ok(suggestion.role === 'chefe', 'descrição reconhece chefe')

  assert.throws(() => validateSpec({ ...soldier, name: 'a' }), /pelo menos 2/)
  checks += 1
  console.log('  ok  nome curto é recusado no gerador')

  const clamped = validateSpec({
    ...soldier,
    seed: -5,
    stats: { vida: 999999, dano: -3, velocidade: 5000, alcance: 12.7 },
    drops: [{ item: '', chance: 10, quantidade: 1 }, { item: 'munição', chance: 150, quantidade: 0 }]
  })
  ok(clamped.stats.vida === 99999, 'atributos são limitados a valores válidos')
  ok(clamped.stats.alcance === 13, 'atributos decimais são arredondados')
  ok(clamped.seed > 0, 'semente negativa é corrigida')
  ok(clamped.drops.length === 1 && clamped.drops[0]?.chance === 100, 'drops vazios são descartados e chances limitadas')

  const savedSoldier = await saveCharacter(project.id, soldier)
  ok(savedSoldier.images.length === 4, 'quatro direções são gravadas no projeto')
  ok(
    existsSync(join(project.path, 'personagens', 'soldado-alfa', 'soldado-alfa_frente.png')),
    'PNG salvo na pasta personagens/'
  )
  ok(
    existsSync(join(project.path, 'personagens', 'soldado-alfa', 'soldado-alfa.json')),
    'ficha JSON salva junto do sprite'
  )

  const sheet = JSON.parse(
    readFileSync(join(project.path, 'personagens', 'soldado-alfa', 'soldado-alfa.json'), 'utf8')
  ) as { nome: string; atributos: { vida: number }; imagens: unknown[] }
  ok(sheet.nome === 'Soldado Alfa' && sheet.imagens.length === 4, 'ficha descreve nome e imagens')
  ok(sheet.atributos.vida === 100, 'ficha guarda os atributos do jogo')

  const planWithCharacters = await buildGodotExportPlan(project.id)
  ok(
    planWithCharacters.files.some(
      (file) =>
        file.relativePath ===
        'pixel_strike/recursos/personagens/soldado-alfa/soldado-alfa_frente.png'
    ),
    'personagens gerados entram na exportação da Godot'
  )
  ok(
    planWithCharacters.files.some((file) =>
      file.relativePath.endsWith('personagens/soldado-alfa/soldado-alfa.json')
    ),
    'ficha JSON do personagem também vai para a Godot'
  )

  const soldierList = await listCharacters(project.id, 'personagem')
  ok(soldierList.length === 1 && soldierList[0]?.name === 'Soldado Alfa', 'personagem aparece na lista')
  ok(soldierList[0]?.spec.seed === 42, 'lista devolve a especificação salva')

  const secondSoldier = await saveCharacter(project.id, { ...soldier, name: 'Soldado Alfa' })
  ok(secondSoldier.folder.endsWith('soldado-alfa-2'), 'mesmo nome não sobrescreve o anterior')

  const monster = defaultSpec('monstro', {
    name: 'Morcego Chefe',
    description: 'morcego gigante das montanhas geladas',
    archetype: 'voador',
    role: 'chefe',
    seed: 7,
    abilities: ['investida'],
    drops: [{ item: 'asa', chance: 35, quantidade: 2 }]
  })
  const savedMonster = await saveCharacter(project.id, monster)
  ok(
    existsSync(join(project.path, 'monstros', 'morcego-chefe', 'morcego-chefe_frente.png')),
    'monstro salvo na pasta monstros/'
  )
  ok(savedMonster.spec.drops.length === 1, 'drops do monstro são guardados')
  ok((await listCharacters(project.id, 'monstro')).length === 1, 'monstro aparece na lista de monstros')
  ok((await listCharacters(project.id)).length === 3, 'lista geral soma personagens e monstros')

  // --- Editor de animações (etapa 4) --------------------------------------
  const animationConfig = {
    characterId: savedSoldier.id,
    name: 'Soldado Alfa Andando',
    kind: 'walk' as const,
    direction: 'frente' as const,
    fps: 8,
    loop: true,
    frames: Array.from({ length: 6 }, () => ({ hold: 1 }))
  }

  const animationPreview = await previewAnimation(animationConfig)
  ok(animationPreview.frames.length === 6, 'prévia devolve um quadro por batida')
  ok(
    animationPreview.width === 64 * 6 && animationPreview.height === 64,
    'spritesheet é horizontal e do tamanho do sprite'
  )
  ok(
    animationPreview.sheet.startsWith('data:image/png;base64,'),
    'spritesheet da prévia pronta para a tela'
  )
  ok(new Set(animationPreview.frames).size > 1, 'quadros têm poses diferentes entre si')
  ok(animationPreview.durationMs === 750, 'duração do ciclo calculada pelo FPS')

  const slowPreview = await previewAnimation({
    ...animationConfig,
    frames: animationConfig.frames.map((frame, index) => ({ hold: index === 0 ? 3 : 1 }))
  })
  ok(slowPreview.durationMs === 1000, 'espera por quadro altera a duração (8 batidas a 8 FPS)')

  const savedAnimation = await saveAnimation(project.id, animationConfig)
  ok(
    existsSync(join(project.path, 'animacoes', 'soldado-alfa-andando', 'soldado-alfa-andando_01.png')),
    'quadros salvos na pasta animacoes/'
  )
  ok(
    existsSync(join(project.path, 'animacoes', 'soldado-alfa-andando', 'soldado-alfa-andando_sheet.png')),
    'spritesheet salva junto dos quadros'
  )

  const animationSheet = JSON.parse(
    readFileSync(
      join(project.path, 'animacoes', 'soldado-alfa-andando', 'soldado-alfa-andando.json'),
      'utf8'
    )
  ) as {
    tipo: string
    fps: number
    repete: boolean
    quadros: Array<{ arquivo: string; espera: number }>
    folha: { colunas: number; largura: number }
  }
  ok(
    animationSheet.tipo === 'walk' && animationSheet.fps === 8 && animationSheet.repete === true,
    'ficha guarda tipo, FPS e repetição'
  )
  ok(
    animationSheet.quadros.length === 6 && animationSheet.folha.colunas === 6,
    'ficha descreve os quadros e as colunas da spritesheet'
  )
  ok(
    animationSheet.quadros.every((frame) => frame.espera === 1),
    'espera de cada quadro fica registrada na ficha'
  )

  const sheetPng = pngInfo(
    readFileSync(
      join(project.path, 'animacoes', 'soldado-alfa-andando', 'soldado-alfa-andando_sheet.png')
    )
  )
  ok(
    sheetPng.width === 384 && sheetPng.height === 64 && sheetPng.colorType === 6,
    'PNG da spritesheet tem 384x64 e transparência'
  )

  assert.throws(() => validateAnimationConfig({ ...animationConfig, name: 'a' }), /pelo menos 2/)
  checks += 1
  console.log('  ok  nome curto é recusado no editor de animações')
  assert.throws(
    () => validateAnimationConfig({ ...animationConfig, frames: [] }),
    /pelo menos um quadro/
  )
  checks += 1
  console.log('  ok  animação sem quadros é recusada')

  const clampedAnimation = validateAnimationConfig({ ...animationConfig, fps: 500 })
  ok(clampedAnimation.fps === 60, 'FPS é limitado a 60')

  const animationList = await listAnimations(project.id)
  ok(
    animationList.length === 1 && animationList[0]?.name === 'Soldado Alfa Andando',
    'animação aparece na lista do projeto'
  )
  ok(
    animationList[0]?.frameCount === 6 && animationList[0]?.sheetColumns === 6,
    'lista devolve quadros e colunas da spritesheet'
  )

  const planWithAnimations = await buildGodotExportPlan(project.id)
  ok(
    planWithAnimations.files.some(
      (file) =>
        file.relativePath ===
        'pixel_strike/recursos/animacoes/soldado-alfa-andando/soldado-alfa-andando_sheet.png'
    ),
    'spritesheet entra na exportação da Godot'
  )

  await removeAnimation(savedAnimation.id)
  ok((await listAnimations(project.id)).length === 0, 'animação removida sai da lista')
  ok(
    !existsSync(join(project.path, 'animacoes', 'soldado-alfa-andando')),
    'pasta da animação sai do projeto'
  )
  ok(
    readdirSync(join(dataDir, 'lixeira')).some((name) => name.includes('soldado-alfa-andando')),
    'animação removida vai para a lixeira interna'
  )

  await removeCharacter(savedSoldier.id)
  ok((await listCharacters(project.id, 'personagem')).length === 1, 'personagem removido sai da lista')
  ok(
    !existsSync(join(project.path, 'personagens', 'soldado-alfa')),
    'pasta do personagem sai do projeto'
  )
  ok(
    existsSync(join(dataDir, 'lixeira')) &&
      readdirSync(join(dataDir, 'lixeira')).some((name) => name.includes('soldado-alfa')),
    'sprites removidos vão para a lixeira interna'
  )

  // --- Remoção segura -----------------------------------------------------
  await removeProject(project.id, true)
  ok(!existsSync(project.path), 'pasta do projeto sai do lugar após remover')
  const trashEntry = join(dataDir, 'lixeira', 'projetos')
  ok(existsSync(trashEntry), 'arquivos removidos ficam na lixeira interna')
  ok((await listProjects()).length === 2, 'projeto removido sai da lista')
  const afterRemove = await readSettings()
  ok(afterRemove.activeProjectId !== project.id, 'projeto ativo é atualizado após remoção')

  // --- Validações de entrada ---------------------------------------------
  await assert.rejects(() => createProject({ name: 'a' }), /pelo menos 2 caracteres/)
  checks += 1
  console.log('  ok  nome curto é rejeitado com mensagem clara')

  await shutdownCore()
  console.log(`\n${checks} verificações aprovadas.`)
}

/** A limpeza é best-effort: no Windows o SQLite pode manter o arquivo aberto por instantes. */
function cleanup(): void {
  try {
    rmSync(root, { recursive: true, force: true })
  } catch {
    // A pasta temporária do sistema é limpa pelo próprio Windows depois.
  }
}

main()
  .then(() => {
    cleanup()
    process.exit(0)
  })
  .catch((error: unknown) => {
    console.error('\nFALHA nos testes:', error)
    cleanup()
    process.exit(1)
  })
