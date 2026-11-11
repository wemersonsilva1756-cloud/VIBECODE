# Pixel Strike Studio

Plataforma desktop para criação de jogos 2D em pixel art, com editores visuais e
assistência de inteligência artificial. Interface em português do Brasil, pensada
para quem está começando.

> **Estado atual: Etapas 1, 2, 3 e 4 de 10 concluídas e testadas.**
> Nesta versão o Studio gerencia projetos, arquivos, banco de dados local, backups,
> integra a Godot 4, gera **personagens e monstros em pixel art** com sprites
> transparentes e ficha JSON e monta **animações com linha do tempo, FPS e
> spritesheet**. Os editores de mapas, armas e o assistente de IA **ainda não
> existem** — cada item tem sua etapa e a interface diz isso claramente, sem botões
> que não funcionam.
>
> O gerador da etapa 3 é **procedural e determinístico**, não é IA: a descrição é
> interpretada por palavras-chave. Os provedores de IA chegam na etapa 9.

---

## O que já funciona

| Recurso | Situação |
| --- | --- |
| Aplicativo desktop (Electron + React + TypeScript) | Funcionando |
| Interface em tema escuro com navegação lateral | Funcionando |
| Guia inicial para iniciantes | Funcionando |
| Criar, abrir, renomear, duplicar e remover projetos | Funcionando |
| Estrutura de pastas organizada por tipo de recurso | Funcionando |
| Navegar, pré-visualizar e importar arquivos do projeto | Funcionando |
| Importar sem sobrescrever (arquivos repetidos ganham sufixo) | Funcionando |
| Vincular projeto Godot 4, ler versão, cenas, scripts e autoloads | Funcionando |
| Gerar personagens com sprites transparentes em 4 direções | Funcionando |
| Gerar monstros (humanoide, quadrúpede, gosma, voador) e chefes | Funcionando |
| Ficha JSON com atributos, habilidades e drops | Funcionando |
| Montar animações em 10 tipos (idle, andar, correr, atacar, morrer...) | Funcionando |
| Linha do tempo com reordenar, duplicar, excluir e espera por quadro | Funcionando |
| FPS, repetição e pré-visualização em tempo real | Funcionando |
| Spritesheet horizontal e ficha JSON por animação | Funcionando |
| Exportar para a Godot com prévia e backup dos substituídos | Funcionando |
| Banco de dados local SQLite | Funcionando |
| Backups completos com restauração | Funcionando |
| Backup de segurança automático antes de restaurar | Funcionando |
| Histórico de ações | Funcionando |
| Preferências (pasta de projetos, retenção de backups) | Funcionando |
| Tutoriais e glossário em português | Funcionando |
| Geradores de mapas, armas, skills, itens e efeitos | Etapas 5 a 8 |
| Exportar cenas e TileMaps gerados pelos módulos | Junto com as etapas 5 a 8 |
| Geração com inteligência artificial de verdade | Etapa 9 |
| Provedores de IA e assistente central | Etapa 9 |
| Instalador para Windows e sistema de atualização | Etapa 10 |

A tela **Etapas do desenvolvimento** (no menu lateral) mostra o plano completo e o
que está concluído.

---

## Como abrir o Studio

### Opção 1 — atalho pronto (mais simples)

Clique duas vezes em **`abrir-studio.cmd`** na pasta do projeto. O script:

1. usa o Node.js portátil da pasta `.tools/node` quando ele existe;
2. instala as dependências na primeira execução;
3. compila o aplicativo se necessário;
4. abre o Pixel Strike Studio.

### Opção 2 — comandos

```bash
npm install       # apenas na primeira vez
npm run dev       # modo desenvolvimento (recarrega a interface sozinho)
npm run build     # gera a versão compilada em out/
npm start         # abre a versão compilada
```

### Requisitos

- Windows 10 ou 11 (o código também roda em Linux e macOS).
- Node.js 22 ou superior **para compilar**. O aplicativo já compilado não precisa de
  Node para abrir.
- Nenhuma conta, nenhuma conexão com a internet e nenhuma chave de API são
  necessárias para usar a Etapa 1.

> Nesta máquina o Node não estava instalado, então foi baixada uma versão portátil
> em `.tools/node` (não altera o sistema). Para instalar oficialmente, use o
> instalador LTS de <https://nodejs.org>.

---

## Primeiros passos (para quem nunca programou)

1. Ao abrir pela primeira vez, siga o **guia inicial** (três passos).
2. Escolha onde os projetos serão salvos. O padrão é
   `Documentos\Pixel Strike Studio\Projetos`.
3. Crie o primeiro projeto — por exemplo `Pixel Strike`.
4. Abra o projeto no menu **Projetos**. Dentro dele já existem as pastas
   `personagens`, `monstros`, `armas`, `itens`, `efeitos`, `mapas`, `animacoes`,
   `audio`, `godot`, `originais` e `gerados`.
