// Compartido por RegistrarseClient.tsx (cliente) y app/api/cuestionario/route.ts
// (servidor) — mismo regex, antes copiado literal en ambos (FE-M4, auditoría 26 ago).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}
