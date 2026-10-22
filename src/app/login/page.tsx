"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { httpJson, mensagemHttp } from "@/lib/http";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const mensagem = window.sessionStorage.getItem("escala_http_erro");
    if (mensagem) {
      setErro(mensagem);
      window.sessionStorage.removeItem("escala_http_erro");
    }
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await httpJson("/api/login", { method: "POST", body: { email, senha } });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setErro(mensagemHttp(e, "Falha no login"));
    } finally {
      setCarregando(false);
    }
  }

  const ambiente = (process.env.NEXT_PUBLIC_AMBIENTE ?? "local") as "local" | "preview" | "production";
  const rotuloAmbiente = { local: "DEV LOCAL", preview: "PREVIEW", production: "PRODUÇÃO" }[ambiente];

  return (
    <div className="login-fundo">
      <form className="login-caixa" onSubmit={entrar}>
        <div className="login-logo">
          <div className="logo-mpsp">
            <span className="mp">MP</span>
            <span className="sp">SP</span>
          </div>
          <h1>Escala de Audiências Criminais</h1>
        </div>
        <label className="campo">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>
        <label className="campo">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {erro && <div className="login-erro">{erro}</div>}
        <button type="submit" className="btn primario" disabled={carregando}>
          {carregando ? "Entrando..." : "Entrar"}
        </button>
        <span className={`badge-ambiente ${ambiente}`}>{rotuloAmbiente}</span>
      </form>
    </div>
  );
}
