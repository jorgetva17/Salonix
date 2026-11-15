import { describe, expect, it } from "vitest";
import {
  centsToInput,
  formatPhone,
  isoToZonedLocal,
  parseBRLToCents,
  whatsappLink,
  zonedLocalToIso,
} from "@/lib/format";

describe("parseBRLToCents", () => {
  it.each([
    ["35", 3500],
    ["35,5", 3550],
    ["35,50", 3550],
    ["1.234,56", 123456],
    ["R$ 45,00", 4500],
    ["35.5", 3550],
    ["0", 0],
  ])("%s -> %i", (input, cents) => expect(parseBRLToCents(input)).toBe(cents));

  it.each(["", "abc", "-5", "1,234", "12,3,4"])("rejeita %j", (input) => expect(parseBRLToCents(input)).toBeNull());

  it("não perde centavos por float (0,29 e 1,15)", () => {
    expect(parseBRLToCents("0,29")).toBe(29);
    expect(parseBRLToCents("1,15")).toBe(115);
  });

  it("centsToInput é o inverso", () => expect(centsToInput(4550)).toBe("45,50"));
});

describe("telefone e WhatsApp", () => {
  it("monta o link com 55 quando falta", () => {
    expect(whatsappLink("85999990000")).toBe("https://wa.me/5585999990000");
    expect(whatsappLink("5585999990000", "Olá!")).toBe("https://wa.me/5585999990000?text=Ol%C3%A1!");
  });
  it("formata (DDD) número", () => {
    expect(formatPhone("85999990000")).toBe("(85) 99999-0000");
    expect(formatPhone("8533334444")).toBe("(85) 3333-4444");
    expect(formatPhone(null)).toBe("");
  });
});

describe("fuso horário", () => {
  it("converte horário local de São Paulo para UTC e volta", () => {
    expect(zonedLocalToIso("2026-11-13T10:30")).toBe("2026-11-13T13:30:00.000Z");
    expect(isoToZonedLocal("2026-11-14T02:15:00Z")).toBe("2026-11-13T23:15");
  });
  it("respeita outro fuso (Fortaleza também é UTC-3)", () => {
    expect(zonedLocalToIso("2026-11-13T08:00", "America/Fortaleza")).toBe("2026-11-13T11:00:00.000Z");
  });
});
