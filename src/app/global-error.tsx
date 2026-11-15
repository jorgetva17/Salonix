"use client";

/** Último recurso: substitui o layout raiz, por isso traz o próprio <html> e estilos mínimos. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, display: "grid", placeItems: "center", minHeight: "100vh", background: "#f6f8f9", color: "#0f2129" }}>
        <main style={{ maxWidth: "28rem", padding: "2rem", textAlign: "center" }}>
          <h1>Algo deu errado</h1>
          <p>O Salonix encontrou um erro inesperado. Tente novamente.</p>
          <button onClick={reset} style={{ minHeight: 44, padding: "0 1.25rem", borderRadius: 8, border: 0, background: "#1b3b4b", color: "#fff", fontSize: 16, cursor: "pointer" }}>
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
