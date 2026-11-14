/** Só dígitos, DDD + número (10 ou 11); aceita "+55" na frente. null se inválido. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? digits : null;
}

/** "11988887777" → "(11) 98888-7777"; "1133334444" → "(11) 3333-4444". */
export function formatPhone(digits: string): string {
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  const split = number.length - 4;
  return `(${ddd}) ${number.slice(0, split)}-${number.slice(split)}`;
}
