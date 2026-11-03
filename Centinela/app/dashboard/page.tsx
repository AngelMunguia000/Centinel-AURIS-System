import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, FileText, Headset, Router, ShieldCheck, TriangleAlert, Wifi } from 'lucide-react'
import { getPageUser } from '@/lib/page-auth'
import { prisma } from '@/lib/prisma'
import { AppHeader } from '@/components/app-header'
import { GlassBackground, consolaBlobs } from '@/components/glass-background'
import { GlassPanel } from '@/components/glass-panel'
import { SeguridadSidebar } from '@/components/SeguridadSidebar'
import { Saludo } from '@/components/Saludo'
import { resumenEdge } from '@/lib/edge/resumen'
import { nombreCorto } from '@/lib/saludo'
import { atencion, type FilaAtencion } from '@/lib/atencion'
import { hace } from '@/lib/tiempo'
import type { Severidad } from '@/lib/edge/contrato'
import { FranjaCifras } from '@/components/marca'

export const metadata: Metadata = {
  title: "Inicio — Centinela AURIS",
  description: "Estado general del sistema de seguridad Centinela AURIS.",
  robots: { index: false, follow: false },
}

const COLOR_SEVERIDAD: Record<Severidad, string> = {
  baja: "text-foreground/40",
  media: "text-amber-300",
  alta: "text-red-300",
}

const TONO_FILA: Record<FilaAtencion['tono'], string> = {
  alerta: "bg-brand",
  senal: "bg-signal",
  neutro: "bg-foreground/30",
}

