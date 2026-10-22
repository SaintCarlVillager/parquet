"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { podeEditar, useSessao } from "@/app/components/SessaoProvider";
import { httpJson, mensagemHttp } from "@/lib/http";
import { filtrarPromotores } from "@/lib/promotoresFiltros";

interface Promotor {
  id: number;
  nome: string;
  apelido: string;
  email: string | null;
  tipo: string;
  atuacao: string;
  varas: number[];
  ativo: boolean;
  generico: boolean;
  observacoes: string | null;
}

const ATUACOES = [
  { valor: "TODAS", rotulo: "Varas, auxiliares e plantão" },
  { valor: "CUSTODIA_PLANTAO", rotulo: "Custódia e Plantão (sem varas)" },
  { valor: "CUSTODIA", rotulo: "Somente Custódia" },
  { valor: "PLANTAO", rotulo: "Somente Plantão" },
];

const VARAS = [1, 2, 3, 4, 5, 6];

export default function PromotoresPage() {
  const { papel } = useSessao();
  const chefe = podeEditar(papel);
  const [lista, setLista] = useState<Promotor[]>([]);
  const [filtros, setFiltros] = useState({ tipo: "", atuacao: "", varas: [] as number[] });
  const [form, setForm] = useState<{ nome: string; apelido: string; email: string; tipo: string; atuacao: string; varas: number[]; generico: boolean; observacoes: string }>({ nome: "", apelido: "", email: "", tipo: "TITULAR", atuacao: "TODAS", varas: [], generico: false, observacoes: "" });
  const filtrados = useMemo(() => filtrarPromotores(lista, filtros), [lista, filtros]);
  const filtrosAtivos = Boolean(filtros.tipo || filtros.atuacao || filtros.varas.length);
  const opcoesTipo = [...new Set(lista.map((p) => p.tipo))].sort();
  const opcoesAtuacao = [...new Set(lista.map((p) => p.atuacao ?? "TODAS"))].sort();
  const formularioVazio = () => ({ nome: "", apelido: "", email: "", tipo: "TITULAR", atuacao: "TODAS", varas: [] as number[], generico: false, observacoes: "" });
  const [editando, setEditando] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [cargos, setCargos] = useState<{ SECRETARIO: number | null; SUBSECRETARIO: number | null }>({ SECRETARIO: null, SUBSECRETARIO: null });
  const [msgCargos, setMsgCargos] = useState("");
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async () => {
    try {
      setLista(await httpJson<Promotor[]>("/api/promotores"));
      setCargos(await httpJson<typeof cargos>("/api/cargos"));
    } catch (e) { setErro(mensagemHttp(e, "Falha ao carregar promotores")); }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar() {
    setErro("");
    setMsg("");
    const url = editando ? `/api/promotores/${editando}` : "/api/promotores";
    try { await httpJson(url, { method: editando ? "PATCH" : "POST", body: form }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    setForm(formularioVazio());
    setEditando(null);
    setMsg(editando ? "Promotor atualizado. Regenere a escala para aplicar." : "Promotor cadastrado.");
    setTimeout(() => setMsg(""), 6000);
    carregar();
  }

  async function toggleAtivo(p: Promotor) {
    try { await httpJson(`/api/promotores/${p.id}`, { method: "PATCH", body: { ativo: !p.ativo } }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    carregar();
  }

  async function toggleGenerico(p: Promotor) {
    try { await httpJson(`/api/promotores/${p.id}`, { method: "PATCH", body: { generico: !p.generico } }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    carregar();
  }

  async function excluir(p: Promotor) {
    if (!confirm(`Excluir ${p.apelido}?`)) return;
    try { await httpJson(`/api/promotores/${p.id}`, { method: "DELETE" }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    carregar();
  }

  async function salvarCargos() {
    setErro("");
    setMsgCargos("");
    try { await httpJson("/api/cargos", { method: "PUT", body: cargos }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    setMsgCargos("Cargos atualizados. Regenere a escala para aplicar os limites.");
    setTimeout(() => setMsgCargos(""), 6000);
    carregar();
  }

  return (
    <div>
      <h2 data-tour="promotores-titulo">Promotores</h2>
      {erro && <p className="erro">{erro}</p>}
      {msg && <p className="sucesso">{msg}</p>}
      <div className="linha no-print" style={{ marginBottom: 14 }}>
        <button className="btn secundario" onClick={() => window.print()}>Imprimir / PDF</button>
      </div>
      <p className="muted print-resumo">{`${filtrosAtivos ? `Filtros aplicados — Tipo: ${filtros.tipo || "Todos"} | Atuação: ${ATUACOES.find((a) => a.valor === filtros.atuacao)?.rotulo ?? "Todas"} | Varas: ${filtros.varas.length ? filtros.varas.map((vara) => `${vara}ª`).join(", ") : "Todas"}` : "Todos os promotores"} · ${filtrados.length} resultado(s)`}</p>
      <div className="panel no-print filtros-promotores">
        <div className="campo">
          <label htmlFor="filtro-tipo">Tipo</label>
          <select id="filtro-tipo" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}>
            <option value="">Todos</option>
            {opcoesTipo.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="filtro-atuacao">Atuação</label>
          <select id="filtro-atuacao" value={filtros.atuacao} onChange={(e) => setFiltros({ ...filtros, atuacao: e.target.value })}>
            <option value="">Todas</option>
            {opcoesAtuacao.map((atuacao) => <option key={atuacao} value={atuacao}>{ATUACOES.find((a) => a.valor === atuacao)?.rotulo ?? atuacao}</option>)}
          </select>
        </div>
        <fieldset className="campo filtro-varas">
          <legend>Varas</legend>
          <div className="filtro-varas-opcoes">
            {VARAS.map((vara) => (
              <label key={vara}>
                <input type="checkbox" checked={filtros.varas.includes(vara)} onChange={() => setFiltros({ ...filtros, varas: filtros.varas.includes(vara) ? filtros.varas.filter((x) => x !== vara) : [...filtros.varas, vara] })} />
                {vara}ª
              </label>
            ))}
          </div>
        </fieldset>
        <span className="muted">{filtrados.length} de {lista.length} promotor(es)</span>
        {filtrosAtivos && <button className="btn mini secundario" onClick={() => setFiltros({ tipo: "", atuacao: "", varas: [] })}>Limpar filtros</button>}
      </div>
      {chefe ? (
        <div className="panel no-print">
          <h3 style={{ marginTop: 0 }}>Cargo administrativo</h3>
          <p className="muted" style={{ marginTop: -6 }}>
            O Secretário faz no máximo 1 audiência por semana. Na ausência dele (portaria), o Sub-secretário
            assume a função (1 audiência/semana) e o cobridor da portaria fica com as demais funções do cargo,
            sem esse limite.
          </p>
          {msgCargos && <p className="sucesso">{msgCargos}</p>}
          <div className="linha">
            <div className="campo">
              <label>PJ Secretário</label>
              <select
                value={cargos.SECRETARIO ?? ""}
                onChange={(e) => setCargos({ ...cargos, SECRETARIO: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">—</option>
                {lista.filter((p) => p.ativo && p.id !== cargos.SUBSECRETARIO).map((p) => (
                  <option key={p.id} value={p.id}>{p.apelido} — {p.nome}</option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label>PJ Sub-secretário</label>
              <select
                value={cargos.SUBSECRETARIO ?? ""}
                onChange={(e) => setCargos({ ...cargos, SUBSECRETARIO: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">—</option>
                {lista.filter((p) => p.ativo && p.id !== cargos.SECRETARIO).map((p) => (
                  <option key={p.id} value={p.id}>{p.apelido} — {p.nome}</option>
                ))}
              </select>
            </div>
            <button className="btn" onClick={salvarCargos}>Salvar cargos</button>
          </div>
        </div>
      ) : (
        <div className="panel no-print">
          <h3 style={{ marginTop: 0 }}>Cargo administrativo</h3>
          <div className="linha">
            <div className="campo">
              <label>PJ Secretário</label>
              <div style={{ paddingTop: 6 }}>
                {(() => {
                  const p = lista.find((x) => x.id === cargos.SECRETARIO);
                  return p ? <><strong>{p.apelido}</strong> — {p.nome}</> : <em className="muted">—</em>;
                })()}
              </div>
            </div>
            <div className="campo">
              <label>PJ Sub-secretário</label>
              <div style={{ paddingTop: 6 }}>
                {(() => {
                  const p = lista.find((x) => x.id === cargos.SUBSECRETARIO);
                  return p ? <><strong>{p.apelido}</strong> — {p.nome}</> : <em className="muted">—</em>;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      {chefe && (
      <div className="panel no-print">
        <div className="linha">
          <div className="campo">
            <label>Nome completo</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} size={40} />
          </div>
          <div className="campo">
            <label>Apelido (na escala)</label>
            <input value={form.apelido} onChange={(e) => setForm({ ...form, apelido: e.target.value })} />
          </div>
          <div className="campo">
            <label>E-mail</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} size={30} />
          </div>
          <div className="campo">
            <label>Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="TITULAR">Titular</option>
              <option value="AUXILIAR">Auxiliar</option>
              <option value="REGIONAL">Regional</option>
              <option value="SUBSTITUTO">Substituto</option>
            </select>
          </div>
          <div className="campo">
            <label>Atuação</label>
            <select value={form.atuacao} onChange={(e) => setForm({ ...form, atuacao: e.target.value })}>
              {ATUACOES.map((a) => (
                <option key={a.valor} value={a.valor}>{a.rotulo}</option>
              ))}
            </select>
          </div>
          <button className="btn" onClick={salvar} data-tour="promotores-novo">
            {editando ? "Salvar alterações" : "Adicionar"}
          </button>
          {editando && (
            <button className="btn secundario" onClick={() => { setEditando(null); setForm(formularioVazio()); }}>
              Cancelar
            </button>
          )}
        </div>
        <div className="campo" style={{ marginTop: 4 }}>
          <label>Varas de atuação em audiências (deixe todas desmarcadas para atuar em qualquer vara)</label>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {VARAS.map((v) => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 0, color: "var(--text)" }}>
                <input
                  type="checkbox"
                  checked={form.varas.includes(v)}
                  onChange={() =>
                    setForm({
                      ...form,
                      varas: form.varas.includes(v) ? form.varas.filter((x) => x !== v) : [...form.varas, v],
                    })
                  }
                />
                {v}ª Vara
              </label>
            ))}
          </div>
        </div>
        <div className="campo" style={{ marginTop: 8 }}>
          <label htmlFor="promotor-observacoes">Observações (máximo de 2.000 caracteres)</label>
          <textarea id="promotor-observacoes" rows={3} maxLength={2000} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
        </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontWeight: "normal", color: "var(--text)" }} title="Placeholder de função (ex.: PJS/PJE): pode acumular posições no mesmo dia e não se aplica à regra de dias consecutivos">
            <input
              type="checkbox"
              checked={form.generico}
              onChange={(e) => setForm({ ...form, generico: e.target.checked })}
            />
            Cargo/função genérico (placeholder)
          </label>
      </div>
      )}

      <div className="panel" data-tour="promotores-lista">
        <table>
          <thead>
            <tr>
              <th>Apelido</th>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Tipo</th>
              <th>Atuação</th>
              <th>Varas</th>
              <th>Observações</th>
              <th>Ativo</th>
              {chefe && <th className="no-print"></th>}
            </tr>
          </thead>
          <tbody>
            {(["TITULAR", "AUXILIAR", "REGIONAL", "SUBSTITUTO"] as const).map((tipo) => {
              const doTipo = filtrados
                .filter((p) => p.tipo === tipo)
                .sort((a, b) => a.apelido.localeCompare(b.apelido));
              if (doTipo.length === 0) return null;
              const rotulo =
                tipo === "TITULAR" ? "Titulares" : tipo === "AUXILIAR" ? "Auxiliares" : tipo === "REGIONAL" ? "Regionais" : "Substitutos";
              return [
                <tr key={`tipo-${tipo}`} className="linha-tipo">
                  <td colSpan={chefe ? 9 : 8}>
                    <strong>{rotulo}</strong> <span className="muted">({doTipo.length})</span>
                  </td>
                </tr>,
                ...doTipo.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.apelido}</strong></td>
                    <td>{p.nome}</td>
                    <td>{p.email}</td>
                    <td>{p.tipo}</td>
                    <td>{ATUACOES.find((a) => a.valor === (p.atuacao ?? "TODAS"))?.rotulo ?? p.atuacao}</td>
                    <td>{!p.varas || p.varas.length === 0 ? "Todas" : [...p.varas].sort((a, b) => a - b).map((v) => `${v}ª`).join(", ")}</td>
                    <td className="observacoes-promotor">{p.observacoes}</td>
                    <td>{p.ativo ? "Sim" : "Não"}</td>
                    {chefe && (
                      <td className="no-print">
                        <button className="btn mini secundario" onClick={() => { setEditando(p.id); setForm({ nome: p.nome, apelido: p.apelido, email: p.email ?? "", tipo: p.tipo, atuacao: p.atuacao ?? "TODAS", varas: p.varas ?? [], generico: p.generico ?? false, observacoes: p.observacoes ?? "" }); }}>
                          Editar
                        </button>{" "}
                        <button className="btn mini secundario" onClick={() => toggleGenerico(p)} title="Placeholder de função: pode acumular posições no mesmo dia e não se aplica à regra de dias consecutivos">
                          {p.generico ? "Genérico ✓" : "Genérico"}
                        </button>{" "}
                        <button className="btn mini secundario" onClick={() => toggleAtivo(p)}>
                          {p.ativo ? "Desativar" : "Ativar"}
                        </button>{" "}
                        <button className="btn mini perigo" onClick={() => excluir(p)}>
                          Excluir
                        </button>
                      </td>
                    )}
                  </tr>
                )),
              ];
            })}
            {filtrados.length === 0 && <tr><td colSpan={chefe ? 9 : 8}>Nenhum promotor encontrado com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
