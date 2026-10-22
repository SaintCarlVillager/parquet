import { redirect } from "next/navigation";
import { papelAtual } from "@/lib/auth";
import GradeView from "./GradeView";

export default async function GradePage() {
  const papel = await papelAtual();
  if (!papel) redirect("/login");
  if (papel === "PROMOTOR") redirect("/");
  return <GradeView />;
}