5. Antes de mudanças grandes, clique em **Backup**. Se algo der errado, use
   **Histórico → Restaurar**.
6. Leia **Ajuda e tutoriais** para entender sprites, quadros, tiles e colisões em
   linguagem simples.

### Gerador de personagens e monstros

Menu **Gerador de Personagens** ou **Monstros e Inimigos**. Passo a passo:

1. Dê um **nome** (ele vira o nome da pasta) e escreva uma **descrição**.
2. Clique em **Interpretar descrição** — palavras como `deserto`, `neve`, `neon`,
   `lobo`, `morcego`, `gosma`, `chefe`, `raro`, `fuzil`, `espada` escolhem paleta,
   arquétipo, papel e equipamento.
3. Ajuste o que quiser: papel, arquétipo, tamanho (32, 64 ou 96 px), paleta,
   cada cor, direções e semente.
4. Preencha vida, dano, velocidade e alcance. Nos monstros, adicione habilidades e
   drops (chance de 0 a 100 por item).
5. Use **Gerar variação** para sortear outra semente e **Salvar no projeto**.

O Studio grava tudo em `personagens/<nome>/` ou `monstros/<nome>/`:

```
soldado-alfa/
  soldado-alfa_frente.png
  soldado-alfa_costas.png
  soldado-alfa_esquerda.png
  soldado-alfa_direita.png
  soldado-alfa.json
```

Os PNGs têm fundo transparente e tamanho exato de 32, 64 ou 96 px. A ficha JSON traz
atributos, habilidades, drops, paleta e semente — o mesmo **soldado-alfa.json** que a
exportação para a Godot enxerga e copia para o lado da engine.

### Editor de animações

Menu **Editor de Animações**. Passo a passo:

1. Escolha o **personagem base** (personagens e monstros já salvos aparecem na lista).
2. Escolha o **tipo**: parado, andando, correndo, ataque, tiro, recarregar, morte,
   dano recebido, cura ou habilidade. Cada tipo já vem com FPS, número de quadros e
   repetição sugeridos.
3. Escolha a **direção**. A pré-visualização reproduz sozinha em tempo real.
4. Na **linha do tempo**, use as setas para reordenar, o ícone de cópia para duplicar e
   a lixeira para excluir. O campo numérico é a **espera** do quadro em batidas
   (1 batida = 1 ÷ FPS).
5. Clique em **Salvar animação**.

O Studio grava em `animacoes/<nome>/`:

```
soldado-alfa-andando/
  soldado-alfa-andando_01.png ... _06.png
  soldado-alfa-andando_sheet.png   ← todos os quadros lado a lado
  soldado-alfa-andando.json        ← tipo, FPS, repetição, espera e colunas
```

Nada aqui é simulado: os quadros são desenhados pelo mesmo motor procedural dos
sprites, com poses diferentes por tipo de animação. A importação de uma spritesheet
externa ainda **não** existe — está prevista para a etapa 10, junto do polimento.

### Gerenciador de arquivos

Menu **Arquivos do projeto**. Você navega pelas pastas, vê imagens como sprites (com
fundo xadrez), lê arquivos de texto e cenas como código, cria pastas, importa arquivos
do computador e move itens indesejados para a lixeira interna.

- Importar **nunca sobrescreve**: um arquivo repetido vira `nome-2.png`.
- Caminhos são validados: a interface não consegue sair da pasta do projeto.

### Integração com Godot 4

Menu **Integração com Godot 4**. Passo a passo:

1. Clique em **Escolher pasta da Godot** e selecione a pasta que contém
   `project.godot`.
2. O Studio mostra nome do projeto, versão da engine, cena principal, autoloads,
   quantidade de cenas, scripts e imagens.
3. Coloque na pasta `godot/` do seu projeto no Studio os arquivos que deseja enviar.
4. Clique em **Pré-visualizar exportação** e confira **cada arquivo** e o que acontece
   com ele (novo, substituir ou sem mudança).
5. Confirme. Nada é apagado; arquivos substituídos vão antes para
   `.pixel_strike/backups/` dentro do projeto Godot.

O que a exportação grava hoje:

| Arquivo | Para que serve |
| --- | --- |
| `addons/pixel_strike/pixel_strike.gd` | Utilitário (autoload) que lê o manifesto e carrega recursos |
| `addons/pixel_strike/pixel_strike_manifest.json` | Lista dos recursos exportados |
| `addons/pixel_strike/LEIA-ME.md` | Instruções para ativar o autoload |
| `pixel_strike/recursos/...` | Arquivos da pasta `godot/` do projeto |
| `pixel_strike/recursos/personagens/...` | Sprites PNG e fichas JSON dos personagens gerados |
| `pixel_strike/recursos/monstros/...` | Sprites PNG e fichas JSON dos monstros gerados |
| `pixel_strike/recursos/animacoes/...` | Quadros PNG, spritesheets e fichas JSON das animações |

