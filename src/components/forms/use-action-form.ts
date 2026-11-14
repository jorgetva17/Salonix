"use client";

import { useActionState, useTransition, type FormEvent } from "react";
import type { FormState } from "@/lib/action-result";

/**
 * useActionState com envio pelo onSubmit. Com <form action={...}> o React 19
 * limpa os campos não controlados a cada envio, inclusive quando a action
 * devolve erro de validação; assim o que a pessoa digitou continua no formulário.
 */
export function useActionForm(
  action: (prev: FormState, formData: FormData) => Promise<FormState>,
  initialState: FormState,
) {
  const [state, dispatch, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return [state, onSubmit, pending] as const;
}
