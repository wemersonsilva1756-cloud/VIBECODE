import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AnimationAsset,
  AnimationConfig,
  AnimationKind,
  AnimationPreview
} from '../../shared/animations'
import {
  ANIMATION_KINDS,
  DEFAULT_FPS,
  DEFAULT_FRAME_COUNT,
  poseForFrame
} from '../../shared/animations'
import type { CharacterCategory, CharacterDirection, CharacterSpec } from '../../shared/characters'
import { DIRECTIONS } from '../../shared/characters'
import { execute, queryAll, queryOne } from './database'
import { getProject } from './projects'
import { ensureDir, isDirectory, moveToTrash, pathExists } from './filesystem'
import { slugify, timestampSlug } from './naming'
import { encodePng } from './png'
import { renderPosePixels, toDataUrl } from './sprites'
import { logActivity } from './activity'

/**
 * Editor de animações (etapa 4).
 *
 * Cada animação nasce de um personagem ou monstro salvo no projeto: os quadros
 * são desenhados pelo motor procedural em poses diferentes, gravados como PNGs
 * individuais, uma spritesheet horizontal e uma ficha JSON com FPS, repetição e
 * espera de cada quadro.
 */

const FOLDER = 'animacoes'
const MAX_FRAMES = 24
const MAX_NAME = 60

let trashDir = ''

export function configureAnimations(options: { trashDir: string }): void {
  trashDir = options.trashDir
}

interface CharacterSource {
  projectId: string
  name: string
  category: CharacterCategory
  spec: CharacterSpec
}

interface CharacterRow {
  project_id: string
  kind: string
  name: string
  data: string
}

/** Lê a ficha do personagem/monstro que serve de base para a animação. */
async function loadCharacter(characterId: string): Promise<CharacterSource> {
  const row = await queryOne<CharacterRow>(
    `SELECT project_id, kind, name, data FROM assets
     WHERE id = ? AND kind IN ('personagem', 'monstro')`,
    [characterId]
  )
  if (!row) throw new Error('O personagem escolhido não existe mais no projeto.')

  try {
    const parsed = JSON.parse(row.data) as { spec: CharacterSpec }
    return {
      projectId: row.project_id,
      name: row.name,
      category: row.kind === 'monstro' ? 'monstro' : 'personagem',
      spec: parsed.spec
    }
  } catch {
    throw new Error('A ficha do personagem está corrompida e não pôde ser lida.')
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

/** Valida e normaliza a configuração vinda da interface. */
export function validateAnimationConfig(input: AnimationConfig): AnimationConfig {
  const name = String(input.name ?? '').trim()
  if (name.length < 2) throw new Error('O nome da animação precisa ter pelo menos 2 caracteres.')
  if (name.length > MAX_NAME) {
    throw new Error(`O nome da animação pode ter no máximo ${MAX_NAME} caracteres.`)
  }

  const kind: AnimationKind = ANIMATION_KINDS.includes(input.kind) ? input.kind : 'idle'
  const direction: CharacterDirection = DIRECTIONS.includes(input.direction)
    ? input.direction
    : 'frente'

  const fps = clamp(Number(input.fps) || DEFAULT_FPS[kind], 1, 60)

  const frames = (Array.isArray(input.frames) ? input.frames : [])
    .map((frame) => ({ hold: clamp(Number(frame?.hold) || 1, 1, 8) }))
    .slice(0, MAX_FRAMES)

  if (frames.length === 0) throw new Error('A animação precisa de pelo menos um quadro.')

  return {
    characterId: String(input.characterId ?? ''),
    name,
    kind,
    direction,
    fps,
    loop: Boolean(input.loop),
    frames
  }
}

export interface RenderedFrame {
  width: number
  height: number
  pixels: Uint8Array
  png: Buffer
}

/** Desenha todos os quadros da animação em memória (nada é gravado). */
export function renderFrames(spec: CharacterSpec, config: AnimationConfig): RenderedFrame[] {
  return config.frames.map((_, index) => {
    const pose = poseForFrame(config.kind, index, config.frames.length)
    const frame = renderPosePixels(spec, config.direction, pose)
    return {
      ...frame,
      png: encodePng(frame.width, frame.height, frame.pixels)
    }
  })
}

/** Monta a spritesheet horizontal a partir dos quadros já renderizados. */
export function buildSpritesheet(frames: RenderedFrame[]): {
  width: number
  height: number
  columns: number
  pixels: Uint8Array
  png: Buffer
} {
  if (frames.length === 0) throw new Error('Não há quadros para montar a spritesheet.')

  const first = frames[0]
  if (!first) throw new Error('Não há quadros para montar a spritesheet.')

  const width = first.width * frames.length
  const height = first.height
  const pixels = new Uint8Array(width * height * 4)

  frames.forEach((frame, index) => {
    const offsetX = index * first.width
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) {
        const from = (y * frame.width + x) * 4
        const to = (y * width + offsetX + x) * 4
        pixels[to] = frame.pixels[from] ?? 0
        pixels[to + 1] = frame.pixels[from + 1] ?? 0
        pixels[to + 2] = frame.pixels[from + 2] ?? 0
        pixels[to + 3] = frame.pixels[from + 3] ?? 0
      }
    }
  })

  return { width, height, columns: frames.length, pixels, png: encodePng(width, height, pixels) }
}

