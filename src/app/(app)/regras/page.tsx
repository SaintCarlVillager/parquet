"use client";

import { useEffect, useState } from "react";
import { DIAS_SEMANA } from "@/lib/datas";
import { podeEditar, useSessao } from "@/app/components/SessaoProvider";
import { httpJson, mensagemHttp } from "@/lib/http";

interface PromotorVinc {
  id: number;
  apelido: string;
  nome: string;
  ativo: boolean;
}

interface Regra {
  id: number;
  nome: string;
  tipo: string;
  diasCsv: string;
  gruposCsv: string;
  promotores: { promotor: PromotorVinc }[];
}

const GRUPOS = [
  { chave: "CUSTODIA", nome: "Custódia" },
  { chave: "AUDIENCIAS", nome: "Audiências (varas)" },
  { chave: "PLANTAO", nome: "Plantão" },
];

const DIAS_ORDEM = [1, 2, 3, 4, 5, 6, 0];

function resumoRegra(r: Regra): string {
  const dias = r.diasCsv
    .split(",")
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .map((d) => DIAS_SEMANA[d]);
  const txt =
    (r.tipo === "EXCETO" ? "Exceto " : "Somente ") +
    dias.map((d) => d.slice(0, 3)).join(", ");
  const grupos = r.gruposCsv ? r.gruposCsv.split(",").map((g) => GRUPOS.find((x) => x.chave === g)?.nome ?? g).join(", ") : "todos os grupos";
  return `${txt} · ${grupos}`;
}

