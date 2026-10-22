import { redirect } from "next/navigation";
import { papelAtual } from "@/lib/auth";
import ExcecoesView from "./ExcecoesView";

export default async function ExcecoesPage() {
  const papel = await papelAtual();
  if (!papel) redirect("/login");
  if (papel === "PROMOTOR") redirect("/");
  return <ExcecoesView />;
}
