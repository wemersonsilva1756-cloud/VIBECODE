import { FolderPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '../state/store'
import { Button, Field, Input, Modal, Note, Textarea } from './ui'

/** Criação de projeto: nome, descrição e destino dos arquivos. */

export function NewProjectDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const { createProject, settings, busy } = useApp()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(): Promise<void> {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError('Escreva um nome com pelo menos 2 caracteres.')
      return
    }
    setError(null)
    const created = await createProject({ name: trimmed, description: description.trim() })
    if (created) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Criar novo projeto"
      description="Um projeto guarda todos os recursos do seu jogo: personagens, monstros, mapas, armas, animações e efeitos."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy !== null}>
            Cancelar
          </Button>
          <Button icon={FolderPlus} onClick={handleSubmit} loading={busy !== null}>
            Criar projeto
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Nome do projeto"
          error={error}
          hint="Exemplo: Pixel Strike. O Studio cria uma pasta com esse nome dentro da sua pasta de projetos."
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Pixel Strike"
            maxLength={60}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleSubmit()
            }}
          />
        </Field>

        <Field
          label="Descrição (opcional)"
          hint="Ajuda você a lembrar o objetivo do projeto. Pode mudar depois."
        >
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Jogo de tiro 2D em pixel art com bases militares, monstros e sistema de skins."
          />
        </Field>

        <Note tone="info">
          Os arquivos serão criados em{' '}
          <span className="font-mono break-all">{settings?.workspaceRoot ?? '—'}</span>. Nada é
          enviado para a internet: tudo fica salvo no seu computador.
        </Note>
      </div>
    </Modal>
  )
}
