import {
  ArrowLeft,
  ArrowRight,
  Copy,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  Plus,
  Save,
  Trash2
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ANIMATION_KINDS,
  ANIMATION_KIND_HINTS,
  ANIMATION_KIND_LABELS,
  DEFAULT_FPS,
  DEFAULT_FRAME_COUNT,
  NON_LOOPING_KINDS,
  type AnimationAsset,
  type AnimationConfig,
  type AnimationKind
} from '@shared/animations'
import {
  DIRECTIONS,
  DIRECTION_LABELS,
  type CharacterAsset,
  type CharacterDirection
} from '@shared/characters'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Note,
  PageHeader
} from '../components/ui'
import { formatDateTime } from '../lib/format'
import { useApp } from '../state/store'

function messageOf(error: unknown): string | undefined {
  return error instanceof Error && error.message ? error.message : undefined
}

function SheetThumb({ relativePath }: { relativePath: string }): React.JSX.Element {
  const { activeProject } = useApp()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!activeProject) return undefined
    void window.studio.files
      .preview(activeProject.id, relativePath)
      .then((preview) => {
        if (!cancelled) setSrc(preview.dataUrl)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [activeProject, relativePath])

  return (
    <div className="grid h-14 w-24 place-items-center overflow-hidden rounded-lg border border-base-700 bg-base-950">
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <ImageIcon className="size-4 text-ink-600" aria-hidden />
      )}
    </div>
  )
}

