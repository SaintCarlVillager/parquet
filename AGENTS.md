# AGENTS.md

Operação deste repositório para o agente. Apresentação do Parquet e a alusão do nome ficam em `README.md`. Setup, incidentes, banco e deploy ficam em `OPERACAO.md`.

App web (Next.js 15.5.28 + TypeScript + Prisma 6.19.3) da escala mensal de audiências dos promotores criminais. A tela se chama Escala PJ Criminal. Produção: `https://viladesaocarlos.vercel.app`; Preview: `https://saintcarlvillage.vercel.app`; Development: `http://localhost:3000`.

> **Atualize este arquivo sempre que descobrir uma peculiaridade nova.**

## Ambiente Windows — peculiaridades críticas

- **Node não está no PATH global.** Em cada shell:
  ```powershell
  $env:Path = "$env:USERPROFILE\tools\nodejs;$env:Path"
  ```
- **TLS corporativo (MPSP)**: o proxy intercepta TLS. Sem a cadeia, npm/vercel/prisma/neon falham com `unable to get local issuer certificate`. Defina `NODE_EXTRA_CA_CERTS` com o caminho local do certificado (veja `.env.example`). Em shells novos funciona; para garantir, exporte também na sessão.
- **Firewall do MPSP bloqueia a porta 5432** (e WebSocket/5152): o Postgres/Neon só é acessível via **HTTP na 443**. Por isso o `src/lib/db.ts` usa `PrismaNeonHTTP` (`@prisma/adapter-neon`). Restrições do modo HTTP (o driver rejeita com `Transactions are not supported in HTTP mode`):
  - **Sem `$transaction`** — código sequencial de propósito (`escalaService.ts`, `api/regras/[id]`, `api/promotores/[id]`).
  - **Sem `Promise.all` com consultas Prisma** — lote vira transação; usar `await` sequencial (corrigido em `escalaService`, `escalas/[id]`, `reset`, `export`, `grade`, `portarias`).
  - **Sem `createMany`** — também vira lote; usar `inserirDesignacoes()` (`src/lib/designacoes.ts`, INSERT multi-VALUES via `$executeRawUnsafe`) ou loop de `create`.
  - **Write (`create`/`update`) com `include` de relação vira transação** — write simples e depois `findUnique` com `include` (corrigido em `designacoes/[id]`, `portarias`, `portarias/[id]`). Leituras (`findUnique`/`findMany`) com `include` funcionam normalmente.
  - **Nested create relacional** (`varas: { create: [...] }`, `promotores: { create: [...] }`) vira transação — criar o pai e depois `create` dos vínculos em loop (corrigido em `api/promotores` e `api/regras`). Nunca engolir erro genérico com `catch` que responde 409: checar duplicidade antes e deixar erros reais estourar.
  - POST de geração leva ~25s (round-trips sequenciais ao Neon) — normal.
- **Shell é PowerShell 5.1**: não usar `&&` (usar `;` ou `; if ($?) { ... }`); caminhos com espaço sempre entre aspas; nativo que escreve no stderr vira erro amarelo "NativeCommandError" (ignorar).
- **Arquivos `.mjs` com acentos** quebram ao serem criados via here-string/Set-Content do PowerShell (UTF-8 vira mojibake). Escrever scripts Node com ASCII (sem acentos).
- **Dev server na porta 3000 trava o engine do Prisma**: matar o processo node antes de `prisma generate` / `npm run build`.

## Comandos

```powershell
$env:Path = "$env:USERPROFILE\tools\nodejs;$env:Path"
npm run dev                 # dev local (porta 3000), usa .env = ambiente Development da Vercel
npm run build               # build de produção
npx prisma generate         # após alterar schema.prisma (matar node antes!)
   npx tsc --noEmit            # typecheck
   npm run lint                # eslint (flat config, Next core-web-vitals)
   npm run test:unit           # testes unitarios isolados, sem Neon
   npm run test:e2e            # validadores contra servidor local + banco Development
   npm run verify               # lint + testes + typecheck + build, gate antes do Preview
   node scripts/verifica-higiene.mjs  # arquivos proibidos/segredos (gate de higiene)
   npm audit --omit=dev               # dependencias de producao sem vulnerabilidades
   git status --short ; git diff --check  # checklist de entrega antes do commit
```