Tudo o que o gerador da etapa 3 cria entra na exportação automaticamente — não é
preciso copiar arquivo por arquivo. O Studio não altera cenas, scripts ou
configurações que você criou na Godot.

Opcionalmente, em Configurações, você pode apontar o executável da Godot apenas para
conferir a versão instalada — o Studio nunca abre a Godot sozinho.

### Onde ficam os arquivos

| O quê | Onde |
| --- | --- |
| Projetos e recursos | pasta escolhida em Configurações |
| Banco de dados (`studio.db`) | `%APPDATA%\Pixel Strike Studio` |
| Backups | `<pasta de dados>\backups\<id do projeto>` |
| Lixeira interna (nada é apagado de verdade) | `<pasta de dados>\lixeira` |
| Cópias feitas antes de exportar para a Godot | `<projeto Godot>\.pixel_strike\backups\<data e hora>` |

---

## Testes

```bash
npm run typecheck   # verificação de tipos (interface + processo principal)
npm run test:core   # 139 verificações: banco, projetos, arquivos, Godot, sprites e animações
npm run smoke       # compila e abre o Electron verificando IPC, banco e interface
```

O `smoke` é um teste real de integração em duas fases: cria um projeto em pasta
temporária, faz backup, testa o gerenciador de arquivos, gera um sprite e uma animação,
confere o estado inicial da Godot, **recarrega a janela** (simulando reiniciar o app),
confere que o projeto continua aberto, abre as páginas de arquivos, personagens e
animações pelo menu e remove o projeto. Tudo dentro do Electron, sem tocar nos seus
dados.

Resultado da última execução desta versão: **typecheck OK, 139/139 verificações do
núcleo, build OK, smoke OK**.

---

## Estrutura do código

```
src/
  main/                 processo principal do Electron (Node)
    core/               banco de dados, projetos, backups, histórico, estatísticas
      database.ts       conexão SQLite e migrações versionadas
      projects.ts       criar, abrir, duplicar, remover, backup, restaurar
      file-manager.ts   listar, pré-visualizar, importar e remover arquivos
      godot.ts          ler project.godot, vincular e exportar com backup
      characters.ts     gerar, salvar, listar e remover personagens/monstros
      sprites.ts        desenho em pixel art (grade 32, poses e quatro direções)
      animations.ts     quadros, spritesheet, ficha e remoção de animações
      png.ts            codificador PNG RGBA sem dependências
      settings-store.ts preferências locais
      activity.ts       histórico de ações
      stats.ts          indicadores do painel
      filesystem.ts     cópia, tamanho e lixeira interna
      project-template.ts  pastas e arquivos de um projeto novo
    ipc.ts              canais validados entre interface e núcleo
    security.ts         bloqueio de navegação externa e permissões
    smoke.ts            teste automático em duas fases
    index.ts            janela e ciclo de vida
  preload/              ponte segura (contextBridge) exposta à interface
  renderer/             interface React + Tailwind
    src/components/     botões, cartões, modais, notificações, navegação
    src/pages/          painel, projetos, arquivos, projeto, Godot, personagens, animações, ajuda, etapas
    src/state/store.tsx estado global e chamadas ao núcleo
  shared/               contrato de tipos compartilhado (IPC, estrutura de pastas)
tests/core.test.ts      testes do núcleo
docs/ARQUITETURA.md     decisões técnicas e como estender
```

Detalhes de arquitetura, esquema do banco e contrato de IPC em
[`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

---

## Segurança

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- A interface não acessa disco, banco ou Node: só fala com o processo principal por
  canais IPC com validação de argumentos e de origem.
- Links externos abrem no navegador padrão; navegação dentro da janela é bloqueada.
- Permissões de mídia/dispositivo negadas por padrão.
- Política de segurança de conteúdo (CSP) restritiva na interface.
- **Nenhum dado do usuário sai do computador.** Nenhuma chave de API é usada nesta
  etapa.

## Regras do projeto

- Nada de botões falsos ou integrações simuladas.
- Nenhuma operação destrutiva sem confirmação.
- O Studio nunca apaga arquivos de forma definitiva: move para a lixeira interna.
- Restaurar backup sempre cria antes uma cópia de segurança do estado atual.
- Raridade, condição de desgaste e padrão de skin serão tratados como campos
  separados (etapa 6), nunca misturados.
- Conteúdo visual sempre original ou devidamente licenciado.

---

## Próxima etapa

**Etapa 4 — Editor de sprites e animações:** linha do tempo, corte automático de
spritesheets, reordenação de quadros, FPS, loop, pré-visualização em tempo real e as
animações padrão (idle, walk, run, attack, shoot, reload, death, hit, heal, skills)
exportadas junto do personagem.

Nada da Etapa 4 começará antes de as etapas 1 a 3 estarem estáveis — e elas estão
testadas nesta versão.
