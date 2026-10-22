"use client";

import { useRouter } from "next/navigation";
import { httpJson, mensagemHttp } from "@/lib/http";

export default function LimparEscalasBotao() {
  const router = useRouter();

  async function limpar() {
    if (!confirm("Limpar todas as escalas? Esta ação apagará as escalas e designações, mas preservará os cadastros e configurações.")) return;
    try {
      const resultado = await httpJson<{ apagadas: number }>("/api/configuracoes/reset", { method: "POST" });
      alert(`${resultado.apagadas} escala(s) apagada(s).`);
      router.refresh();
    } catch (e) {
      alert(mensagemHttp(e, "Não foi possível limpar as escalas."));
    }
  }

  return <button className="btn perigo" onClick={limpar}>Limpar todas as escalas</button>;
}
