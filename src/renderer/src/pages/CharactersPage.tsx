import {
  Dices,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wand2
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ARCHETYPE_LABELS,
  DIRECTIONS,
  DIRECTIONS as ALL_DIRECTIONS,
  DIRECTION_LABELS,
  EQUIPMENT_LABELS,
  PALETTES,
  ROLE_LABELS,
  defaultSpec,
  paletteById,
  type CharacterAsset,
  type CharacterCategory,
  type CharacterDirection,
  type CharacterEquipment,
  type CharacterRole,
  type CharacterSpec,
  type MonsterArchetype,
  type SpriteSize
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
  PageHeader,
  Textarea
} from '../components/ui'
import { formatDateTime } from '../lib/format'
import { useApp } from '../state/store'

const CATEGORY_COPY: Record<CharacterCategory, { title: string; description: string; folder: string }> = {
  personagem: {
    title: 'Gerador de personagens',
    description:
      'Crie soldados, NPCs e vendedores com sprites transparentes em quatro direções e uma ficha de atributos pronta para o jogo.',
    folder: 'personagens'
  },
  monstro: {
    title: 'Monstros e inimigos',
    description:
      'Crie inimigos comuns, especiais, raros e chefes com atributos, habilidades e tabela de drops.',
    folder: 'monstros'
  }
}

const ROLE_OPTIONS: Record<CharacterCategory, CharacterRole[]> = {
  personagem: ['soldado', 'npc', 'vendedor'],
  monstro: ['comum', 'especial', 'raro', 'chefe']
}

const PALETTE_FIELDS: Array<{ key: keyof CharacterSpec['palette']; label: string }> = [
  { key: 'pele', label: 'Pele' },
  { key: 'cabelo', label: 'Cabelo' },
  { key: 'roupa', label: 'Roupa' },
  { key: 'detalhe', label: 'Detalhe' },
  { key: 'calca', label: 'Calça' },
  { key: 'bota', label: 'Bota' },
  { key: 'contorno', label: 'Contorno' }
]

function AssetThumb({ relativePath }: { relativePath: string }): React.JSX.Element {
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
    <div className="grid size-14 place-items-center rounded-lg border border-base-700 bg-base-950">
      {src ? (
        <img
          src={src}
          alt=""
          className="size-12 object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <ImageIcon className="size-4 text-ink-600" aria-hidden />
      )}
    </div>
  )
}

