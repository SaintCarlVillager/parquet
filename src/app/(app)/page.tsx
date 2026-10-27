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
      <h2 className="page-titulo" data-tour="/-titulo">Dashboard</h2>
      <div className="cards" aria-label="Resumo">
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
        <h3 className="painel-titulo">{chefe ? "Comece por aqui" : "Atalhos"}</h3>
        {chefe ? (
          <ol className="atalhos-lista">
            <li>
              Confira o cadastro de <Link href="/promotores">promotores</Link> e{" "}
              <Link href="/grade">grade de posições</Link>.
            </li>
            <li>
              Lance <Link href="/portarias">portarias de cobertura</Link> e <Link href="/feriados">feriados</Link>.
            </li>
            <li>
              Gere a <Link href="/escala">escala mensal</Link>, ajuste manualmente e publique.
            </li>
          </ol>
        ) : (
          <p>
            Consulte a <Link href="/escala">escala mensal</Link>, a <Link href="/custodia">custódia</Link> e as{" "}
            <Link href="/portarias">portarias de cobertura</Link>.
          </p>
        )}
      </div>

      <div className="panel">
        <h3 className="painel-titulo">Escalas recentes</h3>
        {escalas.length === 0 ? (
          <p className="muted">Nenhuma escala gerada ainda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Status</th>
                <th>Designações</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {escalas.map((e) => (
                <tr key={e.id}>
                  <td className="num">{String(e.mes).padStart(2, "0")}/{e.ano}</td>
                  <td><span className={`badge ${e.status}`}>{e.status}</span></td>
                  <td className="num">{e._count.designacoes}</td>
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
