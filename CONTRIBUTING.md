# Contribuicao

## Mensagens de commit

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
tipo(escopo): descricao curta
```

- `tipo`: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf` ou `ci`
- `escopo` (opcional, preferivel): area afetada, ex. `gerador`, `ui`, `auth`
- `descricao`: portugues sem acentos, imperativo, sem ponto final

Exemplos:

```
feat(ui): adiciona zebra nas grades
fix(gerador): balanceia exposicao a varas no periodo
docs: esclarece politica de commits
```

Titulo de PR de squash deve seguir o mesmo padrao (o merge usa essa mensagem no `main`).
Corpo do commit/PR pode explicar o motivo em linguagem simples; o subject permanece tecnico e convencional.

## Relacao com AGENTS.md

Operacao do app, banco e deploy ficam em `AGENTS.md` e `OPERACAO.md`. Este arquivo fixa so o padrao de commit para humanos e agentes.
