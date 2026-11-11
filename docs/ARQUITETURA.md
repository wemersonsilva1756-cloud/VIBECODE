# Arquitetura do Pixel Strike Studio

Documento técnico da Etapa 1. Explica como o aplicativo está dividido, como os dados
circulam e como adicionar os próximos módulos sem quebrar o que já existe.

## Visão geral

```
┌──────────────────────────────────────────────────────────────┐
│ INTERFACE (renderer)                                         │
│ React + TypeScript + Tailwind · src/renderer                 │
│ Sem acesso a Node, disco ou banco.                           │
└───────────────▲──────────────────────────────────────────────┘
                │  window.studio.<recurso>.<ação>()  (contextBridge)
                │  <IpcResult> { ok, data } | { ok:false, message }
┌───────────────┴──────────────────────────────────────────────┐
│ PRELOAD (ponte) · src/preload                                │
│ Só ipcRenderer.invoke/send + eventos de progresso.           │
└───────────────▲──────────────────────────────────────────────┘
                │  canais validados (origem + argumentos)
┌───────────────┴──────────────────────────────────────────────┐
│ PROCESSO PRINCIPAL · src/main                                │
│ ipc.ts  →  core/  →  SQLite (libsql) + sistema de arquivos   │
└──────────────────────────────────────────────────────────────┘
```

Regras que sustentam essa divisão:

1. **A interface nunca importa código de `src/main`.** Só tipos de `src/shared`.
2. **Todo erro chega à interface como texto em português** (envelope `IpcResult`), nunca
   como stack trace cru.
3. **O núcleo não conhece Electron.** `initializeCore()` recebe caminhos e versão por
   parâmetro, então os mesmos serviços rodam nos testes em Node puro.

