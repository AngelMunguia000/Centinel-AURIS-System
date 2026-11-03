# Centinela — gateway de la Raspberry Pi

Puente entre los nodos ESP32 (MQTT, vía Mosquitto) y la web de Centinela (HTTP).
Diseño: `docs/diseno/2026-10-16-enlace-edge-design.md`.

```
ESP32 ──MQTT──▶ Mosquitto ──▶ este gateway ──HTTP + token──▶ web (Next.js)
                               ▲  API /v1/comandos  ◀──────── web
```

## Qué hace

- Escucha `centinel/+/status|telemetry|events|ack`.
- Cada 2 s manda a la web la telemetría de los nodos en línea (también es su latido).
- Convierte los cambios en línea/desconectado (incluido el Last Will) en eventos `conexion`.
- Guarda los eventos en una cola SQLite y los reenvía si la web no responde; la web descarta los repetidos.
- `POST /v1/comandos`: recibe un comando de la web, lo publica al nodo y espera su ack hasta 3 s.
- `GET /v1/salud`: `{ok, nodos}` sin autenticación.

## Instalar

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt          # Windows: .venv\Scripts\pip
cp .env.example .env                                # y completar el token
```

El token se genera en la web: **Centro de Dispositivos → Vincular Raspberry Pi**. Se muestra una sola vez.

## Correr

```bash
.venv/bin/python -m centinela_gateway               # Windows: .venv\Scripts\python
```

Variables (`.env`): `CENTINELA_WEB_URL`, `CENTINELA_GATEWAY_TOKEN`, `MQTT_HOST`, `MQTT_PORT`, `COLA_DB`, `PUERTO_API` (por defecto 8000).

## Visión (opcional)

Sin visión, todo movimiento que ve la cámara se disuade. Con visión, YOLO revisa la foto del movimiento:

| Ve | Evento | ¿Disuade? |
|---|---|---|
| Una clase de `VISION_OBJETIVOS` (p. ej. `bird`) | `deteccion` (alta) | Sí |
| Objetivo y una persona | `deteccion` (alta) | No: nunca con una persona a la vista |
| Nada de interés | `movimiento` (baja) | No |

Instalar en el mismo venv del gateway, porque corre dentro de su proceso (unos 500 MB con PyTorch CPU), y exportar a NCNN (unas 4 veces más rápido en la Pi 5):

```bash
.venv/bin/pip install -r requirements-vision.txt
.venv/bin/python -c "from ultralytics import YOLO; YOLO('yolo11n.pt').export(format='ncnn', imgsz=1280)"
# .env: VISION_MODELO=yolo11n_ncnn_model
```

Medido en la Pi 5, 2026-10-29: yolo11n NCNN tarda 80 ms a 640 px y 382 ms a 1280 px. A 1280 px encuentra muchas más aves pequeñas o en parvada (27 contra 6 en una foto de gaviotas). Para que sirva, la cámara también debe mandar fotos grandes.

Ultralytics es AGPL-3.0: para vender Centinela hace falta su licencia comercial o cambiar de modelo.
Por eso esta carpeta se distribuye bajo AGPL-3.0 (`LICENSE`) y el resto de Centinela bajo MIT (`../../LICENSE`).
Cambiar de modelo solo toca `adapters/vision.py` (el `Detector` de `application/camaras.py` es un protocolo).

## Tests

```bash
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest
```

Algunos tests levantan un Mosquitto real en el puerto 18830; sin Mosquitto instalado se saltan.

## Sin hardware

Ver [`simulador/README.md`](simulador/README.md): un ESP32 virtual con el mismo protocolo que el firmware.
