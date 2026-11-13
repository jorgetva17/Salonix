import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tudo, exceto arquivos estáticos, ícones, marca e o manifest do PWA.
    "/((?!_next/static|_next/image|favicon.ico|icons/|brand/|manifest.webmanifest|.*\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
