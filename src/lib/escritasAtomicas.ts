import { db } from "./db";
import type { LinhaDesignacao } from "./designacoes";

function textoSql(valor: string): string {
  return `'${valor.replace(/'/g, "''")}'`;
}

function inteiroSql(valor: number): string {
  if (!Number.isInteger(valor)) throw new Error("Inteiro invalido");
  return String(valor);
}

function decimalSql(valor: number): string {
  if (!Number.isFinite(valor)) throw new Error("Numero invalido");
  return String(valor);
}

export async function substituirGrade(
  grupos: { grupo: string; peso: number }[],
  itens: { diaSemana: number; posicaoId: number }[]
): Promise<void> {
  const pesos = grupos.map((g) => `(${textoSql(g.grupo)},${decimalSql(g.peso)})`).join(",");
  const grade = itens.map((g) => `(${inteiroSql(g.diaSemana)},${inteiroSql(g.posicaoId)})`).join(",");
  const ctes: string[] = [];
  if (pesos) {
    ctes.push(
      `pesos AS (UPDATE "GrupoCarga" AS gc SET "peso" = v.peso FROM (VALUES ${pesos}) AS v(grupo,peso) WHERE gc."grupo" = v.grupo RETURNING 1)`
    );
  }
  const desejados = grade
    ? `(VALUES ${grade})`
    : `(SELECT NULL::integer AS "diaSemana", NULL::integer AS "posicaoId" WHERE false)`;
  ctes.push(
    `apagados AS (DELETE FROM "GradeItem" WHERE NOT EXISTS (SELECT 1 FROM ${desejados} AS v(dia, pos) WHERE v.dia = "GradeItem"."diaSemana" AND v.pos = "GradeItem"."posicaoId") RETURNING 1)`
  );
  if (grade) {
    ctes.push(
      `inseridos AS (INSERT INTO "GradeItem" ("diaSemana","posicaoId") VALUES ${grade} ON CONFLICT ("diaSemana","posicaoId") DO UPDATE SET "posicaoId" = EXCLUDED."posicaoId" RETURNING 1)`
    );
  }
  await db.$executeRawUnsafe(`WITH ${ctes.join(",")} SELECT 1`);
}

export async function substituirVaras(promotorId: number, varas: number[]): Promise<void> {
  const valores = varas.map((vara) => `(${inteiroSql(promotorId)},${inteiroSql(vara)})`).join(",");
  const desejados = valores
    ? `(VALUES ${valores})`
    : `(SELECT NULL::integer AS promotorId, NULL::integer AS vara WHERE false)`;
  const ctes = [
    `apagados AS (DELETE FROM "PromotorVara" WHERE "promotorId" = ${inteiroSql(promotorId)} AND NOT EXISTS (SELECT 1 FROM ${desejados} AS v(pid, vara) WHERE v.pid = "PromotorVara"."promotorId" AND v.vara = "PromotorVara"."vara") RETURNING 1)`,
  ];
  if (valores) {
    ctes.push(
      `inseridos AS (INSERT INTO "PromotorVara" ("promotorId","vara") VALUES ${valores} ON CONFLICT ("promotorId","vara") DO UPDATE SET "vara" = EXCLUDED."vara" RETURNING 1)`
    );
  }
  await db.$executeRawUnsafe(`WITH ${ctes.join(",")} SELECT 1`);
}

export async function substituirVinculosRegra(regraId: number, promotoresIds: number[]): Promise<void> {
  const valores = promotoresIds
    .map((promotorId) => `(${inteiroSql(promotorId)},${inteiroSql(regraId)})`)
    .join(",");
  const desejados = valores
    ? `(VALUES ${valores})`
    : `(SELECT NULL::integer AS promotorId, NULL::integer AS regraId WHERE false)`;
  const ctes = [
    `apagados AS (DELETE FROM "PromotorRegra" WHERE "regraId" = ${inteiroSql(regraId)} AND NOT EXISTS (SELECT 1 FROM ${desejados} AS v(pid, rid) WHERE v.pid = "PromotorRegra"."promotorId" AND v.rid = "PromotorRegra"."regraId") RETURNING 1)`,
  ];
  if (valores) {
    ctes.push(
      `inseridos AS (INSERT INTO "PromotorRegra" ("promotorId","regraId") VALUES ${valores} ON CONFLICT ("promotorId","regraId") DO UPDATE SET "regraId" = EXCLUDED."regraId" RETURNING 1)`
    );
  }
  await db.$executeRawUnsafe(`WITH ${ctes.join(",")} SELECT 1`);
}

export async function atualizarDesignacoes(
  atualizacoes: { id: number; promotorId: number | null }[],
  novas: LinhaDesignacao[]
): Promise<void> {
  const updates = atualizacoes
    .map((d) => `(${inteiroSql(d.id)},${d.promotorId === null ? "NULL::integer" : inteiroSql(d.promotorId)})`)
    .join(",");
  const insercoes = novas
    .map((d) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) throw new Error("Data invalida para designacao");
      if (d.origem !== "AUTO" && d.origem !== "MANUAL") throw new Error("Origem invalida");
      return `(${inteiroSql(d.escalaId)},${textoSql(d.data)},${inteiroSql(d.posicaoId)},${d.promotorId === null ? "NULL" : inteiroSql(d.promotorId)},${textoSql(d.origem)})`;
    })
    .join(",");
  const ctes: string[] = [];
  if (updates) {
    ctes.push(
      `atualizadas AS (UPDATE "Designacao" AS d SET "promotorId" = v.promotorId, "origem" = 'AUTO' FROM (VALUES ${updates}) AS v(id,promotorId) WHERE d."id" = v.id RETURNING 1)`
    );
  }
  if (insercoes) {
    ctes.push(
      `inseridas AS (INSERT INTO "Designacao" ("escalaId","data","posicaoId","promotorId","origem") VALUES ${insercoes} RETURNING 1)`
    );
  }
  if (ctes.length) await db.$executeRawUnsafe(`WITH ${ctes.join(",")} SELECT 1`);
}

