import {
  ArrowLeft,
  Check,
  ChevronRight,
  FolderOpen,
  FolderTree,
  HardDriveDownload,
  History,
  Save,
  Trash2,
  Wand2
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { FOLDER_DESCRIPTIONS, PROJECT_FOLDERS } from '@shared/project-structure'
import { formatBytes, formatDateTime, formatRelative, pluralize } from '../lib/format'
import { useApp } from '../state/store'
import { BackupsDialog } from '../components/BackupsDialog'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Note,
  PageHeader,
  Textarea
} from '../components/ui'

export function ProjectDetail({ projectId }: { projectId: string }): React.JSX.Element {
  const {
    projects,
    navigate,
    updateProjectDetails,
    removeProject,
    backupProject,
    busy,
    notify
  } = useApp()

  const project = projects.find((item) => item.id === projectId) ?? null

  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [backupsOpen, setBackupsOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState(true)

  useEffect(() => {
    setName(project?.name ?? '')
    setDescription(project?.description ?? '')
  }, [project?.id, project?.name, project?.description])

  if (!project) {
    return (
      <div className="space-y-6">
        <PageHeader title="Projeto não encontrado" />
        <EmptyState
          icon={FolderTree}
          title="Este projeto não está mais na lista"
          description="Ele pode ter sido removido. Abra a lista de projetos para ver o que está disponível."
          action={
            <Button icon={ArrowLeft} onClick={() => navigate({ name: 'projetos' })}>
              Voltar para projetos
            </Button>
          }
        />
      </div>
    )
  }

  const dirty = name !== project.name || description !== project.description

  async function handleSave(): Promise<void> {
    if (!project) return
    if (name.trim().length < 2) {
      notify('atencao', 'Nome muito curto', 'O nome do projeto precisa ter pelo menos 2 caracteres.')
      return
    }
    const ok = await updateProjectDetails(project.id, {
      name: name.trim(),
      description: description.trim()
    })
    if (!ok) {
      setName(project.name)
      setDescription(project.description)
    }
  }

  async function handleRemove(): Promise<void> {
    if (!project) return
    const ok = await removeProject(project.id, deleteFiles)
    if (ok) setRemoveOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-ink-500">
        <button
          type="button"
          onClick={() => navigate({ name: 'projetos' })}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-white/5 hover:text-ink-200"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Projetos
        </button>
        <ChevronRight className="size-3" aria-hidden />
        <span className="text-ink-300">{project.name}</span>
      </div>

      <PageHeader
        eyebrow="Projeto"
        title={project.name}
        description={project.description || 'Sem descrição ainda.'}
        actions={
          <>
            <Button
              variant="secondary"
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
            >
              Abrir pasta
            </Button>
            <Button
              variant="secondary"
              icon={HardDriveDownload}
              loading={busy === 'Criando backup'}
              onClick={() => void backupProject(project.id)}
            >
              Backup agora
            </Button>
          </>
        }
      />

      {!project.folderExists && (
        <Note tone="warning">
          A pasta do projeto não foi encontrada em <span className="font-mono">{project.path}</span>.
          Verifique se ela foi movida ou renomeada. Você pode tentar restaurar um backup, mas primeiro
          devolva a pasta para este local.
        </Note>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card
            title="Informações do projeto"
            description="Estes dados ficam salvos no banco local e também no arquivo projeto.json."
            actions={
              <Badge tone={dirty ? 'warning' : 'success'} icon={dirty ? undefined : Check}>
                {dirty ? 'Alterações não salvas' : 'Tudo salvo'}
              </Badge>
            }
          >
            <div className="space-y-4">
              <Field label="Nome">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                />
              </Field>
              <Field
                label="Descrição"
                hint="Escreva o objetivo do projeto. Isso ajuda a lembrar o que você quer construir."
              >
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  maxLength={500}
                />
              </Field>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  disabled={!dirty}
                  onClick={() => {
                    setName(project.name)
                    setDescription(project.description)
                  }}
                >
                  Descartar
                </Button>
                <Button
                  icon={Save}
                  disabled={!dirty}
                  loading={busy === 'Salvando alterações'}
                  onClick={() => void handleSave()}
                >
                  Salvar alterações
                </Button>
              </div>
            </div>
          </Card>

          <Card
            title="Estrutura de pastas"
            description="Cada tipo de recurso do jogo tem seu lugar. Você pode abrir estas pastas a qualquer momento."
          >
            <ul className="divide-y divide-base-800/60">
              {PROJECT_FOLDERS.map((folder) => (
                <li key={folder} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="mt-0.5 rounded-md border border-base-800 bg-base-850 px-1.5 py-0.5 font-mono text-[11px] text-accent-300">
                    {folder}/
                  </span>
                  <span className="text-xs leading-relaxed text-ink-400">
                    {FOLDER_DESCRIPTIONS[folder]}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Resumo">
            <dl className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Criado em', value: formatDateTime(project.createdAt) },
                { label: 'Atualizado', value: formatRelative(project.updatedAt) },
                { label: 'Último acesso', value: formatRelative(project.lastOpenedAt) },
                { label: 'Tamanho', value: formatBytes(project.sizeBytes) },
                { label: 'Recursos', value: String(project.assetCount) },
                { label: 'Backups', value: String(project.backupCount) }
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-base-800 bg-base-950/40 px-3 py-2">
                  <dt className="text-ink-500">{item.label}</dt>
                  <dd className="mt-0.5 text-ink-100">{item.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 font-mono text-[11px] break-all text-ink-500">{project.path}</p>
          </Card>

          <Card
            title="Backups"
            description="Cópias completas da pasta do projeto, feitas antes de mudanças importantes."
            actions={
              <Button variant="ghost" size="sm" icon={History} onClick={() => setBackupsOpen(true)}>
                Gerenciar
              </Button>
            }
          >
            <p className="text-xs leading-relaxed text-ink-300">
              {project.backupCount === 0
                ? 'Nenhum backup criado ainda. Faça o primeiro antes de começar a criar recursos.'
                : `${pluralize(project.backupCount, 'backup guardado', 'backups guardados')} para este projeto.`}
            </p>
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                icon={HardDriveDownload}
                loading={busy === 'Criando backup'}
                onClick={() => void backupProject(project.id)}
              >
                Criar backup agora
              </Button>
            </div>
          </Card>

          <Card title="Próximo passo">
            <div className="flex gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-500/15 text-accent-300">
                <Wand2 className="size-4" aria-hidden />
              </span>
              <p className="text-xs leading-relaxed text-ink-300">
                Os geradores de personagens, monstros, armas, mapas e animações chegam nas próximas
                etapas. Enquanto isso, este projeto já está pronto para receber arquivos: use a pasta
                <span className="font-mono text-accent-300"> originais/ </span>
                para o que você trouxer e
                <span className="font-mono text-accent-300"> gerados/ </span>
                para o que o Studio criar.
              </p>
            </div>
            <div className="mt-3">
              <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'roadmap' })}>
                Ver o plano das etapas
              </Button>
            </div>
          </Card>

          <Card title="Remover projeto" description="Ação permanente na lista do Studio.">
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => setRemoveOpen(true)}>
              Remover este projeto
            </Button>
          </Card>
        </div>
      </div>

      <BackupsDialog
        project={project}
        open={backupsOpen}
        onClose={() => setBackupsOpen(false)}
      />

      <ConfirmDialog
        open={removeOpen}
        title={`Remover "${project.name}"?`}
        description="Escolha o que deve acontecer com os arquivos."
        confirmLabel="Remover projeto"
        tone="danger"
        loading={busy !== null}
        onCancel={() => setRemoveOpen(false)}
        onConfirm={handleRemove}
      >
        <div className="space-y-3">
          <label className="flex items-start gap-2.5 rounded-xl border border-base-800 bg-base-950/40 px-3 py-2.5">
            <input
              type="radio"
              name="detail-delete-files"
              checked={deleteFiles}
              onChange={() => setDeleteFiles(true)}
              className="mt-0.5 accent-[#2f7fff]"
            />
            <span className="text-xs leading-relaxed text-ink-200">
              Mover a pasta para a lixeira interna do Studio
              <span className="mt-0.5 block text-ink-500">
                Os arquivos ficam recuperáveis na pasta de dados do aplicativo.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 rounded-xl border border-base-800 bg-base-950/40 px-3 py-2.5">
            <input
              type="radio"
              name="detail-delete-files"
              checked={!deleteFiles}
              onChange={() => setDeleteFiles(false)}
              className="mt-0.5 accent-[#2f7fff]"
            />
            <span className="text-xs leading-relaxed text-ink-200">
              Manter os arquivos no disco
              <span className="mt-0.5 block text-ink-500">
                O projeto sai da lista, a pasta continua onde está.
              </span>
            </span>
          </label>
        </div>
      </ConfirmDialog>
    </div>
  )
}
