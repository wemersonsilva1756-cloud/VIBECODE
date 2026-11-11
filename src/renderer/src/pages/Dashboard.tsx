import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Copy,
  FolderOpen,
  FolderPlus,
  HardDriveDownload,
  History,
  Layers,
  Pencil,
  RotateCcw,
  Rocket,
  Trash2,
  Wand2
} from 'lucide-react'
import { useState } from 'react'
import { MODULES } from '../navigation'
import { formatBytes, formatRelative, pluralize } from '../lib/format'
import { useApp } from '../state/store'
import { BackupsDialog } from '../components/BackupsDialog'
import { NewProjectDialog } from '../components/NewProjectDialog'
import { Badge, Button, Card, EmptyState, Note, PageHeader, StatTile } from '../components/ui'

const ACTIVITY_ICONS: Record<string, typeof Activity> = {
  'projeto.criado': FolderPlus,
  'projeto.atualizado': Pencil,
  'projeto.duplicado': Copy,
  'projeto.removido': Trash2,
  'backup.criado': HardDriveDownload,
  'backup.restaurado': RotateCcw
}

export function Dashboard(): React.JSX.Element {
  const { projects, stats, activity, activeProject, navigate, backupProject, busy, paths } =
    useApp()
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [backupsTarget, setBackupsTarget] = useState<string | null>(null)

  const projectForBackups = projects.find((project) => project.id === backupsTarget) ?? null
  const nextModules = MODULES.filter((module) => !module.available).slice(0, 3)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Estúdio"
        title="Painel"
        description="Aqui você acompanha o projeto ativo, o que já funciona nesta versão e o que vem nas próximas etapas."
        actions={
          <>
            <Button variant="secondary" icon={FolderOpen} onClick={() => navigate({ name: 'projetos' })}>
              Meus projetos
            </Button>
            <Button icon={FolderPlus} onClick={() => setNewProjectOpen(true)}>
              Novo projeto
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Layers}
          label="Projetos"
          value={String(stats?.projectCount ?? 0)}
          hint="salvos neste computador"
        />
        <StatTile
          icon={Wand2}
          label="Recursos criados"
          value={String(stats?.assetCount ?? 0)}
          hint="personagens, mapas, armas…"
        />
        <StatTile
          icon={History}
          label="Backups"
          value={String(stats?.backupCount ?? 0)}
          hint="cópias de segurança guardadas"
        />
        <StatTile
          icon={HardDriveDownload}
          label="Espaço usado"
          value={formatBytes(stats?.totalSizeBytes ?? 0)}
          hint={paths?.workspaceRoot ?? 'pasta de projetos'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {activeProject ? (
          <Card
            title="Projeto ativo"
            description="Tudo o que você criar será salvo dentro deste projeto."
            actions={
              <Badge tone="success" icon={CheckCircle2}>
                {pluralize(activeProject.backupCount, 'backup', 'backups')}
              </Badge>
            }
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-white">{activeProject.name}</h3>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-400">
                    {activeProject.description || 'Sem descrição. Você pode adicionar uma no projeto.'}
                  </p>
                </div>
                <Button
                  icon={ArrowRight}
                  onClick={() => navigate({ name: 'projeto', projectId: activeProject.id })}
                >
                  Abrir projeto
                </Button>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div className="rounded-xl border border-base-800 bg-base-950/40 px-3 py-2">
                  <dt className="text-ink-500">Tamanho</dt>
                  <dd className="mt-0.5 text-sm text-ink-100">
                    {formatBytes(activeProject.sizeBytes)}
                  </dd>
                </div>
                <div className="rounded-xl border border-base-800 bg-base-950/40 px-3 py-2">
                  <dt className="text-ink-500">Recursos</dt>
                  <dd className="mt-0.5 text-sm text-ink-100">{activeProject.assetCount}</dd>
                </div>
                <div className="rounded-xl border border-base-800 bg-base-950/40 px-3 py-2">
                  <dt className="text-ink-500">Atualizado</dt>
                  <dd className="mt-0.5 text-sm text-ink-100">
                    {formatRelative(activeProject.updatedAt)}
                  </dd>
                </div>
                <div className="rounded-xl border border-base-800 bg-base-950/40 px-3 py-2">
                  <dt className="text-ink-500">Aberto</dt>
                  <dd className="mt-0.5 text-sm text-ink-100">
                    {formatRelative(activeProject.lastOpenedAt)}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={HardDriveDownload}
                  loading={busy === 'Criando backup'}
                  onClick={() => void backupProject(activeProject.id)}
                >
                  Backup agora
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={FolderOpen}
                  onClick={() => void window.studio.app.openProjectFolder(activeProject.id)}
                >
                  Abrir pasta
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={History}
                  onClick={() => setBackupsTarget(activeProject.id)}
                >
                  Ver backups
                </Button>
              </div>

              {!activeProject.folderExists && (
                <Note tone="warning">
                  A pasta deste projeto não está mais em <span className="font-mono">{activeProject.path}</span>.
                  Ela pode ter sido movida ou renomeada fora do Studio.
                </Note>
              )}
            </div>
          </Card>
        ) : (
          <Card title="Projeto ativo" description="Nenhum projeto aberto no momento.">
            <EmptyState
              icon={Rocket}
              title="Comece criando seu primeiro projeto"
              description="Um projeto é a pasta onde ficam os personagens, monstros, mapas, armas e animações do seu jogo. O Studio organiza tudo para você."
              action={
                <Button icon={FolderPlus} onClick={() => setNewProjectOpen(true)}>
                  Criar meu primeiro projeto
                </Button>
              }
            />
          </Card>
        )}

        <Card
          title="Etapas do desenvolvimento"
          description="O Studio é construído por etapas. Cada parte só avança quando a anterior está funcionando."
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'roadmap' })}>
              Ver todas
            </Button>
          }
        >
          <ol className="space-y-2.5">
            <li className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-ink-100">Etapa 1 · Estrutura, projetos e banco de dados</p>
                <Badge tone="success">Concluída</Badge>
              </div>
              <p className="mt-1 text-xs text-ink-400">
                Interface, navegação, criação e gerenciamento de projetos, backups e histórico.
              </p>
            </li>
            <li className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-ink-100">Etapa 2 · Gerenciador de arquivos e Godot 4</p>
                <Badge tone="success">Concluída</Badge>
              </div>
              <p className="mt-1 text-xs text-ink-400">
                Navegação pelos arquivos do projeto, importação sem sobrescrever e vínculo com o
                projeto Godot com exportação pré-visualizada e backup.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ name: 'arquivos' })}
                >
                  Abrir arquivos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ name: 'modulo', moduleId: 'godot' })}
                >
                  Integração com Godot
                </Button>
              </div>
            </li>
            <li className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-ink-100">Etapa 3 · Personagens e monstros</p>
                <Badge tone="success">Concluída</Badge>
              </div>
              <p className="mt-1 text-xs text-ink-400">
                Sprites transparentes em quatro direções, paletas, equipamento, ficha de atributos,
                habilidades e drops — salvos nas pastas do projeto.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ name: 'modulo', moduleId: 'personagens' })}
                >
                  Gerar personagem
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ name: 'modulo', moduleId: 'monstros' })}
                >
                  Gerar monstro
                </Button>
              </div>
            </li>
            <li className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-ink-100">Etapa 4 · Animações</p>
                <Badge tone="success">Concluída</Badge>
              </div>
              <p className="mt-1 text-xs text-ink-400">
                Linha do tempo com espera por quadro, FPS, repetição, pré-visualização em tempo
                real e spritesheet salva na pasta animacoes/ do projeto.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ name: 'modulo', moduleId: 'animacoes' })}
                >
                  Abrir editor de animações
                </Button>
              </div>
            </li>
            {nextModules.map((module) => {
              const Icon = module.icon
              return (
                <li
                  key={module.id}
                  className="rounded-xl border border-base-800 bg-base-950/40 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm text-ink-200">
                      <Icon className="size-3.5 text-ink-400" aria-hidden />
                      Etapa {module.stage} · {module.title}
                    </p>
                    <Badge>Planejada</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{module.summary}</p>
                </li>
              )
            })}
          </ol>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Card
          title="O que já funciona nesta versão"
          description="Tudo abaixo é real e pode ser usado agora."
        >
          <ul className="space-y-2 text-xs leading-relaxed text-ink-300">
            {[
              'Criar, abrir, duplicar e remover projetos com pastas organizadas',
              'Banco de dados local em SQLite, só no seu computador',
              'Backups completos com restauração e backup de segurança automático',
              'Histórico das ações realizadas no Studio',
              'Preferências de pasta de projetos e limite de backups',
              'Guia inicial para quem nunca programou'
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Histórico recente"
          description="Registro do que o Studio fez no seu computador."
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'projetos' })}>
              Projetos
            </Button>
          }
        >
          {activity.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-500">
              Nada registrado ainda. Crie um projeto para começar.
            </p>
          ) : (
            <ul className="divide-y divide-base-800/70">
              {activity.map((entry) => {
                const Icon = ACTIVITY_ICONS[entry.type] ?? Activity
                return (
                  <li key={entry.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-base-800 bg-base-850 text-ink-400">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed text-ink-200">{entry.message}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {formatRelative(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <NewProjectDialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
      <BackupsDialog
        project={projectForBackups}
        open={backupsTarget !== null}
        onClose={() => setBackupsTarget(null)}
      />
    </div>
  )
}
