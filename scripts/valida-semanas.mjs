function parseISODate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function diaSemana(iso) { return parseISODate(iso).getDay(); }
function diasDoMes(ano, mes) { const n = new Date(ano, mes, 0).getDate(); const out = []; for (let d = 1; d <= n; d++) out.push(`${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`); return out; }

for (const [ano, mes] of [[2026, 9], [2026, 11], [2027, 2]]) {
  const dias = diasDoMes(ano, mes);
  const primeiro = diaSemana(dias[0]);
  const inicio = parseISODate(dias[0]);
  inicio.setDate(inicio.getDate() - ((primeiro + 6) % 7));
  const semanas = [];
  let atual = [];
  const cursor = new Date(inicio);
  for (let i = 0; i < 42; i++) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    atual.push(iso);
    if (atual.length === 7) {
      semanas.push(atual);
      atual = [];
      if (iso >= dias[dias.length - 1]) break;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  const segundas = semanas.map((s) => s[0]);
  const okSeg = segundas.every((iso) => parseISODate(iso).getDay() === 1);
  const uteis = semanas.flatMap((s) => s.slice(0, 5)).filter((iso) => dias.includes(iso));
  console.log(`${mes}/${ano}: ${semanas.length} semanas, semanas começam na 2ª: ${okSeg}, dias úteis cobertos: ${uteis.length}/${dias.length} (faltando: ${dias.filter((d) => !uteis.includes(d)).join(",") || "nenhum"})`);
}
