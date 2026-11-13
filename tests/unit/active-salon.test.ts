import { describe, expect, it } from "vitest";
import { pickActiveMembership, type Membership } from "@/lib/salon/membership";

const a: Membership = { salonId: "a", role: "admin", salonName: "Salão A" };
const b: Membership = { salonId: "b", role: "reception", salonName: "Salão B" };

describe("pickActiveMembership", () => {
  it("usa o salão do cookie quando o usuário é membro dele", () => {
    expect(pickActiveMembership([a, b], "b")).toEqual(b);
  });
  it("cai para o primeiro salão quando o cookie aponta para salão sem vínculo", () => {
    expect(pickActiveMembership([a, b], "zzz")).toEqual(a);
  });
  it("usa o primeiro salão quando não há cookie", () => {
    expect(pickActiveMembership([a, b])).toEqual(a);
  });
  it("retorna null sem vínculos", () => {
    expect(pickActiveMembership([], "a")).toBeNull();
  });
});
