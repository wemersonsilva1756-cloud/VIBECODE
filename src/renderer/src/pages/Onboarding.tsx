import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  Gamepad2,
  GraduationCap,
  Rocket,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../state/store'
import { Button, Field, Input, Note, Textarea } from '../components/ui'

/** Guia inicial para quem nunca programou: explica o essencial e cria o primeiro projeto. */

const STEPS = ['Boas-vindas', 'Pasta dos projetos', 'Primeiro projeto'] as const

export function Onboarding(): React.JSX.Element {
  const { settings, createProject, chooseWorkspace, completeOnboarding, busy } = useApp()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('Pixel Strike')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(): Promise<void> {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError('Escreva um nome com pelo menos 2 caracteres.')
      return
    }
    setError(null)
    const created = await createProject({ name: trimmed, description: description.trim() })
    if (created) await completeOnboarding()
  }

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-[radial-gradient(80%_60%_at_20%_0%,rgba(47,127,255,0.18),transparent_60%),radial-gradient(60%_50%_at_100%_100%,rgba(47,127,255,0.1),transparent_65%)] p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-base-800 bg-base-900/85 shadow-2xl backdrop-blur lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Painel de identidade */}
        <div className="hidden flex-col justify-between gap-8 border-r border-base-800 bg-gradient-to-b from-base-850 to-base-950 p-8 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-700 text-white shadow-lg shadow-accent-700/40">
                <Gamepad2 className="size-5" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Pixel Strike Studio</p>
                <p className="text-[11px] text-ink-500">Criação de jogos 2D com IA</p>
              </div>
            </div>

            <h1 className="mt-8 text-2xl leading-tight font-semibold text-white">
              Seu estúdio de jogos 2D, feito para quem está começando.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-400">
              Você não precisa saber programar nem desenhar. O Studio organiza os arquivos do seu
              jogo e, nas próximas etapas, cria personagens, mapas e armas com você.
            </p>

            <ul className="mt-6 space-y-2.5 text-xs text-ink-300">
              {[
                { icon: GraduationCap, text: 'Tutoriais em português, sem termos complicados' },
                { icon: ShieldCheck, text: 'Backup automático antes de qualquer mudança importante' },
                { icon: FolderOpen, text: 'Todos os arquivos no seu computador, organizados' },
                { icon: Sparkles, text: 'Assistente de IA chega na etapa 9, com adaptadores independentes' }
              ].map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.text} className="flex gap-2.5">
                    <Icon className="mt-0.5 size-4 shrink-0 text-accent-300" aria-hidden />
                    <span className="leading-relaxed">{item.text}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-base-800 bg-base-900/60 px-3.5 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
              Versão atual
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-300">
              Etapa 1 de 10 concluída: estrutura do aplicativo, navegação, projetos, banco de dados
              local e backups.
            </p>
          </div>
        </div>

        {/* Passos */}
        <div className="flex flex-col p-7 sm:p-9">
          <div className="mb-6 flex items-center gap-2">
            {STEPS.map((label, index) => (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                    index < step
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : index === step
                        ? 'border-accent-500/50 bg-accent-500/20 text-accent-200'
                        : 'border-base-700 bg-base-850 text-ink-500'
                  }`}
                >
                  {index < step ? <CheckCircle2 className="size-3.5" aria-hidden /> : index + 1}
                </div>
                <span
                  className={`truncate text-[11px] ${index === step ? 'text-ink-100' : 'text-ink-500'}`}
                >
                  {label}
                </span>
                {index < STEPS.length - 1 && (
                  <div className="mx-1 hidden h-px flex-1 bg-base-800 sm:block" aria-hidden />
                )}
              </div>
            ))}
          </div>

          <div className="flex-1">
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">
                  Antes de começar, três coisas importantes
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      title: 'Tudo fica no seu computador',
                      text: 'Os projetos, o banco de dados e os backups ficam em pastas locais. Nada é enviado para a internet.'
                    },
                    {
                      title: 'O Studio nunca apaga seus arquivos',
                      text: 'Ao remover um projeto, os arquivos vão para uma lixeira interna. Restaurar um backup sempre cria uma cópia de segurança antes.'
                    },
                    {
                      title: 'Você decide, a IA executa',
                      text: 'Nenhuma alteração importante é feita sem mostrar o que será modificado e pedir sua autorização.'
                    }
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-xl border border-base-800 bg-base-950/40 px-3.5 py-3"
                    >
                      <p className="text-sm text-ink-100">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-400">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">Onde os projetos serão salvos</h2>
                <p className="text-sm leading-relaxed text-ink-400">
                  O Studio cria uma pasta para cada projeto. Sugerimos manter dentro de
                  Documentos, na pasta <span className="font-mono text-accent-300">Pixel Strike Studio</span>.
                </p>

                <div className="rounded-xl border border-base-800 bg-base-950/50 px-3.5 py-3">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                    Pasta atual
                  </p>
                  <p className="mt-1 font-mono text-xs break-all text-ink-100">
                    {settings?.workspaceRoot ?? '—'}
                  </p>
                </div>

                <Button variant="secondary" icon={FolderOpen} onClick={() => void chooseWorkspace()}>
                  Escolher outra pasta
                </Button>

                <Note tone="info">
                  Mudar de pasta depois afeta apenas projetos novos. Os antigos continuam onde estão
                  e você pode continuar abrindo normalmente.
                </Note>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">Crie seu primeiro projeto</h2>
                <p className="text-sm leading-relaxed text-ink-400">
                  Um projeto guarda tudo do seu jogo. Você pode criar outros depois quantas vezes
                  quiser.
                </p>

                <Field
                  label="Nome do projeto"
                  error={error}
                  hint="Sugestão: use o nome do seu jogo."
                >
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={60}
                    autoFocus
                  />
                </Field>

                <Field label="Descrição (opcional)" hint="Pode deixar em branco e preencher depois.">
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Jogo de tiro 2D em pixel art, com bases militares e sistema de skins."
                  />
                </Field>

                <Note tone="success">
                  Ao criar, o Studio monta as pastas de personagens, monstros, armas, itens, efeitos,
                  mapas, animações, áudio e exportação para Godot — tudo vazio e pronto para uso.
                </Note>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-base-800 pt-5">
            <div>
              {step > 0 && (
                <Button
                  variant="ghost"
                  icon={ArrowLeft}
                  onClick={() => setStep((current) => Math.max(0, current - 1))}
                  disabled={busy !== null}
                >
                  Voltar
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {step < 2 ? (
                <>
                  <Button variant="ghost" onClick={() => void completeOnboarding()}>
                    Pular guia
                  </Button>
                  <Button icon={ArrowRight} onClick={() => setStep((current) => current + 1)}>
                    Continuar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => void completeOnboarding()}
                    disabled={busy !== null}
                  >
                    Fazer isso depois
                  </Button>
                  <Button
                    icon={Rocket}
                    onClick={() => void handleCreate()}
                    loading={busy === 'Criando projeto'}
                  >
                    Criar projeto e começar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Passo {step + 1} de {STEPS.length}
      </p>
    </div>
  )
}
