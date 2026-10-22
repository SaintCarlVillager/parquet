import { redirect } from "next/navigation";
import { papelAtual } from "@/lib/auth";
import UsuariosView from "./UsuariosView";

export default async function UsuariosPage() {
  const papel = await papelAtual();
  if (!papel) redirect("/login");
  if (papel !== "CHEFE") redirect("/");
  return <UsuariosView />;
}
