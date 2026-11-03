import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { respuestaComandoSchema, type Comando } from '@/lib/edge/contrato'

// Spec 2026-10-16-enlace-edge-design.md §4.3 y §8: web → Pi, con auditoría de cada comando.

export type EstadoComando = 'ok' | 'error' | 'timeout' | 'pi_inaccesible'

export interface ResultadoComando {
  estado: EstadoComando
  error?: string
  resultado?: unknown
  latenciaMs: number
}

const TIMEOUT_PI_MS = 5_000

export async function enviarComando(args: {
  dispositivo: { id: number; nodeId: string; gateway: { urlBase: string; tokenHash: string } }
  usuarioId: number
  comando: Comando
  fetchImpl?: typeof fetch
}): Promise<ResultadoComando> {
  const { dispositivo, usuarioId, comando, fetchImpl = fetch } = args
  const cmdId = randomUUID()
  const inicio = Date.now()
  let resultado: ResultadoComando

  try {
    // shortcut: HTTP sin TLS en la LAN de la demo, y la Pi se autentica comparando
    // sha256(su token) con este hash; con TLS conviene una clave web → Pi dedicada (spec §7).
    const res = await fetchImpl(`${dispositivo.gateway.urlBase}/v1/comandos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${dispositivo.gateway.tokenHash}` },
      body: JSON.stringify({ v: 1, cmd_id: cmdId, node_id: dispositivo.nodeId, tipo: comando.tipo, payload: comando.payload }),
      signal: AbortSignal.timeout(TIMEOUT_PI_MS),
    })
    const parsed = respuestaComandoSchema.safeParse(await res.json().catch(() => null))
    resultado = parsed.success
      ? { estado: parsed.data.estado, error: parsed.data.error, resultado: parsed.data.resultado, latenciaMs: Math.round(parsed.data.latencia_ms) }
      : { estado: 'error', error: `Respuesta inválida de la Pi (HTTP ${res.status})`, latenciaMs: Date.now() - inicio }
  } catch {
    resultado = { estado: 'pi_inaccesible', error: 'No hay conexión con la Pi', latenciaMs: Date.now() - inicio }
  }

  await prisma.comandoDispositivo.create({
    data: {
      id: cmdId,
      dispositivoId: dispositivo.id,
      usuarioId,
      tipo: comando.tipo,
      payload: JSON.stringify(comando.payload),
      estado: resultado.estado,
      latenciaMs: resultado.latenciaMs,
    },
  })
  return resultado
}