- Testes end-to-end (23 validadores de gerador/regras/portarias/custódia + export/import de configurações em Excel): `scripts/valida-*.mjs`. Batem na API com sessão — rodar com `node --env-file=.env --import ./scripts/pre-sessao.mjs scripts/valida-X.mjs` (login via `SESSAO_EMAIL` e senha via `E2E_SENHA` no `.env`; aborta se algum dos dois estiver ausente; injeta o cookie no `fetch`). Mutam dados de dev (criam/removem registros TESTE e regeneram a escala de 2026-09) — nunca apontar para produção. `scripts/limpeza.mjs` remove apelidos `TESTE-*` remanescentes.
- Testes unitários ficam em `tests/unit` e rodam isolados do Neon com `npm run test:unit`; o comando `npm run verify` é o gate obrigatório antes de Preview e executa testes unitários, typecheck e build. Os validadores E2E continuam separados porque usam banco compartilhado e dados de teste.
- `npm run test:e2e` executa todos os `scripts/valida*.mjs` em sequência com sessão automática e chama `scripts/limpeza.mjs` ao final. Exige `npm run dev` ativo e nunca deve apontar para produção. Para retomar a partir de um validador: `$env:E2E_FROM="valida-rotulos.mjs"; npm run test:e2e`.

## Banco de dados

- **Neon Postgres** (hobby). **Branches**: `main` = produção; branch `development` = usado pelos ambientes **Development e Preview** da Vercel (dados isolados da produção). O id do projeto e o endpoint ficam só no painel da Neon e nas envs, nunca no repositório. `neonctl` autenticado (login navegador).
- `.env` local vem de `npx vercel env pull .env` (ambiente Development → aponta para o **branch development**). **`.env` NUNCA vai para o git** (já no .gitignore; contém DATABASE_URL com credenciais).
- `schema.prisma` usa `provider = "postgresql"`. `prisma db push` **não funciona localmente** (porta bloqueada) — aplicar schema via `node --env-file=.env scripts/aplica-schema-neon.mjs` (sql SQL gerado de `schema-neon.sql`).
- Migração SQLite→Postgres **concluída e validada ponto a ponto** (suíte completa verde em 2026-09); scripts da migração (`migra-dados.mjs`, seed, diag-*) foram removidos e não fazem parte desta versão.

## Deploy — POLÍTICA (definida pelo usuário; NÃO mudar)

- **Desenvolvimento**: sempre local (`npm run dev`) contra o banco Neon.
- **Deploy**: SEMPRE `npx vercel` (ambiente **Preview**). **NUNCA `npx vercel --prod`.**
- **Após os testes passarem**: sempre fazer o deploy com `npx vercel`, seguindo a política de Preview acima.
- **Após o deploy Preview**: apontar o alias com `npx vercel alias escala-pj-criminal-<id>-viladesaocarlos.vercel.app saintcarlvillage.vercel.app`.
- **Promoção Preview → Production**: feita SOMENTE pelo usuário, no painel da Vercel (Deployments → Promote to Production). **Peculiaridade**: o deployment promovido herda a `DATABASE_URL` do ambiente de origem (preview → branch development). Por isso a produção usa `DATABASE_URL_PRODUCAO` (main do Neon), resolvida em `src/lib/db.ts` quando `VERCEL_ENV === "production"` — adicionar/alterar essa env pelo CLI (`npx vercel env add DATABASE_URL_PRODUCAO production`) ou painel.
- **Deployment Protection (Vercel Authentication)** do projeto está DESLIGADO (previews públicos, como produção).
- Proxy do MPSP intercepta TLS: `NODE_EXTRA_CA_CERTS` aponta para a cadeia CA local (variável de usuário; caminho fora do repositório).
- O env `DATABASE_URL` (etc.) já está injetado nos ambientes da Vercel (integração Neon). `SESSION_SECRET` também está nos 3 ambientes (sessão HMAC).

## Autenticação e perfis