## Camadas e responsabilidades

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main/index.ts` | Ciclo de vida do app, janela, CSP/bridge, teste automático (`--smoke-test`) |
| `src/main/ipc.ts` | Registro dos canais, validação de origem e de argumentos |
| `src/main/security.ts` | Bloqueio de navegação externa, `window.open`, webviews e permissões |
| `src/main/core/database.ts` | Conexão SQLite, pragmas e migrações versionadas |
| `src/main/core/projects.ts` | CRUD de projetos, duplicação, backup, restauração, remoção segura |
| `src/main/core/file-manager.ts` | Listagem, prévia, importação sem sobrescrever e lixeira de itens |
| `src/main/core/godot.ts` | Leitura do `project.godot`, vínculo, plano de exportação e escrita com backup |
| `src/main/core/characters.ts` | Serviço de personagens/monstros: validação, gravação, lista e remoção |
| `src/main/core/sprites.ts` | Desenho procedural em pixel art (grade 32, poses, quatro direções, contorno) |
| `src/main/core/animations.ts` | Quadros, spritesheet, ficha JSON, lista e remoção de animações |
| `src/main/core/png.ts` | Codificador PNG RGBA com `zlib` (sem dependências externas) |
| `src/main/smoke.ts` | Teste automático em duas fases (com recarga da janela) |
| `src/main/core/settings-store.ts` | Preferências em tabela chave/valor |
| `src/main/core/activity.ts` | Histórico (mantém as 500 ações mais recentes) |
| `src/main/core/stats.ts` | Contadores e tamanho total em disco |
| `src/main/core/filesystem.ts` | Cópia com progresso, tamanho de pasta, lixeira interna |
| `src/main/core/project-template.ts` | Pastas, `projeto.json` e `LEIA-ME.txt` de um projeto novo |
| `src/main/core/naming.ts` | Slug sem acentos, carimbo de data, formatação de bytes |
| `src/shared/contract.ts` | Tipos e nomes dos canais IPC |
| `src/shared/project-structure.ts` | Lista de pastas do projeto usada pelo núcleo e pela interface |

## Contrato de IPC

Todos os canais seguem `studio:<área>:<ação>`. Nenhum recebe caminho de arquivo
arbitrário da interface: o núcleo sempre resolve os caminhos a partir do banco.

| Canal | Retorno |
| --- | --- |
| `studio:app:paths` | pastas de dados, banco, backups e versão |
| `studio:app:open-data-folder` | abre a pasta de dados no Explorador |
| `studio:app:open-project-folder` | valida o projeto e abre sua pasta |
| `studio:settings:get` / `update` | preferências (patch com campos permitidos) |
| `studio:settings:choose-workspace` | diálogo nativo de pasta |
| `studio:settings:reset-onboarding` | reativa o guia inicial |
| `studio:projects:list` / `get` | resumos com contadores e tamanho |
| `studio:projects:create` | valida nome e cria pastas + registro + histórico |
| `studio:projects:update` | nome, descrição e situação |
| `studio:projects:open` | atualiza último acesso e projeto ativo |
| `studio:projects:duplicate` | copia pasta e registros de recursos |
| `studio:projects:remove` | move para a lixeira (opcional) e/ou retira da lista |
| `studio:projects:backup` | copia a pasta para a área de backups |
| `studio:projects:list-backups` / `restore-backup` | histórico e restauração com cópia de segurança |
| `studio:activity:list` | histórico recente |
| `studio:stats:get` | indicadores do painel |
| `studio:files:list` / `preview` | conteúdo de uma pasta e prévia de arquivo (texto ou imagem) |
| `studio:files:import` | diálogo nativo e cópia de arquivos para o projeto |
| `studio:files:create-folder` / `trash` | pasta nova e envio para a lixeira interna |
| `studio:files:open-folder` | abre uma pasta do projeto no Explorador |
| `studio:godot:state` | vínculo, informações do projeto Godot e executável configurado |
| `studio:godot:link` / `unlink` | vincula a pasta do `project.godot` ou esquece o vínculo |
| `studio:godot:plan` | lista de arquivos que seriam gravados, sem escrever nada |
| `studio:godot:export` | grava o plano, com backup prévio dos arquivos substituídos |
| `studio:godot:choose-executable` / `check-executable` | confere a versão da Godot (opcional) |
| `studio:characters:preview` | sprites em memória (data URL por direção), sem gravar nada |
| `studio:characters:interpret` | sugestões por palavras-chave a partir da descrição |
| `studio:characters:save` | grava PNGs + ficha JSON e registra na tabela `assets` |
| `studio:characters:list` / `remove` | lista personagens/monstros e move a pasta para a lixeira |
| `studio:animations:preview` | quadros e spritesheet em memória, sem gravar nada |
| `studio:animations:save` | grava PNGs, `_sheet.png` e ficha JSON, registrando em `assets` |
| `studio:animations:list` / `remove` | lista animações e move a pasta para a lixeira |
| `studio:event:progress` | evento (main → renderer) de operações longas |

`studio:app:smoke-ready` é o único canal `send` (sem resposta), usado pelo teste
automático.

## Banco de dados

SQLite via `@libsql/client` (binário N-API, funciona no Electron sem compilação
nativa). Migrações são uma lista numerada em `database.ts`: **nunca edite uma migração
já publicada**; acrescente uma nova entrada no fim.

| Tabela | Conteúdo |
| --- | --- |
| `schema_migrations` | versão e data de cada migração aplicada |
| `settings` | chave/valor JSON (pasta de projetos, projeto ativo, guia, retenção) |
| `projects` | id, nome, slug, descrição, caminho, situação, datas |
| `assets` | recursos por projeto; `kind` é `personagem`, `monstro` ou `animacao`, e o `data` guarda a especificação completa (no caso da animação, tipo, FPS, quadros e caminho da spritesheet) |
| `backups` | id, projeto, rótulo, caminho, tamanho, tipo, data |
| `activity` | histórico de ações |
| `godot_links` | pasta do projeto Godot vinculada, data do vínculo e do último envio |

Migração 2 acrescenta `godot_links`. Projetos removidos do banco levam o vínculo junto
(`ON DELETE CASCADE`); nenhum arquivo do projeto Godot é tocado por isso.

`assets.project_id` e `backups.project_id` têm `ON DELETE CASCADE`; apagar um projeto
do banco remove seus registros, mas **os arquivos vão para a lixeira**, não são
destruídos.

## Fluxo de backup e restauração

**Backup**

1. valida que a pasta do projeto existe;
2. copia a pasta para `<dados>/backups/<id do projeto>/<data>_<sufixo>`;
3. mede o tamanho e registra em `backups`;
4. registra a ação no histórico;
5. aplica a retenção configurada **apenas aos backups automáticos/de segurança**
   (os manuais nunca são reciclados); excedentes vão para a lixeira.

Backups ficam fora da pasta do projeto para que copiar o projeto nunca copie os
próprios backups (sem recursão).

**Restauração**

1. cria um backup de segurança do estado atual;
2. move a pasta atual do projeto para a lixeira interna;
3. copia o conteúdo do backup escolhido para o lugar do projeto;
4. atualiza a data do projeto e registra no histórico.

## Progresso de operações longas

Operações de cópia emitem `ProgressEvent { operationId, label, percent, done }` pelo
canal `studio:event:progress`. A interface mostra uma barra flutuante e limpa o estado
1,5 s após o término.

## Segurança

- `BrowserWindow` com `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true`.
- `contextBridge` expõe apenas a API tipada `window.studio`.
- Cada handler IPC confere a origem do frame (`file://` do próprio app ou
  `localhost` do servidor de desenvolvimento) antes de executar.
