import {
  Database,
  FolderOpen,
  GraduationCap,
  HardDriveDownload,
  Info,
  ShieldCheck,
  SlidersHorizontal
} from 'lucide-react'
import { useApp } from '../state/store'
import { Badge, Button, Card, Note, PageHeader } from '../components/ui'

const BACKUP_OPTIONS = [5, 10, 20, 50]

export function SettingsPage(): React.JSX.Element {
  const { settings, paths, chooseWorkspace, updateSettings, resetOnboarding, notify } = useApp()

  async function openDataFolder(): Promise<void> {
    try {
      await window.studio.app.openDataFolder()
    } catch (error) {
      notify(
        'erro',
        'Não foi possível abrir a pasta',
        error instanceof Error ? error.message : undefined
      )
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Preferências gerais do Studio. Tudo é salvo imediatamente no banco de dados local."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Pasta dos projetos"
          description="Onde novos projetos são criados."
          actions={<Badge tone="accent" icon={FolderOpen}>Local</Badge>}
        >
          <div className="space-y-3">
            <p className="rounded-xl border border-base-800 bg-base-950/50 px-3 py-2.5 font-mono text-xs break-all text-ink-100">
              {settings?.workspaceRoot ?? '—'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={FolderOpen} onClick={() => void chooseWorkspace()}>
                Alterar pasta
              </Button>
            </div>
            <Note>
              Alterar esta pasta não move projetos existentes. Eles continuam funcionando e aparecem
              na lista normalmente.
            </Note>
          </div>
        </Card>

        <Card
          title="Backups automáticos"
          description="Quantos backups automáticos e de segurança o Studio mantém por projeto."
          actions={<Badge icon={HardDriveDownload}>Retenção</Badge>}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {BACKUP_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => void updateSettings({ maxBackups: option })}
                  className={`rounded-xl border px-3.5 py-2 text-sm transition-colors ${
                    settings?.maxBackups === option
                      ? 'border-accent-500/50 bg-accent-500/15 text-white'
                      : 'border-base-700 bg-base-850 text-ink-300 hover:border-base-600 hover:text-ink-100'
                  }`}
                >
                  {option} por projeto
                </button>
              ))}
            </div>
            <Note tone="warning">
              Backups criados manualmente nunca são reciclados. O limite vale apenas para os backups
              automáticos e de segurança. Os excedentes vão para a lixeira interna, não são apagados.
            </Note>
          </div>
        </Card>

        <Card
          title="Dados do aplicativo"
          description="Onde ficam o banco de dados e os arquivos internos."
          actions={<Badge icon={Database}>SQLite local</Badge>}
        >
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-ink-500">Banco de dados</dt>
              <dd className="font-mono break-all text-ink-200">{paths?.dbPath ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Pasta de dados</dt>
              <dd className="font-mono break-all text-ink-200">{paths?.dataDir ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Backups guardados em</dt>
              <dd className="font-mono break-all text-ink-200">{paths?.backupsDir ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Lixeira interna</dt>
              <dd className="font-mono break-all text-ink-200">
                {paths ? `${paths.dataDir}\\lixeira` : '—'}
              </dd>
            </div>
          </dl>
          <div className="mt-3">
            <Button variant="secondary" icon={FolderOpen} onClick={() => void openDataFolder()}>
              Abrir pasta de dados
            </Button>
          </div>
        </Card>

        <Card
          title="Aparência e acessibilidade"
          description="O Studio usa tema escuro fixo para não cansar a vista durante o trabalho."
          actions={<Badge icon={SlidersHorizontal}>Tema escuro</Badge>}
        >
          <ul className="space-y-2 text-xs leading-relaxed text-ink-300">
            <li>· Tema escuro com detalhes em azul, otimizado para sessões longas.</li>
            <li>· Todos os botões têm texto explicativo e atalhos visíveis.</li>
            <li>· Notificações informam o resultado de cada operação.</li>
            <li>· Nenhuma ação destrutiva acontece sem confirmação.</li>
          </ul>
        </Card>

        <Card
          title="Guia inicial"
          description="O tour de boas-vindas mostra onde ficam as coisas."
          actions={<Badge icon={GraduationCap}>Para iniciantes</Badge>}
        >
          <p className="text-xs leading-relaxed text-ink-300">
            Você pode rever o guia quantas vezes quiser. Ele explica como criar projetos, onde os
            arquivos ficam e como os backups funcionam.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" icon={GraduationCap} onClick={() => void resetOnboarding()}>
              Mostrar guia inicial novamente
            </Button>
          </div>
        </Card>

        <Card
          title="Sobre esta versão"
          description="Informações técnicas do aplicativo."
          actions={<Badge icon={Info}>v{paths?.appVersion ?? '0.1.0'}</Badge>}
        >
          <ul className="space-y-1.5 text-xs leading-relaxed text-ink-300">
            <li>· Electron, React e TypeScript com interface em português do Brasil.</li>
            <li>· Banco de dados SQLite local, sem servidor e sem envio de dados.</li>
            <li>
              · Comunicação entre interface e sistema isolada: a interface não tem acesso direto ao
              disco ou ao Node.
            </li>
            <li>· Etapa 1 concluída: estrutura, navegação, projetos, banco de dados e backups.</li>
          </ul>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
            <p className="text-xs leading-relaxed text-ink-300">
              Nenhum recurso deste aplicativo envia seus arquivos ou projetos para a internet.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
