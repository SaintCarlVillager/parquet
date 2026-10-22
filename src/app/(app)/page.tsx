import Link from "next/link";
import { db } from "@/lib/db";
import { papelAtual } from "@/lib/auth";
import ExcluirEscalaBotao from "@/app/components/ExcluirEscalaBotao";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const papel = await papelAtual();
  const chefe = papel === "CHEFE";
  const hoje = new Date().toISOString().slice(0, 10);
  const [promotores, emCobertura, escalas] = await Promise.all([
    db.promotor.count({ where: { ativo: true } }),
    db.portaria.findMany({
      where: { inicio: { lte: hoje }, fim: { gte: hoje } },
      include: { promotorAfastado: true, promotorCobridor: true },
      orderBy: { inicio: "asc" },
    }),
    db.escala.findMany({ orderBy: [{ ano: "desc" }, { mes: "desc" }], take: 6, include: { _count: { select: { designacoes: true } } } }),
  ]);

  return (
    <div>
      <h2 data-tour="/-titulo">Dashboard</h2>
      <div className="cards">
        <div className="card">
          <div className="valor">{promotores}</div>
          <div className="rotulo">Promotores ativos</div>
        </div>
        <div className="card">
          <div className="valor">{emCobertura.length}</div>
          <div className="rotulo">Em cobertura hoje</div>
        </div>
        <div className="card">
          <div className="valor">{escalas.length}</div>
          <div className="rotulo">Escalas cadastradas</div>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>{chefe ? "Comece por aqui" : "Atalhos"}</h3>
        {chefe ? (
          <p>
            1. Confira o cadastro de <Link href="/promotores">promotores</Link> e{" "}
            <Link href="/grade">grade de posições</Link>.<br />
            2. Lance <Link href="/portarias">portarias de cobertura</Link> e <Link href="/feriados">feriados</Link>.<br />
            3. Gere a <Link href="/escala">escala mensal</Link>, ajuste manualmente e publique.
          </p>
        ) : (
          <p>
            Consulte a <Link href="/escala">escala mensal</Link>, a <Link href="/custodia">custódia</Link> e as{" "}
            <Link href="/portarias">portarias de cobertura</Link>.
          </p>
        )}
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Escalas recentes</h3>
        {escalas.length === 0 ? (
          <p className="muted">Nenhuma escala gerada ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Status</th>
                <th>Designações</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {escalas.map((e) => (
                <tr key={e.id}>
                  <td>{String(e.mes).padStart(2, "0")}/{e.ano}</td>
                  <td><span className={`badge ${e.status}`}>{e.status}</span></td>
                  <td>{e._count.designacoes}</td>
                  <td>
                    <Link href={`/escala?mes=${e.mes}&ano=${e.ano}`}>Abrir</Link>{" "}
                    {chefe && <ExcluirEscalaBotao id={e.id} rotulo={`${String(e.mes).padStart(2, "0")}/${e.ano}`} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
