import { defineConfig, devices } from '@playwright/test'

// Tests E2E en navegador real (Vitest cubre los unitarios/API en tests/).
// Usa el Chrome instalado en la máquina (channel: 'chrome') para no tener que
// descargar navegadores de Playwright. Si ya hay un `npm run dev` corriendo
// en el puerto 3000 lo reutiliza; si no, lo levanta y lo apaga al terminar.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      // La consola solo abre desde la app de escritorio (lib/cliente-app.ts): los E2E se presentan como ella.
      use: { ...devices['Desktop Chrome'], channel: 'chrome', userAgent: `${devices['Desktop Chrome'].userAgent} CentinelaDesktop/e2e` },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
