"use client";

import { useRef, useState } from "react";
import { httpFormData, mensagemHttp } from "@/lib/http";

export interface ResumoImportacao {
  ok: boolean;
  criados?: number;
  atualizados?: number;
  ignorados?: number;
  cargosAtualizados?: number;
  erros?: { linha: number; erro: string }[];
  erro?: string;
}

export function resumoEmTexto(r: ResumoImportacao): string {
  if (!r.ok && r.erro) return r.erro;
  const partes: string[] = [];
  if (r.criados) partes.push(`${r.criados} criado(s)`);
  if (r.atualizados) partes.push(`${r.atualizados} atualizado(s)`);
  if (r.ignorados) partes.push(`${r.ignorados} já existente(s) — ignorado(s)`);
  if (r.cargosAtualizados) partes.push(`${r.cargosAtualizados} cargo(s) administrativo(s) atualizado(s)`);
  let texto = partes.length ? `Importação concluída: ${partes.join(", ")}.` : "Nada a importar.";
  if (r.erros?.length) {
    texto += ` ${r.erros.length} linha(s) com erro: ${r.erros
      .slice(0, 5)
      .map((e) => `linha ${e.linha}: ${e.erro}`)
      .join("; ")}`;
  }
  return texto;
}

export default function ImportarExcel({
  url,
  onConcluido,
  rotulo = "Importar Excel",
}: {
  url: string | string[];
  onConcluido: (texto: string, ok: boolean) => void;
  rotulo?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setSubindo(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const urls = Array.isArray(url) ? url : [url];
      const resultados: string[] = [];
      let falhou = false;
      for (const destino of urls) {
        try {
          const data = await httpFormData<ResumoImportacao>(destino, fd, { method: "POST" });
          resultados.push(resumoEmTexto(data));
        } catch (e) {
          falhou = true;
          resultados.push(mensagemHttp(e, "Falha na importação"));
        }
      }
      onConcluido(resultados.join(" "), !falhou);
    } finally {
      setSubindo(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <>
      <input ref={ref} type="file" accept=".xlsx,.xlsm" style={{ display: "none" }} onChange={aoEscolher} />
      <button className="btn secundario" disabled={subindo} onClick={() => ref.current?.click()}>
        {subindo ? "Importando…" : rotulo}
      </button>
    </>
  );
}
