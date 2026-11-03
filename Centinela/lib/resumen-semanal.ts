import { prisma } from '@/lib/prisma'
import { metricas, minutosATexto, vencido } from '@/lib/respuesta'
import { CAIDA_MS } from '@/lib/edge/vigilancia'
import { filtroNodos, veDispositivos } from '@/lib/edge/resumen'
import { permisosEfectivos } from '@/lib/permisos'
import { sendResumenEmail } from '@/lib/mail'

// Resumen semanal por correo (roadmap de funciones #7): lo que pasó en los últimos 7 días, para
// quien no abre la consola a diario. Admin y Operador (reportes.ver_todos) ven todo el sistema;
// un Usuario, lo suyo. Se envía una vez por semana ISO, desde el lunes a las 8:00.

type Cuenta = { id: number; nombre: string; permisos: Set<string> }

export interface Resumen {
  desde: Date
  hasta: Date
  sistema: boolean
  reportes: { nuevos: number; resueltos: number; pendientes: number; criticos: number; vencidos: number }
  respuesta: { acuseMin: number | null; resolucionMin: number | null; falsasPct: number | null }
  equipo: { eventos: number; alertas: number; conFoto: number; disuasiones: number; sinDisuadir: number; pisSinContacto: string[] } | null
}

const DIA_MS = 86_400_000
const HORA_ENVIO = 8

/** "2026-W43": semana ISO (lunes a domingo) en hora local. */
export function semanaIso(d: Date): string {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3) // jueves de esa semana: define el año ISO
  const primerJueves = new Date(t.getFullYear(), 0, 4)
  primerJueves.setDate(primerJueves.getDate() - ((primerJueves.getDay() + 6) % 7) + 3)
  const semana = 1 + Math.round((t.getTime() - primerJueves.getTime()) / (7 * DIA_MS))
  return `${t.getFullYear()}-W${String(semana).padStart(2, '0')}`
}

/** Ya se puede enviar el de esta semana: es lunes desde las 8:00 o cualquier día posterior. */
export const tocaEnviar = (d: Date) => d.getDay() !== 1 || d.getHours() >= HORA_ENVIO

