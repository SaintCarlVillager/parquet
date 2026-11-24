"use client";

import { useRouter } from "next/navigation";
import { httpJson, mensagemHttp } from "@/lib/http";
import { useConfirmacao } from "@/app/components/ConfirmacaoProvider";

export default function LimparEscalasBotao() {
  const router = useRouter();
  const { confirmar, avisar } = useConfirmacao();

  async function limpar() {
    if (!(await confirmar({ titulo: "Limpar todas as escalas?", mensagem: "Esta ação apagará as escalas e designações, mas preservará os cadastros e configurações.", acao: "Limpar escalas" }))) return;
    try {
      const resultado = await httpJson<{ apagadas: number }>("/api/configuracoes/reset", { method: "POST" });
      router.refresh();
      await avisar(`${resultado.apagadas} escala(s) apagada(s).`, "Escalas limpas");
    } catch (e) {
      await avisar(mensagemHttp(e, "Não foi possível limpar as escalas."), "Não foi possível limpar");
    }
  }

  return <button className="btn perigo" onClick={limpar}>Limpar todas as escalas</button>;
}
