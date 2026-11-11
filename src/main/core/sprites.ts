import type {
  CharacterDirection,
  CharacterEquipment,
  CharacterSpec,
  MonsterArchetype,
  SpritePalette
} from '@shared/characters'
import type { PoseParams } from '../../shared/animations'
import { encodePng } from './png'

/**
 * Gerador de sprites em pixel art.
 *
 * - Desenha em uma grade lógica de 32x32 e amplia sem interpolação (32, 64 ou 96).
 * - Fundo sempre transparente; contorno automático de 1 pixel.
 * - Totalmente determinístico: a mesma semente gera sempre o mesmo sprite.
 */

const LOGICAL_SIZE = 32

/* ------------------------------------------------------------------- cores */

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => char + char)
          .join('')
      : clean
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0
  ]
}

function toHex(r: number, g: number, b: number): string {
  const part = (value: number): string =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** Clareia (amount > 0) ou escurece (amount < 0) uma cor. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex)
  if (amount >= 0) {
    return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
  }
  const factor = 1 + amount
  return toHex(r * factor, g * factor, b * factor)
}

/** Gerador pseudoaleatório estável para a mesma semente. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ canvas */

class Canvas {
  readonly size = LOGICAL_SIZE
  readonly pixels: Uint8Array

  constructor() {
    this.pixels = new Uint8Array(this.size * this.size * 4)
  }

  set(x: number, y: number, color: string | null): void {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return
    const index = (y * this.size + x) * 4
    if (color === null) {
      this.pixels[index] = 0
      this.pixels[index + 1] = 0
      this.pixels[index + 2] = 0
      this.pixels[index + 3] = 0
      return
    }
    const [r, g, b] = parseHex(color)
    this.pixels.set([r, g, b, 255], index)
  }

  clear(x: number, y: number): void {
    this.set(x, y, null)
  }

  opacity(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return 0
    return this.pixels[(y * this.size + x) * 4 + 3] ?? 0
  }

