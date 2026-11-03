import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Suite corre secuencial (fileParallelism: false) a propósito: todos los
// archivos comparten prisma/test.db, y correr en paralelo introduciría
// condiciones de carrera entre archivos sobre las mismas tablas.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 15000,
  },
})