- Argumentos são validados por tipo; o patch de preferências só aceita chaves
  conhecidas.
- `setWindowOpenHandler` e `will-navigate` bloqueiam navegação para fora; links
  `https`/`mailto` abrem no navegador padrão.
- Permissões (câmera, microfone, etc.) negadas por padrão.
- CSP no `index.html`: `default-src 'self'`, sem `unsafe-eval`, sem scripts externos.

## Como adicionar um módulo (etapas 2 a 9)

1. Crie `src/main/core/<modulo>.ts` com funções puras em relação ao Electron.
2. Adicione os tipos e canais em `src/shared/contract.ts`.
3. Registre os handlers em `src/main/ipc.ts` com validação de argumentos.
4. Exponha no preload (`src/preload/index.ts`) dentro de `StudioApi`.
5. Crie a página em `src/renderer/src/pages/` e ligue no menu (`navigation.ts`),
   trocando o selo "Etapa N" quando o módulo estiver completo.
6. Cubra a lógica nova em `tests/core.test.ts` antes de considerar a etapa concluída.
7. Se houver migração de banco, acrescente uma nova versão em `database.ts`.

## Gerenciador de arquivos

`file-manager.ts` é a única porta de entrada para o disco dentro de um projeto:

- `resolveInside(root, rel)` normaliza o caminho, recusa `..`, `:` e caracteres
  inválidos, e confirma que o destino continua dentro da raiz.
- A listagem classifica por extensão (`imagem`, `audio`, `cena`, `codigo`, `dados`,
  `texto`, `outro`) e devolve data, tamanho e contagem de filhos.
- A prévia lê no máximo 200 KB de texto ou 3 MB de imagem (devolvida como `data:`) —
  nada de enviar arquivos gigantes pelo IPC.
- Importar usa `uniqueName()` para nunca sobrescrever: `heroi.png` repetido vira
  `heroi-2.png`.
- Remover usa a lixeira interna (`dataDir/lixeira`), com `renameSync` e cópia como
  reserva quando o destino está em outro disco.

## Integração com Godot 4

1. **Leitura** — `inspectGodotProject()` analisa `project.godot` (formato INI),
   extrai `config/name`, `config/features` (versão da engine), `run/main_scene` e
   autoloads, e percorre a pasta contando cenas (`.tscn`, `.scn`, `.escn`), scripts
   (`.gd`, `.cs`), imagens e recursos. Projetos com `config_version < 5` são
   recusados com mensagem clara (Godot 3).
2. **Vínculo** — gravado em `godot_links`, por projeto. O Studio nunca grava nessa
   pasta sem vínculo.
3. **Plano** — `buildGodotExportPlan()` monta em memória: script utilitário, manifesto
   JSON, instruções e a cópia de cada arquivo da pasta `godot/` do projeto, mais os
   personagens e monstros gerados (`personagens/` e `monstros/`, PNG + JSON), em
   `pixel_strike/recursos/...`. Para cada arquivo calcula `criar`, `sobrescrever`
   (conteúdo diferente) ou `igual`.
4. **Aplicação** — `applyGodotExport()` recalcula o plano, copia os arquivos que serão
   substituídos para `<godot>/.pixel_strike/backups/<data>/...`, grava, registra em
   `last_export_at` e no histórico. Arquivos `igual` são ignorados, então reexportar
   sem mudanças não reescreve nada.
5. **Executável (opcional)** — `spawnSync(exe, ['--version'])` só lê a versão; o
   Studio não abre a Godot nem executa projetos.

O manifesto é determinístico (sem data volátil) justamente para que a comparação
`igual` funcione em exportações repetidas.

