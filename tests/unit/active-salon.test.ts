import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));

import { pickActiveMembership, type Membership } from "@/lib/salon/active-salon";

const a: Membership = { salonId: "a", role: "admin", salonName: "A" };
const b: Membership = { salonId: "b", role: "reception", salonName: "B" };

describe("pickActiveMembership", () => {
  it("usa o salão do cookie quando ele está na lista", () => {
    expect(pickActiveMembership([a, b], "b")).toBe(b);
  });
  it("cai para o primeiro quando o cookie aponta para salão sem vínculo", () => {
    expect(pickActiveMembership([a, b], "zzz")).toBe(a);
    expect(pickActiveMembership([a, b])).toBe(a);
  });
  it("retorna null sem vínculos", () => {
    expect(pickActiveMembership([], "a")).toBeNull();
  });
});
