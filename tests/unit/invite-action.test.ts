import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert, inviteUserByEmail, revalidatePath } = vi.hoisted(() => ({
  insert: vi.fn(),
  inviteUserByEmail: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/site/url", () => ({ getSiteUrl: async () => "http://localhost:3000" }));
vi.mock("@/lib/salon/active-salon", () => ({
  requireRole: async () => ({ membership: { salonId: "salon-1", role: "admin", salonName: "A" } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => ({ insert }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { inviteUserByEmail } } }),
}));

import { inviteMember } from "@/app/(app)/equipe/actions";

const form = (email: string, role = "reception") => {
  const f = new FormData();
  f.set("email", email);
  f.set("role", role);
  return f;
};

describe("inviteMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mantém o convite quando o usuário já existe", async () => {
    insert.mockResolvedValue({ error: null });
    inviteUserByEmail.mockResolvedValue({ error: { message: "A user with this email address has already been registered" } });
    const result = await inviteMember(null, form("ja@existe.com"));
    expect(result).toEqual({ ok: true, existingUser: true });
    expect(insert).toHaveBeenCalledTimes(1); // convite gravado e não removido
  });

  it("envia o e-mail para conta nova", async () => {
    insert.mockResolvedValue({ error: null });
    inviteUserByEmail.mockResolvedValue({ error: null });
    expect(await inviteMember(null, form("novo@teste.com"))).toEqual({ ok: true });
    expect(inviteUserByEmail).toHaveBeenCalledWith("novo@teste.com", {
      redirectTo: "http://localhost:3000/auth/callback?next=/convite/aceitar",
    });
  });

  it("recusa convite pendente duplicado sem enviar e-mail", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: "duplicate" } });
    const result = await inviteMember(null, form("dup@teste.com"));
    expect(result).toMatchObject({ ok: false, error: "Já existe um convite pendente para este e-mail" });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("valida o e-mail", async () => {
    const result = await inviteMember(null, form("invalido"));
    expect(result).toMatchObject({ ok: false, fieldErrors: { email: "Informe um e-mail válido" } });
  });
});
