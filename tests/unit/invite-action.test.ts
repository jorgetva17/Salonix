import { describe, expect, it } from "vitest";
import { needsPasswordSetup, sendInviteEmail, type InviteMailer } from "@/lib/invites";
import { firstErrors } from "@/lib/validation/auth";
import { inviteSchema } from "@/lib/validation/team";

const mailer = (error: { code?: string; message: string } | null): InviteMailer => ({
  inviteUserByEmail: async () => ({ error }),
});

describe("sendInviteEmail", () => {
  it("retorna existingUser=false quando o convite é enviado", async () => {
    await expect(sendInviteEmail(mailer(null), "a@b.com", "http://x/convite")).resolves.toEqual({
      existingUser: false,
    });
  });
  it("trata e-mail já cadastrado como sucesso (convite aparece no próximo login)", async () => {
    await expect(
      sendInviteEmail(mailer({ code: "email_exists", message: "exists" }), "a@b.com", "http://x"),
    ).resolves.toEqual({ existingUser: true });
  });
  it("propaga outros erros", async () => {
    await expect(
      sendInviteEmail(mailer({ code: "unexpected_failure", message: "boom" }), "a@b.com", "http://x"),
    ).rejects.toThrow("boom");
  });
});

describe("inviteSchema", () => {
  it("aceita papel válido e normaliza e-mail", () => {
    const r = inviteSchema.safeParse({ email: " Joao@X.com ", role: "professional" });
    expect(r.success && r.data).toEqual({ email: "joao@x.com", role: "professional" });
  });
  it("rejeita papel desconhecido", () => {
    const r = inviteSchema.safeParse({ email: "joao@x.com", role: "dono" });
    expect(firstErrors(r).role).toBe("Escolha um perfil");
  });
});

describe("needsPasswordSetup", () => {
  it("pede senha para quem chegou por convite e ainda não definiu", () => {
    expect(needsPasswordSetup({ invited_at: "2026-11-13T10:00:00Z", user_metadata: {} })).toBe(true);
  });
  it("não pede depois de definida", () => {
    expect(needsPasswordSetup({ invited_at: "2026-11-13T10:00:00Z", user_metadata: { password_set: true } })).toBe(false);
  });
  it("não pede para quem se cadastrou sozinho", () => {
    expect(needsPasswordSetup({ user_metadata: {} })).toBe(false);
    expect(needsPasswordSetup(null)).toBe(false);
  });
});
