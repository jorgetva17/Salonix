import { describe, expect, it } from "vitest";
import {
  fieldErrorsOf,
  newPasswordSchema,
  signUpSchema,
  translateAuthError,
} from "@/lib/validation/auth";

describe("validação de auth", () => {
  it("rejeita senha de 7 caracteres", () => {
    const r = signUpSchema.safeParse({ fullName: "Ana", email: "a@b.com", password: "1234567", salonName: "Salão" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrorsOf(r.error).password).toBe("A senha deve ter pelo menos 8 caracteres");
  });

  it("rejeita e-mail inválido", () => {
    const r = signUpSchema.safeParse({ fullName: "Ana", email: "ana", password: "12345678", salonName: "Salão" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrorsOf(r.error).email).toBe("Informe um e-mail válido");
  });

  it("normaliza o e-mail", () => {
    const r = signUpSchema.parse({ fullName: "Ana", email: "  ANA@Test.com ", password: "12345678", salonName: "Salão" });
    expect(r.email).toBe("ana@test.com");
  });

  it("exige confirmação de senha igual", () => {
    const r = newPasswordSchema.safeParse({ password: "12345678", confirmPassword: "87654321" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrorsOf(r.error).confirmPassword).toBe("As senhas não conferem");
  });

  it("traduz erros do Supabase", () => {
    expect(translateAuthError("Invalid login credentials")).toBe("E-mail ou senha incorretos");
    expect(translateAuthError("User already registered")).toBe("Este e-mail já está cadastrado");
  });
});
