# Cadena completa sin hardware (laptop)

**Atajo (2026-10-22):** con Mosquitto corriendo, `npm run dev` en una terminal y `npm run demo:edge`
en otra (ambos en `Projects/Centinela`). Vincula sola una "Pi de demostración" al primer Admin y arranca
el gateway con dos ESP32 virtuales que mandan eventos cada 20 s. Ctrl+C lo detiene todo. Los pasos
manuales de abajo siguen sirviendo para probar piezas sueltas.

Tres terminales. Requisito: Mosquitto corriendo en `127.0.0.1:1883`
(en Windows: `winget install EclipseFoundation.Mosquitto` deja un servicio que arranca solo).

**1. Web**

```bash
cd Projects/Centinela
npm run dev
```

Entra como Admin, ve a **Centro de Dispositivos → Vincular Raspberry Pi**, con nombre libre y dirección
`http://127.0.0.1:8000`, y copia el token.

**2. Gateway (la "Pi")**

```bash
cd Projects/Centinela/edge/pi-gateway
# .env con CENTINELA_WEB_URL=http://localhost:3000 y el token del paso 1
.venv/Scripts/python -m centinela_gateway
```

**3. ESP32 virtual**

```bash
cd Projects/Centinela/edge/pi-gateway
.venv/Scripts/python -m simulador.nodo_virtual --node-id node-0000000000a1
# --evento alta  → manda un evento de severidad alta (crea incidencia y avisa al Operador)
```

Abre **Monitor en Vivo**: el nodo aparece en línea con telemetría, y LED, ping y pan/tilt responden.

Para simular un **corte** hay que matar el proceso del paso 3 (cerrar la terminal o `taskkill /F`);
Ctrl+C se desconecta limpio y el broker no publica el Last Will.

La misma cadena corre automática con:

```bash
cd Projects/Centinela
EDGE_E2E=1 npx playwright test e2e/edge-cadena.spec.ts
```
