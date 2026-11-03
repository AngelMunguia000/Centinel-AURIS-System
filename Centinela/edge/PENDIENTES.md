# Pendientes de hardware (Raspberry Pi + ESP32)

Apartado a pedido del PO el 2026-10-22: "los problemas que tengan que ver con la rasp y con la esp32
documenta para después". La web ya funciona completa contra la cadena simulada (`npm run demo:edge`);
todo lo de esta lista necesita el equipo físico o solo importa cuando esté conectado.

## Bloqueante para retomar

1. **El PO tiene la Pi y el ESP32 desde ~2026-10-18, pero no puede usarlos.** Motivo aún no dicho.
   Lo primero al retomar: preguntar qué lo bloquea (alimentación, cables, SD, Wi-Fi, flasheo…).
2. **Modelo exacto del ESP32 desconocido.** Ver lo impreso en el módulo metálico:
   `ESP32-S3-WROOM` → `pio run -e esp32s3`; `ESP32-WROOM-32` → `pio run -e esp32dev`.
   Ambos compilan (2026-10-22).

## Puesta en marcha (Tarea 15 del plan `docs/diseno/2026-10-16-enlace-edge.md`)

Seguir `edge/RUNBOOK.md` y llenar su §8 con medidas reales:
- Flashear el ESP32 (`edge/esp32-node/README.md`), copiar `include/config.example.h` a `config.h`.
- Pi: Mosquitto + gateway con systemd (RUNBOOK §6), vincularla desde Centro de Dispositivos.
- Medir: tiempo hasta "Desconectado" por LWT, latencia del LED y del ping, estabilidad del Wi-Fi.

## Listo sin hardware, para probar al conectar (2026-10-24, Brain/21 §71)

- Armado: el firmware y el nodo virtual se suscriben a `centinel/sistema/armado`; desarmado, el nodo
  rechaza el audio ("lugar desarmado") y sigue reportando eventos.
- Cámara: firmware con `CAMARA_MODELO` (ESP32-CAM AI-Thinker o ESP32-S3), `/capture` y `/stream`
  (ver `esp32-node/README.md`). El nodo informa su IP en `status`.
- Pi: detección de movimiento con la cámara, foto de evidencia (sube a la web), disuasión por
  presencia con anti-habituación y límite de 20 %. Probado de punta a punta con `npm run demo:edge`
  (el primer nodo virtual trae cámara).
- Qué medir al conectar: que el umbral de movimiento (`UMBRAL_AREA` 3 %, 2 fotos seguidas en
  `pi-gateway/.../camaras.py`) no dispare con cambios de luz ni ramas; ajustar con fotos reales.

## Problemas conocidos del lado edge

| Tema | Detalle | Cuándo atenderlo |
|---|---|---|
| Sin TLS | Pi ↔ web por HTTP y Mosquitto con `allow_anonymous`. La web se autentica ante la Pi con el hash del token del gateway | Antes de salir de la red local: HTTPS, MQTT 8883 con usuarios, clave web → Pi dedicada |
| QoS 0 en el firmware | PubSubClient no publica QoS 1: un ack perdido se ve como "El nodo no respondió" | Si en pruebas reales aparecen falsos "no respondió" |
| Hora de los eventos | El ESP32 no tiene reloj: un evento que esperó en la cola offline muestra la hora de recepción en la Pi | Si importa la hora exacta: NTP en el firmware |
| Disuasión en la Pi | Hecha por presencia (sin apuntar ni confirmar). La máquina de estados completa (apuntado, confirmación, reintentos) sigue solo en `/prototipo`; necesita servos y visión con objetivo | Cuando haya servos y un detector con posición del objetivo |
| Sin bocina | El PO tiene solo ESP32 + cámara: la disuasión se decide y registra, pero el nodo la simula (`AudioSim`) | Al conectar bocina/buzzer: driver de audio real en `drivers.cpp` |
| Varios espectadores del video | Hecho el video en vivo (Brain/21 §72), pero cada espectador abre su propia conexión al nodo; el ESP32 aguanta pocas | Si se ven cortes con varias personas mirando: repartir un solo stream en la Pi |
| Cámara sin autenticación | `/capture` y `/stream` del nodo están abiertos en la LAN (igual que MQTT) | Junto con TLS/usuarios de MQTT, antes de salir de la red local |
| Avisos de Pi caída | Llegan al dueño y a los Operadores, no a otros Admin; los dispara la campanita, así que si nadie tiene la web abierta se crean al abrirla | Si el PO quiere avisos fuera de la web (correo, Telegram) |
| pytest-asyncio | `tests/conftest.py` del gateway usa un fixture que se va a deprecar | Al actualizar dependencias del gateway |
| Bus SSE en memoria | Un solo proceso Next. Más instancias → Redis | Solo si se despliega fuera de la laptop |
| Observación dev | En el primer arranque de `npm run dev` el Monitor tardó ~40 s en mostrar eventos en vivo; no se reprodujo | Si se repite en `npm start` |

Fuentes: `Brain/09_KnownIssues.md` (sección "Enlace edge"), `Brain/21_ChangeRecoveryLog.md` §45–46.
