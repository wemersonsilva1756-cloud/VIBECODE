/** Estrutura padrão de pastas de todo projeto do Studio (compartilhada com a interface). */

export const PROJECT_FOLDERS = [
  'personagens',
  'monstros',
  'armas',
  'itens',
  'efeitos',
  'mapas',
  'animacoes',
  'audio',
  'godot',
  'originais',
  'gerados'
] as const

export const FOLDER_DESCRIPTIONS: Record<string, string> = {
  personagens: 'Sprites e dados de personagens, NPCs, vendedores e soldados.',
  monstros: 'Criaturas, inimigos especiais e chefes.',
  armas: 'Armas, skins e ícones.',
  itens: 'Coletes, capacetes, mochilas, kits médicos e itens especiais.',
  efeitos: 'Explosões, fumaça, fogo, impactos e partículas.',
  mapas: 'Mapas 2D, camadas, colisões e pontos de spawn.',
  animacoes: 'Animações e spritesheets organizados.',
  audio: 'Efeitos sonoros e músicas.',
  godot: 'Arquivos exportados para o projeto Godot 4.',
  originais: 'Arquivos de origem trazidos por você. O Studio nunca altera esta pasta.',
  gerados: 'Recursos criados pelo Studio ou pela IA.'
}
