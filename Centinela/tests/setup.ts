import path from 'node:path'
import { afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'

// Debe ejecutarse antes de que cualquier archivo de test importe lib/prisma
// o lib/auth — Vitest garantiza que setupFiles corre primero. No usar
// prisma/dev.db bajo ninguna circunstancia.
process.env.DATABASE_URL = `file:${path.resolve(__dirname, '../prisma/test.db')}`
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'vitest-test-secret-do-not-use-in-prod'

// Sin esto, la conexión de Prisma sigue viva cuando el globalSetup intenta
// borrar prisma/test.db al final — en Windows eso falla con EPERM porque
// el archivo sigue abierto.
afterAll(async () => {
  await prisma.$disconnect()
})