/** Duração total em milissegundos (espera de cada quadro dividida pelo FPS). */
export function animationDurationMs(config: AnimationConfig): number {
  const beats = config.frames.reduce((total, frame) => total + frame.hold, 0)
  return Math.round((beats / config.fps) * 1000)
}

/** Pré-visualização completa: quadros, spritesheet e duração. */
export async function previewAnimation(input: AnimationConfig): Promise<AnimationPreview> {
  const config = validateAnimationConfig(input)
  if (!config.characterId) throw new Error('Escolha o personagem que serve de base.')
  const character = await loadCharacter(config.characterId)

  const frames = renderFrames(validatedSpec(character.spec, config), config)
  const sheet = buildSpritesheet(frames)

  return {
    frames: frames.map((frame) => toDataUrl(frame.png)),
    sheet: toDataUrl(sheet.png),
    width: sheet.width,
    height: sheet.height,
    durationMs: animationDurationMs(config)
  }
}

function validatedSpec(spec: CharacterSpec, config: AnimationConfig): CharacterSpec {
  // O tamanho e a paleta vêm do personagem; nada é reinterpretado aqui.
  return { ...spec, size: spec.size, directions: [config.direction] }
}

function uniqueFolder(parent: string, slug: string): string {
  let candidate = join(parent, slug)
  let counter = 2
  while (pathExists(candidate)) {
    candidate = join(parent, `${slug}-${counter}`)
    counter += 1
  }
  return candidate
}

function frameFileName(slug: string, index: number): string {
  return `${slug}_${String(index + 1).padStart(2, '0')}.png`
}

/** Grava a animação (PNGs, spritesheet e ficha JSON) no projeto. */
export async function saveAnimation(
  projectId: string,
  input: AnimationConfig
): Promise<AnimationAsset> {
  const config = validateAnimationConfig(input)
  if (!config.characterId) throw new Error('Escolha o personagem que serve de base.')

  const project = await getProject(projectId)
  if (!project.folderExists) {
    throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
  }

  const character = await loadCharacter(config.characterId)
  if (character.projectId !== projectId) {
    throw new Error('Este personagem pertence a outro projeto.')
  }

  const parent = join(project.path, FOLDER)
  ensureDir(parent)
  const folder = uniqueFolder(parent, slugify(config.name))
  ensureDir(folder)
  const slug = folder.split(/[\\/]/).pop() ?? slugify(config.name)

  const spec = validatedSpec(character.spec, config)
  const frames = renderFrames(spec, config)
  const sheet = buildSpritesheet(frames)

  const savedFrames: Array<{ file: string; hold: number }> = []
  frames.forEach((frame, index) => {
    const fileName = frameFileName(slug, index)
    writeFileSync(join(folder, fileName), frame.png)
    savedFrames.push({ file: fileName, hold: config.frames[index]?.hold ?? 1 })
  })

  const sheetFile = `${slug}_sheet.png`
  writeFileSync(join(folder, sheetFile), sheet.png)

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const durationMs = animationDurationMs(config)
  const jsonPath = `${FOLDER}/${slug}/${slug}.json`

  const sheetJson = {
    formato: 1,
    id,
    geradoPor: 'Pixel Strike Studio',
    geradoEm: createdAt,
    nome: config.name,
    personagem: {
      id: config.characterId,
      nome: character.name,
      categoria: character.category,
      semente: character.spec.seed
    },
    tipo: config.kind,
    direcao: config.direction,
    fps: config.fps,
    repete: config.loop,
    duracaoSegundos: Number((durationMs / 1000).toFixed(3)),
    quadros: savedFrames.map((frame) => ({ arquivo: frame.file, espera: frame.hold })),
    folha: {
      arquivo: sheetFile,
      colunas: sheet.columns,
      largura: sheet.width,
      altura: sheet.height
    }
  }

  writeFileSync(join(folder, `${slug}.json`), `${JSON.stringify(sheetJson, null, 2)}\n`, 'utf8')

  const data = JSON.stringify({
    folder: `${FOLDER}/${slug}`,
    kind: config.kind,
    direction: config.direction,
    fps: config.fps,
    loop: config.loop,
    frameCount: frames.length,
    durationMs,
    sheetPath: `${FOLDER}/${slug}/${sheetFile}`,
    sheetColumns: sheet.columns,
    characterName: character.name,
    characterCategory: character.category,
    frames: savedFrames
  })

  await execute(
    `INSERT INTO assets (id, project_id, kind, name, origin, relative_path, data, created_at, updated_at)
     VALUES (?, ?, 'animacao', ?, 'gerado', ?, ?, ?, ?)`,
    [id, projectId, config.name, jsonPath, data, createdAt, createdAt]
  )

  await logActivity(
    projectId,
    'animacao.criada',
    `Animação "${config.name}" (${config.kind}, ${config.direction}) gerada em ${FOLDER}/${slug}.`
  )

  return {
    id,
    projectId,
    name: config.name,
    folder: `${FOLDER}/${slug}`,
    jsonPath,
    kind: config.kind,
    direction: config.direction,
    fps: config.fps,
    loop: config.loop,
    frameCount: frames.length,
    durationMs,
    sheetPath: `${FOLDER}/${slug}/${sheetFile}`,
    sheetColumns: sheet.columns,
    characterName: character.name,
    characterCategory: character.category,
    createdAt
  }
}

