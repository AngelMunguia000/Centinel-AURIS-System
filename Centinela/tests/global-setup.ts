import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

// Base de datos SQLite propia y desechable para la suite — nunca toca
// prisma/dev.db. Se crea desde cero en cada corrida y se borra al terminar
// (DX-05, auditoría integral 26 ago).
const testDbPath = path.resolve(__dirname, '../prisma/test.db')
const testDbUrl = `file:${testDbPath}`

function cleanupDbFiles() {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const file = testDbPath + suffix
    try {
      if (existsSync(file)) rmSync(file)
    } catch {
      // Windows a veces tarda en soltar el handle del archivo tras
      // desconectar Prisma — no vale la pena fallar la suite por esto,
      // el próximo `setup()` lo vuelve a intentar de todas formas.
    }
  }
}

export async function setup() {
  cleanupDbFiles()

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: 'inherit',
  })

  // Roles: datos de referencia estables, no desechables — cada test crea y
  // limpia sus propios Usuarios/Reportes, pero los 3 Roles los sembramos
  // una sola vez aquí (mismo patrón que prisma/seed.ts).
  const prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } })
  try {
    for (const nombre of ['Admin', 'Operador', 'Usuario']) {
      await prisma.rol.upsert({ where: { nombre }, update: {}, create: { nombre } })
    }
  } finally {
    await prisma.$disconnect()
  }
}

export async function teardown() {
  cleanupDbFiles()
}
