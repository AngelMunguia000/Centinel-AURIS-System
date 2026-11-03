import jwt from "jsonwebtoken"
import { prisma } from "@/lib/prisma"
import { descifrarSecreto, hashRespaldo, verificarTotp } from "@/lib/totp"

// Verificación en dos pasos (roadmap de funciones #8). Tras la contraseña (o el OAuth) la cuenta
// con 2 pasos no recibe sesión: recibe un "desafío" firmado de 5 min que solo canjea
// POST /api/login/2fa junto con un código. El desafío no trae `sid`, así que no autentica nada.

type Desafio = { userId: number; recordarme: boolean; via: "password" | "oauth"; proposito: "2fa" }

function secreto(): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error("JWT_SECRET no está configurado")
  return s
}

export function crearDesafio(d: Omit<Desafio, "proposito">): string {
  return jwt.sign({ ...d, proposito: "2fa" }, secreto(), { expiresIn: "5m" })
}

export function leerDesafio(token: unknown): Desafio | null {
  if (typeof token !== "string") return null
  try {
    const d = jwt.verify(token, secreto()) as Desafio
    return d.proposito === "2fa" && typeof d.userId === "number" ? d : null
  } catch {
    return null
  }
}

/**
 * Código de la app (6 dígitos) o de respaldo (XXXX-XXXX, se gasta al usarlo).
 * Devuelve cómo pasó, o null si no pasó.
 */
export async function verificarSegundoPaso(
  usuario: { id: number; totpSecreto: string | null; codigosRespaldo: string | null },
  codigo: unknown
): Promise<"app" | "respaldo" | null> {
  if (!usuario.totpSecreto || typeof codigo !== "string" || codigo.length > 20) return null
  // shortcut: el mismo código de la app vale de nuevo dentro de su ventana (30–90 s); para impedirlo,
  // guardar el último paso TOTP usado en Usuario y rechazar los que no sean mayores.
  if (verificarTotp(descifrarSecreto(usuario.totpSecreto), codigo)) return "app"

  const hashes: string[] = usuario.codigosRespaldo ? JSON.parse(usuario.codigosRespaldo) : []
  const h = hashRespaldo(codigo)
  if (!hashes.includes(h)) return null
  // Condicionado al valor leído: dos usos simultáneos del mismo código no pasan los dos.
  const { count } = await prisma.usuario.updateMany({
    where: { id: usuario.id, codigosRespaldo: usuario.codigosRespaldo },
    data: { codigosRespaldo: JSON.stringify(hashes.filter((x) => x !== h)) },
  })
  return count === 1 ? "respaldo" : null
}

export function codigosRestantes(codigosRespaldo: string | null): number {
  return codigosRespaldo ? (JSON.parse(codigosRespaldo) as string[]).length : 0
}
