# Centinela — firmware del nodo ESP32

PlatformIO + framework Arduino. Diseño: `docs/diseno/2026-10-16-enlace-edge-design.md` §3.1 y §4.1.

## Qué hace

- Se conecta al WiFi (2.4 GHz) y al Mosquitto de la Raspberry Pi.
- Publica `status` retenido con sus capacidades y deja un **Last Will** para que la Pi sepa si se cae.
- Manda `telemetry` cada 2 s: temperatura del chip, señal WiFi, uptime, memoria libre y ángulos pan/tilt.
- Atiende `command/system` (LED, ping, reboot), `command/pantilt` y `command/audio`, y responde un `ack` a cada uno.
- El **botón BOOT** de la placa manda un evento de severidad alta: sirve para probar el flujo de alarmas sin sensores.

| Periférico | Capacidad hoy | Para hacerlo real |
|---|---|---|
| LED integrado | real | — |
| Pan/tilt | simulado | reemplazar `PantiltSim` en `src/drivers.*` por un driver de servos |
| Audio | simulado | reemplazar `AudioSim` |
| Cámara | ausente | fase siguiente (OV5640, MJPEG) |

## Preparar (una vez)

```bash
python -m venv .venv
.venv/Scripts/pip install platformio==6.2.0        # Linux/macOS: .venv/bin/pip
cp include/config.example.h include/config.h        # completar WiFi e IP de la Pi
```

## Compilar y flashear

Conecta el ESP32 con un cable USB **de datos**.

```bash
.venv/Scripts/pio run -e esp32dev -t upload          # ESP32 clásico (DevKit / WROOM-32)
.venv/Scripts/pio run -e esp32s3 -t upload           # ESP32-S3
.venv/Scripts/pio device monitor                     # ver el log (115200 baudios)
```

En el monitor debe salir `Centinela nodo node-xxxxxxxxxxxx` y luego `[mqtt] conectado como ...`.
Si la placa no entra en modo de carga, mantén presionado **BOOT** mientras empieza el `upload`.

## Con cámara (2026-10-24)

La cámara es el sensor: la Pi le pide una foto por segundo, detecta movimiento, abre la incidencia
con la foto como evidencia y decide la disuasión. En `include/config.h`:

| Placa | `config.h` | Compilar |
|---|---|---|
| ESP32-CAM AI-Thinker (OV2640, la más común) | `#define CAMARA_MODELO CAMARA_AI_THINKER` y `#define BOTON_PIN -1` (su GPIO0 es el reloj de la cámara) | `pio run -e esp32cam -t upload` |
| ESP32-S3-WROOM CAM / S3-EYE (OV2640/OV5640) | `#define CAMARA_MODELO CAMARA_ESP32S3_EYE` | `pio run -e esp32s3 -t upload` |

- La ESP32-CAM no trae USB: se flashea con un adaptador USB-TTL (o la placa "MB") y GPIO0 a GND al encender.
- Al arrancar, el monitor serie (`pio device monitor`) debe decir `[camara] lista`. Si dice
  `no inició`, revisar el modelo elegido y el cable plano de la cámara.
- Prueba directa desde la PC, en la misma red: `http://<IP del nodo>/capture` (foto) y
  `http://<IP del nodo>:81/stream` (video). La IP sale en el monitor serie y en el `status` del nodo.
- Sin cámara configurada todo sigue igual que antes (`camara: "ausente"`).

## Actualizar por WiFi (2026-10-30)

Con `OTA_PASS` en `include/config.h` el nodo acepta firmware nuevo por la red (ArduinoOTA, UDP 3232),
así un nodo ya montado no se desarma para cada cambio. La **primera** carga con `OTA_PASS` va por USB;
las siguientes, por WiFi. Se hace desde la Pi (misma red que el nodo; Windows suele bloquear la conexión
de regreso que usa OTA), con el proyecto copiado en `~/esp32-node` y PlatformIO en `~/pio-venv`:

```bash
cd ~/esp32-node
NODO_IP=192.168.1.15 OTA_PASS=$(cat ~/firmware-centinela/.ota_pass) ~/pio-venv/bin/pio run -e esp32s3-ota -t upload
```

- Termina con `Result: OK` y el nodo reinicia; su `status` por MQTT trae el `fw` nuevo (subir `FW_VERSION` para notarlo).
- `Authentication Failed` = la contraseña no coincide con la que tiene grabada el nodo.
- La contraseña vive solo en `config.h` (fuera de git) y en `~/firmware-centinela/.ota_pass` (permisos 600).
  El log de la carga la imprime en la línea `Options:`: no compartir esa salida.
- OTA sigue escuchando aunque el broker MQTT esté caído, para poder reparar el nodo.

## Tests sin placa

```bash
.venv/Scripts/pio test -e native
```

En Windows hace falta un compilador de C++ en el PATH (por ejemplo, MinGW de WinLibs: `winget install BrechtSanders.WinLibs.POSIX.UCRT`).
