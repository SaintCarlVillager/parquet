"use client";

import { useCallback, useEffect, useState } from "react";
import { httpJson, mensagemHttp } from "@/lib/http";

type Usuario = { email: string; nome: string | null; papel: "CHEFE" | "OFICIAL" | "PROMOTOR"; temSenha: boolean; oficialEmail: string | null };
type Oficial = { email: string; nome: string | null };

const PAPEIS: { v: Usuario["papel"]; rotulo: string; descricao: string }[] = [
  { v: "CHEFE", rotulo: "Oficial de Promotoria Chefe", descricao: "Acesso total, incluindo cadastros e usuários" },
  { v: "OFICIAL", rotulo: "Oficial de Promotoria", descricao: "Consulta todas as telas e lança trocas do próprio promotor" },
  { v: "PROMOTOR", rotulo: "Promotor de Justiça", descricao: "Consulta Dashboard, Escala, Custódia, Promotores, Regras e Portarias" },
];

const FORM_VAZIO = { email: "", nome: "", papel: "PROMOTOR" as Usuario["papel"], senha: "", oficialEmail: "" };

export default function UsuariosView() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [oficiais, setOficiais] = useState<Oficial[]>([]);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const j = await httpJson<{ usuarios?: Usuario[]; oficiais?: Oficial[] }>("/api/usuarios");
      setUsuarios(j.usuarios ?? []);
      setOficiais(j.oficiais ?? []);
    } catch (e) { setErro(mensagemHttp(e, "Falha ao carregar usuários")); }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setMsg("");
    try {
      await httpJson("/api/usuarios", { method: "PUT", body: {
        email: form.email,
        nome: form.nome || null,
        papel: form.papel,
        senha: form.senha || null,
        oficialEmail: form.oficialEmail || null,
      }});
    } catch (e) { setErro(mensagemHttp(e, "Falha ao salvar")); return; }
    setForm(FORM_VAZIO);
    setEditando(null);
    setMsg("Acesso salvo.");
    carregar();
  }

  async function excluir(u: Usuario) {
    if (!confirm(`Remover acesso de ${u.email}?`)) return;
    try { await httpJson(`/api/usuarios?email=${encodeURIComponent(u.email)}`, { method: "DELETE" }); }
    catch (e) { setErro(mensagemHttp(e, "Falha ao remover")); return; }
    carregar();
  }

  function editar(u: Usuario) {
    setErro("");
    setMsg("");
    setEditando(u.email);
    setForm({ email: u.email, nome: u.nome ?? "", papel: u.papel, senha: "", oficialEmail: u.oficialEmail ?? "" });
    window.scrollTo({ top: 0 });
  }

  return (
    <div>
      <h1 className="page-titulo" data-tour="usuarios-titulo">Usuários e acessos</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        Conceda acesso ao sistema e defina o papel de cada servidor. Os três papéis: Oficial de Promotoria Chefe
        (tudo, única edição), Oficial de Promotoria (consulta todas as telas e lança trocas vinculadas) e Promotor de Justiça
        (somente leitura de escala, custódia e listas).
      </p>
      {erro && <p className="erro">{erro}</p>}
      {msg && <p className="ok">{msg}</p>}

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{editando ? "Editar acesso" : "Conceder acesso"}</h2>
        <form onSubmit={salvar}>
          <div className="linha">
            <div className="campo">
              <label htmlFor="usuarios-e-mail-mpsp-mp-br">E-mail (@mpsp.mp.br)</label>
              <input id="usuarios-e-mail-mpsp-mp-br" type="email" size={26} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editando} required />
            </div>
            <div className="campo">
              <label htmlFor="usuarios-nome">Nome</label>
              <input id="usuarios-nome" size={26} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="usuarios-papel">Papel</label>
              <select id="usuarios-papel" value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value as Usuario["papel"] })}>
                {PAPEIS.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
            </div>
            {form.papel === "PROMOTOR" && <div className="campo">
              <label htmlFor="usuarios-oficial-vinculado">Oficial vinculado</label>
              <select id="usuarios-oficial-vinculado" value={form.oficialEmail} onChange={(e) => setForm({ ...form, oficialEmail: e.target.value })}>
                <option value="">Nenhum</option>
                {oficiais.map((o) => <option key={o.email} value={o.email}>{o.nome || o.email}</option>)}
              </select>
            </div>}
            <div className="campo">
              <label htmlFor="usuarios-senha">{editando ? "Nova senha (opcional)" : "Senha"}</label>
              <input id="usuarios-senha" type="password" autoComplete="new-password" minLength={8} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required={!editando} />
            </div>
          </div>
          <div className="linha">
            <button type="submit" className="btn">{editando ? "Salvar" : "Conceder acesso"}</button>
            {editando && (
              <button type="button" className="btn secundario" onClick={() => { setEditando(null); setForm(FORM_VAZIO); }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
        <p className="muted" style={{ marginBottom: 0 }}>
          {PAPEIS.find((p) => p.v === form.papel)?.descricao}. Ao editar, deixe a senha vazia para manter a atual.
        </p>
      </div>

      <div className="panel" data-tour="usuarios-lista">
        <h2 style={{ marginTop: 0 }}>Acessos concedidos ({usuarios.length})</h2>
        <table>
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Nome</th>
              <th>Papel</th>
              <th>Oficial vinculado</th>
              <th>Senha</th>
              <th><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.email}>
                <td>{u.email}</td>
                <td>{u.nome ?? <em className="muted">—</em>}</td>
                <td>{PAPEIS.find((p) => p.v === u.papel)?.rotulo ?? u.papel}</td>
                <td>{u.oficialEmail ?? <em className="muted">—</em>}</td>
                <td>{u.temSenha ? "definida" : <em className="muted">sem senha</em>}</td>
                <td>
                  <button type="button" className="btn secundario mini" onClick={() => editar(u)} style={{ marginRight: 6 }}>
                    Editar
                  </button>
                  <button type="button" className="btn perigo mini" onClick={() => excluir(u)}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <em className="muted">Nenhum acesso concedido ainda.</em>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