  rect(x: number, y: number, width: number, height: number, color: string): void {
    for (let dy = 0; dy < height; dy += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        this.set(x + dx, y + dy, color)
      }
    }
  }

  /** Contorno escuro ao redor de tudo o que não é transparente. */
  outline(color: string): void {
    const targets: Array<[number, number]> = []
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (this.opacity(x, y) !== 0) continue
        if (
          this.opacity(x - 1, y) > 0 ||
          this.opacity(x + 1, y) > 0 ||
          this.opacity(x, y - 1) > 0 ||
          this.opacity(x, y + 1) > 0
        ) {
          targets.push([x, y])
        }
      }
    }
    for (const [x, y] of targets) this.set(x, y, color)
  }

  mirror(): void {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size / 2; x += 1) {
        const mirrorX = this.size - 1 - x
        for (let channel = 0; channel < 4; channel += 1) {
          const a = (y * this.size + x) * 4 + channel
          const b = (y * this.size + mirrorX) * 4 + channel
          const temp = this.pixels[a] ?? 0
          this.pixels[a] = this.pixels[b] ?? 0
          this.pixels[b] = temp
        }
      }
    }
  }

  /** Move todos os pixels para perto (deslocamento em pixels da grade). */
  translate(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return
    const copy = this.pixels.slice()
    this.pixels.fill(0)
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const from = (y * this.size + x) * 4
        if (copy[from + 3] === 0) continue
        const targetX = x + dx
        const targetY = y + dy
        if (targetX < 0 || targetY < 0 || targetX >= this.size || targetY >= this.size) continue
        const to = (targetY * this.size + targetX) * 4
        this.pixels[to] = copy[from] ?? 0
        this.pixels[to + 1] = copy[from + 1] ?? 0
        this.pixels[to + 2] = copy[from + 2] ?? 0
        this.pixels[to + 3] = copy[from + 3] ?? 0
      }
    }
  }

  /** Inclina o desenho, jogando o topo para o lado (ancorado nos pés). */
  shear(amount: number): void {
    if (amount === 0) return
    const copy = this.pixels.slice()
    this.pixels.fill(0)
    for (let y = 0; y < this.size; y += 1) {
      const dx = Math.round((amount * (this.size - 1 - y)) / 12)
      if (dx === 0) continue
      for (let x = 0; x < this.size; x += 1) {
        const from = (y * this.size + x) * 4
        if (copy[from + 3] === 0) continue
        const targetX = x + dx
        if (targetX < 0 || targetX >= this.size) continue
        const to = (y * this.size + targetX) * 4
        this.pixels[to] = copy[from] ?? 0
        this.pixels[to + 1] = copy[from + 1] ?? 0
        this.pixels[to + 2] = copy[from + 2] ?? 0
        this.pixels[to + 3] = copy[from + 3] ?? 0
      }
    }
  }

  /** Escala vertical mantendo os pés no chão (agachar/esticar). */
  squashBottom(factor: number): void {
    if (factor === 1) return
    const copy = this.pixels.slice()
    this.pixels.fill(0)
    const safe = Math.max(0.5, Math.min(1.4, factor))
    const anchor = this.size - 1

    for (let y = 0; y < this.size; y += 1) {
      const sourceY = Math.round(anchor - (anchor - y) / safe)
      if (sourceY < 0 || sourceY >= this.size) continue
      for (let x = 0; x < this.size; x += 1) {
        const from = (sourceY * this.size + x) * 4
        if (copy[from + 3] === 0) continue
        const to = (y * this.size + x) * 4
        this.pixels[to] = copy[from] ?? 0
        this.pixels[to + 1] = copy[from + 1] ?? 0
        this.pixels[to + 2] = copy[from + 2] ?? 0
        this.pixels[to + 3] = copy[from + 3] ?? 0
      }
    }
  }

  /** Gira o desenho em um quarto de volta (1 = horário, -1 = anti-horário). */
  rotateQuarter(direction: -1 | 1): void {
    const copy = this.pixels.slice()
    this.pixels.fill(0)
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const from = (y * this.size + x) * 4
        if (copy[from + 3] === 0) continue
        const targetX = direction === 1 ? this.size - 1 - y : y
        const targetY = direction === 1 ? x : this.size - 1 - x
        const to = (targetY * this.size + targetX) * 4
        this.pixels[to] = copy[from] ?? 0
        this.pixels[to + 1] = copy[from + 1] ?? 0
        this.pixels[to + 2] = copy[from + 2] ?? 0
        this.pixels[to + 3] = copy[from + 3] ?? 0
      }
    }
  }

  /** Mistura um clarão por cima de tudo o que é opaco. */
  blend(color: string, amount: number): void {
    if (amount <= 0) return
    const [r, g, b] = parseHex(color)
    const ratio = Math.max(0, Math.min(1, amount))
    for (let index = 0; index < this.pixels.length; index += 4) {
      if ((this.pixels[index + 3] ?? 0) === 0) continue
      this.pixels[index] = Math.round((this.pixels[index] ?? 0) * (1 - ratio) + r * ratio)
      this.pixels[index + 1] = Math.round((this.pixels[index + 1] ?? 0) * (1 - ratio) + g * ratio)
      this.pixels[index + 2] = Math.round((this.pixels[index + 2] ?? 0) * (1 - ratio) + b * ratio)
    }
  }

  scaleTo(size: number): { width: number; height: number; pixels: Uint8Array } {
    const factor = Math.max(1, Math.round(size / this.size))
    const width = this.size * factor
    const height = this.size * factor
    const output = new Uint8Array(width * height * 4)

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceX = Math.floor(x / factor)
        const sourceY = Math.floor(y / factor)
        const from = (sourceY * this.size + sourceX) * 4
        const to = (y * width + x) * 4
        output[to] = this.pixels[from] ?? 0
        output[to + 1] = this.pixels[from + 1] ?? 0
        output[to + 2] = this.pixels[from + 2] ?? 0
        output[to + 3] = this.pixels[from + 3] ?? 0
      }
    }

    return { width, height, pixels: output }
  }
}

/* ------------------------------------------------------------- personagens */

