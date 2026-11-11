import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  ExternalLink,
  File as FileIcon,
  FileAudio,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  FolderTree,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  type LucideIcon
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { FileCategory, FileEntry, FilePreview } from '@shared/contract'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Note, PageHeader } from '../components/ui'
import { formatBytes, formatDateTime } from '../lib/format'
import { useApp } from '../state/store'

const CATEGORY_ICONS: Record<FileCategory, LucideIcon> = {
  pasta: Folder,
  imagem: FileImage,
  audio: FileAudio,
  cena: Boxes,
  codigo: FileCode2,
  dados: FileText,
  texto: FileText,
  outro: FileIcon
}

const CATEGORY_LABELS: Record<FileCategory, string> = {
  pasta: 'Pasta',
  imagem: 'Imagem',
  audio: 'Áudio',
  cena: 'Cena',
  codigo: 'Código',
  dados: 'Dados',
  texto: 'Texto',
  outro: 'Arquivo'
}

function splitPath(relativePath: string): string[] {
  return relativePath ? relativePath.split('/') : []
}

export function FilesPage(): React.JSX.Element {
  const { activeProject, projects, navigate, notify } = useApp()
  const projectId = activeProject?.id ?? null
  const projectName = activeProject?.name ?? ''
  const projectSlug = activeProject?.slug ?? ''

  const [relativePath, setRelativePath] = useState('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderError, setFolderError] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState<FileEntry | null>(null)
  const [trashTarget, setTrashTarget] = useState<FileEntry | null>(null)
  const [trashing, setTrashing] = useState(false)

  const load = useCallback(
    async (path: string) => {
      if (!projectId) return
      setLoading(true)
      setError(null)
      try {
        const list = await window.studio.files.list(projectId, path)
        setEntries(list)
        setRelativePath(path)
        setSelected(null)
        setPreview(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível ler a pasta.')
        setEntries([])
      } finally {
        setLoading(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    setRelativePath('')
    setEntries([])
    setPreview(null)
    setSelected(null)
    if (projectId) void load('')
  }, [projectId, load])

  const openFile = useCallback(
    async (entry: FileEntry) => {
      if (!projectId) return
      if (entry.isDirectory) {
        await load(entry.relativePath)
        return
      }
      setSelected(entry)
      setPreviewLoading(true)
      try {
        const data = await window.studio.files.preview(projectId, entry.relativePath)
        setPreview(data)
      } catch (err) {
        notify('erro', 'Não foi possível abrir o arquivo', err instanceof Error ? err.message : undefined)
        setPreview(null)
      } finally {
        setPreviewLoading(false)
      }
    },
    [projectId, load, notify]
  )

  const handleImport = useCallback(async () => {
    if (!projectId) return
    setImporting(true)
    try {
      const result = await window.studio.files.importFiles(projectId, relativePath)
      if (!result) return

      const parts: string[] = []
      if (result.imported.length > 0) parts.push(`${result.imported.length} copiado(s)`)
      if (result.renamed.length > 0) {
        parts.push(`${result.renamed.length} renomeado(s) para não sobrescrever`)
      }
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} ignorado(s)`)

      notify(
        result.imported.length + result.renamed.length > 0 ? 'sucesso' : 'atencao',
        result.imported.length + result.renamed.length > 0
          ? 'Arquivos copiados para o projeto'
          : 'Nenhum arquivo foi copiado',
        parts.join(' · ') || 'Nada foi selecionado.'
      )
      await load(relativePath)
    } catch (err) {
      notify('erro', 'Falha ao importar', err instanceof Error ? err.message : undefined)
    } finally {
      setImporting(false)
    }
  }, [projectId, relativePath, notify, load])

  const handleCreateFolder = useCallback(async () => {
    if (!projectId) return
    setCreatingFolder(true)
    setFolderError(null)
    try {
      const entry = await window.studio.files.createFolder(projectId, relativePath, folderName)
      setFolderName('')
      setFolderModalOpen(false)
      await load(relativePath)
      setSelected(entry)
      notify('sucesso', 'Pasta criada', entry.relativePath)
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : 'Não foi possível criar a pasta.')
    } finally {
      setCreatingFolder(false)
    }
  }, [projectId, relativePath, folderName, notify, load])

  const handleTrash = useCallback(async () => {
    if (!projectId || !trashTarget) return
    setTrashing(true)
    try {
      await window.studio.files.trash(projectId, trashTarget.relativePath)
      notify(
        'info',
        'Item movido para a lixeira do Studio',
        `${trashTarget.name} pode ser recuperado na pasta de dados do aplicativo.`
      )
      setTrashTarget(null)
      await load(relativePath)
    } catch (err) {
      notify('erro', 'Não foi possível remover', err instanceof Error ? err.message : undefined)
    } finally {
      setTrashing(false)
    }
  }, [projectId, trashTarget, notify, load, relativePath])

  if (!projectId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Gerenciador de arquivos"
          title="Arquivos do projeto"
          description="Veja, importe e organize os arquivos de cada projeto sem sair do Studio."
        />
        <EmptyState
          icon={FolderTree}
          title="Nenhum projeto aberto"
          description="Abra um projeto para navegar pelas pastas de personagens, monstros, mapas e tudo o mais que você criar."
          action={
            <Button onClick={() => navigate({ name: 'projetos' })}>
              {projects.length > 0 ? 'Abrir meus projetos' : 'Criar o primeiro projeto'}
            </Button>
          }
        />
      </div>
    )
  }

  const segments = splitPath(relativePath)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Projeto ${projectName}`}
        title="Arquivos do projeto"
        description="Navegue pelas pastas, veja o conteúdo dos arquivos e importe seus próprios recursos. Nada é apagado de verdade: o que você remover vai para a lixeira interna."
        actions={
          <>
            <Button icon={Upload} loading={importing} onClick={() => void handleImport()}>
              Importar arquivos
            </Button>
            <Button variant="secondary" icon={FolderPlus} onClick={() => setFolderModalOpen(true)}>
              Nova pasta
            </Button>
            <Button
              variant="ghost"
              icon={ExternalLink}
              onClick={() => void window.studio.files.openFolder(projectId, relativePath)}
            >
              Abrir no Explorador
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-base-800 bg-base-900/60 px-3 py-2 text-xs text-ink-300">
        <button
          type="button"
          onClick={() => void load('')}
          className="rounded-md px-2 py-1 font-medium text-ink-200 transition-colors hover:bg-white/5 hover:text-white"
        >
          {projectSlug || projectName}
        </button>
        {segments.map((segment, index) => {
          const target = segments.slice(0, index + 1).join('/')
          return (
            <span key={target} className="flex items-center gap-1.5">
              <ChevronRight className="size-3 text-ink-600" aria-hidden />
              <button
                type="button"
                onClick={() => void load(target)}
                className="rounded-md px-2 py-1 transition-colors hover:bg-white/5 hover:text-white"
              >
                {segment}
              </button>
            </span>
          )
        })}
        <span className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            onClick={() => void load(relativePath)}
            loading={loading}
          >
            Atualizar
          </Button>
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card
          title={relativePath ? `Pasta ${relativePath}` : 'Raiz do projeto'}
          description={`${entries.length} item(ns) nesta pasta`}
          bodyClassName="p-0"
        >
          {error ? (
            <div className="m-4">
              <Note tone="warning">{error}</Note>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-xs text-ink-400">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Lendo a pasta…
            </div>
          ) : entries.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Folder className="mx-auto size-8 text-ink-600" aria-hidden />
              <p className="mt-3 text-sm font-medium text-ink-200">Esta pasta está vazia</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-500">
                Use “Importar arquivos” para copiar sprites, sons ou qualquer arquivo que você já
                tenha no computador.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-base-800/70">
              {entries.map((entry) => {
                const Icon = CATEGORY_ICONS[entry.category]
                const isActive = selected?.relativePath === entry.relativePath
                return (
                  <li
                    key={entry.relativePath}
                    className={isActive ? 'bg-accent-500/10' : 'transition-colors hover:bg-white/[0.03]'}
                  >
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => void openFile(entry)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={
                            entry.isDirectory
                              ? 'grid size-8 shrink-0 place-items-center rounded-lg bg-accent-500/15 text-accent-300'
                              : 'grid size-8 shrink-0 place-items-center rounded-lg bg-base-800 text-ink-300'
                          }
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink-100">{entry.name}</span>
                          <span className="block truncate text-[11px] text-ink-500">
                            {entry.isDirectory
                              ? `${entry.childCount} item(ns) · ${CATEGORY_LABELS.pasta}`
                              : `${CATEGORY_LABELS[entry.category]} · ${formatBytes(entry.sizeBytes)} · ${formatDateTime(entry.modifiedAt)}`}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrashTarget(entry)}
                        aria-label={`Mover ${entry.name} para a lixeira`}
                        title="Mover para a lixeira"
                        className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card
          title="Pré-visualização"
          description={selected ? selected.relativePath : 'Escolha um arquivo na lista ao lado.'}
          actions={selected ? <Badge tone="accent">{CATEGORY_LABELS[selected.category]}</Badge> : undefined}
        >
          {previewLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-ink-400">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Abrindo…
            </div>
          ) : !selected ? (
            <div className="py-12 text-center">
              <FileIcon className="mx-auto size-8 text-ink-600" aria-hidden />
              <p className="mt-3 text-xs leading-relaxed text-ink-500">
                Clique em um arquivo para ver o conteúdo aqui. Imagens aparecem como sprites e os
                arquivos de texto (GDScript, JSON, cenas) como código.
              </p>
            </div>
          ) : !preview ? (
            <Note tone="warning">Não foi possível ler este arquivo.</Note>
          ) : preview.dataUrl ? (
            <div
              className="flex items-center justify-center rounded-xl border border-base-800 p-4"
              style={{
                backgroundColor: '#0b1120',
                backgroundImage:
                  'linear-gradient(45deg, rgba(255,255,255,0.045) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.045) 75%), linear-gradient(45deg, rgba(255,255,255,0.045) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.045) 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 8px 8px'
              }}
            >
              <img
                src={preview.dataUrl}
                alt={`Pré-visualização de ${preview.name}`}
                className="max-h-72 max-w-full"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          ) : preview.text !== null ? (
            <div>
              <pre className="scroll-area max-h-80 overflow-auto rounded-xl border border-base-800 bg-base-950/80 p-3 text-[11px] leading-relaxed text-ink-200">
                <code>{preview.text}</code>
              </pre>
              {preview.truncated && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300">
                  <AlertTriangle className="size-3.5" aria-hidden /> Mostrando apenas o início do
                  arquivo.
                </p>
              )}
            </div>
          ) : (
            <Note tone="info">
              Este é um arquivo binário ({formatBytes(preview.sizeBytes)}) e não tem
              pré-visualização. Use “Abrir no Explorador” para abri-lo em outro programa.
            </Note>
          )}

          {preview && (
            <dl className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-ink-400">
              <div>
                <dt className="text-ink-500">Tamanho</dt>
                <dd className="text-ink-200">{formatBytes(preview.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Modificado</dt>
                <dd className="text-ink-200">{formatDateTime(preview.modifiedAt)}</dd>
              </div>
            </dl>
          )}
        </Card>
      </div>

      <Modal
        open={folderModalOpen}
        onClose={() => {
          setFolderModalOpen(false)
          setFolderError(null)
        }}
        title="Nova pasta"
        description={`Ela será criada dentro de ${relativePath || `${projectName} (raiz)`}.`}
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFolderModalOpen(false)}>
              Cancelar
            </Button>
            <Button loading={creatingFolder} onClick={() => void handleCreateFolder()}>
              Criar pasta
            </Button>
          </>
        }
      >
        <Field
          label="Nome da pasta"
          hint="Exemplos: cenarios, ui, sons, referencias."
          error={folderError}
        >
          <Input
            autoFocus
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder="cenarios"
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleCreateFolder()
            }}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={trashTarget !== null}
        title="Mover para a lixeira do Studio?"
        description={
          trashTarget
            ? `"${trashTarget.name}" será movido para a lixeira interna, dentro da pasta de dados do aplicativo. Você poderá restaurá-lo manualmente.`
            : undefined
        }
        confirmLabel="Mover para a lixeira"
        tone="danger"
        loading={trashing}
        onConfirm={() => void handleTrash()}
        onCancel={() => setTrashTarget(null)}
      >
        <Note tone="info">
          O Studio nunca apaga arquivos de forma definitiva. Esta ação apenas tira o item do projeto.
        </Note>
      </ConfirmDialog>
    </div>
  )
}
