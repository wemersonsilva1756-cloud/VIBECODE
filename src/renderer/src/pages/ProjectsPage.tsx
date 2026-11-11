import {
  Copy,
  FolderOpen,
  FolderPlus,
  FolderX,
  HardDriveDownload,
  History,
  Search,
  Trash2
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ProjectSummary } from '@shared/contract'
import { formatBytes, formatRelative, pluralize } from '../lib/format'
import { useApp } from '../state/store'
import { BackupsDialog } from '../components/BackupsDialog'
import { NewProjectDialog } from '../components/NewProjectDialog'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Input, Note, PageHeader } from '../components/ui'

export function ProjectsPage(): React.JSX.Element {
  const {
    projects,
    navigate,
    openProject,
    duplicateProject,
    backupProject,
    removeProject,
    busy,
    settings,
    notify
  } = useApp()

  const [search, setSearch] = useState('')
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [backupsTarget, setBackupsTarget] = useState<ProjectSummary | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ProjectSummary | null>(null)
  const [deleteFiles, setDeleteFiles] = useState(true)
  const [duplicateTarget, setDuplicateTarget] = useState<ProjectSummary | null>(null)
  const [duplicateName, setDuplicateName] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return projects
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(term) ||
        project.description.toLowerCase().includes(term)
    )
  }, [projects, search])

  function startDuplicate(project: ProjectSummary): void {
    setDuplicateTarget(project)
    setDuplicateName(`${project.name} (cópia)`)
  }

  async function confirmDuplicate(): Promise<void> {
    if (!duplicateTarget) return
    const result = await duplicateProject(duplicateTarget.id, duplicateName.trim() || undefined)
    if (result) setDuplicateTarget(null)
  }

  async function confirmRemove(): Promise<void> {
    if (!removeTarget) return
    const ok = await removeProject(removeTarget.id, deleteFiles)
    if (ok) setRemoveTarget(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Estúdio"
        title="Projetos"
        description={
          settings?.workspaceRoot
            ? `As pastas dos projetos ficam em ${settings.workspaceRoot}.`
            : 'Cada projeto é uma pasta com todos os recursos do seu jogo.'
        }
        actions={
          <Button icon={FolderPlus} onClick={() => setNewProjectOpen(true)}>
            Novo projeto
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou descrição"
            className="pl-9"
            aria-label="Buscar projetos"
          />
        </div>
        <p className="text-xs text-ink-500">
          {pluralize(filtered.length, 'projeto', 'projetos')}
        </p>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title="Nenhum projeto criado ainda"
          description="Crie um projeto para começar. O Studio cria as pastas de personagens, monstros, mapas, armas, animações e efeitos automaticamente."
          action={
            <Button icon={FolderPlus} onClick={() => setNewProjectOpen(true)}>
              Criar projeto
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum projeto encontrado"
          description={`Nada corresponde a "${search}". Tente outro nome ou limpe a busca.`}
          action={
            <Button variant="secondary" onClick={() => setSearch('')}>
              Limpar busca
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((project) => (
            <Card key={project.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate({ name: 'projeto', projectId: project.id })}
                    className="truncate text-left text-base font-semibold text-white hover:text-accent-300"
                  >
                    {project.name}
                  </button>
                  <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-ink-400">
                    {project.description || 'Sem descrição.'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge tone={project.folderExists ? 'success' : 'danger'}>
                    {project.folderExists ? 'Pasta encontrada' : 'Pasta ausente'}
                  </Badge>
                  <span className="text-[11px] text-ink-500">
                    {formatBytes(project.sizeBytes)}
                  </span>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-lg border border-base-800 bg-base-950/40 px-2 py-1.5">
                  <dt className="text-ink-500">Recursos</dt>
                  <dd className="text-ink-200">{project.assetCount}</dd>
                </div>
                <div className="rounded-lg border border-base-800 bg-base-950/40 px-2 py-1.5">
                  <dt className="text-ink-500">Backups</dt>
                  <dd className="text-ink-200">{project.backupCount}</dd>
                </div>
                <div className="rounded-lg border border-base-800 bg-base-950/40 px-2 py-1.5">
                  <dt className="text-ink-500">Atualizado</dt>
                  <dd className="truncate text-ink-200">{formatRelative(project.updatedAt)}</dd>
                </div>
              </dl>

              <p className="mt-3 truncate font-mono text-[11px] text-ink-500" title={project.path}>
                {project.path}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-base-800/70 pt-3">
                <Button
                  size="sm"
                  onClick={() => void openProject(project.id)}
                  loading={busy === 'Abrindo projeto'}
                >
                  Abrir
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Copy}
                  onClick={() => startDuplicate(project)}
                  title="Criar uma cópia completa deste projeto"
                >
                  Duplicar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={HardDriveDownload}
                  loading={busy === 'Criando backup'}
                  onClick={() => void backupProject(project.id)}
                  title="Salvar uma cópia de segurança agora"
                >
                  Backup
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={History}
                  onClick={() => setBackupsTarget(project)}
                  title="Ver backups deste projeto"
                >
                  Histórico
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={FolderOpen}
                  onClick={() => {
                    void window.studio.app.openProjectFolder(project.id).catch((error: unknown) => {
                      notify(
                        'erro',
                        'Não foi possível abrir a pasta',
                        error instanceof Error ? error.message : undefined
                      )
                    })
                  }}
                  title="Abrir a pasta no Explorador de Arquivos"
                >
                  Pasta
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  className="ml-auto text-red-300 hover:bg-red-500/10"
                  onClick={() => {
                    setRemoveTarget(project)
                    setDeleteFiles(true)
                  }}
                  title="Remover do Studio"
                >
                  Remover
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {settings?.workspaceRoot && (
        <Note>
          Alterar a pasta de projetos nas Configurações afeta apenas projetos novos. Os projetos
          existentes continuam na pasta onde foram criados.
        </Note>
      )}

      <NewProjectDialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />

      <BackupsDialog
        project={backupsTarget}
        open={backupsTarget !== null}
        onClose={() => setBackupsTarget(null)}
      />

      <ConfirmDialog
        open={duplicateTarget !== null}
        title="Duplicar projeto"
        description="O Studio copia todos os arquivos do projeto para uma nova pasta. O projeto original não é alterado."
        confirmLabel="Duplicar"
        loading={busy !== null}
        onCancel={() => setDuplicateTarget(null)}
        onConfirm={confirmDuplicate}
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold tracking-wide text-ink-200 uppercase">
            Nome do novo projeto
          </span>
          <Input
            value={duplicateName}
            onChange={(event) => setDuplicateName(event.target.value)}
            maxLength={60}
            autoFocus
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remover projeto do Studio?"
        description={
          removeTarget
            ? `"${removeTarget.name}" será removido da lista de projetos do Studio.`
            : undefined
        }
        confirmLabel="Remover projeto"
        tone="danger"
        loading={busy !== null}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
      >
        <div className="space-y-3">
          <label className="flex items-start gap-2.5 rounded-xl border border-base-800 bg-base-950/40 px-3 py-2.5">
            <input
              type="radio"
              name="delete-files"
              checked={deleteFiles}
              onChange={() => setDeleteFiles(true)}
              className="mt-0.5 accent-[#2f7fff]"
            />
            <span className="text-xs leading-relaxed text-ink-200">
              Mover a pasta do projeto para a lixeira interna do Studio
              <span className="mt-0.5 block text-ink-500">
                Os arquivos podem ser recuperados na pasta de dados do aplicativo. Os backups também
                são arquivados.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 rounded-xl border border-base-800 bg-base-950/40 px-3 py-2.5">
            <input
              type="radio"
              name="delete-files"
              checked={!deleteFiles}
              onChange={() => setDeleteFiles(false)}
              className="mt-0.5 accent-[#2f7fff]"
            />
            <span className="text-xs leading-relaxed text-ink-200">
              Manter os arquivos no disco
              <span className="mt-0.5 block text-ink-500">
                O projeto sai da lista do Studio, mas a pasta continua exatamente onde está.
              </span>
            </span>
          </label>
          <Note tone="warning">
            <span className="flex items-center gap-1.5">
              <FolderX className="size-3.5" aria-hidden /> Nada é apagado definitivamente pelo Studio.
            </span>
          </Note>
        </div>
      </ConfirmDialog>
    </div>
  )
}