function drawWeapon(
  canvas: Canvas,
  palette: SpritePalette,
  equipment: CharacterEquipment,
  direction: CharacterDirection
): void {
  if (equipment === 'nenhum') return

  const metal = '#2f333b'
  const metalLight = '#5b6270'
  const wood = '#7a5a34'

  if (equipment === 'rifle') {
    if (direction === 'costas') {
      canvas.rect(9, 15, 14, 2, metal)
      canvas.rect(9, 15, 4, 2, wood)
      return
    }
    if (direction === 'esquerda' || direction === 'direita') {
      canvas.rect(13, 18, 15, 2, metal)
      canvas.rect(13, 18, 5, 2, wood)
      canvas.rect(28, 18, 1, 1, metalLight)
      canvas.rect(16, 20, 2, 2, metal)
      return
    }
    canvas.rect(8, 18, 16, 2, metal)
    canvas.rect(8, 18, 4, 2, wood)
    canvas.rect(23, 18, 1, 1, metalLight)
    canvas.rect(12, 20, 2, 2, metal)
    return
  }

  if (equipment === 'pistola') {
    canvas.rect(20, 18, 4, 2, metal)
    canvas.rect(20, 20, 2, 2, metalLight)
    return
  }

  if (equipment === 'espada') {
    const blade = '#d7dde7'
    const edge = '#9aa3b2'
    if (direction === 'frente' || direction === 'costas') {
      canvas.rect(24, 9, 2, 11, blade)
      canvas.rect(24, 9, 1, 11, edge)
      canvas.rect(22, 19, 5, 1, wood)
      canvas.rect(23, 20, 3, 1, wood)
      return
    }
    canvas.rect(23, 10, 2, 10, blade)
    canvas.rect(22, 19, 4, 1, wood)
    return
  }

  if (equipment === 'escudo') {
    canvas.rect(7, 14, 4, 9, '#6b7280')
    canvas.rect(7, 14, 4, 1, '#9aa3b2')
    canvas.rect(7, 22, 4, 1, '#3f4652')
    canvas.rect(8, 16, 2, 5, palette.detalhe)
  }
}