export default function RegrasPage() {
  const { papel } = useSessao();
  const chefe = podeEditar(papel);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [promotores, setPromotores] = useState<PromotorVinc[]>([]);
  const [form, setForm] = useState<{ id: number | null; nome: string; tipo: string; dias: number[]; grupos: string[]; promotoresIds: number[] }>({
    id: null,
    nome: "",
    tipo: "SOMENTE",
    dias: [],
    grupos: [],
    promotoresIds: [],
  });
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  async function carregar() {
    try {
      setRegras(await httpJson<Regra[]>("/api/regras"));
      const ps = await httpJson<PromotorVinc[]>("/api/promotores");
      setPromotores(ps.filter((p) => p.ativo));
    } catch (e) { setErro(mensagemHttp(e, "Falha ao carregar regras")); }
  }
  useEffect(() => { carregar(); }, []);

  function toggle<T>(lista: T[], v: T): T[] {
    return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];
  }

  async function salvar() {
    setErro("");
    setMsg("");
    const url = form.id ? `/api/regras/${form.id}` : "/api/regras";
    try { await httpJson(url, { method: form.id ? "PUT" : "POST", body: {
        nome: form.nome,
        tipo: form.tipo,
        dias: form.dias,
        grupos: form.grupos,
        promotoresIds: form.promotoresIds,
    }}); } catch (e) { setErro(mensagemHttp(e)); return; }
    setMsg(form.id ? "Regra atualizada. Regenere a escala para aplicar." : "Regra criada. Regenere a escala para aplicar.");
    setTimeout(() => setMsg(""), 5000);
    setForm({ id: null, nome: "", tipo: "SOMENTE", dias: [], grupos: [], promotoresIds: [] });
    carregar();
  }

  function editar(r: Regra) {
    setForm({
      id: r.id,
      nome: r.nome,
      tipo: r.tipo,
      dias: r.diasCsv.split(",").map(Number),
      grupos: r.gruposCsv ? r.gruposCsv.split(",") : [],
      promotoresIds: r.promotores.map((pv) => pv.promotor.id),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluir(r: Regra) {
    if (!confirm(`Excluir a regra "${r.nome}"?`)) return;
    try { await httpJson(`/api/regras/${r.id}`, { method: "DELETE" }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    if (form.id === r.id) setForm({ id: null, nome: "", tipo: "SOMENTE", dias: [], grupos: [], promotoresIds: [] });
    carregar();
  }

  return (
    <div>
      <h2 data-tour="regras-titulo">Regras</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Regras reutilizáveis de dias da semana, aplicadas por grupo de posições. Vincule cada regra a um ou mais
        promotores; elas restringem a geração automática e a edição manual (promotores SUBSTITUTO não as recebem).
      </p>
      {erro && <p className="erro">{erro}</p>}
      {msg && <p className="ok">{msg}</p>}

      <div className="linha no-print" style={{ marginBottom: 14 }}>
        <button className="btn secundario" onClick={() => window.print()}>Imprimir / PDF</button>
      </div>

      {chefe && (
      <div className="panel no-print">
        <h3 style={{ marginTop: 0 }}>{form.id ? "Editar regra" : "Nova regra"}</h3>
        <div className="linha">
          <div className="campo">
            <label>Nome</label>
            <input
              value={form.nome}
              size={36}
              placeholder="Ex.: Varas somente ter/qui"
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div className="campo">
            <label>Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="SOMENTE">Somente nestes dias</option>
              <option value="EXCETO">Exceto nestes dias</option>
            </select>
          </div>
        </div>
        <div className="campo" style={{ marginBottom: 12 }}>
          <label>Dias da semana</label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {DIAS_ORDEM.map((d) => (
              <label key={d} style={{ display: "flex", gap: 4, alignItems: "center", fontWeight: "normal" }}>
                <input
                  type="checkbox"
                  checked={form.dias.includes(d)}
                  onChange={() => setForm({ ...form, dias: toggle(form.dias, d) })}
                />
                {DIAS_SEMANA[d]}
              </label>
            ))}
          </div>
        </div>
        <div className="campo" style={{ marginBottom: 12 }}>
          <label>Grupos afetados {form.grupos.length === 0 && <em className="muted">(nenhum marcado = todos)</em>}</label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {GRUPOS.map((g) => (
              <label key={g.chave} style={{ display: "flex", gap: 4, alignItems: "center", fontWeight: "normal" }}>
                <input
                  type="checkbox"
                  checked={form.grupos.includes(g.chave)}
                  onChange={() => setForm({ ...form, grupos: toggle(form.grupos, g.chave) })}
                />
                {g.nome}
              </label>
            ))}
          </div>
        </div>
        <div className="campo" style={{ marginBottom: 12 }}>
          <label>Promotores vinculados</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", maxHeight: 180, overflowY: "auto", border: "1px solid var(--borda)", padding: 10, borderRadius: 6 }}>
            {promotores.map((p) => (
              <label key={p.id} style={{ display: "flex", gap: 4, alignItems: "center", fontWeight: "normal" }} title={p.nome}>
                <input
                  type="checkbox"
                  checked={form.promotoresIds.includes(p.id)}
                  onChange={() => setForm({ ...form, promotoresIds: toggle(form.promotoresIds, p.id) })}
                />
                {p.apelido}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={salvar} data-tour="regras-nova">{form.id ? "Salvar alterações" : "Criar regra"}</button>
          {form.id && (
            <button
              className="btn secundario"
              onClick={() => setForm({ id: null, nome: "", tipo: "SOMENTE", dias: [], grupos: [], promotoresIds: [] })}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
      )}

      <div className="panel" data-tour="regras-lista">
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Regra</th>
              <th style={{ textAlign: "left" }}>Condição</th>
              <th style={{ textAlign: "left" }}>Promotores vinculados</th>
              {chefe && <th className="no-print"></th>}
            </tr>
          </thead>
          <tbody>
            {regras.length === 0 && (
              <tr><td colSpan={chefe ? 4 : 3} className="muted">Nenhuma regra cadastrada.</td></tr>
            )}
            {regras.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.nome}</strong></td>
                <td className="muted">{resumoRegra(r)}</td>
                <td>
                  {r.promotores.length === 0
                    ? <em className="muted">nenhum</em>
                    : r.promotores.map((pv) => pv.promotor.apelido).join(", ")}
                </td>
                {chefe && (
                  <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn mini secundario" onClick={() => editar(r)}>Editar</button>{" "}
                    <button className="btn mini perigo" onClick={() => excluir(r)}>Excluir</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
