"use client";

import { useEffect, useState } from "react";
import { DIAS_SEMANA } from "@/lib/datas";
import { podeEditar, useSessao } from "@/app/components/SessaoProvider";
import { httpJson, mensagemHttp } from "@/lib/http";

interface Posicao { id: number; codigo: string; nome: string; grupo: string; ordem: number }
interface GradeItem { diaSemana: number; posicaoId: number }
interface GrupoCarga { grupo: string; nome: string; peso: number }

const ROTULO_GRUPO: Record<string, string> = {
  CUSTODIA: "Custódia",
  AUDIENCIAS: "Audiências (Varas)",
  PLANTAO: "Plantão",
};

export default function GradeView() {
  const { papel } = useSessao();
  const chefe = podeEditar(papel);
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [grade, setGrade] = useState<Set<string>>(new Set());
  const [grupos, setGrupos] = useState<GrupoCarga[]>([]);
  const [msg, setMsg] = useState("");

  async function carregar() {
    try {
      const data = await httpJson<{ posicoes: Posicao[]; gradeItens: GradeItem[]; grupos: GrupoCarga[] }>("/api/grade");
      setPosicoes(data.posicoes);
      setGrade(new Set(data.gradeItens.map((g: GradeItem) => `${g.diaSemana}|${g.posicaoId}`)));
      setGrupos(data.grupos);
    } catch (e) { setMsg(mensagemHttp(e, "Falha ao carregar grade")); }
  }
  useEffect(() => { carregar(); }, []);

  function toggle(dia: number, posId: number) {
    const key = `${dia}|${posId}`;
    const nova = new Set(grade);
    if (nova.has(key)) nova.delete(key);
    else nova.add(key);
    setGrade(nova);
  }

  async function salvarGrade() {
    try { await httpJson("/api/grade", { method: "PUT", body: {
        grupos: grupos.map((g) => ({ grupo: g.grupo, peso: g.peso })),
        gradeItens: [...grade].map((k) => {
          const [d, p] = k.split("|");
          return { diaSemana: Number(d), posicaoId: Number(p) };
        }),
      } }); } catch (e) { setMsg(mensagemHttp(e)); return; }
    setMsg("Grade salva com sucesso.");
    setTimeout(() => setMsg(""), 3000);
    carregar();
  }

  return (
    <div>
      <h2 data-tour="grade-titulo">Grade de posições</h2>
      <p className="muted">
        Define quais posições existem em cada dia da semana (padrão semanal). Para ligar/desligar posições em
        datas específicas, use a aba <a href="/excecoes">Exceções</a>.
      </p>
      <div className="linha no-print" style={{ marginBottom: 14 }}>
        <button className="btn secundario" onClick={() => window.print()}>Imprimir / PDF</button>
      </div>
      {msg && <p className="sucesso">{msg}</p>}

      <div className="panel" data-tour="grade-grade">
        <h3 style={{ marginTop: 0 }}>Carga ponderada por grupo</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          A distribuição equilibra três cargas separadas: cada promotor é comparado aos demais dentro de cada grupo.
        </p>
        <div className="linha">
          {grupos.map((g) => (
            <div className="campo" key={g.grupo}>
              <label>{g.nome}</label>
              {chefe ? (
                <input
                  type="number"
                  step="0.5"
                  value={g.peso}
                  style={{ width: 90 }}
                  onChange={(e) =>
                    setGrupos(grupos.map((x) => (x.grupo === g.grupo ? { ...x, peso: Number(e.target.value) } : x)))
                  }
                />
              ) : (
                <div style={{ paddingTop: 6, fontWeight: "bold" }}>{g.peso}</div>
              )}
            </div>
          ))}
        </div>

        <table>
          <thead>
            <tr>
              <th>Posição</th>
              <th>Grupo</th>
              {DIAS_SEMANA.slice(1, 6).map((d, i) => (
                <th key={d}>{DIAS_SEMANA[i + 1]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posicoes.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.codigo}</strong> — {p.nome}{p.codigo === "C" ? " (fixa em todos os dias úteis)" : ""}</td>
                <td>{ROTULO_GRUPO[p.grupo] ?? p.grupo}</td>
                {[1, 2, 3, 4, 5].map((dia) => (
                  <td key={dia} style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={p.codigo === "C" ? true : grade.has(`${dia}|${p.id}`)}
                      disabled={!chefe || p.codigo === "C"}
                      title={p.codigo === "C" ? "Custódia é fixa em todos os dias úteis (preenchimento manual)" : undefined}
                      onChange={() => toggle(dia, p.id)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {chefe && (
          <p className="no-print">
            <button className="btn" onClick={salvarGrade}>Salvar grade e pesos</button>
          </p>
        )}
      </div>
    </div>
  );
}