function drawHumanoid(
  canvas: Canvas,
  palette: SpritePalette,
  seed: number,
  direction: CharacterDirection,
  options: { boss: boolean; equipment: CharacterEquipment; glowingEyes: boolean; stance?: number }
): void {
  const random = mulberry32(seed)
  const rng = (): number => random()
  const swing = Math.max(-2, Math.min(2, Math.round(options.stance ?? 0)))
  const clothShadow = shade(palette.roupa, -0.22)
  const clothLight = shade(palette.roupa, 0.14)
  const skinShadow = shade(palette.pele, -0.18)
  const pantsShadow = shade(palette.calca, -0.2)
  const eyeColor = options.glowingEyes ? palette.detalhe : palette.contorno

  if (direction === 'costas') {
    // pernas e botas (o passo desloca cada perna para um lado)
    canvas.rect(12 - swing, 23, 3, 7 - Math.abs(swing), palette.calca)
    canvas.rect(17 + swing, 23, 3, 7 - Math.abs(swing), palette.calca)
    canvas.rect(11 - swing, 28 + Math.abs(swing), 4, 2, palette.bota)
    canvas.rect(17 + swing, 28 + Math.abs(swing), 4, 2, palette.bota)

    // mochila quando a semente pede
    if (seed % 3 === 0) {
      canvas.rect(11, 14, 10, 8, palette.detalhe)
      canvas.rect(11, 14, 2, 8, clothShadow)
      canvas.rect(13, 17, 6, 1, shade(palette.detalhe, 0.25))
    } else {
      canvas.rect(11, 13, 10, 10, palette.roupa)
      canvas.rect(15, 13, 2, 10, clothShadow)
    }

    canvas.rect(9, 14, 2, 8, palette.roupa)
    canvas.rect(21, 14, 2, 8, palette.roupa)
    canvas.rect(9, 21, 2, 2, palette.pele)
    canvas.rect(21, 21, 2, 2, palette.pele)
    canvas.rect(15, 12, 2, 2, skinShadow)

    canvas.rect(12, 4, 8, 8, palette.pele)
    canvas.rect(12, 4, 8, 7, palette.cabelo)
    canvas.rect(12, 10, 1, 2, palette.cabelo)
    canvas.rect(19, 10, 1, 2, palette.cabelo)

    drawWeapon(canvas, palette, options.equipment, direction)
    canvas.outline(palette.contorno)
    return
  }

  if (direction === 'esquerda' || direction === 'direita') {
    canvas.rect(14 - swing, 23, 3, 7 - Math.abs(swing), palette.calca)
    canvas.rect(17 + swing, 23, 3, 7 - Math.abs(swing), pantsShadow)
    canvas.rect(13 - swing, 28 + Math.abs(swing), 4, 2, palette.bota)
    canvas.rect(17 + swing, 28 + Math.abs(swing), 4, 2, palette.bota)

    canvas.rect(13, 13, 7, 10, palette.roupa)
    canvas.rect(13, 20, 7, 3, palette.detalhe)
    canvas.rect(13, 13, 1, 10, clothShadow)
    canvas.rect(19, 13, 1, 10, clothLight)

    canvas.rect(15, 14, 2, 8, clothShadow)
    canvas.rect(15, 21, 2, 2, palette.pele)

    canvas.rect(13, 4, 7, 8, palette.pele)
    canvas.rect(13, 4, 7, 3, palette.cabelo)
    canvas.rect(13, 7, 2, 3, palette.cabelo)
    canvas.rect(20, 9, 1, 1, palette.pele)
    canvas.rect(13, 12, 8, 1, skinShadow)

    canvas.set(17, 9, eyeColor)
    canvas.set(18, 11, skinShadow)

    drawWeapon(canvas, palette, options.equipment, direction)
    canvas.outline(palette.contorno)
    if (direction === 'esquerda') canvas.mirror()
    return
  }

  // frente
  canvas.rect(12 - swing, 23, 3, 7 - Math.abs(swing), palette.calca)
  canvas.rect(17 + swing, 23, 3, 7 - Math.abs(swing), pantsShadow)
  canvas.rect(11 - swing, 28 + Math.abs(swing), 4, 2, palette.bota)
  canvas.rect(17 + swing, 28 + Math.abs(swing), 4, 2, palette.bota)

  canvas.rect(11, 13, 10, 10, palette.roupa)
  canvas.rect(15, 13, 2, 7, clothShadow)
  canvas.rect(11, 20, 10, 3, palette.detalhe)
  canvas.rect(15, 20, 2, 3, shade(palette.detalhe, -0.2))

  canvas.rect(9, 14, 2, 7 + swing, palette.roupa)
  canvas.rect(21, 14, 2, 7 - swing, palette.roupa)
  canvas.rect(9, 20 + swing, 2, 2, palette.pele)
  canvas.rect(21, 20 - swing, 2, 2, palette.pele)

  if (seed % 2 === 0) {
    canvas.rect(9, 13, 3, 2, clothShadow)
    canvas.rect(20, 13, 3, 2, clothShadow)
  }

  canvas.rect(15, 12, 2, 2, skinShadow)
  canvas.rect(12, 4, 8, 8, palette.pele)
  canvas.rect(12, 4, 8, 3, palette.cabelo)
  canvas.rect(12, 7, 1, 2, palette.cabelo)
  canvas.rect(19, 7, 1, 2, palette.cabelo)

  canvas.set(14, 9, eyeColor)
  canvas.set(17, 9, eyeColor)
  canvas.rect(15, 11, 2, 1, skinShadow)

  // manchas de camuflagem
  const specks = 5 + (seed % 4)
  for (let index = 0; index < specks; index += 1) {
    const x = 11 + Math.floor(rng() * 10)
    const y = 14 + Math.floor(rng() * 6)
    canvas.set(x, y, rng() > 0.5 ? clothShadow : clothLight)
  }

  if (options.boss) {
    const horn = '#d7dde7'
    const hornShadow = '#8f98a8'
    canvas.rect(9, 3, 2, 4, horn)
    canvas.rect(9, 7, 2, 1, hornShadow)
    canvas.rect(21, 3, 2, 4, horn)
    canvas.rect(21, 7, 2, 1, hornShadow)
    canvas.rect(11, 13, 10, 1, shade(palette.detalhe, 0.35))
  }

  drawWeapon(canvas, palette, options.equipment, direction)
  canvas.outline(palette.contorno)
}

/* ----------------------------------------------------------------- monstros */

