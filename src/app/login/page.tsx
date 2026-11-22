"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
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
    if (carregando) return;
    setErro("");
    if (!email.trim() || !senha) {
      setErro("Informe e-mail e senha.");
      return;
    }
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
    <main className="login-fundo">
      <Card width="100%" maxWidth={400} padding={8} elevation="high">
        <form id="conteudo-principal" onSubmit={entrar} aria-labelledby="login-titulo" tabIndex={-1} noValidate>
          <VStack gap={4}>
            <div className="login-logo">
              <div className="logo-mpsp" aria-hidden="true">
                <span className="mp">MP</span>
                <span className="sp">SP</span>
              </div>
              <h1 id="login-titulo">Escala de Audiências Criminais</h1>
            </div>
            <TextInput
              label="E-mail"
              type="email"
              htmlName="email"
              inputMode="email"
              value={email}
              onChange={setEmail}
              autoComplete="username"
              hasSpellCheck={false}
              autoCapitalize="none"
              hasAutoCorrect={false}
              hasAutoFocus
              size="lg"
            />
            <TextInput
              label="Senha"
              type="password"
              htmlName="password"
              value={senha}
              onChange={setSenha}
              autoComplete="current-password"
              size="lg"
            />
            {erro && <Banner status="error" title={erro} role="alert" />}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              width="100%"
              label={carregando ? "Entrando…" : "Entrar"}
              isLoading={carregando}
            />
            <span className={`badge-ambiente ${ambiente}`}>{rotuloAmbiente}</span>
          </VStack>
        </form>
      </Card>
    </main>
  );
}