- **Login próprio** (sem serviço externo — funciona atrás do proxy do MPSP): `src/lib/auth.ts` (scrypt para senha, cookie `escala_sessao` assinado com HMAC-SHA256, 7 dias). Política de senha: mínimo 8, máximo 256 (`senhaValida` em `src/lib/validacao.ts`), aplicada em login-cadastro (`PUT /api/usuarios`), troca de senha e no `minLength` do formulário de usuários. Trocar a própria senha emite cookie novo (mantém a sessão). Rate limit de login (5 falhas/15 min por e-mail+IP) limpa registros com mais de 24 h a cada falha registrada.
- **3 papéis** (modelo "só o CHEFE edita"): `CHEFE` (tudo, inclusive cadastros e usuários; única edição), `OFICIAL` (consulta TODAS as telas, somente leitura — inclusive Feriados/Posições/Exceções), `PROMOTOR` (somente leitura de Dashboard, Escala, Custódia, Promotores, Regras e Portarias; Feriados/Posições/Exceções/Usuários ficam fora do menu e as páginas redirecionam para `/`). Guardas: `exigir(req, papeis)` nas APIs — `EDICAO = ["CHEFE"]` em toda mutação; leituras de feriados/grade = `LEITURA` (CHEFE+OFICIAL); `GET /api/usuarios` só CHEFE. Páginas consomem papel via `useSessao()` (`SessaoProvider`) para esconder controles; `/feriados`, `/grade`, `/excecoes` e `/usuarios` têm guarda server-side (`papelAtual`). Promotor logado é identificado por `Promotor.email` (fallback: apelido = parte local do e-mail) e destacado com classes `.eu`/`.linha-eu`.
- Páginas sob route group `src/app/(app)` com layout que redireciona para `/login` sem sessão. `/login` pública; `/usuarios` só CHEFE.
- Badge de ambiente na sidebar/login: `NEXT_PUBLIC_AMBIENTE` (injetado pelo `next.config.mjs` a partir de `VERCEL_ENV`: local/preview/production).
- **Usuários**: contas reais ficam só no banco e no vault de senhas. O repositório não lista e-mails, apelidos nem senhas. E2E usa `SESSAO_EMAIL` e `E2E_SENHA` no `.env` (nunca hardcoded).

## Regras de negócio essenciais (resumo)

- **Custódia**: lançamento manual por dia (aba Custódia), preservada em regenerações e **tem prioridade** — pode ser lançada sobre dia ocupado; a regeneração libera a designação automática do dia. `PATCH /api/designacoes/[id]` com `{"cargo":"C"}` ignora o conflito do dia.
- **Portarias de cobertura** (substituíram Afastamentos): quem cobre age **como o cargo coberto** (atuação, varas e regras do afastado) e **herda as audiências** do afastado no período (pré-alocação 1/dia). Afastado fica fora da escala (409 `"afastado (portaria Nº ...)"`). Cobertura limitada ao cargo do afastado (titular "N" vs auxiliar "N'"). Rótulos na escala por modalidade: `acumulando/designado para/auxiliando X`; badge verde `ajudando na auxiliar` para genéricos em auxiliar sem cobertura.
- **Cargos genéricos** (`generico = true`): PJS/PJE não são pessoas reais — sem limite diário, sem regra de dias consecutivos, cobrem portarias quando escolhidos como cobridor. O PJS **não reserva mais uma auxiliar por dia** (São Paulo não garante a nomeação): a vaga vai para um promotor real ou fica vazia. Designação manual do PJS é preservada ao regerar; a automática antiga, sem portaria de cobertura, é liberada. PJE não é reserva de ninguém.
- **Secretário/Sub-secretário** (cargos administrativos via `api/cargos`): 1 audiência/semana no máximo; sub assume o lugar do secretário ausente (portaria); quem cobre NÃO herda o limite.
- **Preferência**: balancear a exposição a cada vara no período da escala (quem já fez mais vezes a vara X perde para quem fez menos; titular `N` e auxiliar `N'` contam a mesma vara).
- **Regras reutilizáveis** (aba Regras): grupos por tipo + dias da semana, vinculáveis a vários PJs (`SUBSTITUTO` as ignora); exceções pontuais na aba Exceções por mês.
- **Datas**: strings `"YYYY-MM-DD"` em toda a API (nunca `Date`).
- **Export/Import de configurações**: `GET /api/configuracoes/export` gera workbook Excel (`src/lib/excelExport.ts`) com abas Afastamentos, Promotores, Regras, Grade e Leia-me (data de datas como texto ISO, pois ExcelJS monta `Date` em UTC). Import round-trip: `POST /api/promotores/import` (CHEFE) e `POST /api/portarias/import` (EDICAO) recebem multipart `arquivo`, acham a aba por nome e casam colunas por tokens normalizados (sem acento/espaço) — apelido é a chave; duplicadas são ignoradas e erros por linha voltam no JSON. Colunas casadas por `colunaDe` (token mais curto; cuidado com tokens que são subpalavra errada, ex. "COBRE" vs "COBRI").
- **Carga ponderada**: agrupada por tipo (Titulares/Auxiliares/Regionais/Substitutos) na tela, impressão (última página) e Excel; carga de cobertura é atribuída ao **cargo original**.
- **Trocas/Ajustes**: lançados por dia, posição e promotor que assume; são uma máscara persistente sobre a escala original e não entram no algoritmo de regras. Permitem substituir uma designação ou preencher posição originalmente vaga. O vínculo entre Oficial e Promotor é configurado no cadastro do usuário Promotor; CHEFE pode lançar qualquer ajuste e OFICIAL pode lançar/excluir somente ajustes dos promotores vinculados (não pode preencher vaga).

