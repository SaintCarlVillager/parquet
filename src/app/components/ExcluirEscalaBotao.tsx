"use client";

import { useRouter } from "next/navigation";
import { httpJson, mensagemHttp } from "@/lib/http";

export default function ExcluirEscalaBotao({ id, rotulo }: { id: number; rotulo: string }) {
  const router = useRouter();
  return (
    <button
      className="btn mini perigo"
      onClick={async () => {
        if (!confirm(`Excluir a escala ${rotulo}? As designações serão apagadas e a ação não pode ser desfeita.`)) return;
        try { await httpJson(`/api/escalas/${id}`, { method: "DELETE" }); }
        catch (e) { alert(mensagemHttp(e)); return; }
        router.refresh();
      }}
    >
      Excluir
    </button>
  );
}
