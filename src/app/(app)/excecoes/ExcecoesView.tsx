"use client";

import { useCallback, useEffect, useState } from "react";
import { DIAS_SEMANA, MESES, diasDoMes, diaSemana, formatarDataBR } from "@/lib/datas";
import { podeEditar, useSessao } from "@/app/components/SessaoProvider";
import { httpJson, mensagemHttp } from "@/lib/http";

interface Posicao { id: number; codigo: string; nome: string; grupo: string }
interface GradeItem { diaSemana: number; posicaoId: number }
interface Excecao { id: number; data: string; posicaoId: number; ativa: boolean; motivo: string | null }

export default function ExcecoesView() {
  const { papel } = useSessao();
  const chefe = podeEditar(papel);
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [gradeItens, setGradeItens] = useState<GradeItem[]>([]);
  const [excecoes, setExcecoes] = useState<Excecao[]>([]);
  const [feriados, setFeriados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const g = await httpJson<{ posicoes: Posicao[]; gradeItens: GradeItem[]; excecoes: Excecao[] }>("/api/grade");
      const fs = await httpJson<{ data: string }[]>("/api/feriados");
      setPosicoes(g.posicoes);
      setGradeItens(g.gradeItens);
      setExcecoes(g.excecoes);
      setFeriados(new Set<string>(fs.map((f) => f.data)));
    } catch (e) { setErro(mensagemHttp(e, "Falha ao carregar exceções")); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const diasUteis = diasDoMes(ano, mes).filter((iso) => {
    const ds = diaSemana(iso);
    return ds >= 1 && ds <= 5 && !feriados.has(iso);
  });

  function templateAtiva(iso: string, posId: number): boolean {
    return gradeItens.some((g) => g.diaSemana === diaSemana(iso) && g.posicaoId === posId);
  }
  function excecaoDe(iso: string, posId: number): Excecao | undefined {
    return excecoes.find((e) => e.data === iso && e.posicaoId === posId);
  }
  function ativaNoDia(iso: string, posId: number): boolean {
    const exc = excecaoDe(iso, posId);
    if (exc) return exc.ativa;
    return templateAtiva(iso, posId);
  }

  async function alternar(iso: string, posId: number) {
    setErro("");
    const alvo = !ativaNoDia(iso, posId);
    const exc = excecaoDe(iso, posId);
    if (alvo === templateAtiva(iso, posId)) {
      // volta ao padrão da grade: remove a exceção explícita
      if (exc) {
        try { await httpJson(`/api/excecoes/${exc.id}`, { method: "DELETE" }); }
        catch (e) { setErro(mensagemHttp(e)); return; }
        setExcecoes(excecoes.filter((e) => e.id !== exc.id));
      }
      return;
    }
    let nova: Excecao;
    try { nova = await httpJson<Excecao>("/api/excecoes", { method: "POST", body: { data: iso, posicaoId: posId, ativa: alvo, motivo: "Exceção pela aba Exceções" } }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    setExcecoes([...excecoes.filter((e) => !(e.data === iso && e.posicaoId === posId)), nova]);
  }

  const excecoesDoMes = excecoes.filter((e) => e.data.slice(0, 7) === `${ano}-${String(mes).padStart(2, "0")}`);

  return (
    <div>
      <h2 data-tour="excecoes-titulo">Exceções da grade</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Liga/desliga posições em dias específicos, criando exceções à grade padrão.
        <strong> Fundo âmbar</strong> = exceção explícita registrada para aquele dia/posição, ou seja,
        <strong> diferente do padrão da grade semanal</strong> (posição desligada apesar de existir no padrão,
        ou ligada apesar de não existir). O estado do checkbox é o que vale na geração.
        Voltar ao estado padrão remove a exceção do cadastro.
        A Custódia é fixa em todos os dias úteis. Fins de semana e feriados não geram vagas.
      </p>
      {erro && <p className="erro">{erro}</p>}
      <div className="panel">
        <div className="linha">
          <div className="campo">
            <label>Mês</label>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label>Ano</label>
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {[agora.getFullYear() - 1, agora.getFullYear(), agora.getFullYear() + 1].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <button className="btn secundario" onClick={carregar} disabled={carregando}>
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
          <span className="muted" style={{ marginBottom: 0, alignSelf: "center" }}>
            {excecoesDoMes.length} exceção(ões) neste mês
          </span>
        </div>
      </div>

      <div className="panel" data-tour="excecoes-lista">
        <table className="table-zebra">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Data</th>
              {posicoes.map((p) => (
                <th key={p.id} style={{ textAlign: "center" }} title={p.nome}>{p.codigo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {diasUteis.map((iso) => (
              <tr key={iso}>
                <td>
                  <strong>{formatarDataBR(iso)}</strong>{" "}
                  <span className="muted">{DIAS_SEMANA[diaSemana(iso)].slice(0, 3)}</span>
                </td>
                {posicoes.map((p) => {
                  const exc = excecaoDe(iso, p.id);
                  const fixaC = p.codigo === "C";
                  return (
                    <td
                      key={p.id}
                      style={{ textAlign: "center", ...(exc ? { background: "#fef3c7" } : {}) }}
                      title={exc ? `Exceção: ${exc.ativa ? "ativada" : "desativada"}${exc.motivo ? ` — ${exc.motivo}` : ""}` : undefined}
                    >
                      <label
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: "normal", color: "var(--text)", cursor: fixaC || !chefe ? "not-allowed" : "pointer" }}
                      >
                        <input
                          type="checkbox"
                          checked={ativaNoDia(iso, p.id)}
                          disabled={fixaC || !chefe}
                          onChange={() => alternar(iso, p.id)}
                        />
                        {p.codigo}
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
            {diasUteis.length === 0 && (
              <tr><td colSpan={posicoes.length + 1} className="muted">Nenhum dia útil neste mês.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