## Gerador de sprites (etapa 3)

`sprites.ts` desenha em uma grade lógica de 32×32 e amplia por vizinho mais próximo para
32, 64 ou 96 px (`scaleTo`), sem interpolação. O PNG é codificado em `png.ts` com
`zlib.deflateSync` — nada de bibliotecas nativas ou binários externos.

- `Canvas` guarda RGBA (`Uint8Array`), com `rect`, `set`, `opacity`, `mirror` e
  `outline` (contorno de 1 px ao redor de tudo que é opaco).
- O desenho é **determinístico**: `mulberry32(seed)` controla detalhes (ombreiras,
  camuflagem, mochila), então a mesma semente gera bytes idênticos.
- Personagens: humanoide com cabeça, tronco, braços, pernas, calça, botas, cabelo,
  olhos e equipamento visível (fuzil, pistola, espada ou escudo); lado esquerdo é o
  direito espelhado.
- Monstros: quatro arquétipos (`humanoide`, `quadrupede`, `slime`, `voador`) e chefes
  com chifres claros.
- `characters.ts` valida tudo (`validateSpec`): nome 2–60, tamanho 32/64/96, pelo
  menos uma direção, cores em hexadecimal, atributos limitados, drops com chance
  0–100 e quantidade 1–999.
- Gravação: `<categoria>/<slug>/<slug>_<direção>.png` + `<slug>.json`, e um registro
  em `assets` para que o gerenciador de arquivos, a exportação para a Godot e os
  próximos módulos enxerguem o recurso.

A descrição é interpretada por `RULES` (palavras-chave → paleta, arquétipo, papel,
equipamento). Não há chamada de IA nesta etapa; a interface diz isso ao usuário.

## Editor de animações (etapa 4)

As animações não são só metadados: cada quadro é desenhado pelo mesmo motor de
sprites, com uma pose diferente.

- `src/shared/animations.ts` define os 10 tipos, os valores sugeridos de FPS e de
  quadros, e `poseForFrame(kind, index, count)` — uma função pura que devolve a pose
  daquele quadro (`bob`, `lean`, `stance`, `squash`, `rotate`, `flash`, `shift`).
- `sprites.ts` aplica a pose: pernas e braços seguem `stance` (humanoides e
  quadrúpedes), e o `Canvas` ganhou `shear`, `squashBottom`, `translate`,
  `rotateQuarter` e `blend`. `renderPosePixels` devolve os pixels crus para montar a
  spritesheet; `renderPose` devolve o PNG.
- `animations.ts` valida a configuração (nome 2–60, FPS 1–60, 1 a 24 quadros, espera
  de 1 a 8 batidas), renderiza, monta a spritesheet horizontal
  (`buildSpritesheet`), calcula a duração (`batidas ÷ FPS`) e grava:
  `animacoes/<slug>/<slug>_NN.png`, `<slug>_sheet.png` e `<slug>.json`.
- A remoção usa a mesma lixeira interna dos outros módulos; nada é apagado.
- A exportação para a Godot copia `animacoes/` junto de `personagens/` e
  `monstros/` para `pixel_strike/recursos/`.

O FPS, a repetição e a espera de cada quadro vêm da ficha JSON, então o runtime do
jogo não precisa adivinhar a velocidade da animação.

## Teste automático do Electron (`npm run smoke`)

Executa o app compilado com `--smoke-test`:

- usa pasta temporária como `userData` e como pasta de projetos (não toca nos dados
  reais);
- espera a interface renderizar e o aviso `studio:app:smoke-ready` (executado uma
  única vez, mesmo que a interface avise mais de uma vez);
- **fase 1**: cria um projeto, faz backup, lista a raiz, cria uma pasta, lê o
  `projeto.json`, consulta o estado inicial da Godot, gera um sprite (prévia + save) e
  monta uma animação de 6 quadros com spritesheet (prévia + save);
- recarrega a janela, como um reinício, e **fase 2**: confirma que o app abriu no
  painel, abre as páginas de arquivos, Godot, personagens e animações pelo menu,
  verifica que as pastas, os sprites e a linha do tempo aparecem e remove o projeto
  pela lixeira;
- encerra com código 0 apenas se tudo responder como esperado, e imprime um resumo.

Isso cobre de uma vez: preload, IPC, validações, SQLite, sistema de arquivos, React e
navegação.
