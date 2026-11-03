# Centinel AURIS

Sistema embebido de **disuasión acústica adaptativa de aves** con visión artificial y posicionamiento dinámico.

Las palomas, zanates y gorriones contaminan producto y dañan la infraestructura de bodegas, patios y terminales de carga. Los ahuyentadores acústicos comerciales repiten siempre el mismo sonido, y en pocas semanas las aves se acostumbran. Centinel confirma que hay un ave con visión artificial, gira una torreta de dos ejes hacia ella y emite un patrón de sonido que cambia de una vez a otra para que las aves no se habitúen.

Proyecto modular de Ingeniería en Computación, Centro Universitario UNE, 2026.
Autores: Gabriel Isaac Márquez Romo y Ángel David Munguía Zúñiga.

## Arquitectura

```
 Plataforma web  ◀── HTTP ──▶  Raspberry Pi 5 (decide)  ◀── MQTT ──▶  ESP32-S3 (ejecuta)
 Next.js · roles ·             YOLO11n (NCNN) · decisión            cámara OV3660 · torreta
 bitácora · reportes           y patrón de audio · SQLite           pan-tilt · audio I²S
```

| Nivel | Carpeta | Tecnología |
|---|---|---|
| 1. Raspberry Pi 5: confirma el ave y decide la respuesta | `Centinela/edge/pi-gateway/` | Python, YOLO11n en NCNN, Mosquitto, SQLite |
| 2. ESP32-S3: cámara, servos y audio | `Centinela/edge/esp32-node/` | C++ / FreeRTOS, PlatformIO |
| 3. Plataforma web: monitor, bitácora, reportes y roles | `Centinela/` | Next.js 16, React 19, TypeScript, Prisma, SQLite |
| App de escritorio (Windows) | `Centinela-Desktop/` | Python, Qt |

**Seguridad por diseño:** si se cae la red o el software, la emisión se detiene. Para eso se usan resistencias pull-down en hardware, un latido (heartbeat) periódico y el mensaje LWT de MQTT.

## Cómo correrlo

### Web

Requiere Node.js 20 o superior.

```bash
cd Centinela
npm install
cp .env.example .env.local        # cada variable trae su explicación
npx prisma migrate dev
npx prisma db seed                # crea 3 cuentas de prueba (contraseña admin123; solo en desarrollo)
npm run build && npm start        # http://localhost:3000
```

`npm run demo:edge` simula un nodo y un gateway y manda eventos a la web, así que se puede probar sin hardware.

### Raspberry Pi y ESP32

Ver `Centinela/edge/pi-gateway/README.md` y `Centinela/edge/esp32-node/README.md`. El paso a paso para levantar todo en el hardware real está en `Centinela/edge/RUNBOOK.md`.

### Escritorio

Ver `Centinela-Desktop/README.md`.

## Pruebas

```bash
cd Centinela && npm test                                    # unitarias (Vitest)
cd Centinela/edge/pi-gateway && python -m pytest            # gateway
cd Centinela-Desktop && python -m pytest                    # escritorio
```

## Resultados (mediciones del 29 de octubre de 2026)

| Indicador | Meta | Resultado | Estado |
|---|---|---|---|
| Inferencia en la Raspberry Pi 5 | ≥ 25 FPS | 80 ms por foto a 640 px (≈ 12 FPS); 382 ms a 1280 px. El sistema analiza 1 foto/s y solo infiere cuando hay movimiento | Parcial |
| Detección | — | 13/13 palomas posadas en fotos de referencia; de 6 a 27 gaviotas detectadas en una foto al pasar a 1280 px | — |
| Tiempo de confirmación | 1 a 2 s | ≈ 1.2 s calculado (3 cuadros a 1280 px) | Estimado |
| Falsos disparos, error de puntería, habituación, silenciamiento ante fallas | ver hipótesis H1.1–H1.6 | Requieren la torreta instalada y el experimento de campo de 8 semanas | Pendiente |

## Licencia

MIT, excepto `Centinela/edge/pi-gateway/`, que es AGPL-3.0 porque usa Ultralytics YOLO. Ver `Centinela/LICENSE`.
