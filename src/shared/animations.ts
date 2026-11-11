import type { CharacterCategory, CharacterDirection, CharacterSpec } from './characters'

/**
 * Tipos do editor de animações (etapa 4).
 *
 * As animações são geradas a partir de um personagem ou monstro já salvo no
 * projeto. Cada quadro é desenhado pelo mesmo motor procedural do sprite, com
 * uma pose diferente (balanço, inclinação, agachamento, clarão), e o resultado
 * é gravado como PNGs individuais + spritesheet horizontal + ficha JSON.
 */

export type AnimationKind =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'shoot'
  | 'reload'
  | 'death'
  | 'hit'
  | 'heal'
  | 'skill'

export const ANIMATION_KINDS: AnimationKind[] = [
  'idle',
  'walk',
  'run',
  'attack',
  'shoot',
  'reload',
  'death',
  'hit',
  'heal',
  'skill'
]

export const ANIMATION_KIND_LABELS: Record<AnimationKind, string> = {
  idle: 'Parado (idle)',
  walk: 'Andando',
  run: 'Correndo',
  attack: 'Ataque',
  shoot: 'Tiro',
  reload: 'Recarregar',
  death: 'Morte',
  hit: 'Dano recebido',
  heal: 'Cura',
  skill: 'Habilidade'
}

export const ANIMATION_KIND_HINTS: Record<AnimationKind, string> = {
  idle: 'Respiração leve, ciclo curto que repete para sempre.',
  walk: 'Passos alternados com balanço do corpo.',
  run: 'Passos maiores, corpo inclinado e mais rápido.',
  attack: 'Avança para frente no golpe e volta.',
  shoot: 'Recuo curto, clarão no momento do disparo.',
  reload: 'Agacha um pouco, mexe nas mãos e volta.',
  death: 'Tomba para o lado e fica no chão (não repete).',
  hit: 'Tremida curta com clarão vermelho.',
  heal: 'Clarão verde pulsando, sem repetir.',
  skill: 'Clarão azul de energia em três intensidades.'
}

/** Quadros sugeridos para cada tipo de animação. */
export const DEFAULT_FRAME_COUNT: Record<AnimationKind, number> = {
  idle: 4,
  walk: 6,
  run: 6,
  attack: 4,
  shoot: 3,
  reload: 5,
  death: 6,
  hit: 2,
  heal: 4,
  skill: 5
}

/** FPS sugerido para cada tipo de animação. */
export const DEFAULT_FPS: Record<AnimationKind, number> = {
  idle: 4,
  walk: 8,
  run: 12,
  attack: 10,
  shoot: 12,
  reload: 8,
  death: 8,
  hit: 12,
  heal: 6,
  skill: 8
}

/** Animações que não devem repetir por padrão. */
export const NON_LOOPING_KINDS: AnimationKind[] = ['death', 'heal', 'hit']

export interface AnimationFrameConfig {
  /** Quantas "batidas" este quadro fica na tela (1 a 8). */
  hold: number
}

export interface AnimationConfig {
  /** Personagem ou monstro salvo que serve de base. */
  characterId: string
  name: string
  kind: AnimationKind
  direction: CharacterDirection
  fps: number
  loop: boolean
  /** Quadros com a espera de cada um. */
  frames: AnimationFrameConfig[]
}

export interface AnimationAsset {
  id: string
  projectId: string
  name: string
  folder: string
  jsonPath: string
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
  createdAt: string
}

export interface AnimationPreview {
  frames: string[]
  sheet: string
  width: number
  height: number
  durationMs: number
}

/** Pose calculada para um quadro. O motor de sprites aplica estes valores. */
export interface PoseParams {
  /** Deslocamento vertical em pixels da grade (negativo sobe). */
  bob: number
  /** Inclinação por linha (positivo joga o topo para a direita). */
  lean: number
  /** Balanço de pernas e braços, de -2 a 2. */
  stance: number
  /** Escala vertical ancorada nos pés (1 = normal, 0.9 = agachado). */
  squash: number
  /** Quarto de volta: 1 = horário, -1 = anti-horário, 0 = sem rotação. */
  rotate: -1 | 0 | 1
  /** Intensidade do clarão (0 a 1). */
  flash: number
  flashColor: string
  /** Deslocamento horizontal do corpo inteiro. */
  shift: number
}

