import type { ActionResult } from "@/lib/action-result";
import { failed } from "@/lib/actions/parse";

export type RpcError = { code?: string; message: string };

/** Mensagens das RPCs (P0001) já são para o usuário; o resto vira texto genérico. */
export function rpcFailure(error: RpcError): ActionResult {
  if (error.code === "42501") return failed("Você não tem permissão para esta ação");
  if (error.code === "P0001") return failed(error.message);
  return failed("Não foi possível concluir. Tente novamente");
}
