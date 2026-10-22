# Parquet

[![CI](https://github.com/SaintCarlVillager/parquet/actions/workflows/ci.yml/badge.svg)](https://github.com/SaintCarlVillager/parquet/actions/workflows/ci.yml)
[![Produção](https://deploy-badge.vercel.app/?url=https://viladesaocarlos.vercel.app&name=producao)](https://viladesaocarlos.vercel.app)
[![Node](https://img.shields.io/badge/node-24-339933?logo=nodedotjs&logoColor=white)](.nvmrc)

Parquet monta a escala mensal de audiências dos promotores de justiça criminais da comarca. A tela continua se chamando Escala PJ Criminal. Parquet é o nome do sistema.

Produção: [viladesaocarlos.vercel.app](https://viladesaocarlos.vercel.app). O preview de cada pull request aparece no próprio PR, pela integração com a Vercel.

## O nome

No foro, *parquet* é o Ministério Público. A palavra vem do francês e nomeia o banco da acusação, o lugar de onde a promotoria fala, em frente à magistratura. Até hoje se diz "o parquet" para falar do próprio órgão.

A sigla fecha com o que o sistema faz:

| | |
| --- | --- |
| **P** | Portarias de cobertura |
| **A** | Audiências do mês |
| **R** | Regras de quem pode atuar |
| **Q** | Quadro de posições da semana |
| **U** | Usuários e papéis |
| **E** | Escala gerada |
| **T** | Trocas e ajustes do dia |

## O que ele faz

O chefe gera o mês. O sistema distribui as audiências entre titulares, auxiliares, regionais, substitutos e cargos genéricos, respeitando regras, feriados, posições e portarias. Quem cobre um afastado atua como o cargo coberto e herda as audiências daquele período.

Custódia é lançada à mão e tem prioridade: a regeneração não a apaga. Trocas e ajustes são uma máscara sobre a escala original. Não entram no algoritmo. Ficam por cima.

Três papéis usam o sistema. O chefe edita. O oficial consulta tudo e lança ajustes dos promotores vinculados. O promotor consulta a própria escala e o que precisa para o mês.

## Começar

É preciso Node.js 22 ou mais novo. Copie `.env.example` para `.env` e preencha as variáveis. O `.env` não vai para o git.

```powershell
npm ci
npx prisma generate
npm run dev
```

O app sobe em `http://localhost:3000`. Os testes de ponta a ponta pedem `SESSAO_EMAIL` e `E2E_SENHA` no ambiente. Não há login padrão no código.

O passo a passo de banco, certificado da rede e deploy está em `OPERACAO.md`.

## Onde está cada documento

- `README.md` é a apresentação, para quem chega no repositório.
- `OPERACAO.md` é o manual de setup, incidente e deploy.
- `AGENTS.md` é instrução de operação para o agente de código. Não é o manual do sistema.