export function neutralPose(): PoseParams {
  return {
    bob: 0,
    lean: 0,
    stance: 0,
    squash: 1,
    rotate: 0,
    flash: 0,
    flashColor: '#ffffff',
    shift: 0
  }
}

/**
 * Pose de um quadro. `index` vai de 0 a `count - 1` e cada tipo de animação tem
 * um ciclo próprio — tudo determinístico, sem sorteio.
 */
export function poseForFrame(kind: AnimationKind, index: number, count: number): PoseParams {
  const pose = neutralPose()
  const i = Math.max(0, Math.min(count - 1, index))

  switch (kind) {
    case 'idle': {
      const cycle = [0, -1, -1, 0]
      pose.bob = cycle[i % cycle.length] ?? 0
      pose.stance = i % 2 === 0 ? 0 : 1
      break
    }
    case 'walk': {
      const stance = [1, 1, 0, -1, -1, 0]
      pose.stance = stance[i % stance.length] ?? 0
      pose.bob = i % 2 === 0 ? 0 : -1
      break
    }
    case 'run': {
      const stance = [2, 1, 0, -2, -1, 0]
      pose.stance = stance[i % stance.length] ?? 0
      pose.bob = i % 2 === 0 ? 0 : -2
      pose.lean = 1
      break
    }
    case 'attack': {
      const shift = [0, 1, 3, 1]
      pose.shift = shift[i % shift.length] ?? 0
      pose.lean = i === 2 ? 2 : i === 3 ? 1 : 0
      pose.stance = i >= 1 && i <= 2 ? 1 : 0
      pose.flash = i === 2 ? 0.35 : 0
      pose.flashColor = '#fca5a5'
      break
    }
    case 'shoot': {
      const shift = [-1, -2, -1]
      pose.shift = shift[i % shift.length] ?? 0
      pose.bob = i === 1 ? -1 : 0
      pose.flash = i === 1 ? 0.5 : 0
      pose.flashColor = '#fde68a'
      break
    }
    case 'reload': {
      const squash = [0.98, 0.94, 0.94, 0.98, 1]
      pose.squash = squash[i % squash.length] ?? 1
      pose.bob = i === 1 || i === 2 ? 1 : 0
      pose.stance = i % 2 === 0 ? 0 : -1
      break
    }
    case 'death': {
      pose.rotate = index >= Math.ceil(count / 2) ? 1 : 0
      pose.bob = index < Math.ceil(count / 2) ? -index : 0
      pose.lean = index < Math.ceil(count / 2) ? 1 + index : 0
      pose.flash = index === 0 ? 0.7 : index === 1 ? 0.3 : 0
      pose.flashColor = '#f87171'
      break
    }
    case 'hit': {
      pose.shift = i === 0 ? -2 : -1
      pose.flash = i === 0 ? 0.75 : 0.4
      pose.flashColor = '#f87171'
      break
    }
    case 'heal': {
      pose.flash = [0.1, 0.3, 0.45, 0.2][i % 4] ?? 0
      pose.flashColor = '#34d399'
      pose.bob = i === 1 || i === 2 ? -1 : 0
      break
    }
    case 'skill': {
      pose.flash = [0.2, 0.4, 0.6, 0.3, 0.1][i % 5] ?? 0
      pose.flashColor = '#60a5fa'
      pose.bob = [0, -1, -2, -1, 0][i % 5] ?? 0
      break
    }
    default:
      break
  }

  return pose
}

/** Nome de arquivo seguro a partir do nome da animação. */
export function animationSlugBase(spec: CharacterSpec, kind: AnimationKind, direction: CharacterDirection): string {
  return `${spec.name}-${kind}-${direction}`
}
