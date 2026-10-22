"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { atuaEm } from "@/lib/gerador";
import { DIAS_SEMANA, diasDoMes, diaSemana, parseISODate } from "@/lib/datas";
import { podeEditar, useSessao } from "@/app/components/SessaoProvider";
import { promotorLogadoId } from "@/lib/promotor-logado";
import { HttpError, httpJson, mensagemHttp } from "@/lib/http";

interface Posicao { id: number; codigo: string; nome: string; grupo: string; ordem: number }
interface Des { id: number; data: string; posicaoId: number; promotorId: number | null }
interface Promotor { id: number; apelido: string; nome: string; email: string | null; tipo: string; atuacao: string; ativo: boolean }
interface Escala { id: number; ano: number; mes: number; status: string }
interface Payload {
  escala: Escala;
  designacoes: Des[];
  promotores: Promotor[];
  posicoes: Posicao[];
  feriados: { data: string; nome: string }[];
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function CustodiaPage() {
  const { papel, email } = useSessao();
  const chefe = podeEditar(papel);
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [payload, setPayload] = useState<Payload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async (m: number, a: number) => {
    setCarregando(true);
    setErro("");
    setMsg("");
    try {
      const lista = await httpJson<Escala[]>("/api/escalas");
      const encontrada = lista.find((e: Escala) => e.mes === m && e.ano === a);
      if (!encontrada) {
        setPayload(null);
        return;
      }
      setPayload(await httpJson<Payload>(`/api/escalas/${encontrada.id}`));
    } catch (e) {
      setErro(e instanceof HttpError && e.status === 503 ? "Erro ao carregar escalas (HTTP 503)." : mensagemHttp(e, "Erro ao carregar a custódia."));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pm = Number(params.get("mes"));
    const pa = Number(params.get("ano"));
    if (pm >= 1 && pm <= 12) setMes(pm);
    if (pa >= 2000) setAno(pa);
    carregar(pm || agora.getMonth() + 1, pa || agora.getFullYear());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function gerar() {
    setErro("");
    try { await httpJson("/api/escalas", { method: "POST", body: { ano, mes } }); }
    catch (e) { setErro(mensagemHttp(e, "Erro ao gerar a escala.")); return; }
    await carregar(mes, ano);
  }

  async function trocar(des: Des, promotorId: number | null) {
    if (!payload) return;
    let nova: Des & { promotor?: { id: number; apelido: string } | null };
    try { nova = await httpJson<Des & { promotor?: { id: number; apelido: string } | null }>(`/api/designacoes/${des.id}`, { method: "PATCH", body: { promotorId } }); }
    catch (e) { setErro(mensagemHttp(e, "Erro ao salvar designação.")); return; }
    setErro("");
    setPayload({
      ...payload,
      designacoes: payload.designacoes.map((d) => (d.id === nova.id ? { ...d, ...nova } : d)),
    });
    if (nova.promotorId) {
      const duplicadas = payload.designacoes.filter(
        (d) => d.data === nova.data && d.promotorId === nova.promotorId && d.id !== nova.id
      );
      if (duplicadas.length > 0) {
        const apelido = payload.promotores.find((p) => p.id === nova.promotorId)?.apelido ?? "O PJ";
        const codigos = duplicadas
          .map((d) => payload.posicoes.find((p) => p.id === d.posicaoId)?.codigo)
          .filter(Boolean)
          .join(", ");
        setMsg(
          `Custódia lançada. ${apelido} também está designado em ${codigos} neste dia — regenere a escala para liberar a designação automática.`
        );
        setTimeout(() => setMsg(""), 10000);
        return;
      }
    }
    setMsg("Custódia atualizada.");
    setTimeout(() => setMsg(""), 2000);
  }

  const feriadoMap = useMemo(() => new Map((payload?.feriados ?? []).map((f) => [f.data, f.nome])), [payload]);
  const posC = payload?.posicoes.find((p) => p.codigo === "C");
  const desPorData = useMemo(() => {
    const m = new Map<string, Des>();
    for (const d of payload?.designacoes ?? []) if (d.posicaoId === posC?.id) m.set(d.data, d);
    return m;
  }, [payload, posC]);

  const diasUteis = useMemo(
    () =>
      diasDoMes(ano, mes).filter((iso) => {
        const ds = diaSemana(iso);
        return ds !== 0 && ds !== 6 && !feriadoMap.has(iso);
      }),
    [ano, mes, feriadoMap]
  );

  const elegiveis = useMemo(
    () => (payload?.promotores ?? []).filter((p) => p.ativo && atuaEm(p, "C")),
    [payload]
  );

  function sufixoTipo(p: Promotor): string {
    if (p.tipo === "SUBSTITUTO") return " (SUBS)";
    if (p.tipo === "AUXILIAR") return " (AUX)";
    if (p.tipo === "REGIONAL") return " (REG)";
    return "";
  }

  const status = payload?.escala.status;
  const editavel = !!chefe && !!payload && status !== "PUBLICADA";
  const meuPromotorId = useMemo(() => {
    if (papel !== "PROMOTOR" || !payload) return null;
    return promotorLogadoId(payload.promotores, email);
  }, [papel, email, payload]);
  const preenchidas = diasUteis.filter((iso) => desPorData.get(iso)?.promotorId).length;

  return (
    <div>
      <h2 data-tour="custodia-titulo">Custódia</h2>
      <p className="muted">
        Lance aqui o PJ responsável pelas audiências de custódia de cada dia útil. Primeiro crie o esqueleto da
        escala mensal na aba Escala.
      </p>
      {erro && <p className="erro">{erro}</p>}
      {msg && <p className="sucesso">{msg}</p>}

      <div className="panel">
        <div className="linha">
          <div className="campo">
            <label>Mês</label>
            <select value={mes} onChange={(e) => { const m = Number(e.target.value); setMes(m); carregar(m, ano); }}>
              {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label>Ano</label>
            <select value={ano} onChange={(e) => { const a = Number(e.target.value); setAno(a); carregar(mes, a); }}>
              {[agora.getFullYear() - 1, agora.getFullYear(), agora.getFullYear() + 1].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          {!payload && chefe && <button className="btn" onClick={gerar}>Criar esqueleto do mês</button>}
          {payload && <span className={`badge ${status}`}>{status}</span>}
          {payload && (
            <span className="muted" style={{ alignSelf: "center" }}>
              {preenchidas}/{diasUteis.length} dias preenchidos
            </span>
          )}
        </div>
      </div>

       {carregando && <div className="vazio"><p>Carregando dados de custódia…</p></div>}
         {!carregando && !erro && !payload ? (
        <div className="vazio">
          <p>
            Não existe escala para <strong>{MESES[mes - 1]}/{ano}</strong> ainda.
            <br />
            {chefe
               ? "Crie o esqueleto do mês na aba Escala para liberar o lançamento das custódias."
              : "Aguarde: a escala deste mês ainda não foi gerada pela oficialia."}
          </p>
        </div>
        ) : payload ? (
         <div className="panel" data-tour="custodia-form">
           {chefe && status === "PUBLICADA" && (
             <p className="erro">Escala publicada: reabra-a na tela da escala para editar as custódias.</p>
           )}
          <table style={{ maxWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ width: 90 }}>Data</th>
                <th style={{ width: 90 }}>Dia</th>
                <th style={{ textAlign: "left" }}>PJ da Custódia</th>
              </tr>
            </thead>
            <tbody>
              {diasUteis.map((iso) => {
                const d = parseISODate(iso);
                const des = desPorData.get(iso);
                const pj = des?.promotorId ? payload.promotores.find((x) => x.id === des.promotorId) : undefined;
                const minha = !!pj && pj.id === meuPromotorId;
                return (
                  <tr key={iso} className={minha ? "linha-eu" : undefined}>
                    <td>{`${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`}</td>
                    <td>{DIAS_SEMANA[d.getDay()]}</td>
                    <td>
                      {des && editavel ? (
                        <select
                          value={des.promotorId ?? ""}
                          onChange={(e) => trocar(des, e.target.value ? Number(e.target.value) : null)}
                          style={{ width: "100%" }}
                        >
                          <option value="">—</option>
                          {elegiveis.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.apelido}
                              {sufixoTipo(p)}
                              {" — "}
                              {p.nome}
                            </option>
                          ))}
                        </select>
                      ) : pj ? (
                        <div>
                          <strong>{pj.apelido}</strong>
                          {sufixoTipo(pj)}
                          {" — "}
                          {pj.nome}
                          {minha && <span className="voce"> — você</span>}
                        </div>
                      ) : (
                         <span className="muted">—</span>
                       )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
       ) : null}
    </div>
  );
}
