import { BookOpen, CircleHelp, FolderTree, ListChecks, Rocket, ShieldCheck } from 'lucide-react'
import { useApp } from '../state/store'
import { Badge, Button, Card, Note, PageHeader } from '../components/ui'

function Tutorial({
  title,
  children,
  open
}: {
  title: string
  children: React.ReactNode
  open?: boolean
}): React.JSX.Element {
  return (
    <details
      open={open}
      className="group rounded-xl border border-base-800 bg-base-950/40 px-4 py-3 open:bg-base-900/60"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-ink-100">
        <span>{title}</span>
        <span className="text-ink-500 transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-3 space-y-2 text-xs leading-relaxed text-ink-300">{children}</div>
    </details>
  )
}

export function HelpPage(): React.JSX.Element {
  const { navigate, resetOnboarding, settings } = useApp()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Ajuda e tutoriais"
        description="Explicações simples sobre cada parte do Studio. Você não precisa saber programar para usar."
        actions={
          <Button variant="secondary" icon={Rocket} onClick={() => void resetOnboarding()}>
            Rever o guia inicial
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card
          title="Tutoriais passo a passo"
          description="Comece pelo primeiro tópico se estiver usando o Studio pela primeira vez."
          actions={<Badge icon={BookOpen}>Iniciante</Badge>}
        >
          <div className="space-y-2">
            <Tutorial title="1. O que é um projeto no Studio" open>
              <p>
                Um projeto é uma pasta no seu computador que reúne tudo do seu jogo. Dentro dela o
                Studio cria subpastas com nomes claros: personagens, monstros, armas, itens, efeitos,
                mapas, animações, áudio, exportação Godot, arquivos originais e arquivos gerados.
              </p>
              <p>
                Cada projeto tem também um arquivo <span className="font-mono text-accent-300">projeto.json</span>{' '}
                com nome, descrição e data de criação. Ele é legível por qualquer editor de texto,
                então você nunca fica preso ao Studio para saber o que existe ali.
              </p>
            </Tutorial>

            <Tutorial title="2. Como criar e abrir um projeto">
              <p>
                No menu lateral, abra <strong>Projetos</strong> e clique em <strong>Novo projeto</strong>.
                Escolha um nome e, se quiser, uma descrição. O Studio cria a pasta e abre o projeto.
              </p>
              <p>
                O projeto aberto no momento aparece no rodapé do menu lateral. Ele é o destino de tudo
                que você criar depois.
              </p>
            </Tutorial>

            <Tutorial title="3. Backups: o que são e quando fazer">
              <p>
                Um backup é uma cópia completa da pasta do projeto, guardada em outro lugar. Faça um
                antes de mudanças grandes, como reorganizar arquivos ou testar uma ideia nova.
              </p>
              <p>
                Para restaurar, abra <strong>Backups</strong> e escolha uma data. O Studio cria uma
                cópia de segurança do estado atual antes de trazer os arquivos antigos de volta — então
                restaurar nunca faz você perder o trabalho mais recente sem uma cópia.
              </p>
            </Tutorial>

            <Tutorial title="4. Onde ficam os meus arquivos">
              <p>
                Os projetos ficam na pasta escolhida em <strong>Configurações → Pasta dos projetos</strong>.
                O banco de dados e os backups internos ficam na pasta de dados do aplicativo, também
                indicada nas Configurações.
              </p>
              <p>
                Nada é enviado para a internet. Se você quiser fazer uma cópia extra, copie a pasta do
                projeto para um pendrive ou serviço de nuvem que já use.
              </p>
            </Tutorial>

            <Tutorial title="5. Modo IA e modo visual (próximas etapas)">
              <p>
                O Studio terá duas formas de trabalhar: descrever o que você quer em português e deixar
                a IA preparar os recursos, ou editar tudo manualmente nos editores visuais. As duas
                formas usam os mesmos arquivos.
              </p>
              <p>
                Nenhuma alteração importante será aplicada sem mostrar antes o que vai mudar e pedir
                sua autorização. Provedores de IA serão configurados por você, com chaves guardadas em
                armazenamento seguro.
              </p>
            </Tutorial>

            <Tutorial title="6. Como exportar para Godot 4 (etapa 2)">
              <p>
                A integração com Godot será conectada a uma pasta de projeto existente. O Studio vai
                identificar a versão, mostrar os arquivos envolvidos, criar um backup, apresentar as
                mudanças e só então aplicar — sempre com sua autorização.
              </p>
            </Tutorial>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Glossário simples" actions={<Badge icon={CircleHelp}>Sem jargão</Badge>}>
            <dl className="space-y-3 text-xs leading-relaxed">
              {[
                {
                  term: 'Sprite',
                  text: 'Um desenho pequeno em pixel art. É a imagem de um personagem, arma ou item.'
                },
                {
                  term: 'Spritesheet',
                  text: 'Uma imagem grande com vários quadros de animação lado a lado.'
                },
                {
                  term: 'Quadro (frame)',
                  text: 'Cada desenho de uma animação. Vários quadros em sequência criam movimento.'
                },
                {
                  term: 'FPS',
                  text: 'Quadros por segundo: a velocidade da animação. 8 a 12 é comum em pixel art.'
                },
                {
                  term: 'Tile / TileMap',
                  text: 'Peças pequenas que se encaixam para montar o cenário de um mapa.'
                },
                {
                  term: 'Colisão',
                  text: 'A área onde o personagem não pode passar, como paredes e obstáculos.'
                },
                {
                  term: 'Backup',
                  text: 'Cópia de segurança de todos os arquivos do projeto em um momento específico.'
                }
              ].map((item) => (
                <div key={item.term}>
                  <dt className="font-semibold text-ink-100">{item.term}</dt>
                  <dd className="text-ink-400">{item.text}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="O que está funcionando agora" actions={<Badge icon={ListChecks}>Etapas 1 a 4</Badge>}>
            <ul className="space-y-1.5 text-xs leading-relaxed text-ink-300">
              <li>· Criar, abrir, duplicar e remover projetos</li>
              <li>· Pastas do projeto organizadas automaticamente</li>
              <li>· Banco de dados local em SQLite</li>
              <li>· Backups com restauração e cópia de segurança</li>
              <li>· Histórico de ações</li>
              <li>· Navegar, pré-visualizar e importar arquivos do projeto</li>
              <li>· Vincular um projeto Godot 4 e exportar com prévia e backup</li>
              <li>· Gerar personagens e monstros com sprites transparentes e ficha JSON</li>
              <li>· Montar animações com linha do tempo, FPS, loop e spritesheet</li>
              <li>· Preferências de pasta e de retenção de backups</li>
            </ul>
            <div className="mt-3">
              <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'roadmap' })}>
                Ver o que vem em seguida
              </Button>
            </div>
          </Card>

          <Card title="Segurança" actions={<Badge tone="success" icon={ShieldCheck}>Ativo</Badge>}>
            <ul className="space-y-1.5 text-xs leading-relaxed text-ink-300">
              <li>· Interface isolada do sistema por padrão (contextIsolation e sandbox).</li>
              <li>· Nenhum acesso direto ao disco ou ao Node pela interface.</li>
              <li>· Links externos abrem no navegador, nunca dentro do Studio.</li>
              <li>· O Studio nunca apaga arquivos de forma definitiva.</li>
            </ul>
          </Card>

          <Note tone="info">
            A pasta de projetos atual é{' '}
            <span className="font-mono break-all">{settings?.workspaceRoot ?? '—'}</span>. Você pode
            mudar em Configurações.
          </Note>
        </div>
      </div>

      <Card
        title="Pastas do projeto"
        actions={<Badge icon={FolderTree}>Automático</Badge>}
        description="O Studio cria estas pastas em todo projeto novo."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['originais/', 'Seus arquivos de origem. Nunca são alterados pelo Studio.'],
            ['gerados/', 'Recursos criados pelo Studio ou pela IA.'],
            ['personagens/', 'Personagens, NPCs, vendedores e soldados.'],
            ['monstros/', 'Criaturas, inimigos especiais e chefes.'],
            ['armas/', 'Armas, skins e ícones.'],
            ['itens/', 'Equipamentos e itens especiais.'],
            ['efeitos/', 'Explosões, fumaça, fogo e partículas.'],
            ['mapas/', 'Mapas, camadas e colisões.'],
            ['animacoes/', 'Animações e spritesheets.'],
            ['audio/', 'Efeitos sonoros e músicas.'],
            ['godot/', 'Somente o que será importado na Godot 4.']
          ].map(([folder, description]) => (
            <div
              key={folder}
              className="rounded-xl border border-base-800 bg-base-950/40 px-3 py-2.5"
            >
              <p className="font-mono text-[11px] text-accent-300">{folder}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