## Convenções

- **TDD obrigatorio**: toda funcionalidade nova, alteracao de regra de negocio ou correcao de bug deve seguir o ciclo Red-Green-Refactor. Primeiro escrever ou ajustar o teste que reproduz o comportamento esperado, depois implementar a menor mudanca necessaria e por fim refatorar mantendo todos os testes verdes. Nao considerar uma tarefa concluida sem testes automatizados para os casos de sucesso, negacao e borda relevantes.
- **Gates antes do Preview**: antes de qualquer `npx vercel`, executar `npm run verify`; para alteracoes que envolvam APIs, geracao, persistencia, autenticacao ou import/export, executar tambem `npm run test:e2e` contra o servidor local e o banco Development. Falha em qualquer teste, typecheck ou build bloqueia o deploy.
- **Commits incrementais** (usuário prefere commits a cada feature/ajuste concluído), mensagens em português sem acentos.
- **Toda tarefa termina testada e commitada** (validar com `npx tsc --noEmit` + `npm run build`; podem ser vários commits por tarefa). NUNCA deixar mudanças unstaged acumuladas: deploy sem commit não registra o trabalho no repositório. Se o arquivo já tiver mudanças não commitadas de outra tarefa, isolar o commit (ex.: `git stash`/checkout + reaplicar) para commitar só o que a tarefa alterou.
- **Sem comentários** no código.
- Identidade visual MPSP: vermelho `#C40008`, preto `#212125`, Arial (títulos). Impressão A4 paisagem, 1 semana por folha.
- Debug de banco via scripts efêmeros em `scripts/` — deletar após uso; validar sempre com `npx tsc --noEmit` + `npm run build` antes de commit/deploy.

## Arquivos-chave

- `src/lib/db.ts` — PrismaClient com `PrismaNeonHTTP` (HTTP/443, sem transações).
- `src/lib/gerador.ts` — motor do gerador (grupos, regras, portarias, genéricos, secretário, balanceamento de varas).
- `src/lib/escalaService.ts` — `gerarEscalaMes`: portarias → indisponibilidade/coberturas, pré-alocações, custódias preservadas.
- Criacao de escala e geracao automatica sao operacoes separadas: `POST /api/escalas` cria apenas o esqueleto; `POST /api/escalas/[id]/gerar` preenche vagas sem Trocas/Ajustes e preserva Custodia e designacoes existentes.
- `src/app/api/designacoes/[id]/route.ts` — validações do ajuste manual.
- `prisma/schema.prisma` — provider postgresql (+ `UsuarioPapel`: CHEFE | OFICIAL | PROMOTOR para os 3 perfis de acesso).
- `scripts/aplica-schema-neon.mjs` + `prisma/schema-neon.sql` — infraestrutura de schema do banco (Neon).
- `scripts/pre-sessao.mjs` — preload de sessão para os validadores (login + cookie no `fetch` global).
