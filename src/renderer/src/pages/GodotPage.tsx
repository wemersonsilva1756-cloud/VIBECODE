import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  FolderOpen,
  Gamepad2,
  HardDriveDownload,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unlink
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type {
  GodotExecutableInfo,
  GodotExportPlan,
  GodotFilePlan,
  ProjectGodotState
} from '@shared/contract'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Modal,
  Note,
  PageHeader,
  StatTile
} from '../components/ui'
import { formatBytes, formatDateTime } from '../lib/format'
import { useApp } from '../state/store'

const ACTION_LABELS: Record<GodotFilePlan['action'], { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  criar: { label: 'novo', tone: 'success' },
  sobrescrever: { label: 'substituir', tone: 'warning' },
  igual: { label: 'sem mudança', tone: 'neutral' }
}

export function GodotPage(): React.JSX.Element {
  const { activeProject, projects, navigate, notify } = useApp()
  const projectId = activeProject?.id ?? null
  const projectName = activeProject?.name ?? ''

  const [state, setState] = useState<ProjectGodotState | null>(null)
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [plan, setPlan] = useState<GodotExportPlan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [confirmExport, setConfirmExport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [executable, setExecutable] = useState<GodotExecutableInfo | null>(null)
  const [checkingExecutable, setCheckingExecutable] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const next = await window.studio.godot.state(projectId)
      setState(next)
      setExecutable(next.executable)
    } catch (err) {
      notify('erro', 'Não foi possível ler o estado da Godot', messageOf(err))
    } finally {
      setLoading(false)
    }
  }, [projectId, notify])

  useEffect(() => {
    setState(null)
    setPlan(null)
    setSelectedFile(null)
    if (projectId) void load()
  }, [projectId, load])

  const handleLink = useCallback(async () => {
    if (!projectId) return
    setLinking(true)
    try {
      const next = await window.studio.godot.link(projectId)
      if (!next) return
      setState(next)
      notify(
        'sucesso',
        'Projeto Godot vinculado',
        `${next.info?.name ?? 'Projeto'}${next.info?.engineVersion ? ` · Godot ${next.info.engineVersion}` : ''}`
      )
    } catch (err) {
      notify('erro', 'Não foi possível vincular', messageOf(err))
    } finally {
      setLinking(false)
    }
  }, [projectId, notify])

  const handleUnlink = useCallback(async () => {
    if (!projectId) return
    try {
      const next = await window.studio.godot.unlink(projectId)
      setState(next)
      setPlan(null)
      setConfirmUnlink(false)
      notify('info', 'Vínculo removido', 'Nada foi alterado na pasta do projeto Godot.')
    } catch (err) {
      notify('erro', 'Não foi possível desvincular', messageOf(err))
    }
  }, [projectId, notify])

  const handlePlan = useCallback(async () => {
    if (!projectId) return
    setPlanLoading(true)
    try {
      const next = await window.studio.godot.plan(projectId)
      setPlan(next)
      setSelectedFile(next.files[0]?.relativePath ?? null)
    } catch (err) {
      notify('erro', 'Não foi possível preparar a exportação', messageOf(err))
    } finally {
      setPlanLoading(false)
    }
  }, [projectId, notify])

  const handleExport = useCallback(async () => {
    if (!projectId) return
    setExporting(true)
    try {
      const result = await window.studio.godot.exportProject(projectId)
      setConfirmExport(false)
      setPlan(null)
      await load()
      notify(
        'sucesso',
        'Exportação concluída',
        `${result.written} arquivo(s) gravado(s) em ${result.targetPath}${
          result.backupPath ? ` · cópia de segurança em ${result.backupPath}` : ''
        }`
      )
    } catch (err) {
      notify('erro', 'A exportação falhou', messageOf(err))
    } finally {
      setExporting(false)
    }
  }, [projectId, notify, load])

  const handleChooseExecutable = useCallback(async () => {
    setCheckingExecutable(true)
    try {
      const info = await window.studio.godot.chooseExecutable()
      setExecutable(info)
      if (info.ok) {
        notify('sucesso', 'Godot configurada', info.message)
      } else if (info.path) {
        notify('atencao', 'Executável não aceito', info.message)
      }
    } catch (err) {
      notify('erro', 'Não foi possível verificar a Godot', messageOf(err))
    } finally {
      setCheckingExecutable(false)
    }
  }, [notify])

  const handleCheckExecutable = useCallback(async () => {
    setCheckingExecutable(true)
    try {
      setExecutable(await window.studio.godot.checkExecutable())
    } catch (err) {
      notify('erro', 'Não foi possível conferir a Godot', messageOf(err))
    } finally {
      setCheckingExecutable(false)
    }
  }, [notify])

  if (!projectId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Etapa 2 · disponível"
          title="Integração com Godot 4"
          description="Vincule a pasta do seu projeto Godot para exportar a preparação do Pixel Strike com prévia e backup."
        />
        <EmptyState
          icon={Boxes}
          title="Nenhum projeto aberto"
          description="A integração funciona dentro de um projeto do Studio. Abra ou crie um projeto para começar."
          action={
            <Button onClick={() => navigate({ name: 'projetos' })}>
              {projects.length > 0 ? 'Abrir meus projetos' : 'Criar o primeiro projeto'}
            </Button>
          }
        />
      </div>
    )
  }

  const info = state?.info ?? null
  const link = state?.link ?? null
  const selectedPlanFile = plan?.files.find((file) => file.relativePath === selectedFile) ?? null

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Projeto ${projectName} · Etapa 2`}
        title="Integração com Godot 4"
        description="O Studio lê o seu projeto Godot, mostra o que existe e só grava arquivos depois que você aprovar a lista. Tudo o que for substituído fica guardado em .pixel_strike/backups."
        actions={
          <>
            <Button icon={FolderOpen} loading={linking} onClick={() => void handleLink()}>
              {link ? 'Trocar pasta da Godot' : 'Escolher pasta da Godot'}
            </Button>
            {link && (
              <Button
                variant="secondary"
                icon={HardDriveDownload}
                loading={planLoading}
                onClick={() => void handlePlan()}
              >
                Pré-visualizar exportação
              </Button>
            )}
            <Button variant="ghost" icon={RefreshCw} loading={loading} onClick={() => void load()}>
              Atualizar
            </Button>
          </>
        }
      />

      {loading && !state ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-base-800 bg-base-900/60 py-16 text-xs text-ink-400">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Lendo projeto Godot…
        </div>
      ) : !link ? (
        <div className="space-y-4">
          <EmptyState
            icon={Gamepad2}
            title="Escolha a pasta do seu projeto Godot 4"
            description="Selecione a pasta que contém o arquivo project.godot. O Studio identifica a versão, lista cenas e scripts e nunca altera nada sem mostrar antes."
            action={
              <Button icon={Link2} loading={linking} onClick={() => void handleLink()}>
                Escolher pasta da Godot
              </Button>
            }
          />
          <Note tone="info">
            A exportação envia a preparação do Pixel Strike (script utilitário, manifesto e
            instruções), os personagens, monstros e animações já gerados e todos os arquivos que
            você colocar na pasta <strong className="text-ink-100">godot/</strong> do projeto.
            Mapas entram na etapa 5.
          </Note>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={Gamepad2}
              label="Projeto Godot"
              value={info?.name ?? 'Não encontrado'}
              hint={info?.engineVersion ? `Godot ${info.engineVersion}` : 'Versão não informada'}
            />
            <StatTile
              icon={Boxes}
              label="Cenas"
              value={String(info?.counts.scenes ?? 0)}
              hint={`${info?.counts.scripts ?? 0} script(s)`}
            />
            <StatTile
              icon={HardDriveDownload}
              label="Imagens"
              value={String(info?.counts.images ?? 0)}
              hint={`${info?.counts.resources ?? 0} recurso(s) .tres`}
            />
            <StatTile
              icon={CheckCircle2}
              label="Último envio"
              value={link.lastExportAt ? formatDateTime(link.lastExportAt) : 'nunca'}
              hint={link.path}
            />
          </div>

          {info?.problem && <Note tone="warning">{info.problem}</Note>}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Card
              title="O que existe no projeto Godot"
              description={link.path}
              actions={
                <Button variant="ghost" size="sm" icon={Unlink} onClick={() => setConfirmUnlink(true)}>
                  Desvincular
                </Button>
              }
            >
              <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-ink-500">Formato</dt>
                  <dd className="text-ink-200">
                    {info?.configVersion ? `config_version ${info.configVersion}` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-500">Cena principal</dt>
                  <dd className="truncate text-ink-200" title={info?.mainScene ?? undefined}>
                    {info?.mainScene ?? 'não definida'}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-500">Autoloads</dt>
                  <dd className="text-ink-200">
                    {info && info.autoloads.length > 0 ? info.autoloads.join(', ') : 'nenhum'}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-500">Vinculado em</dt>
                  <dd className="text-ink-200">{formatDateTime(link.linkedAt)}</dd>
                </div>
              </dl>

              {info && info.scenes.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                    Cenas encontradas
                  </p>
                  <ul className="scroll-area max-h-40 space-y-1 overflow-auto text-[11px] text-ink-300">
                    {info.scenes.map((scene) => (
                      <li key={scene} className="truncate font-mono">
                        {scene}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {info && info.scripts.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                    Scripts encontrados
                  </p>
                  <ul className="scroll-area max-h-32 space-y-1 overflow-auto text-[11px] text-ink-300">
                    {info.scripts.map((script) => (
                      <li key={script} className="truncate font-mono">
                        {script}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {info && info.counts.scenes === 0 && (
                <p className="mt-4 text-xs leading-relaxed text-ink-500">
                  Este projeto ainda não tem cenas. Você pode criar a primeira na própria Godot e
                  voltar aqui para exportar os recursos do Studio.
                </p>
              )}
            </Card>

            <div className="space-y-4">
              <Card
                title="Executável da Godot (opcional)"
                description="Serve só para conferir a versão instalada. O Studio nunca abre a Godot sozinho."
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-base-800 text-accent-300">
                    <ShieldCheck className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-ink-200">
                      {executable?.ok
                        ? `Godot ${executable.version} encontrada`
                        : executable?.path
                          ? 'Executável configurado, mas não validado'
                          : 'Nenhum executável configurado'}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-ink-500" title={executable?.path ?? ''}>
                      {executable?.path ?? 'Nada é obrigatório aqui.'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={FolderOpen}
                    loading={checkingExecutable}
                    onClick={() => void handleChooseExecutable()}
                  >
                    Escolher executável
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={RefreshCw}
                    loading={checkingExecutable}
                    onClick={() => void handleCheckExecutable()}
                  >
                    Conferir versão
                  </Button>
                </div>
                {executable && !executable.ok && executable.message && (
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-500">{executable.message}</p>
                )}
              </Card>

              <Card title="Como a exportação funciona">
                <ol className="space-y-2 text-xs leading-relaxed text-ink-300">
                  <li>1. Você clica em “Pré-visualizar exportação”.</li>
                  <li>2. O Studio mostra cada arquivo e o que vai acontecer com ele.</li>
                  <li>3. Você confirma; os arquivos substituídos vão para o backup antes.</li>
                  <li>4. O histórico registra a exportação com data e hora.</li>
                </ol>
                <div className="mt-3">
                  <Note tone="info">
                    Nada é apagado e nenhuma cena sua é modificada. O Studio só cria os arquivos do
                    addon e copia a pasta <strong className="text-ink-100">godot/</strong>.
                  </Note>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      <Modal
        open={plan !== null}
        onClose={() => setPlan(null)}
        title="Pré-visualização da exportação"
        description={plan ? `Destino: ${plan.targetPath}` : undefined}
        width="lg"
        footer={
          plan ? (
            <>
              <Button variant="secondary" onClick={() => setPlan(null)}>
                Cancelar
              </Button>
              <Button
                icon={HardDriveDownload}
                disabled={plan.files.every((file) => file.action === 'igual')}
                onClick={() => setConfirmExport(true)}
              >
                Exportar {plan.files.filter((file) => file.action !== 'igual').length} arquivo(s)
              </Button>
            </>
          ) : undefined
        }
      >
        {plan && (
          <div className="space-y-3">
            {plan.warnings.map((warning) => (
              <Note key={warning} tone="warning">
                {warning}
              </Note>
            ))}

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <ul className="scroll-area max-h-72 divide-y divide-base-800 overflow-auto rounded-xl border border-base-800">
                {plan.files.map((file) => {
                  const action = ACTION_LABELS[file.action]
                  const isActive = file.relativePath === selectedFile
                  return (
                    <li key={file.relativePath}>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(file.relativePath)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] transition-colors ${
                          isActive ? 'bg-accent-500/10 text-ink-100' : 'text-ink-300 hover:bg-white/[0.03]'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate font-mono">{file.relativePath}</span>
                        <Badge tone={action.tone}>{action.label}</Badge>
                      </button>
                    </li>
                  )
                })}
              </ul>

              <div className="min-w-0">
                {selectedPlanFile ? (
                  <>
                    <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink-400">
                      <span className="truncate font-mono">{selectedPlanFile.relativePath}</span>
                      <span>{formatBytes(selectedPlanFile.bytes)}</span>
                    </div>
                    {selectedPlanFile.preview ? (
                      <pre className="scroll-area max-h-64 overflow-auto rounded-xl border border-base-800 bg-base-950/80 p-3 text-[10.5px] leading-relaxed text-ink-200">
                        <code>{selectedPlanFile.preview}</code>
                      </pre>
                    ) : (
                      <Note tone="info">Arquivo binário: será copiado sem alteração.</Note>
                    )}
                  </>
                ) : (
                  <Note tone="info">Escolha um arquivo para ver o conteúdo.</Note>
                )}
              </div>
            </div>

            <p className="text-[11px] text-ink-500">
              {plan.assetCount} arquivo(s) de recursos (pasta godot/, sprites e animações). Os
              demais são a preparação criada pelo Studio.
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmExport}
        title="Confirmar exportação para a Godot"
        description={
          plan
            ? `Serão gravados ${plan.files.filter((file) => file.action !== 'igual').length} arquivo(s) em ${plan.targetPath}.`
            : undefined
        }
        confirmLabel="Sim, exportar agora"
        loading={exporting}
        onConfirm={() => void handleExport()}
        onCancel={() => setConfirmExport(false)}
      >
        <div className="space-y-3">
          <Note tone="warning">
            Feche a Godot antes de exportar. Se o projeto estiver aberto, a engine pode reescrever os
            arquivos importados.
          </Note>
          <div className="flex items-start gap-2 text-xs leading-relaxed text-ink-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
            <p>
              Arquivos que já existem serão substituídos, mas uma cópia de cada um é guardada antes em{' '}
              <span className="font-mono text-ink-100">.pixel_strike/backups/</span>.
            </p>
          </div>
          <div className="flex items-start gap-2 text-xs leading-relaxed text-ink-300">
            <Info className="mt-0.5 size-4 shrink-0 text-accent-300" aria-hidden />
            <p>Nenhuma cena, script ou configuração sua será removida.</p>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmUnlink}
        title="Desvincular esta pasta Godot?"
        description="O Studio esquece o caminho. Nenhum arquivo é alterado ou apagado."
        confirmLabel="Desvincular"
        onConfirm={() => void handleUnlink()}
        onCancel={() => setConfirmUnlink(false)}
      />
    </div>
  )
}

function messageOf(error: unknown): string | undefined {
  return error instanceof Error && error.message ? error.message : undefined
}