function drawQuadruped(
  canvas: Canvas,
  palette: SpritePalette,
  seed: number,
  stance = 0
): void {
  const bodyShadow = shade(palette.roupa, -0.2)
  const bodyLight = shade(palette.roupa, 0.15)
  const swing = Math.max(-2, Math.min(2, Math.round(stance)))

  // cauda
  canvas.rect(23, 12, 4, 2, bodyShadow)
  canvas.rect(26, 10, 2, 3, bodyShadow)

  // corpo e lombo
  canvas.rect(8, 14, 16, 7, palette.roupa)
  canvas.rect(8, 14, 16, 2, bodyLight)
  canvas.rect(8, 19, 16, 2, bodyShadow)

  // cabeça e focinho
  canvas.rect(4, 12, 8, 7, palette.roupa)
  canvas.rect(2, 15, 3, 3, shade(palette.roupa, -0.1))
  canvas.rect(5, 11, 2, 2, palette.detalhe)
  canvas.set(9, 14, palette.detalhe)
  canvas.set(7, 15, palette.contorno)
  canvas.rect(2, 18, 1, 1, '#f8fafc')

  // dentes
  if (seed % 2 === 0) {
    canvas.set(3, 18, '#e5e7eb')
    canvas.set(5, 18, '#e5e7eb')
  }

  // patas (o passo alterna as patas da frente e de trás)
  canvas.rect(9 + swing, 21, 2, 6 - Math.abs(swing), palette.calca)
  canvas.rect(12 - swing, 21, 2, 5, bodyShadow)
  canvas.rect(18 + swing, 21, 2, 5, bodyShadow)
  canvas.rect(21 - swing, 21, 2, 6 - Math.abs(swing), palette.calca)
  canvas.rect(9 + swing, 26 + Math.abs(swing), 3, 1, palette.bota)
  canvas.rect(21 - swing, 26 + Math.abs(swing), 3, 1, palette.bota)

  canvas.outline(palette.contorno)
}

function drawSlime(canvas: Canvas, palette: SpritePalette, seed: number): void {
  const light = shade(palette.roupa, 0.28)
  const deep = shade(palette.roupa, -0.25)

  const rows: Array<[number, number, number]> = [
    [14, 12, 8],
    [15, 10, 12],
    [16, 9, 14],
    [17, 8, 16],
    [18, 8, 16],
    [19, 8, 16],
    [20, 9, 14],
    [21, 10, 12],
    [22, 12, 8]
  ]

  for (const [y, x, width] of rows) {
    canvas.rect(x, y, width, 1, palette.roupa)
  }

  canvas.rect(10, 17, 3, 2, light)
  canvas.set(12, 16, light)
  canvas.rect(9, 21, 14, 1, deep)

  const eyeShift = seed % 2 === 0 ? 0 : 1
  canvas.rect(12 + eyeShift, 17, 2, 2, '#f8fafc')
  canvas.rect(18 + eyeShift, 17, 2, 2, '#f8fafc')
  canvas.set(13 + eyeShift, 18, palette.contorno)
  canvas.set(19 + eyeShift, 18, palette.contorno)
  canvas.rect(15, 20, 3, 1, deep)

  if (seed % 3 === 0) {
    canvas.set(11, 19, light)
    canvas.set(21, 19, light)
  }

  canvas.outline(palette.contorno)
}

function drawFlyer(canvas: Canvas, palette: SpritePalette, seed: number): void {
  const membrane = shade(palette.roupa, -0.15)
  const bone = shade(palette.roupa, -0.35)

  // asas
  for (let index = 0; index < 7; index += 1) {
    canvas.rect(3 + index, 12 + index, 7 - Math.floor(index / 2), 1, membrane)
    canvas.rect(22 + Math.floor(index / 2), 12 + index, 7 - index, 1, membrane)
  }
  canvas.rect(4, 12, 6, 1, bone)
  canvas.rect(22, 12, 6, 1, bone)

  // corpo
  canvas.rect(12, 13, 8, 11, palette.roupa)
  canvas.rect(13, 14, 6, 3, shade(palette.roupa, 0.2))
  canvas.rect(13, 22, 6, 3, shade(palette.roupa, -0.2))

  // cabeça, olhos e presas
  canvas.rect(12, 9, 8, 5, palette.roupa)
  canvas.rect(13, 10, 2, 2, palette.detalhe)
  canvas.rect(17, 10, 2, 2, palette.detalhe)
  canvas.set(13, 10, '#f8fafc')
  canvas.set(18, 10, '#f8fafc')
  canvas.set(14, 13, '#f8fafc')
  canvas.set(17, 13, '#f8fafc')

  // garras
  canvas.rect(12, 25, 2, 3, bone)
  canvas.rect(18, 25, 2, 3, bone)
  if (seed % 2 === 0) {
    canvas.set(11, 27, palette.detalhe)
    canvas.set(20, 27, palette.detalhe)
  }

  canvas.outline(palette.contorno)
}