export async function construirResumen(u: Cuenta, hasta: Date = new Date()): Promise<Resumen> {
  const desde = new Date(hasta.getTime() - 7 * DIA_MS)
  const sistema = u.permisos.has('reportes.ver_todos')
  const filtro = sistema ? {} : { usuarioId: u.id }
  const rango = { gte: desde, lt: hasta }

  const [nuevos, resueltos, pendientes, recientes] = await Promise.all([
    prisma.reporte.count({ where: { ...filtro, createdAt: rango } }),
    prisma.reporte.count({ where: { ...filtro, resueltoEn: rango } }),
    prisma.reporte.findMany({ where: { ...filtro, estado: 'pendiente' }, select: { estado: true, prioridad: true, createdAt: true, atendidoEn: true } }),
    prisma.reporte.findMany({ where: { ...filtro, createdAt: rango }, select: { createdAt: true, atendidoEn: true, resueltoEn: true, motivoCierre: true } }),
  ])

  let equipo: Resumen['equipo'] = null
  if (veDispositivos(u)) {
    const deEquipos = { dispositivo: filtroNodos(u), ocurridoEn: rango }
    const [eventos, alertas, conFoto, disuasiones, sinDisuadir, pis] = await Promise.all([
      prisma.eventoDispositivo.count({ where: deEquipos }),
      prisma.eventoDispositivo.count({ where: { ...deEquipos, severidad: 'alta' } }),
      prisma.eventoDispositivo.count({ where: { ...deEquipos, evidencia: { not: null } } }),
      prisma.eventoDispositivo.count({ where: { ...deEquipos, tipo: 'disuasion', detalle: { startsWith: 'Ráfaga' } } }),
      prisma.eventoDispositivo.count({ where: { ...deEquipos, tipo: 'disuasion', detalle: { startsWith: 'Sin disuadir' } } }),
      prisma.gateway.findMany({
        where: { revocadoEn: null, ...(u.permisos.has('dispositivos.otros') ? {} : { usuarioId: u.id }) },
        select: { nombre: true, ultimoContacto: true },
      }),
    ])
    const corte = hasta.getTime() - CAIDA_MS
    const pisSinContacto = pis.filter((g) => !g.ultimoContacto || g.ultimoContacto.getTime() < corte).map((g) => g.nombre)
    equipo = { eventos, alertas, conFoto, disuasiones, sinDisuadir, pisSinContacto }
  }

  return {
    desde,
    hasta,
    sistema,
    reportes: {
      nuevos,
      resueltos,
      pendientes: pendientes.length,
      criticos: pendientes.filter((r) => r.prioridad === 'critica').length,
      vencidos: pendientes.filter((r) => vencido(r, hasta.getTime())).length,
    },
    respuesta: metricas(recientes),
    equipo,
  }
}

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const fecha = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
const min = (m: number | null) => (m == null ? '—' : minutosATexto(m))
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Correo en HTML con estilos en línea (los clientes de correo ignoran las hojas de estilo). */
export function htmlResumen(nombre: string, r: Resumen, enlace: string): { asunto: string; html: string } {
  const fila = (etiqueta: string, valor: string | number, alerta = false) =>
    `<tr><td style="padding:6px 0;color:#555">${etiqueta}</td><td style="padding:6px 0;text-align:right;font-weight:600;${alerta ? 'color:#b3261e' : ''}">${valor}</td></tr>`
  const bloque = (titulo: string, filas: string) =>
    `<h3 style="margin:24px 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9e1b34">${titulo}</h3><table style="width:100%;border-collapse:collapse;font-size:14px">${filas}</table>`

  const { reportes: rp, respuesta: rs, equipo: eq } = r
  const avisos = [
    rp.vencidos > 0 && `${plural(rp.vencidos, 'reporte pendiente', 'reportes pendientes')} sin acuse fuera de plazo`,
    rp.criticos > 0 && plural(rp.criticos, 'crítico abierto', 'críticos abiertos'),
    eq && eq.pisSinContacto.length > 0 && `Sin contacto: ${eq.pisSinContacto.map(escapar).join(', ')}`,
  ].filter(Boolean)

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
<p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#888;margin:0">Centinela · resumen semanal</p>
<h2 style="margin:6px 0 4px;font-size:22px">Hola, ${escapar(nombre)}</h2>
<p style="margin:0;color:#555">Del ${fecha(r.desde)} al ${fecha(r.hasta)}${r.sistema ? ', todo el sistema' : ', tus reportes y equipos'}.</p>
${avisos.length ? `<div style="margin-top:16px;padding:12px 14px;border-radius:8px;background:#fdecea;color:#b3261e;font-size:14px">${avisos.join('<br>')}</div>` : `<div style="margin-top:16px;padding:12px 14px;border-radius:8px;background:#e8f5e9;color:#1b5e20;font-size:14px">Sin pendientes urgentes.</div>`}
${bloque('Reportes', fila('Nuevos', rp.nuevos) + fila('Resueltos', rp.resueltos) + fila('Pendientes ahora', rp.pendientes) + fila('Vencidos sin acuse', rp.vencidos, rp.vencidos > 0))}
${bloque('Respuesta', fila('Acuse promedio', min(rs.acuseMin)) + fila('Resolución promedio', min(rs.resolucionMin)) + fila('Falsas alarmas', rs.falsasPct == null ? '—' : `${rs.falsasPct} %`))}
${eq ? bloque('Equipos', fila('Eventos', eq.eventos) + fila('Alertas', eq.alertas) + fila('Con foto de la cámara', eq.conFoto) + fila('Disuasiones ejecutadas', eq.disuasiones) + fila('Detecciones sin disuadir', eq.sinDisuadir)) : ''}
<p style="margin:28px 0 0"><a href="${escapar(enlace)}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#9e1b34;color:#fff;text-decoration:none;font-weight:600">Abrir la consola</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#888">Puedes desactivar este correo en Ajustes.</p>
</div>`
  const urgente = avisos.length ? ' · requiere atención' : ''
  return { asunto: `Centinela: resumen del ${fecha(r.desde)} al ${fecha(r.hasta)}${urgente}`, html }
}

/** Arma el resumen de una cuenta como lo recibiría por correo (lo usa también la vista previa de Ajustes). */
export async function resumenDe(usuarioId: number, origen: string, ahora: Date = new Date()) {
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, include: { rol: true, permisosCuenta: { select: { permiso: true, otorgado: true } } } })
  if (!u) return null
  const cuenta = { id: u.id, nombre: u.nombre, permisos: permisosEfectivos(u.rol.nombre, u.permisosCuenta) }
  return { email: u.email, ...htmlResumen(u.nombre, await construirResumen(cuenta, ahora), `${origen}/dashboard`) }
}

export async function enviarResumen(usuarioId: number, origen: string, ahora: Date = new Date()): Promise<{ sent: boolean; reason?: string }> {
  const r = await resumenDe(usuarioId, origen, ahora)
  if (!r) return { sent: false, reason: 'Cuenta no encontrada' }
  const res = await sendResumenEmail(r.email, r.asunto, r.html)
  if (!res.sent && res.reason) console.error(`[resumen] correo a la cuenta ${usuarioId} no enviado: ${res.reason}`)
  return res
}

/**
 * Envía el resumen de esta semana a quien lo tenga activado y aún no lo haya recibido. Igual que
 * escalarVencidos, no hay cron: lo dispara GET /api/notificaciones. Devuelve cuántas cuentas se procesaron.
 */
export async function enviarResumenesPendientes(origen: string, ahora: Date = new Date()): Promise<number> {
  if (!tocaEnviar(ahora)) return 0
  const semana = semanaIso(ahora)
  const noEnviado = { resumenSemanal: true, OR: [{ resumenEnviadoSemana: null }, { resumenEnviadoSemana: { not: semana } }] }
  const pendientes = await prisma.usuario.findMany({ where: noEnviado, select: { id: true } })
  let procesados = 0
  for (const { id } of pendientes) {
    // Condicionado: si dos campanitas consultan a la vez, solo una envía. Un correo que falla no se
    // reintenta esa semana (se registra en el log): mejor un resumen perdido que uno repetido cada 15 s.
    const { count } = await prisma.usuario.updateMany({ where: { id, ...noEnviado }, data: { resumenEnviadoSemana: semana } })
    if (count !== 1) continue
    await enviarResumen(id, origen, ahora)
    procesados++
  }
  return procesados
}