export type LinhaPortaria = {
  numero: string | null;
  promotorAfastadoId: number;
  promotorCobridorId: number | null;
  modalidade: string;
  inicio: string;
  fim: string;
  observacao: string | null;
};

export async function inserirPortarias(rows: LinhaPortaria[]): Promise<void> {
  if (rows.length === 0) return;
  const valores = rows.map((r) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(r.fim)) {
      throw new Error("Data invalida para portaria");
    }
    return `(${r.numero === null ? "NULL" : textoSql(r.numero)},${inteiroSql(r.promotorAfastadoId)},${r.promotorCobridorId === null ? "NULL::integer" : inteiroSql(r.promotorCobridorId)},${textoSql(r.modalidade)},${textoSql(r.inicio)},${textoSql(r.fim)},${r.observacao === null ? "NULL" : textoSql(r.observacao)})`;
  });
  await db.$executeRawUnsafe(
    `INSERT INTO "Portaria" ("numero","promotorAfastadoId","promotorCobridorId","modalidade","inicio","fim","observacao") VALUES ${valores.join(",")}`
  );
}

export type LinhaPromotorImportacao = {
  id: number | null;
  apelido: string;
  nome: string;
  email: string | null;
  tipo: string;
  atuacao: string;
  ativo: boolean;
  generico: boolean;
  observacoes: string | null;
  varas: number[];
};

export async function publicarPromotores(
  rows: LinhaPromotorImportacao[],
  cargos: { cargo: string; apelido: string }[]
): Promise<void> {
  if (rows.length === 0) return;
  const existentes = rows.filter((r) => r.id !== null);
  const novos = rows.filter((r) => r.id === null);
  const atualizacoes = existentes.map(
    (r) => `(${inteiroSql(r.id!)},${textoSql(r.apelido)},${textoSql(r.nome)},${r.email === null ? "NULL" : textoSql(r.email)},${textoSql(r.tipo)},${textoSql(r.atuacao)},${r.ativo},${r.generico},${r.observacoes === null ? "NULL" : textoSql(r.observacoes)})`
  );
  const insercoes = novos.map(
    (r) => `(${textoSql(r.apelido)},${textoSql(r.nome)},${r.email === null ? "NULL" : textoSql(r.email)},${textoSql(r.tipo)},${textoSql(r.atuacao)},${r.ativo},${r.generico},${r.observacoes === null ? "NULL" : textoSql(r.observacoes)})`
  );
  const varas = rows.flatMap((r) => [...new Set(r.varas)].map((vara) => `(${textoSql(r.apelido)},${inteiroSql(vara)})`)).join(",");
  const cargosValores = cargos.map((c) => `(${textoSql(c.cargo)},${textoSql(c.apelido)})`).join(",");
  const ctes: string[] = [];
  if (atualizacoes.length) {
    ctes.push(
      `atualizados AS (UPDATE "Promotor" AS p SET "apelido" = v.apelido, "nome" = v.nome, "email" = v.email, "tipo" = v.tipo, "atuacao" = v.atuacao, "ativo" = v.ativo, "generico" = v.generico, "observacoes" = v.observacoes FROM (VALUES ${atualizacoes.join(",")}) AS v(id,apelido,nome,email,tipo,atuacao,ativo,generico,observacoes) WHERE p."id" = v.id RETURNING p."id",p."apelido")`
    );
  } else {
    ctes.push(`atualizados AS (SELECT NULL::integer AS "id", NULL::text AS "apelido" WHERE false)`);
  }
  if (insercoes.length) {
    ctes.push(
      `criados AS (INSERT INTO "Promotor" ("apelido","nome","email","tipo","atuacao","ativo","generico","observacoes") VALUES ${insercoes.join(",")} RETURNING "id","apelido")`
    );
  } else {
    ctes.push(`criados AS (SELECT NULL::integer AS "id", NULL::text AS "apelido" WHERE false)`);
  }
  ctes.push(`promotores AS (SELECT "id","apelido" FROM atualizados UNION ALL SELECT "id","apelido" FROM criados)`);
  if (varas) {
    ctes.push(
      `varas AS (INSERT INTO "PromotorVara" ("promotorId","vara") SELECT p."id",v.vara FROM (VALUES ${varas}) AS v(apelido,vara) JOIN promotores p ON p."apelido" = v.apelido ON CONFLICT ("promotorId","vara") DO NOTHING RETURNING 1)`
    );
  }
  if (cargosValores) {
    ctes.push(
      `cargos AS (INSERT INTO "CargoAdministrativo" ("cargo","promotorId") SELECT c.cargo,p."id" FROM (VALUES ${cargosValores}) AS c(cargo,apelido) JOIN promotores p ON p."apelido" = c.apelido ON CONFLICT ("cargo") DO UPDATE SET "promotorId" = EXCLUDED."promotorId" RETURNING 1)`
    );
  }
  await db.$executeRawUnsafe(`WITH ${ctes.join(",")} SELECT 1`);
}
