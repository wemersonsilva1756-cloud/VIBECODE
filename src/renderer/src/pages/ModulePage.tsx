import { ArrowLeft, CheckCircle2, Construction, Info, Lightbulb, ListChecks } from 'lucide-react'
import { moduleById } from '../navigation'
import { useApp } from '../state/store'
import { Badge, Button, Card, EmptyState, Note, PageHeader } from '../components/ui'

/**
 * Página dos módulos que ainda serão entregues.
 *
 * Regra do projeto: nada de botões falsos. Aqui o usuário vê exatamente o que
 * virá, em qual etapa e por que ainda não está disponível.
 */
export function ModulePage({ moduleId }: { moduleId: string }): React.JSX.Element {
  const { navigate, projects } = useApp()
  const module = moduleById(moduleId)

  if (!module) {
    return (
      <div className="space-y-6">
        <PageHeader title="Módulo não encontrado" />
        <EmptyState
          icon={Info}
          title="Este módulo não existe"
          description="Ele pode ter mudado de nome. Veja as etapas do desenvolvimento para conhecer tudo o que está planejado."
          action={
            <Button icon={ArrowLeft} onClick={() => navigate({ name: 'roadmap' })}>
              Ver etapas
            </Button>
          }
        />
      </div>
    )
  }

  const Icon = module.icon

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Etapa ${module.stage}`}
        title={module.title}
        description={module.summary}
        actions={
          <>
            <Badge tone="warning" icon={Construction}>
              Ainda não disponível
            </Badge>
            <Button variant="secondary" onClick={() => navigate({ name: 'roadmap' })}>
              Ver etapas
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card
          title="O que este módulo vai fazer"
          description="Recursos planejados para esta etapa. Nada aqui está ativo nesta versão."
          actions={<Badge icon={ListChecks}>{module.planned.length} recursos</Badge>}
        >
          <ul className="space-y-2.5">
            {module.planned.map((item) => (
              <li key={item} className="flex gap-2.5 text-xs leading-relaxed text-ink-300">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ink-500" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card title="Por que ainda não está aqui">
            <div className="flex gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-300">
                <Icon className="size-4" aria-hidden />
              </span>
              <p className="text-xs leading-relaxed text-ink-300">
                O Studio é entregue por etapas. Cada módulo só aparece com funções completas e
                testadas — não colocamos telas vazias nem botões que não fazem nada. Este módulo está
                previsto para a <strong className="text-ink-100">etapa {module.stage}</strong>.
              </p>
            </div>
          </Card>

          <Card title="O que você pode fazer agora">
            <ul className="space-y-1.5 text-xs leading-relaxed text-ink-300">
              <li>· Criar e abrir projetos com as pastas organizadas por tipo de recurso.</li>
              <li>· Fazer backups e restaurar versões anteriores com segurança.</li>
              <li>· Guardar arquivos próprios na pasta originais/ de cada projeto.</li>
              <li>· Ler os tutoriais para se preparar para as próximas etapas.</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate({ name: 'projetos' })}
              >
                {projects.length > 0 ? 'Abrir meus projetos' : 'Criar um projeto'}
              </Button>
              <Button variant="ghost" size="sm" icon={Lightbulb} onClick={() => navigate({ name: 'ajuda' })}>
                Ver tutoriais
              </Button>
            </div>
          </Card>

          <Note tone="info">
            Quer que este módulo venha antes? A ordem das etapas pode ser ajustada — o importante é
            que cada um chegue funcionando de verdade.
          </Note>
        </div>
      </div>
    </div>
  )
}
