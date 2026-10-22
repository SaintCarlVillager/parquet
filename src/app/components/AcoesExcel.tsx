"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ImportarExcel from "./ImportarExcel";

export default function AcoesExcel({ chefe }: { chefe: boolean }) {
  const router = useRouter();
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  function aoConcluir(texto: string, ok: boolean) {
    setErro(ok ? "" : texto);
    setMensagem(ok ? texto : "");
    if (ok) router.refresh();
  }

  return (
    <div className="panel no-print" data-tour="configuracoes-acoes">
      <h3 style={{ marginTop: 0 }}>Backup e restauração</h3>
      <p className="muted">Exporte um backup das configurações ou importe uma planilha preenchida conforme o modelo exportado.</p>
      <div className="linha">
        <a
          className="btn secundario"
          href="/api/configuracoes/export"
          title="Baixa um arquivo Excel com promotores, regras, grade e portarias para consulta ou backup"
        >
          Exportar Excel
        </a>
        {chefe && (
          <>
            <span title="Atualiza promotores, cargos administrativos e portarias a partir de uma planilha Excel">
              <ImportarExcel
                url={["/api/promotores/import", "/api/portarias/import"]}
                rotulo="Importar Excel"
                onConcluido={aoConcluir}
              />
            </span>
          </>
        )}
      </div>
      {erro && <p className="erro">{erro}</p>}
      {mensagem && <p className="sucesso">{mensagem}</p>}
    </div>
  );
}
