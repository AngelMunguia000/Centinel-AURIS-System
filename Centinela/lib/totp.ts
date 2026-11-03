import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

// Verificación en dos pasos (roadmap de funciones #8): TOTP de RFC 6238 (30 s, 6 dígitos,
// HMAC-SHA1), lo que usan Google Authenticator, Microsoft Authenticator, Authy, etc.

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const PASO_S = 30

export function base32(bytes: Buffer): string {
  let bits = ""
  for (const b of bytes) bits += b.toString(2).padStart(8, "0")
  let salida = ""
  for (let i = 0; i < bits.length; i += 5) salida += ALFABETO[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)]
  return salida
}

function desdeBase32(texto: string): Buffer {
  let bits = ""
  for (const c of texto.replace(/=+$/, "").toUpperCase()) {
    const v = ALFABETO.indexOf(c)
    if (v < 0) throw new Error("base32 inválido")
    bits += v.toString(2).padStart(5, "0")
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

export function nuevoSecreto(): string {
  return base32(randomBytes(20))
}

export function codigoTotp(secreto: string, ms: number = Date.now()): string {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(Math.floor(ms / 1000 / PASO_S)))
  const h = createHmac("sha1", desdeBase32(secreto)).update(contador).digest()
  const o = h[h.length - 1] & 0xf
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0")
}

/** Acepta el código actual y uno de cada lado (±30 s) por relojes desfasados. */
export function verificarTotp(secreto: string, codigo: string, ms: number = Date.now()): boolean {
  const limpio = codigo.replace(/\s/g, "")
  if (!/^\d{6}$/.test(limpio)) return false
  return [-1, 0, 1].some((d) => {
    const esperado = codigoTotp(secreto, ms + d * PASO_S * 1000)
    return timingSafeEqual(Buffer.from(esperado), Buffer.from(limpio))
  })
}

export function uriOtpauth(secreto: string, cuenta: string): string {
  return `otpauth://totp/${encodeURIComponent(`Centinela:${cuenta}`)}?secret=${secreto}&issuer=Centinela&digits=6&period=${PASO_S}`
}

// El secreto se guarda cifrado (AES-256-GCM) con una llave derivada de JWT_SECRET: una copia de la
// base de datos sola no basta para generar códigos.
function llave(): Buffer {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error("JWT_SECRET no está configurado")
  return createHash("sha256").update(`centinela-totp:${s}`).digest()
}

export function cifrarSecreto(secreto: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv("aes-256-gcm", llave(), iv)
  const datos = Buffer.concat([c.update(secreto, "utf8"), c.final()])
  return [iv, c.getAuthTag(), datos].map((b) => b.toString("base64")).join(".")
}

export function descifrarSecreto(guardado: string): string {
  const [iv, tag, datos] = guardado.split(".").map((p) => Buffer.from(p, "base64"))
  const d = createDecipheriv("aes-256-gcm", llave(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(datos), d.final()]).toString("utf8")
}

/** 8 códigos de respaldo "XXXX-XXXX"; se guardan solo sus hashes y cada uno sirve una vez. */
export function nuevosCodigosRespaldo(): { codigos: string[]; hashes: string[] } {
  const codigos = Array.from({ length: 8 }, () => {
    const t = base32(randomBytes(5)).slice(0, 8)
    return `${t.slice(0, 4)}-${t.slice(4)}`
  })
  return { codigos, hashes: codigos.map(hashRespaldo) }
}

export function hashRespaldo(codigo: string): string {
  return createHash("sha256").update(codigo.replace(/[\s-]/g, "").toUpperCase()).digest("hex")
}
