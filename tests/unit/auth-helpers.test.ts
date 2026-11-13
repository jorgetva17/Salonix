import { describe, expect, it } from "vitest";
import { authErrorMessage, safeNextPath } from "@/lib/auth-helpers";

describe("authErrorMessage", () => {
  it("traduz credenciais inválidas", () => {
    expect(authErrorMessage("invalid_credentials")).toBe("E-mail ou senha incorretos");
  });
  it("traduz e-mail já cadastrado", () => {
    expect(authErrorMessage("user_already_exists")).toBe("Este e-mail já está cadastrado");
    expect(authErrorMessage("email_exists")).toBe("Este e-mail já está cadastrado");
  });
  it("usa mensagem genérica para códigos desconhecidos", () => {
    expect(authErrorMessage("algo_novo")).toBe("Não foi possível concluir. Tente novamente.");
    expect(authErrorMessage(undefined)).toBe("Não foi possível concluir. Tente novamente.");
  });
});

describe("safeNextPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeNextPath("/agenda?dia=2026-11-13")).toBe("/agenda?dia=2026-11-13");
  });
  it("rejeita URLs externas e protocol-relative", () => {
    expect(safeNextPath("https://evil.com")).toBe("/painel");
    expect(safeNextPath("//evil.com")).toBe("/painel");
    expect(safeNextPath("/\\evil.com")).toBe("/painel");
  });
  it("rejeita caracteres de controle que o navegador descarta", () => {
    expect(safeNextPath("/\t/evil.com")).toBe("/painel");
    expect(safeNextPath("/\n/evil.com")).toBe("/painel");
  });
  it("rejeita caminhos que viram protocol-relative ao normalizar", () => {
    expect(safeNextPath("/..//evil.com")).toBe("/painel");
    expect(safeNextPath("/.//evil.com")).toBe("/painel");
  });
  it("usa /painel quando ausente", () => {
    expect(safeNextPath(null)).toBe("/painel");
  });
});
