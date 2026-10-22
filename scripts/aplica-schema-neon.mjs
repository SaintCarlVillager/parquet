import fs from "fs";
import { Pool } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL_UNPOOLED;
const pool = new Pool({ connectionString: url });
const script = fs.readFileSync("prisma/schema-neon.sql", "utf8");
const stmts = script
  .split(/;\s*\r?\n/)
  .map((s) => s.replace(/--[^\n]*/g, "").trim())
  .filter((s) => s.length > 0);
console.log("statements:", stmts.length);
let falhas = 0;
for (const s of stmts) {
  const head = s.replace(/\s+/g, " ").slice(0, 55);
  try {
    await pool.query(s);
    console.log("ok :", head);
  } catch (e) {
    if (/already exists|ja existe/.test(e.message)) {
      console.log("ok :", head, "(ja existente)");
      continue;
    }
    falhas++;
    console.log("FALHA:", head, "|", e.message);
  }
}
await pool.end();
console.log(falhas === 0 ? "SCHEMA APLICADO" : falhas + " falhas");
