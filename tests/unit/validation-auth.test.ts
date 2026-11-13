import { describe, expect, it } from "vitest";
import {
  createSalonSchema,
  firstErrors,
  newPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

const validSignUp = {
  fullName: "Ana Souza",
  email: "ana@exemplo.com",
  password: "segredo123",
  salonName: "Barbearia da Ana",
};

describe("signUpSchema", () => {
  it("aceita dados válidos e normaliza o e-mail", () => {
    const r = signUpSchema.safeParse({ ...validSignUp, email: "  Ana@Exemplo.COM " });
    expect(r.success && r.data.email).toBe("ana@exemplo.com");
  });
  it("rejeita senha curta com mensagem em pt-BR", () => {
    const r = signUpSchema.safeParse({ ...validSignUp, password: "1234567" });
    expect(firstErrors(r).password).toBe("A senha deve ter pelo menos 8 caracteres");
  });
  it("rejeita e-mail inválido", () => {
    const r = signUpSchema.safeParse({ ...validSignUp, email: "ana@" });
    expect(firstErrors(r).email).toBe("Informe um e-mail válido");
  });
  it("exige nome do salão", () => {
    const r = signUpSchema.safeParse({ ...validSignUp, salonName: " " });
    expect(firstErrors(r).salonName).toBe("Informe o nome do salão");
  });
});

describe("signInSchema", () => {
  it("exige senha", () => {
    const r = signInSchema.safeParse({ email: "ana@exemplo.com", password: "" });
    expect(firstErrors(r).password).toBe("Informe a senha");
  });
});

describe("newPasswordSchema", () => {
  it("rejeita confirmação diferente", () => {
    const r = newPasswordSchema.safeParse({ password: "segredo123", confirmPassword: "segredo124" });
    expect(firstErrors(r).confirmPassword).toBe("As senhas não conferem");
  });
});

describe("createSalonSchema", () => {
  it("apara espaços do nome", () => {
    const r = createSalonSchema.safeParse({ salonName: "  Salão Bela  " });
    expect(r.success && r.data.salonName).toBe("Salão Bela");
  });
});
