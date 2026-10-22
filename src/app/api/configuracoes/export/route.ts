import { gerarWorkbookConfiguracoes } from "@/lib/excelExport";
import { TODOS, exigir } from "@/lib/auth";
import { withApiError } from "@/lib/errosApi";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

async function getHandler(req: Request) {
  const g = await exigir(req, TODOS);
  if ("erro" in g) return g.erro;
  const wb = await gerarWorkbookConfiguracoes();
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="configuracoes-escala.xlsx"',
    },
  });
}

export const GET = withApiError("configuracoes.export.GET", getHandler);