export function AnimationsPage(): React.JSX.Element {
  const { activeProject, navigate, notify } = useApp()
  const projectId = activeProject?.id ?? null

  const [characters, setCharacters] = useState<CharacterAsset[]>([])
  const [charactersLoading, setCharactersLoading] = useState(false)
  const [characterId, setCharacterId] = useState('')

  const [kind, setKind] = useState<AnimationKind>('walk')
  const [direction, setDirection] = useState<CharacterDirection>('frente')
  const [fps, setFps] = useState(DEFAULT_FPS.walk)
  const [loop, setLoop] = useState(true)
  const [holds, setHolds] = useState<number[]>(() =>
    Array.from({ length: DEFAULT_FRAME_COUNT.walk }, () => 1)
  )
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)

  const [frames, setFrames] = useState<string[]>([])
  const [sheet, setSheet] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [playing, setPlaying] = useState(true)
  const [current, setCurrent] = useState(0)

  const [saving, setSaving] = useState(false)
  const [animations, setAnimations] = useState<AnimationAsset[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<AnimationAsset | null>(null)
  const [removing, setRemoving] = useState(false)

  const previewTimer = useRef<number | null>(null)

  const selected = characters.find((item) => item.id === characterId) ?? null

  const loadCharacters = useCallback(async () => {
    if (!projectId) {
      setCharacters([])
      return
    }
    setCharactersLoading(true)
    try {
      const list = await window.studio.characters.list(projectId)
      setCharacters(list)
      setCharacterId((current) => current || list[0]?.id || '')
    } catch (error) {
      notify('erro', 'Não foi possível listar os personagens', messageOf(error))
    } finally {
      setCharactersLoading(false)
    }
  }, [projectId, notify])

  const loadAnimations = useCallback(async () => {
    if (!projectId) {
      setAnimations([])
      return
    }
    setListLoading(true)
    try {
      setAnimations(await window.studio.animations.list(projectId))
    } catch (error) {
      notify('erro', 'Não foi possível listar as animações', messageOf(error))
    } finally {
      setListLoading(false)
    }
  }, [projectId, notify])

  useEffect(() => {
    void loadCharacters()
    void loadAnimations()
  }, [loadCharacters, loadAnimations])

  // O nome acompanha a escolha até o usuário decidir editá-lo.
  useEffect(() => {
    if (nameTouched) return
    const base = selected?.name ?? 'Animação'
    setName(`${base} · ${ANIMATION_KIND_LABELS[kind]} ${DIRECTION_LABELS[direction]}`)
  }, [nameTouched, selected, kind, direction])

  const config: AnimationConfig = useMemo(
    () => ({
      characterId,
      name: name.trim() || 'Animação',
      kind,
      direction,
      fps,
      loop,
      frames: holds.map((hold) => ({ hold }))
    }),
    [characterId, name, kind, direction, fps, loop, holds]
  )

  const configKey = useMemo(() => JSON.stringify(config), [config])

  useEffect(() => {
    if (!characterId) {
      setFrames([])
      setSheet(null)
      return undefined
    }
    if (previewTimer.current) window.clearTimeout(previewTimer.current)
    setPreviewLoading(true)

    previewTimer.current = window.setTimeout(() => {
      void window.studio.animations
        .preview(config)
        .then((result) => {
          setFrames(result.frames)
          setSheet(result.sheet)
          setPreviewError(null)
          setCurrent((index) => (index < result.frames.length ? index : 0))
        })
        .catch((error: unknown) => {
          setFrames([])
          setSheet(null)
          setPreviewError(messageOf(error) ?? 'Não foi possível gerar a animação.')
        })
        .finally(() => setPreviewLoading(false))
    }, 220)

    return () => {
      if (previewTimer.current) window.clearTimeout(previewTimer.current)
    }
  }, [configKey, characterId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reprodução: cada quadro fica na tela pela espera dividida pelo FPS.
  useEffect(() => {
    if (!playing || frames.length === 0) return undefined
    const hold = holds[current] ?? 1
    const delay = Math.max(40, Math.round((hold / Math.max(1, fps)) * 1000))
    const timer = window.setTimeout(() => {
      setCurrent((index) => {
        const next = index + 1
        if (next >= frames.length) {
          if (!loop) {
            setPlaying(false)
            return frames.length - 1
          }
          return 0
        }
        return next
      })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [playing, current, frames.length, holds, fps, loop])

  const changeKind = useCallback((next: AnimationKind) => {
    setKind(next)
    setFps(DEFAULT_FPS[next])
    setLoop(!NON_LOOPING_KINDS.includes(next))
    setHolds(Array.from({ length: DEFAULT_FRAME_COUNT[next] }, () => 1))
    setCurrent(0)
  }, [])

  const moveFrame = useCallback((index: number, offset: number) => {
    setHolds((current) => {
      const target = index + offset
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      if (item === undefined) return current
      next.splice(target, 0, item)
      return next
    })
    setCurrent((value) => Math.max(0, Math.min(value, holds.length - 1)))
  }, [holds.length])

  const duplicateFrame = useCallback((index: number) => {
    setHolds((current) => {
      if (current.length >= 24) return current
      const next = [...current]
      next.splice(index + 1, 0, current[index] ?? 1)
      return next
    })
  }, [])

  const removeFrame = useCallback((index: number) => {
    setHolds((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)))
    setCurrent((value) => Math.max(0, Math.min(value, holds.length - 2)))
  }, [holds.length])

  const handleSave = useCallback(async () => {
    if (!projectId || !characterId) return
    setSaving(true)
    try {
      const asset = await window.studio.animations.save(projectId, config)
      notify(
        'sucesso',
        'Animação salva',
        `${asset.frameCount} quadros, ${asset.fps} FPS em ${asset.folder} — já aparece em Arquivos e na exportação para a Godot.`
      )
      await loadAnimations()
    } catch (error) {
      notify('erro', 'Não foi possível salvar', messageOf(error))
    } finally {
      setSaving(false)
    }
  }, [projectId, characterId, config, notify, loadAnimations])

  const handleRemove = useCallback(async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await window.studio.animations.remove(removeTarget.id)
      notify('info', 'Movido para a lixeira', `"${removeTarget.name}" saiu do projeto.`)
      setRemoveTarget(null)
      await loadAnimations()
    } catch (error) {
      notify('erro', 'Não foi possível remover', messageOf(error))
    } finally {
      setRemoving(false)
    }
  }, [removeTarget, notify, loadAnimations])

  if (!projectId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Etapa 4 · disponível"
          title="Editor de animações"
          description="Monte animações a partir dos personagens do projeto com linha do tempo, FPS, repetição e spritesheet."
        />
        <EmptyState
          icon={Film}
          title="Nenhum projeto aberto"
          description="As animações são salvas dentro do projeto. Abra ou crie um projeto para começar."
          action={<Button onClick={() => navigate({ name: 'projetos' })}>Abrir projetos</Button>}
        />
      </div>
    )
  }

  if (!charactersLoading && characters.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={`Projeto ${activeProject?.name ?? ''} · Etapa 4`}
          title="Editor de animações"
          description="Monte animações a partir dos personagens do projeto com linha do tempo, FPS, repetição e spritesheet."
        />
        <EmptyState
          icon={Film}
          title="Nenhum personagem no projeto"
          description="As animações usam um personagem ou monstro já salvo como base. Gere um na etapa 3 e volte aqui."
          action={
            <Button onClick={() => navigate({ name: 'modulo', moduleId: 'personagens' })}>
              Abrir o gerador de personagens
            </Button>
          }
        />
      </div>
    )
  }

  const totalBeats = holds.reduce((total, hold) => total + hold, 0)
  const durationMs = Math.round((totalBeats / Math.max(1, fps)) * 1000)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Projeto ${activeProject?.name ?? ''} · Etapa 4`}
        title="Editor de animações"
        description="Linha do tempo com quadros reais, espera por quadro, FPS e repetição. Salva PNGs, spritesheet e ficha JSON no projeto."
        actions={
          <>
            <Button
              variant="secondary"
              icon={playing ? Pause : Play}
              onClick={() => setPlaying((value) => !value)}
              disabled={frames.length === 0}
            >
              {playing ? 'Pausar' : 'Reproduzir'}
            </Button>
            <Button
              icon={Save}
              loading={saving}
              disabled={!characterId}
              onClick={() => void handleSave()}
            >
              Salvar animação
            </Button>
          </>
        }
      />

      <Note tone="info">
        Os quadros são desenhados pelo mesmo motor procedural dos sprites: nada é simulado. Cada
        tipo de animação tem um ciclo de poses próprio e o resultado é determinístico — o mesmo
        personagem e a mesma configuração geram sempre os mesmos arquivos.
      </Note>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card title="Configuração" description="Escolha a base e o movimento.">
          <div className="space-y-3">
            <Field
              label="Personagem base"
              hint={
                selected
                  ? `${selected.category === 'monstro' ? 'Monstro' : 'Personagem'} de ${selected.spec.size}px`
                  : 'Gere um personagem na etapa 3 para animar.'
              }
            >
              <select
                value={characterId}
                onChange={(event) => {
                  setCharacterId(event.target.value)
                  setNameTouched(false)
                }}
                className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
              >
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name} ({character.category === 'monstro' ? 'monstro' : 'personagem'})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tipo de animação" hint={ANIMATION_KIND_HINTS[kind]}>
              <select
                value={kind}
                onChange={(event) => changeKind(event.target.value as AnimationKind)}
                className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
              >
                {ANIMATION_KINDS.map((item) => (
                  <option key={item} value={item}>
                    {ANIMATION_KIND_LABELS[item]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Direção">
              <select
                value={direction}
                onChange={(event) => setDirection(event.target.value as CharacterDirection)}
                className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
              >
                {DIRECTIONS.map((item) => (
                  <option key={item} value={item}>
                    {DIRECTION_LABELS[item]}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="FPS" hint="1 a 60">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={fps}
                  onChange={(event) => setFps(Number(event.target.value) || 1)}
                />
              </Field>

              <Field label="Repetição">
                <label className="flex h-[42px] items-center gap-2 rounded-xl border border-base-700 bg-base-950/70 px-3 text-sm text-ink-200">
                  <input
                    type="checkbox"
                    checked={loop}
                    onChange={(event) => setLoop(event.target.checked)}
                    className="size-4 accent-[#3b82f6]"
                  />
                  Repetir em loop
                </label>
              </Field>
            </div>

            <Field label="Nome" hint="Vira o nome da pasta e da ficha JSON.">
              <Input
                value={name}
                maxLength={60}
                onChange={(event) => {
                  setNameTouched(true)
                  setName(event.target.value)
                }}
              />
            </Field>

            <div className="rounded-xl border border-base-800 bg-base-950/40 p-3 text-[11px] leading-relaxed text-ink-400">
              {holds.length} quadro(s) · {totalBeats} batida(s) ·{' '}
              <span className="text-ink-200">{(durationMs / 1000).toFixed(2)}s</span> por ciclo.
              <br />
              Spritesheet: {holds.length} colunas de {selected?.spec.size ?? 32}px.
            </div>
          </div>
        </Card>

        <Card
          title="Pré-visualização"
          description="Reprodução em tempo real com a espera de cada quadro."
          actions={
            previewLoading ? (
              <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> gerando
              </span>
            ) : (
              <Badge tone="accent">
                quadro {frames.length === 0 ? 0 : current + 1}/{frames.length}
              </Badge>
            )
          }
        >
          {previewError ? (
            <Note tone="warning">{previewError}</Note>
          ) : (
            <>
              <div
                className="grid min-h-[220px] place-items-center rounded-xl border border-base-800 p-3"
                style={{
                  backgroundColor: '#0b1120',
                  backgroundImage:
                    'linear-gradient(45deg, rgba(255,255,255,0.045) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.045) 75%), linear-gradient(45deg, rgba(255,255,255,0.045) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.045) 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 8px 8px'
                }}
              >
                {frames[current] ? (
                  <img
                    src={frames[current]}
                    alt={`Quadro ${current + 1}`}
                    className="max-h-52 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <Loader2 className="size-6 animate-spin text-ink-600" aria-hidden />
                )}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={playing ? Pause : Play}
                  onClick={() => setPlaying((value) => !value)}
                  disabled={frames.length === 0}
                >
                  {playing ? 'Pausar' : 'Reproduzir'}
                </Button>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, frames.length - 1)}
                  value={Math.min(current, Math.max(0, frames.length - 1))}
                  onChange={(event) => {
                    setPlaying(false)
                    setCurrent(Number(event.target.value))
                  }}
                  className="flex-1 accent-[#3b82f6]"
                  aria-label="Quadro atual"
                />
              </div>

              <div className="mt-3 flex items-center gap-3">
                <span className="text-[11px] text-ink-500">Spritesheet</span>
                {sheet ? (
                  <img
                    src={sheet}
                    alt="Spritesheet gerada"
                    className="h-12 max-w-full rounded-md border border-base-800 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <span className="text-[11px] text-ink-600">gerando…</span>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card
        title="Linha do tempo"
        description="Reordene, duplique, remova e ajuste a espera de cada quadro."
        actions={
          <div className="flex items-center gap-2">
            <Badge>{holds.length}/24 quadros</Badge>
            <Button
              variant="ghost"
              size="sm"
              icon={Plus}
              disabled={holds.length >= 24}
              onClick={() => {
                setHolds((current) => (current.length >= 24 ? current : [...current, 1]))
                setCurrent(holds.length)
              }}
            >
              Adicionar
            </Button>
          </div>
        }
      >
        <div className="scroll-area -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {holds.map((hold, index) => (
            <div
              key={`${index}-${frames[index]?.slice(-16) ?? ''}`}
              className={`w-[118px] shrink-0 rounded-xl border p-1.5 transition-colors ${
                index === current
                  ? 'border-accent-500 bg-accent-500/10'
                  : 'border-base-800 bg-base-950/40'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setPlaying(false)
                  setCurrent(index)
                }}
                className="grid h-20 w-full place-items-center rounded-lg bg-base-950"
                style={{ imageRendering: 'pixelated' }}
                title={`Ver o quadro ${index + 1}`}
              >
                {frames[index] ? (
                  <img
                    src={frames[index]}
                    alt={`Quadro ${index + 1}`}
                    className="max-h-20 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <ImageIcon className="size-4 text-ink-600" aria-hidden />
                )}
              </button>

              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-ink-500">#{index + 1}</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={hold}
                  onChange={(event) =>
                    setHolds((current) =>
                      current.map((value, i) =>
                        i === index
                          ? Math.max(1, Math.min(8, Number(event.target.value) || 1))
                          : value
                      )
                    )
                  }
                  className="w-12 rounded-md border border-base-700 bg-base-950 px-1 py-0.5 text-center text-[11px] text-ink-100"
                  title="Espera em batidas"
                />
              </div>

              <div className="mt-1 grid grid-cols-4 gap-0.5">
                <button
                  type="button"
                  aria-label="Mover para a esquerda"
                  disabled={index === 0}
                  onClick={() => moveFrame(index, -1)}
                  className="rounded p-1 text-ink-500 hover:bg-white/5 hover:text-ink-100 disabled:opacity-30"
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Mover para a direita"
                  disabled={index === holds.length - 1}
                  onClick={() => moveFrame(index, 1)}
                  className="rounded p-1 text-ink-500 hover:bg-white/5 hover:text-ink-100 disabled:opacity-30"
                >
                  <ArrowRight className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Duplicar quadro"
                  disabled={holds.length >= 24}
                  onClick={() => duplicateFrame(index)}
                  className="rounded p-1 text-ink-500 hover:bg-white/5 hover:text-ink-100 disabled:opacity-30"
                >
                  <Copy className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Remover quadro"
                  disabled={holds.length <= 1}
                  onClick={() => removeFrame(index)}
                  className="rounded p-1 text-ink-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-2 text-[11px] text-ink-500">
          A espera é medida em batidas: 1 batida = 1 ÷ FPS. Um quadro com espera 2 fica o dobro do
          tempo na tela.
        </p>
      </Card>

      <Card
        title="Animações salvas"
        description="Pasta animacoes/ do projeto — PNGs, spritesheet e ficha JSON."
        actions={
          <Button variant="ghost" size="sm" loading={listLoading} onClick={() => void loadAnimations()}>
            Atualizar
          </Button>
        }
      >
        {animations.length === 0 ? (
          <p className="py-6 text-center text-xs leading-relaxed text-ink-500">
            Nada salvo ainda. Ajuste a animação acima e clique em “Salvar animação”.
          </p>
        ) : (
          <ul className="space-y-2">
            {animations.map((asset) => (
              <li
                key={asset.id}
                className="flex items-center gap-3 rounded-xl border border-base-800 bg-base-950/40 p-2"
              >
                <SheetThumb relativePath={asset.sheetPath} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-100">{asset.name}</p>
                  <p className="truncate text-[11px] text-ink-500">
                    {ANIMATION_KIND_LABELS[asset.kind]} · {DIRECTION_LABELS[asset.direction]} ·{' '}
                    {asset.frameCount} quadros · {asset.fps} FPS ·{' '}
                    {(asset.durationMs / 1000).toFixed(2)}s ·{' '}
                    {asset.loop ? 'repete' : 'uma vez'} · {formatDateTime(asset.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  title="Abrir a pasta da animação"
                  aria-label="Abrir a pasta da animação"
                  onClick={() => void window.studio.files.openFolder(projectId, asset.folder)}
                  className="rounded-lg p-1.5 text-ink-500 hover:bg-white/5 hover:text-ink-100"
                >
                  <ExternalLink className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  title="Mover para a lixeira"
                  aria-label="Mover para a lixeira"
                  onClick={() => setRemoveTarget(asset)}
                  className="rounded-lg p-1.5 text-ink-500 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Mover esta animação para a lixeira?"
        description={
          removeTarget
            ? `A pasta ${removeTarget.folder} com os PNGs, a spritesheet e a ficha JSON irá para a lixeira interna do Studio.`
            : undefined
        }
        confirmLabel="Mover para a lixeira"
        tone="danger"
        loading={removing}
        onConfirm={() => void handleRemove()}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  )
}
