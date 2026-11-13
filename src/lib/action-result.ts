export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Estado retornado pelas actions usadas com useActionState. */
export type FormState = ActionResult | { ok: true; message: string } | null;
