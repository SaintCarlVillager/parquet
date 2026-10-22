export function promotorLogadoId<P extends { id: number; apelido: string; email: string | null }>(
  promotores: P[],
  email: string
): number | null {
  if (!email) return null;
  const norm = email.trim().toLowerCase();
  const local = norm.split("@")[0];
  const porEmail = promotores.find((p) => (p.email ?? "").trim().toLowerCase() === norm);
  if (porEmail) return porEmail.id;
  return promotores.find((p) => p.apelido.trim().toLowerCase() === local)?.id ?? null;
}
