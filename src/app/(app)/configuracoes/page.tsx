import { redirect } from "next/navigation";
import { papelAtual } from "@/lib/auth";
import AcoesExcel from "@/app/components/AcoesExcel";
import LimparEscalasBotao from "@/app/components/LimparEscalasBotao";

export default async function ConfiguracoesPage() {
  const papel = await papelAtual();
  if (!papel) redirect("/login");
  const chefe = papel === "CHEFE";

  return (
    <div>
      <h1 className="page-titulo" data-tour="configuracoes-titulo">Configurações</h1>
      <AcoesExcel chefe={chefe} />
      {chefe && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Manutenção</h2>
          <p className="muted">Apague as escalas e suas designações para recomeçar a geração. Cadastros, regras, grade, feriados, portarias e usuários serão preservados.</p>
          <LimparEscalasBotao />
        </div>
      )}
    </div>
  );
}
