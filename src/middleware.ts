import { NextResponse, type NextRequest } from "next/server";
import { origemPermitida } from "@/lib/origem";

export function middleware(req: NextRequest) {
  if (!origemPermitida(req)) {
    return NextResponse.json({ error: "Origem da requisicao nao permitida" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