const TONO_BANDA = {
  ok: { borde: "border-l-green-400", icono: "text-green-400" },
  atencion: { borde: "border-l-signal", icono: "text-signal" },
  alerta: { borde: "border-l-brand", icono: "text-brand" },
} as const

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const cuandoCorto = (iso: string) => {
  const d = new Date(iso)
  return `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Centro de mando (auditoría de la consola, 2026-10-24): ¿está todo bien y qué necesita mi atención?
// Sin accesos que repitan el menú: arriba una frase de estado con a dónde ir, luego las cifras,
// "Requiere atención" y lo que pasó desde la visita anterior.
export default async function DashboardPage() {
  const user = await getPageUser()

  if (!user) {
    redirect('/iniciar-sesion')
  }

  const permisos = new Set<string>(user.permisos)
  const veDispositivos = permisos.has('dispositivos.propios') || permisos.has('dispositivos.otros')
  const veTodos = permisos.has('reportes.ver_todos')
  // Mismo alcance que GET /api/reportes.
  const filtroReportes = veTodos ? {} : { usuarioId: user.id }
  const anterior = user.ultimoLoginAnterior ? new Date(user.ultimoLoginAnterior) : null

  // Spec 2026-10-16-enlace-edge-design.md §6.4: todo lo de los nodos sale de los nodos reales.
  const [r, pendientes, resueltos, nuevos] = await Promise.all([
    resumenEdge({ id: user.id, permisos }, anterior),
    prisma.reporte.findMany({
      where: { ...filtroReportes, estado: 'pendiente' },
      select: { id: true, titulo: true, prioridad: true, operadorAsignadoId: true, createdAt: true, atendidoEn: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.reporte.count({ where: { ...filtroReportes, estado: 'resuelto' } }),
    anterior ? prisma.reporte.count({ where: { ...filtroReportes, createdAt: { gt: anterior } } }) : Promise.resolve(0),
  ])

  // eslint-disable-next-line react-hooks/purity -- Server Component: se renderiza una vez por request
  const ahora = Date.now()
  const filas = atencion(pendientes, veDispositivos ? r.caidos : [], { id: user.id, role: user.role, permisos }, ahora)
  const filasReportes = filas.filter((f) => f.href === '/reportes').length
  const criticos = pendientes.filter((p) => p.prioridad === 'critica').length

  // Lo más grave primero: alertas de hoy, nodos que no vigilan, incidencias críticas.
  const ultimoContacto = r.caidos.map((c) => c.ultimoContacto ?? '').sort().at(-1) || null
  const banda: { tono: keyof typeof TONO_BANDA; icono: LucideIcon; texto: string; accion?: { href: string; texto: string } } =
    veDispositivos && r.altasHoy > 0
      ? { tono: 'alerta', icono: TriangleAlert, texto: `${plural(r.altasHoy, 'alerta alta', 'alertas altas')} hoy.`, accion: { href: '/bitacora', texto: 'Ver Bitácora' } }
    : veDispositivos && r.nodosTotal === 0
      ? { tono: 'atencion', icono: Router, texto: 'Aún no hay nodos vinculados: Centinela todavía no vigila nada.', accion: { href: '/dispositivos', texto: 'Vincular una Pi' } }
    : veDispositivos && r.nodosEnLinea < r.nodosTotal
      ? { tono: 'atencion', icono: Wifi, texto: `${r.nodosTotal - r.nodosEnLinea} de ${r.nodosTotal} nodos sin conexión · último contacto ${hace(ultimoContacto, ahora)}`, accion: { href: '/monitor', texto: 'Ver Monitor' } }
    : criticos > 0
      ? { tono: 'alerta', icono: TriangleAlert, texto: `${plural(criticos, 'reporte crítico pendiente', 'reportes críticos pendientes')}.`, accion: { href: '/reportes', texto: 'Ver reportes' } }
    : veDispositivos
      ? { tono: 'ok', icono: ShieldCheck, texto: `Todo en calma: ${r.nodosEnLinea} de ${r.nodosTotal} nodos en línea y ninguna alerta alta hoy.` }
    : pendientes.length > 0
      ? { tono: 'atencion', icono: FileText, texto: `Tienes ${plural(pendientes.length, 'reporte pendiente', 'reportes pendientes')}.`, accion: { href: '/reportes', texto: 'Ver reportes' } }
      : { tono: 'ok', icono: ShieldCheck, texto: 'Sin reportes pendientes por ahora.' }

  const tercera = veTodos ? 'Altas sin asignar' : user.role === 'Operador' ? 'Para ti y sin dueño' : 'Tus pendientes'
  const BandaIcono = banda.icono
  const maxHora = Math.max(1, ...r.actividad24h)

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <AppHeader />

      <div className="relative z-10 flex">
        <SeguridadSidebar active="inicio" permisos={user.permisos} />

        <div className="flex-1 container mx-auto px-4 lg:px-8 py-8 max-w-6xl">
          <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <Saludo
              nombre={nombreCorto(user.nombre, user.apellido) || (user.username ?? '')}
              visita={anterior ? `Tu visita anterior: ${hace(anterior, ahora)}` : 'Es tu primera visita: bienvenido a Centinela.'}
            />
            {user.role === 'Operador' && (
              <Link href="/operador" className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-4 py-2 text-sm font-semibold hover:border-signal/40 hover:text-signal transition-colors">
                <Headset className="h-4 w-4" aria-hidden="true" />
                Cola de trabajo
              </Link>
            )}
          </section>

          <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-foreground/10 border-l-[3px] bg-foreground/[0.03] px-4 py-3 ${TONO_BANDA[banda.tono].borde}`}>
            <BandaIcono className={`h-5 w-5 shrink-0 ${TONO_BANDA[banda.tono].icono}`} aria-hidden="true" />
            <p className="flex-1 min-w-[12rem] font-semibold text-foreground">{banda.texto}</p>
            {banda.accion && (
              <Link href={banda.accion.href} className="rounded-full border border-foreground/15 px-4 py-1.5 text-sm font-semibold hover:border-signal/40 hover:text-signal transition-colors">
                {banda.accion.texto}
              </Link>
            )}
          </div>

          <FranjaCifras
            className="mb-6"
            items={veDispositivos ? [
              { valor: `${r.nodosEnLinea}/${r.nodosTotal}`, etiqueta: 'Nodos en línea', tono: r.nodosTotal > 0 && r.nodosEnLinea === r.nodosTotal ? 'ok' : 'senal' },
              { valor: pendientes.length, etiqueta: 'Reportes pendientes', tono: pendientes.length > 0 ? 'senal' : 'normal' },
              { valor: filasReportes, etiqueta: tercera, tono: filasReportes > 0 ? (veTodos ? 'alerta' : 'senal') : 'normal' },
              { valor: r.altasHoy, etiqueta: 'Alertas altas hoy', tono: r.altasHoy > 0 ? 'alerta' : 'normal' },
            ] : [
              { valor: pendientes.length, etiqueta: 'Reportes pendientes', tono: pendientes.length > 0 ? 'senal' : 'normal' },
              { valor: resueltos, etiqueta: 'Resueltos', tono: 'ok' },
              { valor: pendientes.length + resueltos, etiqueta: 'Reportes en total' },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <GlassPanel padding="md" radius="lg" className="md:col-span-3">
              <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-signal">Requiere atención</h2>
              {filas.length === 0 && <p className="text-sm text-foreground/55">Nada pendiente de tu lado.</p>}
              <ul>
                {filas.slice(0, 6).map((f) => (
                  <li key={f.titulo + f.detalle}>
                    <Link href={f.href} className="group flex items-center gap-3 border-b border-foreground/10 py-2.5 hover:bg-foreground/[0.03]">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${TONO_FILA[f.tono]}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{f.titulo}</span>
                        <span className="block truncate text-xs text-foreground/45">{f.detalle}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-foreground/30 group-hover:text-signal" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              {filas.length > 6 && (
                <Link href="/reportes" className="mt-3 inline-block text-sm font-semibold text-signal">y {filas.length - 6} más en Reportes</Link>
              )}
            </GlassPanel>

            <div className="flex flex-col gap-4 md:col-span-2">
              <GlassPanel padding="md" radius="lg">
                <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-signal">Desde tu última visita</h2>
                {anterior ? (
                  <ul className="space-y-1 text-sm text-foreground/75">
                    <li><span className="font-mono text-lg text-foreground">{nuevos}</span> {nuevos === 1 ? 'reporte nuevo' : 'reportes nuevos'}</li>
                    {veDispositivos && <li><span className="font-mono text-lg text-foreground">{r.eventosDesde}</span> {r.eventosDesde === 1 ? 'evento de los nodos' : 'eventos de los nodos'}</li>}
                  </ul>
                ) : (
                  <p className="text-sm text-foreground/55">Es tu primera visita.</p>
                )}
              </GlassPanel>

              {veDispositivos && (
                <GlassPanel padding="md" radius="lg">
                  <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-signal">Actividad de los nodos · 24 h</h2>
                  <div className="relative flex h-14 items-end gap-[3px]" role="img" aria-label={`${r.actividad24h.reduce((a, b) => a + b, 0)} eventos en las últimas 24 horas`}>
                    {r.actividad24h.map((n, i) => (
                      <span key={i} className={`flex-1 rounded-sm ${n ? 'bg-signal' : 'bg-foreground/10'}`} style={{ height: n ? `${Math.max(8, (n / maxHora) * 100)}%` : '3px' }} />
                    ))}
                    {r.actividad24h.every((n) => n === 0) && (
                      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-foreground/40">Sin actividad en las últimas 24 h</span>
                    )}
                  </div>
                  <div className="mt-1 flex justify-between font-mono text-[10px] text-foreground/35"><span>hace 24 h</span><span>ahora</span></div>
                </GlassPanel>
              )}

              {veDispositivos && (
                <GlassPanel padding="md" radius="lg">
                  <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-signal">Últimos eventos</h2>
                  {r.ultimosEventos.length === 0 && <p className="text-[13px] text-foreground/50">Los nodos todavía no reportan eventos.</p>}
                  <ul className="space-y-3">
                    {r.ultimosEventos.map((e) => (
                      <li key={e.id}>
                        <p className={`font-mono text-[10px] font-semibold uppercase tracking-widest ${COLOR_SEVERIDAD[e.severidad]}`}>
                          {cuandoCorto(e.ocurridoEn)} · {e.tipo}
                        </p>
                        <p className="mt-0.5 text-[13px] text-foreground/80">{e.dispositivoNombre}{e.detalle ? `: ${e.detalle}` : ''}</p>
                      </li>
                    ))}
                  </ul>
                  <Link href="/bitacora" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground/40 hover:text-signal transition-colors">
                    Ver bitácora completa
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </GlassPanel>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
