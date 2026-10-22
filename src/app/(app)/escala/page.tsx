"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { estaDisponivel, atuaEm, type PromotorInput } from "@/lib/gerador";
import { DIAS_SEMANA, diasDoMes, diaSemana, formatarDataBR, parseISODate } from "@/lib/datas";
import { podeEditar, useSessao } from "@/app/components/SessaoProvider";
import { promotorLogadoId } from "@/lib/promotor-logado";
import { HttpError, httpJson, mensagemHttp } from "@/lib/http";

interface Posicao { id: number; codigo: string; nome: string; grupo: string; ordem: number }
interface GrupoCarga { grupo: string; nome: string; peso: number }
interface Des { id: number; data: string; posicaoId: number; promotorId: number | null; promotor?: { id: number; apelido: string } | null; origem: string; travada: boolean; trocaCom?: string | null }
interface Promotor extends PromotorInput { nome: string; email: string | null }
interface Escala { id: number; ano: number; mes: number; status: string }
interface Payload {
  escala: Escala;
  designacoes: Des[];
  promotores: Promotor[];
  posicoes: Posicao[];
  grupos: GrupoCarga[];
  feriados: { data: string; nome: string }[];
  gradeItens: { diaSemana: number; posicaoId: number }[];
  excecoes: { id: number; data: string; posicaoId: number; ativa: boolean }[];
  saldoAnterior: Record<string, Record<string, number>>;
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function EscalaPage() {
  const { papel, email } = useSessao();
  const chefe = podeEditar(papel);
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [payload, setPayload] = useState<Payload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [modoGrade, setModoGrade] = useState(false);

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
      setErro(e instanceof HttpError && e.status === 503 ? "Erro ao carregar escalas (HTTP 503)." : mensagemHttp(e, "Erro ao carregar a escala."));
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

  const [emitidaEm, setEmitidaEm] = useState("");
  useEffect(() => {
    const atualizar = () => setEmitidaEm(new Date().toLocaleString("pt-BR"));
    atualizar();
    window.addEventListener("beforeprint", atualizar);
    return () => window.removeEventListener("beforeprint", atualizar);
  }, []);

  async function gerar() {
    setGerando(true);
    setErro("");
    try {
      await httpJson("/api/escalas", { method: "POST", body: { ano, mes } });
      await carregar(mes, ano);
      setMsg("Esqueleto da escala criado. Lance Custódia e Trocas/Ajustes ou gere as designações.");
    } catch (e) {
      setErro(mensagemHttp(e, "Erro ao gerar a escala. Consulte o log do servidor."));
    } finally {
      setGerando(false);
    }
  }

  async function gerarDesignacoes() {
    if (!payload) return;
    setGerando(true);
    setErro("");
    try {
      await httpJson(`/api/escalas/${payload.escala.id}/gerar`, { method: "POST" });
      await carregar(mes, ano);
      setMsg("Designações geradas para as vagas sem ajuste manual.");
    } catch (e) {
      setErro(mensagemHttp(e, "Erro ao gerar designações. Consulte o log do servidor."));
    } finally {
      setGerando(false);
    }
  }

  async function exportar() {
    if (!payload) return;
    setExportando(true);
    setErro("");
    try {
      const resposta = await fetch(`/api/escalas/${payload.escala.id}/export`);
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        const texto = corpo && typeof corpo === "object"
          ? (corpo as Record<string, unknown>).erro ?? (corpo as Record<string, unknown>).error
          : null;
        throw new HttpError(resposta.status, typeof texto === "string" ? texto : "Erro ao exportar a escala.");
      }
      const arquivo = await resposta.blob();
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement("a");
      link.href = url;
      link.download = `escala-${payload.escala.mes}-${payload.escala.ano}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(mensagemHttp(e, "Erro ao exportar a escala."));
    } finally {
      setExportando(false);
    }
  }

  async function limpar() {
    if (!payload) return;
    if (!confirm("Limpar a escala? Todas as vagas, exceto Custódia, ficarão sem designação, preservando os dias e posições para lançamentos manuais.")) return;
    setErro("");
    let data: { limpas: number };
    try { data = await httpJson<{ limpas: number }>(`/api/escalas/${payload.escala.id}/reset`, { method: "POST" }); }
    catch (e) {
      setErro(mensagemHttp(e, "Erro ao limpar a escala."));
      await carregar(mes, ano);
      return;
    }
    setMsg(`Escala limpa: ${data.limpas} vaga(s) preservada(s) sem designação. As custódias foram mantidas.`);
    await carregar(mes, ano);
  }

  async function mudarStatus(status: string) {    if (!payload) return;
    try { await httpJson(`/api/escalas/${payload.escala.id}`, { method: "PATCH", body: { status } }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    await carregar(mes, ano);
  }

  async function trocarPromotor(des: Des, promotorId: number | null) {
    if (!payload) return;
    let nova: Des;
    try { nova = await httpJson<Des>(`/api/designacoes/${des.id}`, { method: "PATCH", body: { promotorId } }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    setErro("");
    setPayload({
      ...payload,
      designacoes: payload.designacoes.map((d) => (d.id === nova.id ? { ...d, ...nova } : d)),
    });
  }

  async function destravar(des: Des) {
    if (!payload) return;
    try { await httpJson(`/api/designacoes/${des.id}`, { method: "PATCH", body: { travada: false } }); }
    catch (e) { setErro(mensagemHttp(e)); return; }
    await carregar(mes, ano);
  }

  const dias = useMemo(() => diasDoMes(ano, mes), [ano, mes]);
  const feriadoMap = useMemo(() => new Map((payload?.feriados ?? []).map((f) => [f.data, f.nome])), [payload]);

  const semanas = useMemo(() => {
    if (dias.length === 0) return [];
    const primeiro = diaSemana(dias[0]);
    const inicio = parseISODate(dias[0]);
    inicio.setDate(inicio.getDate() - ((primeiro + 6) % 7));
    const semanas: string[][] = [];
    let atual: string[] = [];
    const cursor = new Date(inicio);
    for (let i = 0; i < 42; i++) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      atual.push(iso);
      if (atual.length === 7) {
        semanas.push(atual);
        atual = [];
        if (iso >= dias[dias.length - 1]) break;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return semanas;
  }, [dias]);

  const desPorChave = useMemo(() => {
    const m = new Map<string, Des>();
    for (const d of payload?.designacoes ?? []) m.set(`${d.data}|${d.posicaoId}`, d);
    return m;
  }, [payload]);

  const posicoesOrdenadas = useMemo(
    () => [...(payload?.posicoes ?? [])].sort((a, b) => a.ordem - b.ordem),
    [payload]
  );
  const posicoesAtivas = useMemo(() => {
    if (modoGrade) return posicoesOrdenadas;
    const usadas = new Set((payload?.designacoes ?? []).map((d) => d.posicaoId));
    return posicoesOrdenadas.filter((p) => usadas.has(p.id));
  }, [payload, posicoesOrdenadas, modoGrade]);

  function posicaoAtivaNoDia(iso: string, posId: number): boolean {
    if (!payload) return false;
    const exc = payload.excecoes.find((e) => e.data === iso && e.posicaoId === posId);
    if (exc) return exc.ativa;
    const ds = diaSemana(iso);
    return payload.gradeItens.some((g) => g.diaSemana === ds && g.posicaoId === posId);
  }

  async function alternarPosicao(iso: string, posId: number, novaAtiva: boolean) {
    if (!payload) return;
    let exc: Payload["excecoes"][number];
    try { exc = await httpJson<Payload["excecoes"][number]>("/api/excecoes", { method: "POST", body: {
        data: iso,
        posicaoId: posId,
        ativa: novaAtiva,
        motivo: novaAtiva ? "Ativada na tela da escala" : "Desativada na tela da escala",
    }}); } catch (e) { setErro(mensagemHttp(e)); return; }
    setPayload({
      ...payload,
      excecoes: [...payload.excecoes.filter((e) => !(e.data === iso && e.posicaoId === posId)), exc],
      designacoes: novaAtiva
        ? payload.designacoes
        : payload.designacoes.filter((d) => !(d.data === iso && d.posicaoId === posId)),
    });
  }

  const cargaGrupo = useMemo(() => {
    const m = new Map<number, Record<string, number>>();
    for (const p of payload?.promotores ?? []) m.set(p.id, {});
    const grupoDe = new Map((payload?.posicoes ?? []).map((x) => [x.id, x.grupo]));
    const codigoDe = new Map((payload?.posicoes ?? []).map((x) => [x.id, x.codigo]));
    const pesoDe = new Map((payload?.grupos ?? []).map((g) => [g.grupo, g.peso]));
    const promotorDe = new Map((payload?.promotores ?? []).map((p) => [p.id, p]));
    for (const d of payload?.designacoes ?? []) {
      if (!d.promotorId) continue;
      const g = grupoDe.get(d.posicaoId) ?? "AUDIENCIAS";
      // A carga da audiência pertence ao cargo original, mesmo quando servida por cobertura.
      const cob = coberturaDe(promotorDe.get(d.promotorId), d.data, codigoDe.get(d.posicaoId) ?? "");
      const alvoId = cob?.afastadoId ?? d.promotorId;
      const rec = m.get(alvoId);
      if (!rec) continue;
      rec[g] = (rec[g] ?? 0) + (pesoDe.get(g) ?? 1);
    }
    return m;
  }, [payload]);
  const gruposLista = payload?.grupos ?? [];
  const saldoAcumulado = useMemo(() => {
    const m = new Map<number, Record<string, number>>();
    for (const [id, anterior] of Object.entries(payload?.saldoAnterior ?? {})) m.set(Number(id), { ...anterior });
    for (const [id, rec] of cargaGrupo) {
      const total = m.get(id) ?? {};
      for (const [grupo, valor] of Object.entries(rec)) total[grupo] = (total[grupo] ?? 0) + valor;
      m.set(id, total);
    }
    return m;
  }, [payload, cargaGrupo]);

  const ocupadosPorDia = useMemo(() => {
    const m = new Map<string, Set<number>>();
    for (const d of payload?.designacoes ?? []) {
      if (!d.promotorId) continue;
      let s = m.get(d.data);
      if (!s) {
        s = new Set();
        m.set(d.data, s);
      }
      s.add(d.promotorId);
    }
    return m;
  }, [payload]);

  const status = payload?.escala.status;
  const editavel = chefe && (status === "RASCUNHO" || status === "PRONTA" || status === "APROVADA");

  const meuPromotorId = useMemo(() => {
    if (papel !== "PROMOTOR" || !payload) return null;
    return promotorLogadoId(payload.promotores, email);
  }, [papel, email, payload]);

  const posicaoCId = payload?.posicoes.find((p) => p.codigo === "C")?.id;
  const vagasEmBranco = payload
    ? payload.designacoes.filter((d) => !d.promotorId && d.origem === "AUTO" && d.posicaoId !== posicaoCId).length
    : 0;

  return (
    <div>
      <h2 className="no-print" data-tour="escala-titulo">Escala mensal</h2>
      {erro && <p className="erro">{erro}</p>}
      {msg && <p className="sucesso">{msg}</p>}
      {vagasEmBranco > 0 && !gerando && !carregando && (
        <p className="erro">
          Atenção: {vagasEmBranco} posição(ões) sem candidato disponível na geração automática — preencha
          manualmente ou ajuste vínculos/atuações/portarias e gere novamente.
        </p>
      )}

      <div className="panel no-print" data-tour="escala-controles">
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
          {chefe && !payload && !carregando && (
            <button className="btn" onClick={gerar} disabled={gerando} aria-busy={gerando} data-tour="escala-gerar">
              {gerando ? "Criando…" : "Gerar escala"}
            </button>
          )}
          {chefe && payload && status !== "PUBLICADA" && (
            <button className="btn" onClick={gerarDesignacoes} disabled={gerando} aria-busy={gerando} data-tour="escala-gerar-desig">
              {gerando ? "Gerando…" : "Gerar designações"}
            </button>
          )}
          {chefe && payload && status !== "PUBLICADA" && (
            <button
              className="btn perigo"
              onClick={limpar}
               title="Deixa as vagas sem designação, mantendo os dias, posições e Custódia"
            >
              Limpar escala
            </button>
          )}
          {chefe && payload && status !== "PUBLICADA" && (
            <button
              className={modoGrade ? "btn" : "btn secundario"}
              onClick={() => setModoGrade(!modoGrade)}
              title="Ligar/desligar posições por dia antes de regerar"
            >
              {modoGrade ? "Concluir edição da grade" : "Editar grade dos dias"}
            </button>
          )}
          {payload && (
            <>
              {chefe && status === "RASCUNHO" && <button className="btn secundario" onClick={() => mudarStatus("PRONTA")}>Marcar como PRONTA</button>}
              {chefe && status === "PRONTA" && <button className="btn secundario" onClick={() => mudarStatus("APROVADA")}>Aprovar</button>}
              {chefe && status === "APROVADA" && <button className="btn" onClick={() => mudarStatus("PUBLICADA")}>Publicar</button>}
              {chefe && status === "PUBLICADA" && <button className="btn perigo" onClick={() => mudarStatus("RASCUNHO")}>Reabrir para edição</button>}
              {chefe && status !== "RASCUNHO" && status !== "PUBLICADA" && (
                <button className="btn secundario" onClick={() => mudarStatus("RASCUNHO")}>Voltar a rascunho</button>
              )}
              <button className="btn secundario" onClick={exportar} disabled={exportando} aria-busy={exportando}>
                {exportando ? "Exportando…" : "Exportar Excel"}
              </button>
              <button className="btn secundario" onClick={() => window.print()}>Imprimir / PDF</button>
            </>
          )}
          {payload && <span className={`badge ${status}`}>{status}</span>}
          {payload && (
            <span className="muted" style={{ marginBottom: 0, alignSelf: "center" }}>
              Contorno vermelho tracejado = vaga sem designação · Custódia (amarelo) é preenchida manualmente
            </span>
          )}
          {modoGrade && (
            <p className="muted" style={{ marginBottom: 0, width: "100%" }}>
              Clique nas caixas para ligar/desligar cada posição em cada dia (ex.: varas auxiliares em dias
               específicos). Desligar tira a audiência daquele dia.
            </p>
          )}
        </div>
      </div>

      {carregando && <div className="vazio"><p>Carregando escala de <strong>{MESES[mes - 1]}/{ano}</strong>…</p></div>}
      {!carregando && !erro && !payload ? (
        <div className="vazio">
          <p>
            Ainda não existe escala para <strong>{MESES[mes - 1]}/{ano}</strong>.
            <br />
            {chefe ? (
              <>
                 Clique em <strong>Gerar escala</strong> para criar o esqueleto do mês. Depois lance Custódia e
                 Trocas/Ajustes ou clique em <strong>Gerar designações</strong> para preencher as vagas restantes.
              </>
            ) : (
              <>Aguarde: a escala deste mês ainda não foi gerada pela oficialia.</>
            )}
          </p>
        </div>
      ) : payload ? (
        <>
          <div className="panel" style={{ overflowX: "auto" }} data-tour="escala-tabela">
            {semanas.map((semana, si) => (
              <table className="grade-semanal" key={si} style={{ marginBottom: si < semanas.length - 1 ? 24 : 0 }}>
                <thead>
                  <tr>
                    <th colSpan={6} className="semana-titulo">
                      <span className="marca-print">
                        <span className="mp">MP</span>
                        <span className="sp">SP</span>
                        <span className="assinatura"> | MINISTÉRIO PÚBLICO DO ESTADO DE SÃO PAULO</span>
                      </span>
                      ESCALA DE AUDIÊNCIAS — {MESES[mes - 1].toUpperCase()}/{ano}
                      <span className="emissao-print">
                        Emitida em {emitidaEm || "—"} · Status: {payload.escala.status}
                      </span>
                    </th>
                  </tr>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    {semana.slice(0, 5).map((iso) => {
                      const d = parseISODate(iso);
                      const noMes = d.getMonth() + 1 === mes && d.getFullYear() === ano;
                      const feriado = feriadoMap.get(iso);
                      return (
                        <th key={iso} className={feriado && noMes ? "dia-feriado" : ""} style={{ opacity: noMes ? 1 : 0.35 }}>
                          {DIAS_SEMANA[d.getDay()]}
                          <br />
                          <strong style={{ fontSize: 14 }}>{noMes ? d.getDate() : ""}</strong>
                          {noMes && feriado && <span className="feriado-chip" title={feriado}>{feriado}</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {posicoesAtivas.map((pos) => (
                    <tr key={pos.id} className={pos.codigo === "C" ? "custodia-row" : ""}>
                      <td className="rotulo-pos">{pos.codigo}</td>
                      {semana.slice(0, 5).map((iso) => {
                        const d = parseISODate(iso);
                        const noMes = d.getMonth() + 1 === mes && d.getFullYear() === ano;
                        const des = desPorChave.get(`${iso}|${pos.id}`);
                        if (!noMes) return <td key={iso}></td>;
                        if (modoGrade) {
                          const ativa = pos.codigo === "C" ? true : posicaoAtivaNoDia(iso, pos.id);
                          return (
                            <td key={iso}>
                              <input
                                type="checkbox"
                                checked={ativa}
                                disabled={pos.codigo === "C"}
                                onChange={() => alternarPosicao(iso, pos.id, !ativa)}
                                title={
                                  pos.codigo === "C"
                                    ? "Custódia é fixa em todos os dias úteis (preenchimento manual)"
                                    : `${pos.codigo} em ${formatarDataBR(iso)}: ${ativa ? "ativo" : "desativado"}`
                                }
                              />
                            </td>
                          );
                        }
                        const ativaNoDia = pos.codigo === "C" || posicaoAtivaNoDia(iso, pos.id);
                        return (
                          <td key={iso}>
                            {des && ativaNoDia ? (
                              <CellSelect
                                des={des}
                                promotores={payload.promotores}
                                data={iso}
                                codigo={pos.codigo}
                                posicaoId={pos.id}
                                grupo={pos.grupo}
                                ocupados={ocupadosPorDia.get(iso) ?? CONJUNTO_VAZIO}
                                editavel={editavel}
                                destacarId={meuPromotorId}
                                conflito={des.promotorId ? !payload.promotores.find((p) => p.id === des.promotorId)?.generico && payload.designacoes.filter((x) => x.data === iso && x.promotorId === des.promotorId).length > 1 : false}
                                onChange={(pid) => trocarPromotor(des, pid)}
                                onDestravar={() => destravar(des)}
                              />
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>

          <div className="panel painel-carga" data-tour="escala-carga">
            <div className="marca-print">
              <span className="mp">MP</span>
              <span className="sp">SP</span>
              <span className="assinatura"> | MINISTÉRIO PÚBLICO DO ESTADO DE SÃO PAULO</span>
            </div>
            <h3 style={{ marginTop: 0 }}>Carga ponderada por promotor e grupo</h3>
            <p className="muted">O saldo anterior acumula os meses já escalados e é considerado na distribuição deste mês. Carga maior agora resulta em compensação nos meses seguintes.</p>
            <div className="emissao-print" style={{ marginBottom: 8 }}>
              CARGA PONDERADA — {MESES[mes - 1].toUpperCase()}/{ano} · Emitida em {emitidaEm || "—"} · Status:{" "}
              {payload.escala.status}
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Promotor</th>
                  <th style={{ textAlign: "left" }}>E-mail</th>
                  <th style={{ textAlign: "center" }}>Saldo anterior</th>
                  {gruposLista.map((g) => (
                    <th key={g.grupo} style={{ textAlign: "center" }}>
                      {g.nome}
                    </th>
                  ))}
                  <th style={{ textAlign: "center" }}>Carga intramês</th>
                  <th style={{ textAlign: "center" }}>Carga acumulada</th>
                </tr>
              </thead>
              <tbody>
                {(["TITULAR", "AUXILIAR", "REGIONAL", "SUBSTITUTO"] as const)
                  .map((tipo) => ({
                    tipo,
                    linhas: [...cargaGrupo.entries()]
                      .map(([id, rec]) => ({
                        id,
                        rec,
                        total: gruposLista.reduce((s, g) => s + (rec[g.grupo] ?? 0), 0),
                        anterior: gruposLista.reduce((s, g) => s + (payload.saldoAnterior[String(id)]?.[g.grupo] ?? 0), 0),
                        acumulado: gruposLista.reduce((s, g) => s + (saldoAcumulado.get(id)?.[g.grupo] ?? 0), 0),
                        prom: payload.promotores.find((p) => p.id === id),
                      }))
                      .filter((l) => l.prom?.tipo === tipo)
                      .sort((a, b) => b.total - a.total || a.prom!.apelido.localeCompare(b.prom!.apelido)),
                  }))
                  .filter((g) => g.linhas.length > 0)
                  .flatMap((g) => [
                     <tr key={`tipo-${g.tipo}`} className="linha-tipo">
                       <td colSpan={5 + gruposLista.length}>
                        <strong>
                          {g.tipo === "TITULAR" ? "Titulares" : g.tipo === "AUXILIAR" ? "Auxiliares" : g.tipo === "REGIONAL" ? "Regionais" : "Substitutos"}
                        </strong>{" "}
                        <span className="muted">({g.linhas.length})</span>
                      </td>
                    </tr>,
                     ...g.linhas.map(({ id, rec, total, anterior, acumulado, prom }) => (
                      <tr key={id} className={meuPromotorId === id ? "linha-eu" : undefined}>
                        <td>
                          <strong>{prom?.apelido ?? id}</strong>{" "}
                          <span className="muted">{prom?.nome}</span>
                          {meuPromotorId === id && <span className="voce"> — você</span>}
                        </td>
                        <td className="muted" style={{ fontSize: 11 }}>{prom?.email}</td>
                        <td style={{ textAlign: "center" }}>{anterior.toFixed(1)}</td>
                        {gruposLista.map((gg) => (
                          <td key={gg.grupo} style={{ textAlign: "center" }}>
                            {(rec[gg.grupo] ?? 0).toFixed(1)}
                          </td>
                        ))}
                        <td style={{ textAlign: "center", fontWeight: "bold" }}>{total.toFixed(1)}</td>
                        <td style={{ textAlign: "center", fontWeight: "bold" }}>{acumulado.toFixed(1)}</td>
                      </tr>
                    )),
                  ])}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

type Cobertura = { inicio: string; fim: string; varas: number[]; afastadoId?: number; modalidade?: string; afastadoAuxiliar?: boolean };

function coberturaDe(p: { coberturas?: Cobertura[] } | undefined, data: string, codigo: string): Cobertura | undefined {
  if (!p) return undefined;
  const m = /^(\d)('?)$/.exec(codigo);
  if (!m) return undefined;
  const vara = Number(m[1]);
  const isAux = m[2] === "'";
  return (p.coberturas ?? []).find(
    (c) =>
      c.inicio <= data &&
      data <= c.fim &&
      (!!c.afastadoAuxiliar === isAux) &&
      (!c.varas || c.varas.length === 0 || c.varas.includes(vara))
  );
}

const ROTULO_COBERTURA: Record<string, string> = {
  DESIGNADO: "designado para",
  ACUMULACAO: "acumulando",
  AUXILIO: "auxiliando",
};

function rotuloCobertura(c: Cobertura | undefined, apelido: string): string {
  if (!c) return "";
  return `${ROTULO_COBERTURA[c.modalidade ?? ""] ?? "cobrindo"} ${apelido}`;
}

function rotuloCustodia(
  p: Promotor | undefined,
  data: string,
  codigo: string,
  promotores: Promotor[]
): string {
  if (!p || codigo !== "C") return "";
  const afast = (p.portarias ?? []).find((pt) => pt.inicio <= data && data <= pt.fim);
  if (afast) return `afastado (portaria ${afast.numero ? `Nº ${afast.numero}` : "sem nº"})`;
  const cob = (p.coberturas ?? []).find((c) => c.inicio <= data && data <= c.fim);
  if (cob) return rotuloCobertura(cob, promotores.find((x) => x.id === cob.afastadoId)?.apelido ?? "");
  return "";
}

const CONJUNTO_VAZIO = new Set<number>();

function CellSelect({
  des,
  promotores,
  data,
  codigo,
  posicaoId,
  grupo,
  ocupados,
  editavel,
  destacarId,
  conflito,
  onChange,
  onDestravar,
}: {
  des: Des;
  promotores: Promotor[];
  data: string;
  codigo: string;
  posicaoId: number;
  grupo: string;
  ocupados: Set<number>;
  editavel: boolean;
  destacarId: number | null;
  conflito: boolean;
  onChange: (id: number | null) => void;
  onDestravar: () => void;
}) {
  const classe = [
    des.origem === "MANUAL" ? "manual" : "",
    conflito ? "invalido" : "",
    !des.promotorId ? (codigo === "C" ? "vazio-c" : "vazio") : "",
    destacarId !== null && des.promotorId === destacarId ? "eu" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const atual = promotores.find((p) => p.id === des.promotorId);
  const sufixoTipo =
    atual?.tipo === "SUBSTITUTO" ? " · Substituto" : atual?.tipo === "AUXILIAR" ? " · Auxiliar" : atual?.tipo === "REGIONAL" ? " · Regional" : "";
  const cobrindo = (() => {
    if (!atual) return null;
    const cob = coberturaDe(atual, data, codigo);
    if (!cob) return null;
    return { apelido: promotores.find((p) => p.id === cob.afastadoId)?.apelido ?? null, cob };
  })();
  // PJS na auxiliar sem cobertura = substituto vindo ajudar (não é acumulação).
  const ajudaAux = !!atual?.generico && /^\d'$/.test(codigo) && !cobrindo;
  const rotuloC = rotuloCustodia(atual, data, codigo, promotores);
  const titulo = atual
    ? `${atual.nome}${sufixoTipo}${cobrindo?.apelido ? ` · ${rotuloCobertura(cobrindo.cob, cobrindo.apelido)}` : ""}${rotuloC ? ` · ${rotuloC}` : ""}${ajudaAux ? " · vindo ajudar na auxiliar" : ""}`
    : "Vaga sem designação";
  return (
    <div>
      {editavel && des.travada && (
        <button
          className="btn mini secundario"
          title="Célula travada — clique para destravar"
          onClick={onDestravar}
          style={{ padding: "0 4px" }}
        >
          🔒
        </button>
      )}
      <select
        className={classe}
        value={des.promotorId ?? ""}
        title={titulo}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={!editavel}
      >
        <option value="">—</option>
        {promotores
          .filter((p) => p.ativo)
          .map((p) => {
            const naoAtua = p.tipo !== "SUBSTITUTO" && !atuaEm(p, codigo);
            const disp = estaDisponivel(p, data, codigo, posicaoId, grupo);
            return (
              <option key={p.id} value={p.id} disabled={naoAtua || !disp}>
                {p.apelido}
                {p.cargo === "SECRETARIO" ? " (SEC)" : p.cargo === "SUBSECRETARIO" ? " (SUBSEC)" : ""}
                {p.tipo === "SUBSTITUTO" ? " (SUBS)" : p.tipo === "AUXILIAR" ? " (AUX)" : p.tipo === "REGIONAL" ? " (REG)" : ""}
                {naoAtua ? " (não atua)" : !disp ? " (indisp.)" : p.generico || !ocupados.has(p.id) ? " (livre no dia)" : ""}
              </option>
            );
          })}
      </select>
      {atual && <div className="nome-sec">{atual.nome}</div>}
      {des.trocaCom && <div className="trocou">{des.trocaCom === "vaga sem candidato" ? "ajuste de vaga" : `trocou com ${des.trocaCom}`}</div>}
      {atual && cobrindo?.apelido && <div className="cobrindo">{rotuloCobertura(cobrindo.cob, cobrindo.apelido)}</div>}
      {atual && rotuloC && !cobrindo?.apelido && <div className="cobrindo">{rotuloC}</div>}
      {atual && ajudaAux && <div className="ajuda-aux">ajudando na auxiliar</div>}
    </div>
  );
}
