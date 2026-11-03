import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Fotos de evidencia de los eventos (cámara del nodo → Pi → web). Se guardan fuera de public/:
// solo se sirven por GET /api/evidencia/[eventoId], que revisa quién puede verlas.

export const EVIDENCIA_MAX_BYTES = 2 * 1024 * 1024
// El id lo genera la Pi (uuid4/uuid5): validarlo evita escapar de la carpeta con "../".
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const idValido = (id: string) => ID.test(id)

export function carpetaEvidencias(): string {
  return process.env.EVIDENCIAS_DIR ?? path.join(process.cwd(), 'storage', 'evidencias')
}

/** JPEG = empieza con FF D8 FF. Lo que no lo sea no se guarda. */
export const esJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff

export async function guardarEvidencia(id: string, jpeg: Uint8Array): Promise<string> {
  const archivo = `${id}.jpg`
  await mkdir(carpetaEvidencias(), { recursive: true })
  await writeFile(path.join(carpetaEvidencias(), archivo), jpeg)
  return archivo
}

export async function leerEvidencia(archivo: string): Promise<Buffer | null> {
  if (!idValido(archivo.replace(/\.jpg$/, ''))) return null
  return readFile(path.join(carpetaEvidencias(), archivo)).catch(() => null)
}
