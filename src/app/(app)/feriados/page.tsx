import { redirect } from "next/navigation";
import { papelAtual } from "@/lib/auth";
import FeriadosView from "./FeriadosView";

export default async function FeriadosPage() {
  const papel = await papelAtual();
  if (!papel) redirect("/login");
  if (papel === "PROMOTOR") redirect("/");
  return <FeriadosView />;
}
