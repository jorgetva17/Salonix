import { describe, expect, it } from "vitest";
import { escapeLike, normalizeSearch } from "@/lib/search";

describe("normalizeSearch", () => {
  it("remove acentos, espaços nas pontas e maiúsculas", () => {
    expect(normalizeSearch(" João ")).toBe("joao");
    expect(normalizeSearch("JOSÉ ÁVILA")).toBe("jose avila");
  });
});

describe("escapeLike", () => {
  it("escapa curingas do LIKE", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
