"use client";

import { useCallback, useEffect, useState } from "react";
import { formatarDataBR } from "@/lib/datas";
import { podeEditar, useSessao } from "@/app/components/SessaoProvider";
import { httpJson, mensagemHttp } from "@/lib/http";

interface Feriado { id: number; data: string; nome: string }

export default function FeriadosView() {
  const { papel } = useSessao();
  const chefe = podeEditar(papel);
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [lista, setLista] = useState<Feriado[]>([]);
  const [form, setForm] = useState({ data: "", nome: "" });
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try { setLista(await httpJson<Feriado[]>(`/api/feriados?ano=${ano}`)); }
    catch (e) { setErro(mensagemHttp(e, "Falha ao carregar feriados")); }
  }, [ano]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    setErro("");
    try { await httpJson("/api/feriados", { method: "POST", body: { ...form, ano } }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    setForm({ data: "", nome: "" });
    carregar();
  }

  async function excluir(f: Feriado) {
    if (!confirm(`Excluir feriado ${formatarDataBR(f.data)}?`)) return;
    try { await httpJson(`/api/feriados/${f.id}`, { method: "DELETE" }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    carregar();
  }

  return (
    <div>
      <h2 data-tour="feriados-titulo">Feriados</h2>
      {erro && <p className="erro">{erro}</p>}
      <div className="panel">
        <div className="linha">
          <div className="campo">
            <label>Ano</label>
            <select value={ano} onChange={(e) => { setAno(Number(e.target.value)); setForm({ data: "", nome: "" }); }}>
              {[anoAtual - 1, anoAtual, anoAtual + 1].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>
      {chefe && (
        <div className="panel">
          <div className="linha">
            <div className="campo">
              <label>Data</label>
              <input type="date" min={`${ano}-01-01`} max={`${ano}-12-31`} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="campo">
              <label>Descrição</label>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} size={40} />
            </div>
            <button className="btn" onClick={salvar} data-tour="feriados-novo">Adicionar</button>
          </div>
        </div>
      )}
      <div className="panel">
        <table>
          <thead>
            <tr><th>Data</th><th>Descrição</th>{chefe && <th></th>}</tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.id}>
                <td>{formatarDataBR(f.data)}</td>
                <td>{f.nome}</td>
                {chefe && (
                  <td>
                    <button className="btn mini perigo" onClick={() => excluir(f)}>Excluir</button>
                  </td>
                )}
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={chefe ? 3 : 2} className="muted">Nenhum feriado cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
