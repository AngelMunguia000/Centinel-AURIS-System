import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUsuario } from '@/lib/auth'
import { suscribir } from '@/lib/edge/bus'
import { snapshotPara, visiblePara } from '@/lib/edge/estado'

// Spec 2026-10-16-enlace-edge-design.md §4.4: estado en vivo de los nodos edge por SSE.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// El snapshot periódico es lo que convierte "Pi desenchufada" en sin_contacto sin que
// llegue ningún mensaje, y de paso mantiene viva la conexión a través de proxies.
const SNAPSHOT_MS = 5_000

export async function GET(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!usuario.permisos.has('dispositivos.propios') && !usuario.permisos.has('dispositivos.otros')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const encoder = new TextEncoder()
  let limpiar = () => {}

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let cerrado = false
      const enviar = (evento: string, datos: unknown) => {
        if (!cerrado) controller.enqueue(encoder.encode(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`))
      }
      const enviarSnapshot = async () => {
        try {
          enviar('snapshot', await snapshotPara(usuario))
        } catch (error) {
          console.error('[edge] snapshot SSE falló:', error)
        }
      }

      const cancelarBus = suscribir((e) => {
        if (visiblePara(usuario, e.usuarioId)) enviar(e.tipo, { dispositivoId: e.dispositivoId, ...(e.datos as object) })
      })
      const intervalo = setInterval(enviarSnapshot, SNAPSHOT_MS)
      limpiar = () => {
        if (cerrado) return
        cerrado = true
        clearInterval(intervalo)
        cancelarBus()
        try {
          controller.close()
        } catch {
          // ya cerrado por el cliente
        }
      }
      request.signal.addEventListener('abort', limpiar)
      await enviarSnapshot()
    },
    cancel() {
      limpiar()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
