"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatarDataBR, MESES } from "@/lib/datas";
import { podeEditarTrocas, useSessao } from "@/app/components/SessaoProvider";
import { promotorLogadoId } from "@/lib/promotor-logado";
import { httpJson, mensagemHttp } from "@/lib/http";

type P = { id: number; apelido: string; nome: string; email: string | null };
type Posicao = { id: number; codigo: string; nome: string };
type Troca = {
  id: number;
  data: string;
  posicaoId: number | null;
  posicao: Posicao | null;
  promotorOrigemId: number | null;
  promotorDestinoId: number;
  promotorOrigem: P | null;
  promotorDestino: P;
  observacao: string | null;
};
type Opcao = { data: string; posicaoId: number; codigo: string; nome: string; promotorId: number | null };

export default function TrocasPage() {
  const { papel, email } = useSessao();
  const podeEditar = podeEditarTrocas(papel);
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [promotores, setPromotores] = useState<P[]>([]);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [data, setData] = useState("");
  const [posicaoId, setPosicaoId] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const d = await httpJson<{ trocas?: Troca[]; promotores?: P[]; opcoes?: Opcao[] }>(`/api/trocas?ano=${ano}&mes=${mes}`);
      setTrocas(d.trocas ?? []);
      setPromotores(d.promotores ?? []);
      setOpcoes(d.opcoes ?? []);
    } catch (e) {
      setErro(mensagemHttp(e, "Erro ao carregar ajustes."));
    } finally {
      setCarregando(false);
    }
  }, [ano, mes]);
  useEffect(() => { carregar(); }, [carregar]);

  const meuId = useMemo(() => promotorLogadoId(promotores, email), [promotores, email]);
  const opcoesDoDia = useMemo(
    () => opcoes.filter((o) => o.data === data && (papel !== "OFICIAL" || o.promotorId === meuId)),
    [opcoes, data, papel, meuId]
  );
  const opcaoAtual = opcoesDoDia.find((o) => String(o.posicaoId) === posicaoId);

  useEffect(() => {
    if (!data && opcoes.length) setData(opcoes[0].data);
  }, [opcoes, data]);
  useEffect(() => {
    if (data && !opcoesDoDia.some((o) => String(o.posicaoId) === posicaoId)) {
      setPosicaoId(opcoesDoDia[0] ? String(opcoesDoDia[0].posicaoId) : "");
    }
  }, [data, opcoesDoDia, posicaoId]);
  useEffect(() => {
    if (opcaoAtual) setOrigem(opcaoAtual.promotorId === null ? "VAGA" : String(opcaoAtual.promotorId));
  }, [opcaoAtual]);

  async function salvar() {
    setErro("");
    try { await httpJson("/api/trocas", { method: "POST", body: { data, posicaoId, promotorOrigemId: origem, promotorDestinoId: destino, observacao } }); }
    catch (e) { setErro(mensagemHttp(e, "Não foi possível lançar o ajuste.")); return; }
    setMsg("Ajuste lançado. A escala já exibe a alteração, inclusive após regeração.");
    setDestino(""); setObservacao("");
    await carregar();
  }

  async function excluir(t: Troca) {
    if (!confirm(`Excluir o ajuste de ${t.posicao?.codigo ?? "posição"} em ${formatarDataBR(t.data)}?`)) return;
    try { await httpJson(`/api/trocas/${t.id}`, { method: "DELETE" }); }
    catch (e) { setErro(mensagemHttp(e, "Não foi possível excluir.")); return; }
    await carregar();
  }

  return <div>
    <h2 data-tour="trocas-titulo">Trocas / Ajustes</h2>
    <p className="muted" style={{ marginTop: -8 }}>Troque ou preencha uma posição específica da escala sem alterar as regras da geração. Para uma posição vaga, selecione “Vaga sem candidato” como designado originalmente.</p>
    {erro && <p className="erro">{erro}</p>}
    {msg && <p className="ok">{msg}</p>}
    <div className="panel no-print" data-tour="trocas-lancar">
      <div className="linha">
        <div className="campo"><label>Mês</label><select value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
        <div className="campo"><label>Ano</label><select value={ano} onChange={(e) => setAno(Number(e.target.value))}>{[ano - 1, ano, ano + 1].filter((v, i, a) => a.indexOf(v) === i).map((v) => <option key={v}>{v}</option>)}</select></div>
        {podeEditar && <>
          <div className="campo"><label>Dia</label><select value={data} onChange={(e) => setData(e.target.value)}><option value="">Selecione…</option>{[...new Set(opcoes.map((o) => o.data))].sort().map((d) => <option key={d} value={d}>{formatarDataBR(d)}</option>)}</select></div>
          <div className="campo"><label>Posição</label><select value={posicaoId} onChange={(e) => setPosicaoId(e.target.value)}><option value="">Selecione…</option>{opcoesDoDia.map((o) => <option key={o.posicaoId} value={o.posicaoId}>{o.codigo} — {o.nome}</option>)}</select></div>
          <div className="campo"><label>Designado originalmente</label><select value={origem} onChange={(e) => setOrigem(e.target.value)} disabled={!opcaoAtual}><option value="">Selecione…</option>{opcaoAtual?.promotorId === null && <option value="VAGA">Vaga sem candidato</option>}{opcaoAtual && opcaoAtual.promotorId !== null && <option value={opcaoAtual.promotorId}>{promotores.find((p) => p.id === opcaoAtual.promotorId)?.apelido}</option>}</select></div>
          <div className="campo"><label>Quem assume</label><select value={destino} onChange={(e) => setDestino(e.target.value)}><option value="">Selecione…</option>{promotores.filter((p) => p.id !== opcaoAtual?.promotorId).map((p) => <option key={p.id} value={p.id}>{p.apelido} — {p.nome}</option>)}</select></div>
          <div className="campo"><label>Observação</label><input value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
          <button className="btn" onClick={salvar} disabled={!data || !posicaoId || !origem || !destino}>Lançar ajuste</button>
        </>}
      </div>
      {carregando && <p className="muted" style={{ marginBottom: 0 }}>Carregando posições disponíveis…</p>}
      {!carregando && !opcoes.length && <p className="muted" style={{ marginBottom: 0 }}>Não há posições disponíveis neste mês. Gere a escala antes de lançar ajustes.</p>}
    </div>
    <div className="panel" data-tour="trocas-lista">
      <h3 style={{ marginTop: 0 }}>Trocas / Ajustes lançados</h3>
       {carregando ? <p className="muted">Carregando ajustes…</p> : !trocas.length ? <p className="muted">Nenhum ajuste lançado neste mês.</p> : <table><thead><tr><th>Dia</th><th>Posição</th><th>Designado originalmente</th><th>Quem assume</th><th>Observação</th>{podeEditar && <th className="no-print" />}</tr></thead><tbody>{trocas.map((t) => <tr key={t.id}><td>{formatarDataBR(t.data)}</td><td><strong>{t.posicao?.codigo ?? "—"}</strong> <span className="muted">{t.posicao?.nome}</span></td><td>{t.promotorOrigem ? <><strong>{t.promotorOrigem.apelido}</strong> <span className="muted">{t.promotorOrigem.nome}</span></> : <em className="muted">vaga sem candidato</em>}</td><td><strong>{t.promotorDestino.apelido}</strong> <span className="muted">{t.promotorDestino.nome}</span></td><td className="muted">{t.observacao}</td>{podeEditar && <td className="no-print"><button className="btn mini perigo" onClick={() => excluir(t)}>Excluir</button></td>}</tr>)}</tbody></table>}
    </div>
  </div>;
}
