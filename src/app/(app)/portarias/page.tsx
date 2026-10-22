"use client";

import { useEffect, useMemo, useState } from "react";
import { formatarDataBR, MODALIDADES_PORTARIA, MESES } from "@/lib/datas";
import { podeEditar, useSessao } from "@/app/components/SessaoProvider";
import { httpJson, mensagemHttp } from "@/lib/http";

const ROTULO_MODALIDADE: Record<string, string> = {
  DESIGNADO: "Designado",
  ACUMULACAO: "Acumulação",
  AUXILIO: "Auxílio",
};

interface PromotorSel { id: number; apelido: string; nome: string }
interface Portaria {
  id: number;
  numero: string | null;
  promotorAfastadoId: number;
  promotorAfastado: PromotorSel;
  promotorCobridorId: number | null;
  promotorCobridor: PromotorSel | null;
  modalidade: string;
  inicio: string;
  fim: string;
  observacao: string | null;
}

const FORM_VAZIO = { id: null as number | null, numero: "", promotorAfastadoId: "", promotorCobridorId: "", modalidade: "DESIGNADO", inicio: "", fim: "", observacao: "" };

export default function PortariasPage() {
  const { papel } = useSessao();
  const chefe = podeEditar(papel);
  const [portarias, setPortarias] = useState<Portaria[]>([]);
  const [promotores, setPromotores] = useState<PromotorSel[]>([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  async function carregar() {
    setCarregando(true);
    try {
      const data = await httpJson<{ portarias: Portaria[]; promotores: PromotorSel[] }>("/api/portarias");
      setPortarias(data.portarias);
      setPromotores(data.promotores);
    } catch (e) {
      setErro(mensagemHttp(e, "Erro ao carregar portarias."));
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { carregar(); }, []);

  const gruposMes = useMemo(() => {
    const numeroDe = (n: string | null) => {
      const m = n ? /\d+/.exec(n) : null;
      return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER;
    };
    const mapa = new Map<string, Portaria[]>();
    for (const p of portarias) {
      const chave = p.inicio.slice(0, 7);
      const lista = mapa.get(chave) ?? [];
      lista.push(p);
      mapa.set(chave, lista);
    }
    return [...mapa.keys()]
      .sort()
      .map((chave) => ({
        chave,
        nome: `${MESES[Number(chave.slice(5, 7)) - 1]}/${chave.slice(0, 4)}`,
        lista: mapa.get(chave)!.sort(
          (a, b) => numeroDe(a.numero) - numeroDe(b.numero) || a.inicio.localeCompare(b.inicio) || a.id - b.id
        ),
      }));
  }, [portarias]);

  async function salvar() {
    setErro("");
    setMsg("");
    const url = form.id ? `/api/portarias/${form.id}` : "/api/portarias";
    try { await httpJson(url, { method: form.id ? "PUT" : "POST", body: form }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    setMsg(form.id ? "Portaria atualizada. Regenere a escala para aplicar." : "Portaria lançada. Regenere a escala para aplicar.");
    setTimeout(() => setMsg(""), 5000);
    setForm(FORM_VAZIO);
    carregar();
  }

  function editar(p: Portaria) {
    setForm({
      id: p.id,
      numero: p.numero ?? "",
      promotorAfastadoId: String(p.promotorAfastadoId),
      promotorCobridorId: p.promotorCobridorId ? String(p.promotorCobridorId) : "",
      modalidade: p.modalidade,
      inicio: p.inicio,
      fim: p.fim,
      observacao: p.observacao ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluir(p: Portaria) {
    if (!confirm(`Excluir a portaria de cobertura de ${p.promotorAfastado.apelido}?`)) return;
    try { await httpJson(`/api/portarias/${p.id}`, { method: "DELETE" }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    if (form.id === p.id) setForm(FORM_VAZIO);
    carregar();
  }

  return (
    <div>
      <h2 data-tour="portarias-titulo">Portarias de cobertura</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Registre a portaria que designa quem cobre o promotor afastado, e como (Designado, Acumulação ou Auxílio).
        No período, o promotor afastado sai da escala e quem cobre passa a poder atuar nas varas dele.
      </p>
      {erro && <p className="erro">{erro}</p>}
      {msg && <p className="ok">{msg}</p>}

      <div className="linha no-print" style={{ marginBottom: 14 }}>
        <button className="btn secundario" onClick={() => window.print()}>Imprimir / PDF</button>
      </div>

      {chefe && (
      <div className="panel no-print">
        <h3 style={{ marginTop: 0 }}>{form.id ? "Editar portaria" : "Nova portaria"}</h3>
        <div className="linha">
          <div className="campo">
            <label>Nº da portaria (opcional)</label>
            <input value={form.numero} size={18} placeholder="Ex.: RT 123/2026" onChange={(e) => setForm({ ...form, numero: e.target.value })} />
          </div>
          <div className="campo">
            <label>Promotor afastado</label>
            <select value={form.promotorAfastadoId} onChange={(e) => setForm({ ...form, promotorAfastadoId: e.target.value })}>
              <option value="">Selecione…</option>
              {promotores.map((p) => <option key={p.id} value={p.id}>{p.apelido} — {p.nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label>Quem cobre</label>
            <select value={form.promotorCobridorId} onChange={(e) => setForm({ ...form, promotorCobridorId: e.target.value })}>
              <option value="">— (sem designado)</option>
              {promotores.filter((p) => String(p.id) !== form.promotorAfastadoId).map((p) => (
                <option key={p.id} value={p.id}>{p.apelido} — {p.nome}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Modalidade</label>
            <select value={form.modalidade} onChange={(e) => setForm({ ...form, modalidade: e.target.value })}>
              {MODALIDADES_PORTARIA.map((m) => <option key={m} value={m}>{ROTULO_MODALIDADE[m] ?? m}</option>)}
            </select>
          </div>
        </div>
        <div className="linha">
          <div className="campo">
            <label>Início</label>
            <input type="date" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
          </div>
          <div className="campo">
            <label>Fim</label>
            <input type="date" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} />
          </div>
          <div className="campo">
            <label>Observação (opcional)</label>
            <input value={form.observacao} size={30} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          <button className="btn" onClick={salvar} data-tour="portarias-nova">{form.id ? "Salvar alterações" : "Lançar"}</button>
          {form.id && <button className="btn secundario" onClick={() => setForm(FORM_VAZIO)}>Cancelar</button>}
        </div>
      </div>
      )}

      {carregando && <div className="panel"><p className="muted" style={{ margin: 0 }}>Carregando portarias…</p></div>}
      {!carregando && gruposMes.length === 0 && (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>Nenhuma portaria lançada.</p>
        </div>
      )}
      {gruposMes.map((g) => (
        <div className="panel" key={g.chave} data-tour="portarias-lista">
          <h3 style={{ marginTop: 0 }}>{g.nome}</h3>
          <table>
            <thead>
              <tr>
                <th>Portaria</th>
                <th>Período</th>
                <th>Afastado</th>
                <th>Quem cobre</th>
                <th>Modalidade</th>
                <th>Observação</th>
                {chefe && <th className="no-print"></th>}
              </tr>
            </thead>
            <tbody>
              {g.lista.map((p) => (
                <tr key={p.id}>
                  <td>{p.numero ?? <em className="muted">—</em>}</td>
                  <td>{formatarDataBR(p.inicio)} a {formatarDataBR(p.fim)}</td>
                  <td><strong>{p.promotorAfastado.apelido}</strong> <span className="muted">{p.promotorAfastado.nome}</span></td>
                  <td>
                    {p.promotorCobridor
                      ? <><strong>{p.promotorCobridor.apelido}</strong> <span className="muted">{p.promotorCobridor.nome}</span></>
                      : <em className="muted">sem designado</em>}
                  </td>
                  <td>{ROTULO_MODALIDADE[p.modalidade] ?? p.modalidade}</td>
                  <td className="muted">{p.observacao}</td>
                  {chefe && (
                    <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                      <button className="btn mini secundario" onClick={() => editar(p)}>Editar</button>{" "}
                      <button className="btn mini perigo" onClick={() => excluir(p)}>Excluir</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
