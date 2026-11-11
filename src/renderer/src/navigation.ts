import {
  Boxes,
  Crosshair,
  Dices,
  Film,
  FolderKanban,
  FolderTree,
  HelpCircle,
  LayoutDashboard,
  Map,
  Package,
  Route as RouteIcon,
  Settings,
  Skull,
  Sparkles,
  UserRound,
  Zap,
  type LucideIcon
} from 'lucide-react'

export type Route =
  | { name: 'painel' }
  | { name: 'projetos' }
  | { name: 'arquivos' }
  | { name: 'projeto'; projectId: string }
  | { name: 'modulo'; moduleId: string }
  | { name: 'configuracoes' }
  | { name: 'ajuda' }
  | { name: 'roadmap' }

export type StaticRouteName =
  | 'painel'
  | 'projetos'
  | 'arquivos'
  | 'configuracoes'
  | 'ajuda'
  | 'roadmap'

export const ROUTE_LABELS: Record<StaticRouteName, string> = {
  painel: 'Painel',
  projetos: 'Projetos',
  arquivos: 'Arquivos do projeto',
  configuracoes: 'Configurações',
  ajuda: 'Ajuda e tutoriais',
  roadmap: 'Etapas do desenvolvimento'
}

export interface ModuleDefinition {
  id: string
  title: string
  stage: number
  icon: LucideIcon
  summary: string
  planned: string[]
  /** Verdadeiro quando o módulo já está implementado e testado. */
  available?: boolean
}

/**
 * Módulos de criação. Todos aparecem no menu desde já para o usuário acompanhar
 * o plano, mas cada um informa com honestidade em qual etapa será entregue.
 */
