import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { isSupabaseConfigured } from "./env";

const PUBLIC_PATHS = [
  "/entrar",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
  "/convite/aceitar",
  "/auth/callback",
  "/manifest.webmanifest",
];
const PUBLIC_PREFIXES = ["/icons/", "/brand/"];
const GUEST_ONLY = ["/entrar", "/cadastro", "/recuperar-senha"];
const AUTH_PAGES = ["/redefinir-senha", "/convite/aceitar", "/auth/callback"];

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

const SETUP_PAGE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configuração pendente · Salonix</title>
<style>body{font-family:system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f6f8f9;color:#0f2129}main{max-width:32rem;padding:2rem}code{background:#e8eef1;padding:.1rem .35rem;border-radius:4px}</style></head>
<body><main><h1>Configuração pendente</h1><p>O Salonix ainda não está conectado ao banco de dados. Cadastre as variáveis de ambiente
<code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (e <code>SUPABASE_SERVICE_ROLE_KEY</code> no servidor) e publique de novo.</p></main></body></html>`;

/** Renova a sessão e protege as rotas privadas. */
export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    // Sem Supabase nada funciona: resposta clara em vez de erro 500 genérico.
    if (isPublicPath(request.nextUrl.pathname) && !GUEST_ONLY.includes(request.nextUrl.pathname) && !AUTH_PAGES.includes(request.nextUrl.pathname)) {
      return NextResponse.next({ request });
    }
    return new NextResponse(SETUP_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname, search } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (user && GUEST_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