interface AnimationRow {
  id: string
  project_id: string
  name: string
  relative_path: string
  data: string
  created_at: string
}

function toAnimation(row: AnimationRow): AnimationAsset | null {
  try {
    const parsed = JSON.parse(row.data) as {
      kind: AnimationKind
      direction: CharacterDirection
      fps: number
      loop: boolean
      frameCount: number
      durationMs: number
      sheetPath: string
      sheetColumns: number
      characterName: string
      characterCategory: CharacterCategory
      folder: string
    }
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      folder: parsed.folder,
      jsonPath: row.relative_path,
      kind: parsed.kind,
      direction: parsed.direction,
      fps: parsed.fps,
      loop: parsed.loop,
      frameCount: parsed.frameCount,
      durationMs: parsed.durationMs,
      sheetPath: parsed.sheetPath,
      sheetColumns: parsed.sheetColumns,
      characterName: parsed.characterName,
      characterCategory: parsed.characterCategory,
      createdAt: row.created_at
    }
  } catch {
    return null
  }
}

/** Lista as animações salvas no projeto. */
export async function listAnimations(projectId: string): Promise<AnimationAsset[]> {
  const rows = await queryAll<AnimationRow>(
    `SELECT id, project_id, name, relative_path, data, created_at
     FROM assets WHERE project_id = ? AND kind = 'animacao' ORDER BY created_at DESC`,
    [projectId]
  )
  return rows.map(toAnimation).filter((asset): asset is AnimationAsset => asset !== null)
}

/** Move a pasta da animação para a lixeira e remove o registro. */
export async function removeAnimation(assetId: string): Promise<void> {
  const row = await queryOne<AnimationRow>(
    'SELECT id, project_id, name, relative_path, data, created_at FROM assets WHERE id = ?',
    [assetId]
  )
  if (!row) throw new Error('Esta animação não existe mais.')

  const asset = toAnimation(row)
  const project = await getProject(row.project_id)

  if (asset && project.folderExists) {
    const folder = join(project.path, asset.folder)
    if (isDirectory(folder)) {
      if (!trashDir) throw new Error('A lixeira do Studio não está configurada.')
      moveToTrash(folder, trashDir, `${timestampSlug(new Date())}_${slugify(asset.name)}`)
    }
  }

  await execute('DELETE FROM assets WHERE id = ?', [assetId])
  await logActivity(row.project_id, 'animacao.removida', `Animação "${row.name}" movida para a lixeira.`)
}

/** Leitura da ficha salva em disco (usada nos testes). */
export function readAnimationSheet(projectPath: string, jsonPath: string): unknown {
  return JSON.parse(readFileSync(join(projectPath, jsonPath), 'utf8'))
}

/** Quadros sugeridos para começar uma animação nova. */
export function defaultFrameConfig(kind: AnimationKind): Array<{ hold: number }> {
  return Array.from({ length: DEFAULT_FRAME_COUNT[kind] }, () => ({ hold: 1 }))
}
