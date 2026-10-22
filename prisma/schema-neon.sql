-- CreateTable
CREATE TABLE "UsuarioPapel" (
    "email" TEXT NOT NULL,
    "nome" TEXT,
    "papel" TEXT NOT NULL,
    "oficialEmail" TEXT,

    CONSTRAINT "UsuarioPapel_pkey" PRIMARY KEY ("email")
);

ALTER TABLE "UsuarioPapel" ADD COLUMN IF NOT EXISTS "oficialEmail" TEXT;
ALTER TABLE "UsuarioPapel" ADD COLUMN IF NOT EXISTS "senhaHash" TEXT;
ALTER TABLE "UsuarioPapel" ADD COLUMN IF NOT EXISTS "sessaoVersao" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS "Promotor" ADD COLUMN IF NOT EXISTS "observacoes" TEXT;

CREATE TABLE IF NOT EXISTS "LoginTentativa" (
    "chave" TEXT NOT NULL,
    "falhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginTentativa_pkey" PRIMARY KEY ("chave")
);

CREATE TABLE IF NOT EXISTS "Auditoria" (
    "id" SERIAL NOT NULL,
    "requestId" TEXT NOT NULL,
    "contexto" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "usuarioEmail" TEXT,
    "papel" TEXT,
    "resultado" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotor" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "apelido" TEXT NOT NULL,
    "email" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'TITULAR',
    "atuacao" TEXT NOT NULL DEFAULT 'TODAS',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "generico" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,

    CONSTRAINT "Promotor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoAdministrativo" (
    "cargo" TEXT NOT NULL,
    "promotorId" INTEGER,

    CONSTRAINT "CargoAdministrativo_pkey" PRIMARY KEY ("cargo")
);

-- CreateTable
CREATE TABLE "Regra" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'SOMENTE',
    "diasCsv" TEXT NOT NULL DEFAULT '',
    "gruposCsv" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Regra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotorRegra" (
    "id" SERIAL NOT NULL,
    "promotorId" INTEGER NOT NULL,
    "regraId" INTEGER NOT NULL,

    CONSTRAINT "PromotorRegra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotorVara" (
    "id" SERIAL NOT NULL,
    "promotorId" INTEGER NOT NULL,
    "vara" INTEGER NOT NULL,

    CONSTRAINT "PromotorVara_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feriado" (
    "id" SERIAL NOT NULL,
    "data" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Feriado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portaria" (
    "id" SERIAL NOT NULL,
    "numero" TEXT,
    "promotorAfastadoId" INTEGER NOT NULL,
    "promotorCobridorId" INTEGER,
    "modalidade" TEXT NOT NULL DEFAULT 'DESIGNADO',
    "inicio" TEXT NOT NULL,
    "fim" TEXT NOT NULL,
    "observacao" TEXT,

    CONSTRAINT "Portaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Posicao" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "grupo" TEXT NOT NULL DEFAULT 'AUDIENCIAS',
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "Posicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoCarga" (
    "grupo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GrupoCarga_pkey" PRIMARY KEY ("grupo")
);

-- CreateTable
CREATE TABLE "GradeItem" (
    "id" SERIAL NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "posicaoId" INTEGER NOT NULL,

    CONSTRAINT "GradeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeExcecao" (
    "id" SERIAL NOT NULL,
    "data" TEXT NOT NULL,
    "posicaoId" INTEGER NOT NULL,
    "ativa" BOOLEAN NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "GradeExcecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bloqueio" (
    "id" SERIAL NOT NULL,
    "promotorId" INTEGER NOT NULL,
    "posicaoId" INTEGER,
    "data" TEXT,
    "motivo" TEXT,

    CONSTRAINT "Bloqueio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escala" (
    "id" SERIAL NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "observacao" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Escala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Designacao" (
    "id" SERIAL NOT NULL,
    "escalaId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "posicaoId" INTEGER NOT NULL,
    "promotorId" INTEGER,
    "origem" TEXT NOT NULL DEFAULT 'AUTO',
    "travada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Designacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Troca" (
    "id" SERIAL NOT NULL,
    "data" TEXT NOT NULL,
    "posicaoId" INTEGER,
    "promotorOrigemId" INTEGER,
    "promotorDestinoId" INTEGER NOT NULL,
    "observacao" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Troca_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Troca" ADD COLUMN IF NOT EXISTS "posicaoId" INTEGER;
ALTER TABLE "Troca" ALTER COLUMN "promotorOrigemId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Promotor_apelido_key" ON "Promotor"("apelido");

-- CreateIndex
CREATE UNIQUE INDEX "PromotorRegra_promotorId_regraId_key" ON "PromotorRegra"("promotorId", "regraId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotorVara_promotorId_vara_key" ON "PromotorVara"("promotorId", "vara");

-- CreateIndex
CREATE UNIQUE INDEX "Feriado_data_key" ON "Feriado"("data");

-- CreateIndex
CREATE UNIQUE INDEX "Posicao_codigo_key" ON "Posicao"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "GradeItem_diaSemana_posicaoId_key" ON "GradeItem"("diaSemana", "posicaoId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeExcecao_data_posicaoId_key" ON "GradeExcecao"("data", "posicaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Escala_ano_mes_key" ON "Escala"("ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "Designacao_escalaId_data_posicaoId_key" ON "Designacao"("escalaId", "data", "posicaoId");
CREATE INDEX IF NOT EXISTS "Portaria_promotorAfastadoId_inicio_fim_idx" ON "Portaria"("promotorAfastadoId", "inicio", "fim");
CREATE INDEX IF NOT EXISTS "Bloqueio_promotorId_data_idx" ON "Bloqueio"("promotorId", "data");
CREATE INDEX IF NOT EXISTS "Troca_data_promotorDestinoId_idx" ON "Troca"("data", "promotorDestinoId");
CREATE INDEX IF NOT EXISTS "Designacao_promotorId_data_idx" ON "Designacao"("promotorId", "data");
CREATE INDEX IF NOT EXISTS "Auditoria_requestId_idx" ON "Auditoria"("requestId");
CREATE INDEX IF NOT EXISTS "Auditoria_usuarioEmail_criadaEm_idx" ON "Auditoria"("usuarioEmail", "criadaEm");
CREATE INDEX IF NOT EXISTS "Auditoria_recurso_criadaEm_idx" ON "Auditoria"("recurso", "criadaEm");
CREATE INDEX IF NOT EXISTS "Auditoria_criadaEm_idx" ON "Auditoria"("criadaEm");
DROP INDEX IF EXISTS "Troca_data_promotorOrigemId_key";
CREATE UNIQUE INDEX "Troca_data_posicaoId_key" ON "Troca"("data", "posicaoId");

-- AddForeignKey
ALTER TABLE "CargoAdministrativo" ADD CONSTRAINT "CargoAdministrativo_promotorId_fkey" FOREIGN KEY ("promotorId") REFERENCES "Promotor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotorRegra" ADD CONSTRAINT "PromotorRegra_promotorId_fkey" FOREIGN KEY ("promotorId") REFERENCES "Promotor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotorRegra" ADD CONSTRAINT "PromotorRegra_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "Regra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotorVara" ADD CONSTRAINT "PromotorVara_promotorId_fkey" FOREIGN KEY ("promotorId") REFERENCES "Promotor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portaria" DROP CONSTRAINT IF EXISTS "Portaria_promotorAfastadoId_fkey";
ALTER TABLE "Portaria" ADD CONSTRAINT "Portaria_promotorAfastadoId_fkey" FOREIGN KEY ("promotorAfastadoId") REFERENCES "Promotor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portaria" ADD CONSTRAINT "Portaria_promotorCobridorId_fkey" FOREIGN KEY ("promotorCobridorId") REFERENCES "Promotor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeItem" ADD CONSTRAINT "GradeItem_posicaoId_fkey" FOREIGN KEY ("posicaoId") REFERENCES "Posicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeExcecao" ADD CONSTRAINT "GradeExcecao_posicaoId_fkey" FOREIGN KEY ("posicaoId") REFERENCES "Posicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueio" ADD CONSTRAINT "Bloqueio_promotorId_fkey" FOREIGN KEY ("promotorId") REFERENCES "Promotor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designacao" ADD CONSTRAINT "Designacao_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "Escala"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designacao" ADD CONSTRAINT "Designacao_posicaoId_fkey" FOREIGN KEY ("posicaoId") REFERENCES "Posicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designacao" ADD CONSTRAINT "Designacao_promotorId_fkey" FOREIGN KEY ("promotorId") REFERENCES "Promotor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Troca" DROP CONSTRAINT IF EXISTS "Troca_promotorOrigemId_fkey";
ALTER TABLE "Troca" ADD CONSTRAINT "Troca_promotorOrigemId_fkey" FOREIGN KEY ("promotorOrigemId") REFERENCES "Promotor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Troca" DROP CONSTRAINT IF EXISTS "Troca_promotorDestinoId_fkey";
ALTER TABLE "Troca" ADD CONSTRAINT "Troca_promotorDestinoId_fkey" FOREIGN KEY ("promotorDestinoId") REFERENCES "Promotor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Troca" ADD CONSTRAINT "Troca_posicaoId_fkey" FOREIGN KEY ("posicaoId") REFERENCES "Posicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UsuarioPapel_papel_check') THEN ALTER TABLE "UsuarioPapel" ADD CONSTRAINT "UsuarioPapel_papel_check" CHECK ("papel" IN ('CHEFE','OFICIAL','PROMOTOR')) NOT VALID; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Promotor_tipo_check') THEN ALTER TABLE "Promotor" ADD CONSTRAINT "Promotor_tipo_check" CHECK ("tipo" IN ('TITULAR','AUXILIAR','REGIONAL','SUBSTITUTO')) NOT VALID; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Promotor_atuacao_check') THEN ALTER TABLE "Promotor" ADD CONSTRAINT "Promotor_atuacao_check" CHECK ("atuacao" IN ('TODAS','CUSTODIA','PLANTAO','CUSTODIA_PLANTAO')) NOT VALID; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrupoCarga_peso_check') THEN ALTER TABLE "GrupoCarga" ADD CONSTRAINT "GrupoCarga_peso_check" CHECK ("peso" >= 0 AND "peso" <> 'NaN'::double precision AND "peso" <> 'Infinity'::double precision AND "peso" <> '-Infinity'::double precision) NOT VALID; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GradeItem_diaSemana_check') THEN ALTER TABLE "GradeItem" ADD CONSTRAINT "GradeItem_diaSemana_check" CHECK ("diaSemana" BETWEEN 1 AND 5) NOT VALID; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Escala_ano_mes_check') THEN ALTER TABLE "Escala" ADD CONSTRAINT "Escala_ano_mes_check" CHECK ("ano" BETWEEN 2000 AND 2200 AND "mes" BETWEEN 1 AND 12) NOT VALID; END IF; END $$;
ALTER TABLE "Portaria" DROP CONSTRAINT IF EXISTS "Portaria_periodo_check";
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Portaria_periodo_check') THEN ALTER TABLE "Portaria" ADD CONSTRAINT "Portaria_periodo_check" CHECK ("inicio" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND "fim" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND "inicio" <= "fim") NOT VALID; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Designacao_origem_check') THEN ALTER TABLE "Designacao" ADD CONSTRAINT "Designacao_origem_check" CHECK ("origem" IN ('AUTO','MANUAL')) NOT VALID; END IF; END $$;
