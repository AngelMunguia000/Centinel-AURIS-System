import { Prisma, type Dispositivo, type Gateway } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { publicar } from '@/lib/edge/bus'
import { marcarGatewayActivo } from '@/lib/edge/vigilancia'
import { avisaSiempre, estaArmado } from '@/lib/edge/armado'
import { anotarMuestra } from '@/lib/edge/historial'
import type { EventosLote, TelemetriaLote } from '@/lib/edge/contrato'

// Spec 2026-10-16-enlace-edge-design.md §4.2, §6.3 y §8.

export class NodoAjenoError extends Error {
  constructor(public nodeId: string) {
    super(`node_id ${nodeId} pertenece a otra cuenta`)
  }
}

/**
 * Devuelve el Dispositivo de cada node_id, creando los desconocidos bajo el
 * dueño del gateway. Si alguno es de otra cuenta lanza NodoAjenoError ANTES de
 * escribir nada, para que el lote completo se rechace.
 */
async function resolverNodos(gateway: Gateway, nodeIds: string[]): Promise<Map<string, Dispositivo>> {
  const unicos = [...new Set(nodeIds)]
  const existentes = await prisma.dispositivo.findMany({ where: { nodeId: { in: unicos } } })
  const ajeno = existentes.find((d) => d.usuarioId !== gateway.usuarioId)
  if (ajeno) throw new NodoAjenoError(ajeno.nodeId!)

  const porNodo = new Map(existentes.map((d) => [d.nodeId!, d]))
  for (const nodeId of unicos) {
    if (porNodo.has(nodeId)) continue
    const creado = await prisma.dispositivo.create({
      data: { nombre: nodeId, uid: nodeId, nodeId, tipo: 'sensor', conexion: 'ACTIVA', usuarioId: gateway.usuarioId, gatewayId: gateway.id },
    })
    porNodo.set(nodeId, creado)
  }
  return porNodo
}

export async function registrarTelemetria(gateway: Gateway, lote: TelemetriaLote): Promise<void> {
  const nodos = await resolverNodos(gateway, lote.nodos.map((n) => n.node_id))
  const ahora = new Date()
  await marcarGatewayActivo(gateway, ahora)

  for (const n of lote.nodos) {
    const d = nodos.get(n.node_id)!
    // La conexión NO se toca aquí: solo los eventos `conexion` la cambian (un latido
    // con telemetría vieja no debe "revivir" un nodo que ya cayó por LWT).
    await prisma.dispositivo.update({
      where: { id: d.id },
      data: {
        gatewayId: gateway.id,
        ultimoContacto: ahora,
        telemetria: JSON.stringify(n.telemetria),
        variableLabel: 'Temp',
        variableValor: `${n.telemetria.temp_c.toFixed(1)} °C`,
        ...(n.capacidades ? { capacidades: JSON.stringify(n.capacidades) } : {}),
        ...(n.fw ? { firmware: n.fw } : {}),
      },
    })
    await anotarMuestra(d.id, n.telemetria, ahora)
    publicar({
      tipo: 'dispositivo.telemetria',
      usuarioId: d.usuarioId,
      dispositivoId: d.id,
      datos: { telemetria: n.telemetria, capacidades: n.capacidades ?? null, ultimoContacto: ahora.toISOString() },
    })
  }
}

export async function registrarEventos(gateway: Gateway, lote: EventosLote): Promise<{ nuevos: number }> {
  const nodos = await resolverNodos(gateway, lote.eventos.map((e) => e.node_id))
  const operadores = await prisma.usuario.findMany({ where: { rol: { nombre: 'Operador' } }, select: { id: true } })
  const armado = estaArmado(gateway)
  let nuevos = 0

  for (const e of lote.eventos) {
    const d = nodos.get(e.node_id)!
    const offline = e.tipo === 'conexion' && e.detalle === 'offline'
    // Desarmado: el evento queda en la Bitácora, pero solo lo que avisa siempre abre incidencia o avisa.
    const alerta = armado || avisaSiempre(e)
    try {
      // Evento, cambio de conexión, incidencia y avisos en una sola transacción:
      // si el id ya existe (reintento de la Pi), P2002 revierte todo y no se duplica nada.
      await prisma.$transaction(async (tx) => {
        await tx.eventoDispositivo.create({
          data: { id: e.id, dispositivoId: d.id, tipo: e.tipo, severidad: e.severidad, detalle: e.detalle, ocurridoEn: new Date(e.ocurrido_en) },
        })
        // Disuasión estructurada (fase 3): la decisión y, después, su resultado medido por la Pi.
        if (e.tipo === 'disuasion' && e.datos) {
          await tx.disuasion.create({
            data: {
              id: e.id,
              dispositivoId: d.id,
              ocurridoEn: new Date(e.ocurrido_en),
              ejecutada: e.datos.ejecutada ?? false,
              motivo: e.datos.motivo ?? null,
              patron: e.datos.patron ?? null,
              duracionMs: e.datos.duracion_ms ?? null,
              ganancia: e.datos.ganancia ?? null,
            },
          })
        }
        if (e.tipo === 'disuasion_resultado' && e.datos?.disuasion_id && e.datos.exito !== undefined) {
          // updateMany con el nodo: un resultado no puede tocar la disuasión de otro nodo.
          await tx.disuasion.updateMany({
            where: { id: e.datos.disuasion_id, dispositivoId: d.id },
            data: { exito: e.datos.exito, medidoEn: new Date(e.ocurrido_en) },
          })
        }
        if (e.tipo === 'conexion') {
          await tx.dispositivo.update({ where: { id: d.id }, data: { conexion: offline ? 'DESCONECTADO' : 'ACTIVA' } })
        }
        let reporteId: number | null = null
        if (e.severidad === 'alta' && alerta) {
          const r = await tx.reporte.create({
            data: {
              titulo: `Nodo ${d.nombre}: ${e.tipo}`,
              descripcion: `${e.detalle ?? 'Sin detalle.'}\n\nEvento ${e.id} reportado por la Raspberry Pi "${gateway.nombre}" el ${e.ocurrido_en}.`,
              prioridad: 'alta',
              categoria: 'Hardware',
              usuarioId: d.usuarioId,
              eventoId: e.id,
            },
          })
          reporteId = r.id
        }
        // Un nodo que parpadea notifica, pero solo la severidad alta abre incidencia (spec §8).
        if ((reporteId !== null || offline) && alerta && operadores.length > 0) {
          await tx.notificacion.createMany({
            data: operadores.map((o) => ({
              destinatarioId: o.id,
              mensaje: offline ? `Nodo ${d.nombre} desconectado` : `Nodo ${d.nombre}: ${e.tipo} (severidad alta)`,
              reporteId,
            })),
          })
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue
      throw error
    }

    nuevos += 1
    const datos = { id: e.id, dispositivoId: d.id, dispositivoNombre: d.nombre, tipo: e.tipo, severidad: e.severidad, detalle: e.detalle ?? null, ocurridoEn: e.ocurrido_en }
    publicar({ tipo: 'evento.nuevo', usuarioId: d.usuarioId, dispositivoId: d.id, datos })
    if (e.tipo === 'conexion') {
      publicar({ tipo: 'dispositivo.estado', usuarioId: d.usuarioId, dispositivoId: d.id, datos: { conexion: offline ? 'DESCONECTADO' : 'ACTIVA' } })
    }
  }
  return { nuevos }
}
