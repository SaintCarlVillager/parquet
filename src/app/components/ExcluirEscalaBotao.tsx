"use client";

import { useRouter } from "next/navigation";
import { httpJson, mensagemHttp } from "@/lib/http";
import { useConfirmacao } from "@/app/components/ConfirmacaoProvider";

export default function ExcluirEscalaBotao({ id, rotulo }: { id: number; rotulo: string }) {
  const router = useRouter();
  const { confirmar, avisar } = useConfirmacao();
  return (
    <button
      className="btn mini perigo"
      onClick={async () => {
        if (!(await confirmar({ titulo: `Excluir a escala ${rotulo}?`, mensagem: "As designações serão apagadas e a ação não pode ser desfeita.", acao: "Excluir" }))) return;
        try { await httpJson(`/api/escalas/${id}`, { method: "DELETE" }); }
        catch (e) { await avisar(mensagemHttp(e), "Não foi possível excluir"); return; }
        router.refresh();
      }}
    >
      Excluir
    </button>
  );
}
