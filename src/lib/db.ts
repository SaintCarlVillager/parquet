import { PrismaClient } from "@prisma/client";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function criar(): PrismaClient {
  const producao = process.env.VERCEL_ENV === "production";
  const url = producao ? process.env.DATABASE_URL_PRODUCAO : process.env.DATABASE_URL;
  if (!url) {
    throw new Error(producao ? "DATABASE_URL_PRODUCAO nao configurada" : "DATABASE_URL nao configurada");
  }
  const adapter = new PrismaNeonHTTP(url, {});
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? criar();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
