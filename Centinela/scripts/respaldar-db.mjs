// Respaldo de la base SQLite: `npm run db:respaldo`. VACUUM INTO saca una copia consistente
// aunque el servidor esté escribiendo (copiar dev.db a mano a medio guardar puede corromperla).
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const CONSERVAR = 10
const dir = path.resolve('prisma/_backups')
mkdirSync(dir, { recursive: true })

const sello = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
const destino = path.join(dir, `dev-${sello}.db`)

const prisma = new PrismaClient()
await prisma.$executeRawUnsafe(`VACUUM INTO '${destino.replaceAll("'", "''")}'`)
await prisma.$disconnect()

const viejos = readdirSync(dir).filter((f) => /^dev-\d{8}-\d{6}\.db$/.test(f)).sort().slice(0, -CONSERVAR)
for (const f of viejos) rmSync(path.join(dir, f))
console.log(`✔ Respaldo en ${destino}${viejos.length ? ` (borrados ${viejos.length} viejos)` : ''}`)
