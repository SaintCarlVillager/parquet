export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const MODALIDADES_PORTARIA = ["DESIGNADO", "ACUMULACAO", "AUXILIO"];

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function diaSemana(iso: string): number {
  return parseISODate(iso).getDay();
}

export function segundaDe(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISODate(d);
}

export function diasDoMes(ano: number, mes: number): string[] {
  const n = new Date(ano, mes, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= n; d++) out.push(toISODate(new Date(ano, mes - 1, d)));
  return out;
}

function diaUtilNoMes(iso: string, ano: number, mes: number): boolean {
  const d = parseISODate(iso);
  return d.getFullYear() === ano && d.getMonth() + 1 === mes;
}

export function semanasDoMes(ano: number, mes: number): string[][] {
  const dias = diasDoMes(ano, mes);
  if (dias.length === 0) return [];
  const primeiro = diaSemana(dias[0]);
  const inicio = parseISODate(dias[0]);
  inicio.setDate(inicio.getDate() - ((primeiro + 6) % 7));
  const semanas: string[][] = [];
  let atual: string[] = [];
  const cursor = new Date(inicio);
  for (let i = 0; i < 42; i++) {
    const iso = toISODate(cursor);
    atual.push(iso);
    if (atual.length === 7) {
      semanas.push(atual);
      atual = [];
      if (iso >= dias[dias.length - 1]) break;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return semanas.filter((semana) =>
    semana.slice(0, 5).some((iso) => diaUtilNoMes(iso, ano, mes))
  );
}

export function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