function drawMonster(canvas: Canvas, spec: CharacterSpec, stance = 0): void {
  const archetype: MonsterArchetype = spec.archetype
  const boss = spec.role === 'chefe'

  if (archetype === 'quadrupede') {
    drawQuadruped(canvas, spec.palette, spec.seed, stance)
  } else if (archetype === 'slime') {
    drawSlime(canvas, spec.palette, spec.seed)
  } else if (archetype === 'voador') {
    drawFlyer(canvas, spec.palette, spec.seed)
  } else {
    drawHumanoid(canvas, spec.palette, spec.seed, 'frente', {
      boss,
      equipment: 'nenhum',
      glowingEyes: true,
      stance
    })

    // garras no lugar das mãos
    canvas.rect(8, 21, 3, 2, spec.palette.detalhe)
    canvas.rect(21, 21, 3, 2, spec.palette.detalhe)

    if (boss) {
      canvas.rect(10, 2, 2, 3, '#d7dde7')
      canvas.rect(20, 2, 2, 3, '#d7dde7')
      canvas.rect(11, 25, 10, 1, shade(spec.palette.detalhe, -0.4))
    }
  }
}

/* -------------------------------------------------------------------- API */

/** Desenha um sprite em 32x32 e devolve o PNG ampliado para o tamanho pedido. */
export function renderSprite(
  spec: CharacterSpec,
  direction: CharacterDirection,
  stance = 0
): Buffer {
  const canvas = new Canvas()
  const palette = spec.palette

  if (spec.category === 'monstro') {
    drawMonster(canvas, { ...spec, category: 'monstro' })
    if (direction === 'esquerda' || direction === 'direita') {
      // Monstros usam o mesmo desenho; o lado esquerdo é espelhado.
      if (direction === 'esquerda') canvas.mirror()
    } else if (direction === 'costas') {
      // Costas: sem olhos, apenas a silhueta.
      canvas.rect(12, 9, 8, 5, palette.roupa)
    }
  } else {
    drawHumanoid(canvas, palette, spec.seed, direction, {
      boss: false,
      equipment: spec.equipment,
      glowingEyes: false,
      stance
    })
  }

  const scaled = canvas.scaleTo(spec.size)
  return encodePng(scaled.width, scaled.height, scaled.pixels)
}

export function renderAllDirections(
  spec: CharacterSpec,
  directions: CharacterSpec['directions']
): Array<{ direction: CharacterDirection; png: Buffer }> {
  return directions.map((direction) => ({
    direction,
    png: renderSprite(spec, direction)
  }))
}

/**
 * Desenha um sprite com a pose de um quadro de animação.
 *
 * A ordem importa: primeiro a pose é desenhada (postura das pernas), depois o
 * desenho é inclinado, agachado, deslocado, girado e por fim recebe o clarão.
 */
export function renderPose(
  spec: CharacterSpec,
  direction: CharacterDirection,
  pose: PoseParams
): Buffer {
  const frame = renderPosePixels(spec, direction, pose)
  return encodePng(frame.width, frame.height, frame.pixels)
}

/** Mesma pose, mas devolvendo os pixels (usado para montar a spritesheet). */
export function renderPosePixels(
  spec: CharacterSpec,
  direction: CharacterDirection,
  pose: PoseParams
): { width: number; height: number; pixels: Uint8Array } {
  const canvas = new Canvas()
  const palette = spec.palette
  const stance = pose.stance

  if (spec.category === 'monstro') {
    drawMonster(canvas, spec, stance)
    if (direction === 'esquerda' || direction === 'direita') {
      if (direction === 'esquerda') canvas.mirror()
    } else if (direction === 'costas') {
      canvas.rect(12, 9, 8, 5, palette.roupa)
    }
  } else {
    drawHumanoid(canvas, palette, spec.seed, direction, {
      boss: false,
      equipment: spec.equipment,
      glowingEyes: false,
      stance
    })
  }

  if (pose.lean !== 0) canvas.shear(pose.lean)
  if (pose.squash !== 1) canvas.squashBottom(pose.squash)
  if (pose.shift !== 0 || pose.bob !== 0) canvas.translate(pose.shift, pose.bob)
  if (pose.rotate !== 0) canvas.rotateQuarter(pose.rotate)
  if (pose.flash > 0) canvas.blend(pose.flashColor, pose.flash)

  return canvas.scaleTo(spec.size)
}

export function toDataUrl(png: Buffer): string {
  return `data:image/png;base64,${png.toString('base64')}`
}