export const MODULES: ModuleDefinition[] = [
  {
    id: 'godot',
    title: 'Integração com Godot 4',
    stage: 2,
    icon: Boxes,
    available: true,
    summary:
      'Vincular a pasta do seu projeto Godot 4, identificar a versão, listar as cenas e recursos e exportar a preparação do Pixel Strike com prévia e backup.',
    planned: [
      'Selecionar a pasta do projeto Godot e identificar a versão',
      'Listar cenas, scripts, imagens e recursos do projeto',
      'Exportar o script utilitário, o manifesto de recursos e as instruções',
      'Copiar os arquivos da pasta godot/ do projeto para dentro da Godot',
      'Pré-visualizar cada arquivo antes de gravar, com backup dos substituídos'
    ]
  },
  {
    id: 'personagens',
    title: 'Gerador de Personagens',
    stage: 3,
    icon: UserRound,
    available: true,
    summary:
      'Crie soldados, NPCs e vendedores com sprites transparentes em quatro direções, paletas ajustáveis e ficha de atributos salva no projeto.',
    planned: [
      'Sprites 32, 64 ou 96 px com fundo transparente e contorno automático',
      'Quatro direções: frente, costas, esquerda e direita',
      'Paletas prontas e edição de cada cor',
      'Equipamento visível: fuzil, pistola, espada ou escudo',
      'Ficha de atributos em JSON salva na pasta personagens/' 
    ]
  },
  {
    id: 'monstros',
    title: 'Monstros e Inimigos',
    stage: 3,
    icon: Skull,
    available: true,
    summary:
      'Crie inimigos comuns, especiais, raros e chefes com quatro arquétipos, atributos, habilidades e tabela de drops.',
    planned: [
      'Arquétipos humanoide, quadrúpede, gosma e voador',
      'Papéis de inimigo comum, especial, raro e chefe',
      'Vida, dano, velocidade e alcance configuráveis',
      'Habilidades e tabela de drops com chances independentes',
      'Ficha completa salva na pasta monstros/' 
    ]
  },
  {
    id: 'animacoes',
    title: 'Editor de Animações',
    stage: 4,
    icon: Film,
    available: true,
    summary:
      'Montar animações a partir dos personagens do projeto com linha do tempo, espera por quadro, FPS, loop, spritesheet e ficha JSON.',
    planned: [
      'Animações padrão: idle, walk, run, attack, shoot, reload, death, hit, heal e skill',
      'Reordenar, duplicar e excluir quadros na linha do tempo',
      'Configurar FPS, duração, espera por quadro e repetição',
      'Pré-visualização em tempo real com reprodução automática',
      'Spritesheet horizontal e ficha JSON salvas na pasta animacoes/ do projeto'
    ]
  },
  {
    id: 'mapas',
    title: 'Construtor de Mapas',
    stage: 5,
    icon: Map,
    summary:
      'Editor de mapas com tiles, camadas, colisões, áreas seguras, PvP, spawns e exportação para TileMap da Godot.',
    planned: [
      'Grade e tiles configuráveis, pintura de terreno',
      'Camadas de fundo, objetos e colisão',
      'Áreas seguras, áreas PvP, spawns e áreas secretas',
      'Proposta de mapa gerada por descrição, sempre editável',
      'Exportação para TileSet e TileMap do Godot 4'
    ]
  },
  {
    id: 'armas',
    title: 'Armas e Skins',
    stage: 6,
    icon: Crosshair,
    summary:
      'Editor de armas pixel art com skins, padrões, raridades, condições e variações da mesma arma.',
    planned: [
      'Modelos base: AK-47, M4A4, AWP, Desert Eagle, Glock, USP-S, MP5, P90 e facas',
      'Skins com cores, padrões e variações visuais',
      'Raridades (azul, roxo, rosa, vermelho, dourado e Blue Gem) separadas das condições',
      'Ícones, sprites, efeitos de disparo e animação de recarga',
      'Comparação lado a lado das versões da mesma arma'
    ]
  },
  {
    id: 'habilidades',
    title: 'Skills e Habilidades',
    stage: 7,
    icon: Sparkles,
    summary:
      'Descrever habilidades em português e receber efeito visual, parâmetros e código pronto para a Godot.',
    planned: [
      'Dano, alcance, duração, recarga e área de efeito',
      'Granadas, fumaça, explosões, cura, escudos e habilidades táticas',
      'Efeitos visuais e partículas associados',
      'Pré-visualização e ajuste visual dos parâmetros',
      'Geração de script de integração para Godot 4'
    ]
  },
  {
    id: 'efeitos',
    title: 'Efeitos Visuais e Sonoros',
    stage: 7,
    icon: Zap,
    summary:
      'Gerar e organizar explosões, fumaça, fogo, impactos, sangue estilizado, cura e partículas.',
    planned: [
      'Biblioteca de efeitos por categoria',
      'Edição de quadros, cores e tempo de vida',
      'Efeitos de habilidades reaproveitáveis',
      'Integração com provedores de áudio quando configurados'
    ]
  },
  {
    id: 'itens',
    title: 'Itens e Equipamentos',
    stage: 8,
    icon: Package,
    summary:
      'Criar coletes, capacetes, mochilas, seringas, kits médicos, chaves e itens especiais com ícones e atributos.',
    planned: [
      'Ícones e sprites gerados',
      'Nome, descrição, raridade, valor e propriedades',
      'Categorias de itens e equipamentos',
      'Vínculo com o sistema de drops'
    ]
  },
  {
    id: 'drops',
    title: 'Drops e Economia',
    stage: 8,
    icon: Dices,
    summary:
      'Configurar tabelas de recompensas, caixas e eventos com validação real de probabilidades.',
    planned: [
      'Tabelas de drops por monstro, caixa e missão',
      'Probabilidades exclusivas validadas em 100%',
      'Probabilidades independentes quando configuradas assim',
      'Calculadora de chances',
      'Raridade, condição e padrão de skin sempre separados'
    ]
  }
]

export interface NavItem {
  label: string
  route: Route
  icon: LucideIcon
  badge?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Estúdio',
    items: [
      { label: 'Painel', route: { name: 'painel' }, icon: LayoutDashboard },
      { label: 'Projetos', route: { name: 'projetos' }, icon: FolderKanban },
      { label: 'Arquivos do projeto', route: { name: 'arquivos' }, icon: FolderTree }
    ]
  },
  {
    label: 'Criação',
    items: MODULES.map((module) => ({
      label: module.title,
      route: { name: 'modulo', moduleId: module.id } as Route,
      icon: module.icon,
      badge: module.available ? undefined : `Etapa ${module.stage}`
    }))
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Configurações', route: { name: 'configuracoes' }, icon: Settings },
      { label: 'Ajuda e tutoriais', route: { name: 'ajuda' }, icon: HelpCircle },
      { label: 'Etapas do desenvolvimento', route: { name: 'roadmap' }, icon: RouteIcon }
    ]
  }
]

export function moduleById(id: string): ModuleDefinition | undefined {
  return MODULES.find((module) => module.id === id)
}
