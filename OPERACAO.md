# Operacao

## Seguranca Da Aplicacao

- **Cabecalhos HTTP**: CSP (`default-src 'self'`, scripts da propria origem),
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy` e HSTS sao injetados pelo `next.config.mjs` em todas as
  rotas; testados em `tests/unit/seguranca-headers.test.ts`. Ao adicionar
  origem externa (fonte, imagem, API), atualize a CSP com cuidado.
- **Senha**: minimo de 8 e maximo de 256 caracteres (`senhaValida` em
  `src/lib/validacao.ts`), aplicada na API de usuarios, na troca de senha e no
  formulario (`minLength`). `trocar-senha` emite cookie novo: quem troca a
  propria senha nao perde a sessao.
- **Rate limit de login**: 5 falhas em 15 minutos por e-mail e IP; cada falha
  registrada remove registros com mais de 24 h (`LoginTentativa`).
- **Gerador de senha**: `gerador-de-senha.ps1` usa `RandomNumberGenerator`
  (fonte criptografica); o antigo hash SHA256 deterministico foi removido.

## Ambiente novo

1. Instale Node.js 22 e garanta o PATH:

   ```powershell
   $env:Path = "$env:USERPROFILE\tools\nodejs;$env:Path"
   ```

2. Configure o certificado do proxy MPSP:

   ```powershell
   $env:NODE_EXTRA_CA_CERTS = "C:\caminho\para\ca.pem"
   ```

3. Obtenha o ambiente Development da Vercel:

   ```powershell
   npx vercel env pull .env
   ```

4. Instale, gere o client e valide:

   ```powershell
   npm ci
   npx prisma generate
   npm run verify
   ```

O `.env` aponta para o branch `development` do Neon e nunca deve ser versionado.
Em producao, `src/lib/db.ts` usa `DATABASE_URL_PRODUCAO` quando
`VERCEL_ENV=production`.

## Variaveis

- `DATABASE_URL`: conexao Development/Preview do Neon.
- `DATABASE_URL_UNPOOLED`: usada pelo aplicador do schema no Neon.
- `DATABASE_URL_PRODUCAO`: conexao do branch `main`, somente Production.
  - A senha do Neon pode ser rotacionada pela Neon e desatualizar essa env:
    sintoma e login (e qualquer API) em producao com 500 `Erro interno do
    servidor`, e nos runtime logs `NeonDbError: password authentication failed
    for user 'neondb_owner'`. Corrigir regenerando a connection string do
    branch `main` (`npx neonctl cs main --project-id $env:NEON_PROJECT_ID`) e recriando a env (`npx vercel env rm DATABASE_URL_PRODUCAO
    production --yes` + `npx vercel env add DATABASE_URL_PRODUCAO production`),
    seguido de redeploy do deployment de producao (env e congelada no build).
- `SESSION_SECRET`: segredo HMAC da sessao; minimo de 32 caracteres.
- `NODE_EXTRA_CA_CERTS`: cadeia CA do proxy MPSP em ambiente local/CLI.
- `VERCEL_ENV`: definido pela Vercel; determina ambiente e conexao de banco.

## Rotacao De Sessao

1. Gere um segredo novo de pelo menos 32 caracteres.
2. Atualize `SESSION_SECRET` nos ambientes Development, Preview e Production.
3. Nao registre ou envie o valor por chat, commit ou log.
4. Abra um PR (ou faca push na branch de um PR aberto) e valide login/logout
   no link de Preview que a Vercel publica no PR.
5. O merge na `main` publica em Production automaticamente; faca-o so depois
   da validacao no Preview.

A troca invalida tokens antigos. Se houver suspeita de comprometimento, faca a
rotacao imediatamente e confirme que o login exige nova sessao.

## Importacao Excel

- Arquivo permitido: `.xlsx`, no maximo 5 MB.
- Promotores: aba `Promotores`; chave `Apelido`.
- Portarias: aba `Afastamentos`; chaves `Afastado`, `Inicio` e `Fim`.
- Datas aceitas: `AAAA-MM-DD` ou `DD/MM/AAAA`, convertidas para ISO.
- Erros retornam linha e mensagem; havendo erro, o lote nao e publicado.
- Duplicadas sao ignoradas conforme a chave do recurso.
- Exporte antes de editar para preservar nomes de abas e colunas.

## Banco E Recuperacao

O firewall bloqueia Postgres direto; nao use `prisma db push` localmente.
Aplique o schema no Development/Preview com:

```powershell
node --env-file=.env scripts/aplica-schema-neon.mjs
```

O aplicador e idempotente para tabelas, indices, constraints e checks existentes.
Antes de alterar schema, valide o branch correto e faca backup/exportacao de
configuracoes. Nunca execute o aplicador apontando para Production sem revisao.

Antes do merge na `main` (que publica em Production automaticamente), aplique o
schema tambem no branch `main` do Neon (mesmo script, com a connection string do
main). Sem isso o banco main fica sem colunas ou tabelas novas; sintoma e
500/`Application error` em producao com `column ... does not exist` nos runtime
logs do deployment.

Se a geracao for interrompida, mantenha a escala em `RASCUNHO`, confira
designacoes e rode novamente `POST /api/escalas/[id]/gerar`. Custodias manuais,
Trocas/Ajustes e designacoes existentes sao preservados conforme as regras do
servico. Nao apague registros diretamente no banco.

## Testes E Deploy

Teste isolado, sem Neon:

```powershell
npm run test:unit
npx tsc --noEmit
npm run build
```

Teste E2E, somente contra Development:

```powershell
npm run dev
npm run test:e2e
```

O E2E cria dados `TESTE-*`, regenera setembro de 2026 e executa limpeza ao
final. Nunca use Production.

Deploy (sem comandos manuais):

1. `npm run verify` local e, quando a mudanca tocar API/geracao/persistencia/
   autenticacao/import-export, `npm run test:e2e` contra o servidor local.
2. Push na branch do PR: a Vercel publica um Preview e comenta o link no PR. O
   Preview usa o banco do ambiente Preview (branch `development` do Neon).
3. Validar a mudanca nesse link de Preview.
4. Com CI verde (`verify` + `higiene`) e Preview validado, fazer o merge na
   `main`: a Vercel publica em Production automaticamente.

Nunca use `npx vercel` (sem subcomando), `npx vercel --prod`, `npx vercel deploy`
ou `npx vercel alias`. `npx vercel env ...` continua permitido para variaveis.

## Higiene E Entrega

Politica de commits incrementais (um commit por feature/ajuste concluido, em
portugues sem acentos); deploy so pela integracao GitHub/Vercel (Preview por PR,
Production a cada merge na `main`). Antes de cada commit e antes do merge:

```powershell
git status --short        # conferir que so ha arquivos esperados
git diff --check          # sem erros de espaco
node scripts/verifica-higiene.mjs
node scripts/audita-dependencias.mjs  # npm audit --omit=dev com excecoes datadas
```

A verificação de higiene falha (exit != 0) se houver:

- Arquivos de ambiente commitados (`.env`, `.env.*`, exceto `.env.example`).
- Chaves e credenciais (`.pem`, `.key`, `id_rsa`, `credentials`, `secrets.*`).
- Artefatos temporarios de exportacao (`tmp-*.xlsx`, gerados pelos E2E).
- Segredos em conteudo: chave privada PEM, chave AWS (`AKIA...`), senha Neon
  (`npg_...`) ou URL de banco remota com senha (host != localhost).

Arquivos sob `tests/` e `fixtures/` sao ignorados na varredura de conteudo
(contem amostras intencionais para os testes), mas continuam checados por nome.

O CI (`.github/workflows/ci.yml`) roda `verify` (testes + typecheck + build) e
o job `higiene` (verifica-higiene + `scripts/audita-dependencias.mjs` + `git diff --check`)
a cada push e pull request.

`scripts/audita-dependencias.mjs` roda `npm audit --omit=dev --json` e falha em
qualquer advisory de producao, exceto os listados em `scripts/audit-excecoes.json`
(GHSA + pacote + motivo + data `expira`). Excecao vencida volta a bloquear o CI;
excecao sem advisory correspondente gera aviso para ser removida. Toda excecao
nova exige justificativa de por que o caminho vulneravel nao e alcancavel.

Nao commitar `.env*`; apenas `.env.example` e permitido se criado. O `.env`
local vem de `npx vercel env pull .env` (Development) e nunca vai para o git.