import { HardDriveDownload, History, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { BackupSummary, ProjectSummary } from '@shared/contract'
import { useApp } from '../state/store'
import { formatBytes, formatDateTime, pluralize } from '../lib/format'
import { Badge, Button, ConfirmDialog, EmptyState, Input, Modal, Note } from './ui'

/** Histórico de backups de um projeto, com restauração confirmada. */

const KIND_LABELS: Record<BackupSummary['kind'], string> = {
  manual: 'Manual',
  automatico: 'Automático',
  seguranca: 'Segurança'
}

export function BackupsDialog({
  project,
  open,
  onClose
}: {
  project: ProjectSummary | null
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const { backupProject, restoreBackup, busy, notify } = useApp()
  const [backups, setBackups] = useState<BackupSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [label, setLabel] = useState('')
  const [pendingRestore, setPendingRestore] = useState<BackupSummary | null>(null)

  const load = useCallback(async () => {
    if (!project) return
    setLoading(true)
    try {
      setBackups(await window.studio.projects.listBackups(project.id))
    } catch (error) {
      notify(
        'erro',
        'Não foi possível carregar os backups',
        error instanceof Error ? error.message : undefined
      )
    } finally {
      setLoading(false)
    }
  }, [project, notify])

  useEffect(() => {
    if (open) {
      setLabel('')
      void load()
    }
  }, [open, load])

  async function handleBackup(): Promise<void> {
    if (!project) return
    const ok = await backupProject(project.id, label.trim() || undefined)
    if (ok) {
      setLabel('')
      await load()
    }
  }

  async function handleRestore(): Promise<void> {
    if (!pendingRestore) return
    const ok = await restoreBackup(pendingRestore.id)
    setPendingRestore(null)
    if (ok) await load()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        width="lg"
        title={project ? `Backups de "${project.name}"` : 'Backups'}
        description="Cada backup é uma cópia completa da pasta do projeto. Antes de restaurar, o Studio salva o estado atual."
        footer={
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-base-800 bg-base-850/60 p-3">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-ink-300 uppercase">
                Nome do backup (opcional)
              </label>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Ex: antes de criar o mapa da base"
                maxLength={80}
              />
            </div>
            <Button
              icon={HardDriveDownload}
              onClick={handleBackup}
              loading={busy !== null}
              disabled={!project}
            >
              Fazer backup agora
            </Button>
          </div>

          {loading ? (
            <p className="py-6 text-center text-xs text-ink-400">Carregando backups…</p>
          ) : backups.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nenhum backup ainda"
              description="Crie o primeiro backup antes de fazer mudanças grandes. Ele guarda uma cópia completa dos arquivos do projeto."
            />
          ) : (
            <div>
              <p className="mb-2 text-xs text-ink-400">
                {pluralize(backups.length, 'backup guardado', 'backups guardados')}
              </p>
              <ul className="space-y-2">
                {backups.map((backup) => (
                  <li
                    key={backup.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-base-800 bg-base-950/40 px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm text-ink-100">{backup.label}</p>
                        <Badge tone={backup.kind === 'manual' ? 'accent' : 'neutral'}>
                          {KIND_LABELS[backup.kind]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {formatDateTime(backup.createdAt)} · {formatBytes(backup.sizeBytes)}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RotateCcw}
                      onClick={() => setPendingRestore(backup)}
                    >
                      Restaurar
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Note tone="warning">
            Restaurar substitui o conteúdo atual da pasta do projeto. O Studio primeiro cria um
            backup de segurança e move a versão atual para a lixeira interna, então nada é perdido
            de forma definitiva.
          </Note>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingRestore !== null}
        title="Restaurar este backup?"
        description={
          pendingRestore
            ? `O projeto voltará ao estado de ${formatDateTime(pendingRestore.createdAt)}.`
            : undefined
        }
        confirmLabel="Restaurar backup"
        tone="danger"
        loading={busy !== null}
        onCancel={() => setPendingRestore(null)}
        onConfirm={handleRestore}
      >
        <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-ink-300">
          <li>O Studio cria um backup de segurança com os arquivos atuais.</li>
          <li>A pasta atual do projeto é movida para a lixeira interna do Studio.</li>
          <li>Os arquivos do backup escolhido são copiados para o projeto.</li>
          <li>O resultado é registrado no histórico do projeto.</li>
        </ol>
      </ConfirmDialog>
    </>
  )
}
