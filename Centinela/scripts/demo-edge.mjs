// Demo sin hardware en un solo comando: `npm run dev` en una terminal y `npm run demo:edge` en otra.
// Vincula una "Pi de demostración" al primer Admin, arranca el gateway Python y dos ESP32 virtuales
// que mandan telemetría y eventos. Ctrl+C lo detiene todo (los nodos caen por LWT, como en la vida real).
import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const WEB = process.env.CENTINELA_WEB_URL ?? 'http://localhost:3000'
const NODOS = ['node-0000000de301', 'node-0000000de302']
const EVENTOS_CADA_S = '20'
const dirGateway = path.resolve('edge/pi-gateway')
const python = path.join(dirGateway, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python')

function fallar(mensaje) {
  console.error(`\n✖ ${mensaje}\n`)
  process.exit(1)
}

const puertoAbierto = (puerto) =>
  new Promise((ok) => {
    const s = net.connect(puerto, '127.0.0.1')
    s.setTimeout(1500)
    s.once('connect', () => (s.destroy(), ok(true)))
    s.once('error', () => ok(false))
    s.once('timeout', () => (s.destroy(), ok(false)))
  })

if (!existsSync(python)) fallar(`No existe ${python}. Crea el entorno: ver edge/pi-gateway/README.md.`)
if (!(await puertoAbierto(1883))) fallar('Mosquitto no responde en 127.0.0.1:1883. En Windows: services.msc → "Mosquitto Broker" → Iniciar.')
const salud = await fetch(`${WEB}/api/health`).then((r) => r.ok, () => false)
if (!salud) fallar(`La web no responde en ${WEB}. Arráncala primero con: npm run dev`)

const prisma = new PrismaClient()
const admin = await prisma.usuario.findFirst({ where: { rol: { nombre: 'Admin' } }, orderBy: { id: 'asc' } })
if (!admin) fallar('No hay ninguna cuenta Admin en la base de datos.')

// Token nuevo en cada arranque: el anterior deja de servir, igual que al re-vincular desde la web.
const token = randomBytes(32).toString('base64url')
const tokenHash = createHash('sha256').update(token).digest('hex')
const datos = { tokenHash, urlBase: 'http://127.0.0.1:8000', revocadoEn: null }
const previo = await prisma.gateway.findFirst({ where: { usuarioId: admin.id, nombre: 'Pi de demostración' } })
if (previo) await prisma.gateway.update({ where: { id: previo.id }, data: datos })
else await prisma.gateway.create({ data: { nombre: 'Pi de demostración', usuarioId: admin.id, ...datos } })
await prisma.$disconnect()

const hijos = []
const lanzar = (args, nombre) => {
  const h = spawn(python, args, {
    cwd: dirGateway,
    env: { ...process.env, CENTINELA_WEB_URL: WEB, CENTINELA_GATEWAY_TOKEN: token, COLA_DB: 'cola-demo.db', PYTHONIOENCODING: 'utf-8' },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  h.on('exit', (code) => code && console.error(`[demo] ${nombre} terminó con código ${code}`))
  hijos.push(h)
}

lanzar(['-m', 'centinela_gateway'], 'gateway')
// El primero trae cámara virtual: cada ~20 s "entra alguien" → movimiento con foto de evidencia y disuasión.
NODOS.forEach((n, i) =>
  lanzar(['-m', 'simulador.nodo_virtual', '--node-id', n, '--eventos-cada', EVENTOS_CADA_S, ...(i === 0 ? ['--camara', '8081'] : [])], n)
)

console.log(`\n✔ Demo en marcha como ${admin.email}: abre ${WEB}/monitor. Ctrl+C para detener.\n`)
process.on('SIGINT', () => {
  for (const h of hijos) h.kill()
  process.exit(0)
})
