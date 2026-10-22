import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import SideNav from "@/app/components/SideNav";
import { SessaoProvider } from "@/app/components/SessaoProvider";
import { TourProvider } from "@/app/components/TourProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await sessaoAtual();
  if (!s) redirect("/login");
  const sessao = { nome: s.nome, papel: s.papel, email: s.email };
  return (
    <SessaoProvider sessao={sessao}>
      <TourProvider>
        <div className="app">
          <SideNav {...sessao} />
          <main className="main">{children}</main>
        </div>
      </TourProvider>
    </SessaoProvider>
  );
}
