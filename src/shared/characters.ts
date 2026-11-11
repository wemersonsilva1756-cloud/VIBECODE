/**
 * Tipos e presets do gerador de personagens e monstros (etapa 3).
 *
 * Importante: nesta etapa não há IA. A "descrição" é interpretada por palavras
 * chave que escolhem paleta e arquétipo — os provedores de IA chegam na etapa 9.
 */

export type CharacterCategory = 'personagem' | 'monstro'

export type CharacterRole =
  | 'soldado'
  | 'npc'
  | 'vendedor'
  | 'comum'
  | 'especial'
  | 'raro'
  | 'chefe'

export type MonsterArchetype = 'humanoide' | 'quadrupede' | 'slime' | 'voador'

export type CharacterEquipment = 'nenhum' | 'rifle' | 'pistola' | 'espada' | 'escudo'

export type CharacterDirection = 'frente' | 'costas' | 'esquerda' | 'direita'

export type SpriteSize = 32 | 64 | 96

export interface SpritePalette {
  pele: string
  cabelo: string
  roupa: string
  detalhe: string
  calca: string
  bota: string
  contorno: string
}

export interface CharacterStats {
  vida: number
  dano: number
  velocidade: number
  alcance: number
}

export interface MonsterDrop {
  item: string
  chance: number
  quantidade: number
}

export interface CharacterSpec {
  category: CharacterCategory
  name: string
  description: string
  role: CharacterRole
  archetype: MonsterArchetype
  size: SpriteSize
  paletteId: string
  palette: SpritePalette
  seed: number
  equipment: CharacterEquipment
  directions: CharacterDirection[]
  stats: CharacterStats
  abilities: string[]
  drops: MonsterDrop[]
}

export interface CharacterAsset {
  id: string
  projectId: string
  category: CharacterCategory
  name: string
  folder: string
  jsonPath: string
  images: Array<{ direction: CharacterDirection; relativePath: string }>
  createdAt: string
  spec: CharacterSpec
}

export interface DescriptionSuggestion {
  paletteId: string | null
  archetype: MonsterArchetype | null
  role: CharacterRole | null
  equipment: CharacterEquipment | null
  matches: string[]
}

export const DIRECTIONS: CharacterDirection[] = ['frente', 'costas', 'esquerda', 'direita']

export const DIRECTION_LABELS: Record<CharacterDirection, string> = {
  frente: 'Frente',
  costas: 'Costas',
  esquerda: 'Esquerda',
  direita: 'Direita'
}

export const MILITAR_PALETTE: SpritePalette = {
  pele: '#c98d63',
  cabelo: '#3a2a1d',
  roupa: '#4a5d3a',
  detalhe: '#2f3b25',
  calca: '#3c4a30',
  bota: '#22261c',
  contorno: '#141a12'
}

export const PALETTES: Array<{ id: string; label: string; palette: SpritePalette }> = [
  {
    id: 'militar',
    label: 'Militar',
    palette: MILITAR_PALETTE
  },
  {
    id: 'urbano',
    label: 'Urbano',
    palette: {
      pele: '#a9744f',
      cabelo: '#1d1d22',
      roupa: '#39465c',
      detalhe: '#25303f',
      calca: '#2b3242',
      bota: '#191d26',
      contorno: '#0e1219'
    }
  },
  {
    id: 'deserto',
    label: 'Deserto',
    palette: {
      pele: '#d9a273',
      cabelo: '#4b3320',
      roupa: '#c2a06a',
      detalhe: '#8f7346',
      calca: '#a98a58',
      bota: '#5c452c',
      contorno: '#3a2a19'
    }
  },
  {
    id: 'neve',
    label: 'Neve',
    palette: {
      pele: '#e2b9a0',
      cabelo: '#c9c2b4',
      roupa: '#d7dee6',
      detalhe: '#9aa7b5',
      calca: '#b9c4cf',
      bota: '#5a6472',
      contorno: '#2b333d'
    }
  },
  {
    id: 'neon',
    label: 'Neon',
    palette: {
      pele: '#9a6ad6',
      cabelo: '#22d3ee',
      roupa: '#312e81',
      detalhe: '#a855f7',
      calca: '#1e1b4b',
      bota: '#0f172a',
      contorno: '#070b16'
    }
  },
  {
    id: 'ferido',
    label: 'Ferido',
    palette: {
      pele: '#b07a5c',
      cabelo: '#2a1d16',
      roupa: '#6b3030',
      detalhe: '#401c1c',
      calca: '#3a2626',
      bota: '#1f1414',
      contorno: '#140a0a'
    }
  },
  {
    id: 'gosma',
    label: 'Gosma',
    palette: {
      pele: '#7bd88f',
      cabelo: '#3f9e62',
      roupa: '#4fbf74',
      detalhe: '#2f8a52',
      calca: '#2f8a52',
      bota: '#1f5c38',
      contorno: '#123322'
    }
  },
  {
    id: 'sombra',
    label: 'Sombra',
    palette: {
      pele: '#5b5f7a',
      cabelo: '#151724',
      roupa: '#2a2d45',
      detalhe: '#8b5cf6',
      calca: '#1c1f33',
      bota: '#101220',
      contorno: '#080912'
    }
  }
]

export function paletteById(id: string): SpritePalette {
  return PALETTES.find((item) => item.id === id)?.palette ?? MILITAR_PALETTE
}

export const ROLE_LABELS: Record<CharacterRole, string> = {
  soldado: 'Soldado',
  npc: 'NPC',
  vendedor: 'Vendedor',
  comum: 'Inimigo comum',
  especial: 'Inimigo especial',
  raro: 'Criatura rara',
  chefe: 'Chefe'
}

export const ARCHETYPE_LABELS: Record<MonsterArchetype, string> = {
  humanoide: 'Humanoide',
  quadrupede: 'Quadrúpede',
  slime: 'Gosma',
  voador: 'Voador'
}

export const EQUIPMENT_LABELS: Record<CharacterEquipment, string> = {
  nenhum: 'Sem equipamento',
  rifle: 'Fuzil',
  pistola: 'Pistola',
  espada: 'Espada',
  escudo: 'Escudo'
}

/** Modelo padrão sugerido para cada categoria/papel. */
export function defaultSpec(
  category: CharacterCategory,
  overrides: Partial<CharacterSpec> = {}
): CharacterSpec {
  const isMonster = category === 'monstro'
  const paletteId = overrides.paletteId ?? (isMonster ? 'sombra' : 'militar')
  const palette = overrides.palette ?? paletteById(paletteId)

  return {
    category,
    name: isMonster ? 'Criatura' : 'Novo personagem',
    description: '',
    role: isMonster ? 'comum' : 'soldado',
    archetype: isMonster ? 'humanoide' : 'humanoide',
    size: 32,
    paletteId,
    palette,
    seed: 1,
    equipment: isMonster ? 'nenhum' : 'rifle',
    directions: [...DIRECTIONS],
    stats: isMonster
      ? { vida: 60, dano: 8, velocidade: 60, alcance: 40 }
      : { vida: 100, dano: 12, velocidade: 90, alcance: 220 },
    abilities: [],
    drops: [],
    ...overrides
  }
}
