export type ActionResult =
  | { ok: true; existingUser?: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
