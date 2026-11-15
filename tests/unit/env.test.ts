import { describe, expect, it } from "vitest";
import { isSupabaseConfigured } from "@/lib/supabase/env";

describe("isSupabaseConfigured", () => {
  it("exige URL e chave anônima preenchidas", () => {
    expect(isSupabaseConfigured({ NEXT_PUBLIC_SUPABASE_URL: "http://x", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })).toBe(true);
    expect(isSupabaseConfigured({ NEXT_PUBLIC_SUPABASE_URL: "http://x" })).toBe(false);
    expect(isSupabaseConfigured({ NEXT_PUBLIC_SUPABASE_URL: " ", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })).toBe(false);
    expect(isSupabaseConfigured({})).toBe(false);
  });
});
