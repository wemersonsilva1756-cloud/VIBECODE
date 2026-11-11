import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FOLDER_DESCRIPTIONS, PROJECT_FOLDERS } from '../../shared/project-structure'
import { ensureDir } from './filesystem'

/** Estrutura de pastas criada em todo projeto novo. */

export { FOLDER_DESCRIPTIONS, PROJECT_FOLDERS }

export interface ProjectManifest {
  formato: number
  studio: string
  studioVersion: string
  id: string
  nome: string
  descricao: string
  criadoEm: string
  atualizadoEm: string
  pastas: string[]
}

export function buildManifest(input: {
  id: string
  name: string
  description: string
  studioVersion: string
  createdAt?: string
}): ProjectManifest {
  const now = new Date().toISOString()
  return {
    formato: 1,
    studio: 'Pixel Strike Studio',
    studioVersion: input.studioVersion,
    id: input.id,
    nome: input.name,
    descricao: input.description,
    criadoEm: input.createdAt ?? now,
    atualizadoEm: now,
    pastas: [...PROJECT_FOLDERS]
  }
}

function readme(name: string): string {
  const folders = PROJECT_FOLDERS.map((folder) => `  - ${folder}/  ->  ${FOLDER_DESCRIPTIONS[folder]}`).join('\n')

  return `PIXEL STRIKE STUDIO - PROJETO "${name}"
=========================================================

Este projeto foi criado automaticamente pelo Pixel Strike Studio.

ESTRUTURA DE PASTAS
---------------------------------------------------------
${folders}

REGRAS IMPORTANTES
---------------------------------------------------------
- A pasta "originais" guarda os arquivos que VOCE trouxe. O Studio nunca
  sobrescreve esses arquivos.
- A pasta "gerados" guarda o que o Studio ou a IA criaram.
- A pasta "godot" recebe apenas os arquivos prontos para importar na Godot 4.
- Antes de qualquer alteracao importante, o Studio cria um backup.
- Os backups ficam guardados na pasta de dados do aplicativo, fora do projeto,
  para que uma restauracao nunca prejudique o projeto atual.

COMO CONTINUAR
---------------------------------------------------------
Abra o Pixel Strike Studio, selecione este projeto e use o menu lateral.
O arquivo "projeto.json" descreve este projeto e pode ser lido por qualquer
editor de texto.
`
}

export function writeProjectFiles(
  projectPath: string,
  manifest: ProjectManifest
): void {
  for (const folder of PROJECT_FOLDERS) {
    ensureDir(join(projectPath, folder))
  }
  writeFileSync(join(projectPath, 'projeto.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  writeFileSync(join(projectPath, 'LEIA-ME.txt'), readme(manifest.nome), 'utf8')
}

export function writeManifest(projectPath: string, manifest: ProjectManifest): void {
  writeFileSync(join(projectPath, 'projeto.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}