export function CharactersPage({ category }: { category: CharacterCategory }): React.JSX.Element {
  const { activeProject, projects, navigate, notify } = useApp()
  const projectId = activeProject?.id ?? null
  const copy = CATEGORY_COPY[category]

  const [spec, setSpec] = useState<CharacterSpec>(() => defaultSpec(category))
  const [previews, setPreviews] = useState<Partial<Record<CharacterDirection, string>>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [assets, setAssets] = useState<CharacterAsset[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [interpreting, setInterpreting] = useState(false)
  const [matches, setMatches] = useState<string[]>([])
  const [removeTarget, setRemoveTarget] = useState<CharacterAsset | null>(null)
  const [removing, setRemoving] = useState(false)
  const [abilityDraft, setAbilityDraft] = useState('')

  const previewTimer = useRef<number | null>(null)

  useEffect(() => {
    setSpec(defaultSpec(category))
    setPreviews({})
    setMatches([])
  }, [category])

  const loadAssets = useCallback(async () => {
    if (!projectId) {
      setAssets([])
      return
    }
    setListLoading(true)
    try {
      setAssets(await window.studio.characters.list(projectId, category))
    } catch (error) {
      notify('erro', 'Não foi possível listar', messageOf(error))
    } finally {
      setListLoading(false)
    }
  }, [projectId, category, notify])

  useEffect(() => {
    void loadAssets()
  }, [loadAssets])

  const specKey = useMemo(() => JSON.stringify(spec), [spec])

  useEffect(() => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current)
    setPreviewLoading(true)

    previewTimer.current = window.setTimeout(() => {
      void window.studio.characters
        .preview(spec)
        .then((result) => {
          setPreviews(result)
          setPreviewError(null)
        })
        .catch((error: unknown) => {
          setPreviews({})
          setPreviewError(messageOf(error) ?? 'Não foi possível gerar o sprite.')
        })
        .finally(() => setPreviewLoading(false))
    }, 260)

    return () => {
      if (previewTimer.current) window.clearTimeout(previewTimer.current)
    }
  }, [specKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback(<K extends keyof CharacterSpec>(key: K, value: CharacterSpec[K]) => {
    setSpec((current) => ({ ...current, [key]: value }))
  }, [])

  const updateStat = useCallback((key: keyof CharacterSpec['stats'], value: number) => {
    setSpec((current) => ({
      ...current,
      stats: { ...current.stats, [key]: Number.isFinite(value) ? value : 0 }
    }))
  }, [])

  const applyPalette = useCallback((paletteId: string) => {
    setSpec((current) => ({ ...current, paletteId, palette: paletteById(paletteId) }))
  }, [])

  const toggleDirection = useCallback((direction: CharacterDirection) => {
    setSpec((current) => {
      const has = current.directions.includes(direction)
      const next = has
        ? current.directions.filter((item) => item !== direction)
        : [...current.directions, direction]
      return {
        ...current,
        directions: next.length > 0 ? next : current.directions
      }
    })
  }, [])

  const handleInterpret = useCallback(async () => {
    if (!spec.description.trim()) {
      notify('atencao', 'Escreva uma descrição', 'Exemplo: "soldado do deserto com fuzil".')
      return
    }
    setInterpreting(true)
    try {
      const suggestion = await window.studio.characters.interpret(spec.description)
      setMatches(suggestion.matches)

      setSpec((current) => {
        const paletteId = suggestion.paletteId ?? current.paletteId
        return {
          ...current,
          paletteId,
          palette: suggestion.paletteId ? paletteById(paletteId) : current.palette,
          archetype: suggestion.archetype ?? current.archetype,
          role: suggestion.role ?? current.role,
          equipment: suggestion.equipment ?? current.equipment
        }
      })

      notify(
        suggestion.matches.length > 0 ? 'sucesso' : 'info',
        suggestion.matches.length > 0
          ? 'Descrição interpretada por palavras-chave'
          : 'Nenhuma palavra conhecida',
        suggestion.matches.length > 0
          ? `Reconhecido: ${suggestion.matches.join(', ')}. Ajuste o que quiser antes de salvar.`
          : 'Nesta etapa não há IA: a descrição só reconhece palavras como deserto, neve, fogo, chefe, lobo, fuzil. A IA real chega na etapa 9.'
      )
    } catch (error) {
      notify('erro', 'Não foi possível interpretar', messageOf(error))
    } finally {
      setInterpreting(false)
    }
  }, [spec.description, notify])

  const handleSave = useCallback(async () => {
    if (!projectId) return
    setSaving(true)
    try {
      const asset = await window.studio.characters.save(projectId, spec)
      notify(
        'sucesso',
        category === 'monstro' ? 'Monstro criado' : 'Personagem criado',
        `${asset.images.length} sprite(s) em ${asset.folder} — já aparecem em Arquivos e na exportação para a Godot.`
      )
      await loadAssets()
    } catch (error) {
      notify('erro', 'Não foi possível salvar', messageOf(error))
    } finally {
      setSaving(false)
    }
  }, [projectId, spec, category, notify, loadAssets])

  const handleRemove = useCallback(async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await window.studio.characters.remove(removeTarget.id)
      notify('info', 'Movido para a lixeira', `"${removeTarget.name}" saiu do projeto.`)
      setRemoveTarget(null)
      await loadAssets()
    } catch (error) {
      notify('erro', 'Não foi possível remover', messageOf(error))
    } finally {
      setRemoving(false)
    }
  }, [removeTarget, notify, loadAssets])

  const addAbility = useCallback(() => {
    const value = abilityDraft.trim()
    if (!value) return
    setSpec((current) => ({
      ...current,
      abilities: [...current.abilities, value].slice(0, 12)
    }))
    setAbilityDraft('')
  }, [abilityDraft])

  if (!projectId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Etapa 3 · disponível"
          title={copy.title}
          description={copy.description}
        />
        <EmptyState
          icon={Sparkles}
          title="Nenhum projeto aberto"
          description="Os sprites são salvos nas pastas do projeto. Abra ou crie um projeto para começar."
          action={
            <Button onClick={() => navigate({ name: 'projetos' })}>
              {projects.length > 0 ? 'Abrir meus projetos' : 'Criar o primeiro projeto'}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Projeto ${activeProject?.name ?? ''} · Etapa 3`}
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <Button
              variant="secondary"
              icon={Dices}
              onClick={() => update('seed', Math.floor(Math.random() * 999_999) + 1)}
            >
              Gerar variação
            </Button>
            <Button icon={Save} loading={saving} onClick={() => void handleSave()}>
              Salvar no projeto
            </Button>
          </>
        }
      />

      <Note tone="info">
        Nesta etapa o gerador é <strong className="text-ink-100">procedural e determinístico</strong>:
        a mesma semente gera o mesmo sprite, e a descrição é interpretada por palavras-chave. Os
        provedores de IA chegam na etapa 9 — nada aqui finge ser IA.
      </Note>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title="Identidade" description="O nome vira o nome da pasta e do arquivo JSON.">
            <div className="space-y-3">
              <Field label="Nome">
                <Input
                  value={spec.name}
                  maxLength={60}
                  onChange={(event) => update('name', event.target.value)}
                  placeholder={category === 'monstro' ? 'Criatura da Névoa' : 'Soldado Alfa'}
                />
              </Field>

              <Field
                label="Descrição"
                hint="Palavras conhecidas: deserto, neve, neon, militar, cidade, gosma, sombra, lobo, morcego, chefe, raro, fuzil, pistola, espada, escudo."
              >
                <Textarea
                  rows={3}
                  value={spec.description}
                  onChange={(event) => update('description', event.target.value)}
                  placeholder={
                    category === 'monstro'
                      ? 'Um lobo gigante das montanhas geladas, chefe da região.'
                      : 'Soldado do deserto equipado com fuzil.'
                  }
                />
              </Field>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Wand2}
                  loading={interpreting}
                  onClick={() => void handleInterpret()}
                >
                  Interpretar descrição
                </Button>
                {matches.length > 0 && (
                  <span className="text-[11px] text-ink-400">
                    Reconhecido: <span className="text-accent-300">{matches.join(', ')}</span>
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Papel">
                  <select
                    value={spec.role}
                    onChange={(event) => update('role', event.target.value as CharacterRole)}
                    className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                  >
                    {ROLE_OPTIONS[category].map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </Field>

                {category === 'monstro' ? (
                  <Field label="Arquétipo">
                    <select
                      value={spec.archetype}
                      onChange={(event) =>
                        update('archetype', event.target.value as MonsterArchetype)
                      }
                      className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                    >
                      {Object.entries(ARCHETYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Equipamento">
                    <select
                      value={spec.equipment}
                      onChange={(event) =>
                        update('equipment', event.target.value as CharacterEquipment)
                      }
                      className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                    >
                      {Object.entries(EQUIPMENT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tamanho do sprite" hint="Grade de 32 px ampliada sem desfoque.">
                  <select
                    value={spec.size}
                    onChange={(event) => update('size', Number(event.target.value) as SpriteSize)}
                    className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                  >
                    <option value={32}>32 × 32</option>
                    <option value={64}>64 × 64</option>
                    <option value={96}>96 × 96</option>
                  </select>
                </Field>

                <Field label="Semente" hint="Muda detalhes sem mudar o estilo.">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={spec.seed}
                      onChange={(event) => update('seed', Number(event.target.value) || 1)}
                    />
                    <Button
                      variant="secondary"
                      icon={Dices}
                      onClick={() => update('seed', Math.floor(Math.random() * 999_999) + 1)}
                    >
                      Sortear
                    </Button>
                  </div>
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Cores" description="Escolha uma paleta pronta e ajuste qualquer cor.">
            <div className="flex flex-wrap gap-2">
              {PALETTES.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => applyPalette(palette.id)}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] transition-colors ${
                    spec.paletteId === palette.id
                      ? 'border-accent-500 bg-accent-500/15 text-ink-100'
                      : 'border-base-700 bg-base-900 text-ink-300 hover:border-base-600'
                  }`}
                >
                  <span className="flex gap-0.5">
                    <span
                      className="size-3 rounded-sm"
                      style={{ backgroundColor: palette.palette.roupa }}
                    />
                    <span
                      className="size-3 rounded-sm"
                      style={{ backgroundColor: palette.palette.pele }}
                    />
                    <span
                      className="size-3 rounded-sm"
                      style={{ backgroundColor: palette.palette.detalhe }}
                    />
                  </span>
                  {palette.label}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PALETTE_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-[11px] text-ink-400">
                  <input
                    type="color"
                    value={spec.palette[field.key]}
                    onChange={(event) =>
                      setSpec((current) => ({
                        ...current,
                        palette: { ...current.palette, [field.key]: event.target.value }
                      }))
                    }
                    className="size-7 cursor-pointer rounded-md border border-base-700 bg-base-950"
                    aria-label={`Cor: ${field.label}`}
                  />
                  {field.label}
                </label>
              ))}
            </div>

            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                Direções
              </p>
              <div className="flex flex-wrap gap-3">
                {ALL_DIRECTIONS.map((direction) => (
                  <label
                    key={direction}
                    className="flex items-center gap-1.5 text-[11px] text-ink-300"
                  >
                    <input
                      type="checkbox"
                      checked={spec.directions.includes(direction)}
                      onChange={() => toggleDirection(direction)}
                      className="size-3.5 accent-[#3b82f6]"
                    />
                    {DIRECTION_LABELS[direction]}
                  </label>
                ))}
              </div>
            </div>
          </Card>

          <Card
            title="Ficha do jogo"
            description="Valores salvos no projeto.json do personagem e prontos para a Godot."
          >
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { key: 'vida', label: 'Vida', max: 99999 },
                  { key: 'dano', label: 'Dano', max: 9999 },
                  { key: 'velocidade', label: 'Velocidade', max: 999 },
                  { key: 'alcance', label: 'Alcance', max: 9999 }
                ] as const
              ).map((field) => (
                <Field key={field.key} label={field.label}>
                  <Input
                    type="number"
                    min={0}
                    max={field.max}
                    value={spec.stats[field.key]}
                    onChange={(event) => updateStat(field.key, Number(event.target.value))}
                  />
                </Field>
              ))}
            </div>

            {category === 'monstro' && (
              <>
                <div className="mt-4">
                  <Field label="Habilidades" hint="Ex.: investida, mordida, rugido.">
                    <div className="flex gap-2">
                      <Input
                        value={abilityDraft}
                        onChange={(event) => setAbilityDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            addAbility()
                          }
                        }}
                        placeholder="mordida"
                      />
                      <Button variant="secondary" icon={Plus} onClick={addAbility}>
                        Adicionar
                      </Button>
                    </div>
                  </Field>
                  {spec.abilities.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {spec.abilities.map((ability, index) => (
                        <button
                          key={`${ability}-${index}`}
                          type="button"
                          onClick={() =>
                            setSpec((current) => ({
                              ...current,
                              abilities: current.abilities.filter((_, i) => i !== index)
                            }))
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-base-700 bg-base-900 px-2.5 py-0.5 text-[11px] text-ink-300 hover:border-red-500/40 hover:text-red-300"
                          title="Remover"
                        >
                          {ability} ×
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
                    Drops
                  </p>
                  <div className="space-y-2">
                    {spec.drops.map((drop, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={drop.item}
                          placeholder="nome do item"
                          onChange={(event) =>
                            setSpec((current) => ({
                              ...current,
                              drops: current.drops.map((item, i) =>
                                i === index ? { ...item, item: event.target.value } : item
                              )
                            }))
                          }
                        />
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={drop.chance}
                          className="w-20"
                          title="Chance (%)"
                          onChange={(event) =>
                            setSpec((current) => ({
                              ...current,
                              drops: current.drops.map((item, i) =>
                                i === index
                                  ? { ...item, chance: Number(event.target.value) }
                                  : item
                              )
                            }))
                          }
                        />
                        <Input
                          type="number"
                          min={1}
                          max={999}
                          value={drop.quantidade}
                          className="w-20"
                          title="Quantidade"
                          onChange={(event) =>
                            setSpec((current) => ({
                              ...current,
                              drops: current.drops.map((item, i) =>
                                i === index
                                  ? { ...item, quantidade: Number(event.target.value) }
                                  : item
                              )
                            }))
                          }
                        />
                        <button
                          type="button"
                          aria-label="Remover drop"
                          onClick={() =>
                            setSpec((current) => ({
                              ...current,
                              drops: current.drops.filter((_, i) => i !== index)
                            }))
                          }
                          className="rounded-lg p-1.5 text-ink-500 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Plus}
                    className="mt-2"
                    onClick={() =>
                      setSpec((current) => ({
                        ...current,
                        drops: [...current.drops, { item: '', chance: 10, quantidade: 1 }]
                      }))
                    }
                  >
                    Adicionar drop
                  </Button>
                  <p className="mt-1 text-[11px] text-ink-500">
                    As chances são independentes (cada item é sorteado separadamente). A validação
                    da economia completa entra na etapa 8.
                  </p>
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card
            title="Pré-visualização"
            description={`${spec.size} × ${spec.size} · fundo transparente`}
            actions={
              previewLoading ? (
                <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> gerando
                </span>
              ) : (
                <Badge tone="accent">{spec.directions.length} direção(ões)</Badge>
              )
            }
          >
            {previewError ? (
              <Note tone="warning">{previewError}</Note>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {DIRECTIONS.filter((direction) => spec.directions.includes(direction)).map(
                  (direction) => (
                    <div key={direction} className="rounded-xl border border-base-800 p-2">
                      <div
                        className="grid place-items-center rounded-lg"
                        style={{
                          backgroundColor: '#0b1120',
                          backgroundImage:
                            'linear-gradient(45deg, rgba(255,255,255,0.045) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.045) 75%), linear-gradient(45deg, rgba(255,255,255,0.045) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.045) 75%)',
                          backgroundSize: '14px 14px',
                          backgroundPosition: '0 0, 7px 7px'
                        }}
                      >
                        {previews[direction] ? (
                          <img
                            src={previews[direction]}
                            alt={`Sprite ${DIRECTION_LABELS[direction]}`}
                            className="size-full max-h-44 object-contain"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        ) : (
                          <div className="h-40" />
                        )}
                      </div>
                      <p className="mt-1.5 text-center text-[11px] text-ink-400">
                        {DIRECTION_LABELS[direction]}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-500">
              <span>
                Paleta {PALETTES.find((item) => item.id === spec.paletteId)?.label ?? 'personalizada'} ·
                semente {spec.seed}
              </span>
              <span>{ROLE_LABELS[spec.role]}</span>
            </div>
          </Card>

          <Card
            title={category === 'monstro' ? 'Monstros salvos' : 'Personagens salvos'}
            description={
              projectId ? `Pasta ${copy.folder}/ do projeto` : 'Abra um projeto para ver a lista'
            }
            actions={
              <Button variant="ghost" size="sm" onClick={() => void loadAssets()} loading={listLoading}>
                Atualizar
              </Button>
            }
          >
            {assets.length === 0 ? (
              <p className="py-6 text-center text-xs leading-relaxed text-ink-500">
                Nada salvo ainda. Ajuste o sprite ao lado e clique em “Salvar no projeto”.
              </p>
            ) : (
              <ul className="space-y-2">
                {assets.map((asset) => (
                  <li
                    key={asset.id}
                    className="flex items-center gap-3 rounded-xl border border-base-800 bg-base-950/40 p-2"
                  >
                    <AssetThumb relativePath={asset.images[0]?.relativePath ?? ''} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink-100">{asset.name}</p>
                      <p className="truncate text-[11px] text-ink-500">
                        {asset.spec.size}px · {asset.images.length} sprite(s) ·{' '}
                        {formatDateTime(asset.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      title="Abrir a pasta do personagem"
                      aria-label="Abrir a pasta do personagem"
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
        </div>
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Mover este item para a lixeira?"
        description={
          removeTarget
            ? `A pasta ${removeTarget.folder} com os sprites e a ficha JSON irá para a lixeira interna do Studio.`
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

function messageOf(error: unknown): string | undefined {
  return error instanceof Error && error.message ? error.message : undefined
}
