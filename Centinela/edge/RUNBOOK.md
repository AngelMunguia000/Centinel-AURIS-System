# Runbook — conectar la Raspberry Pi y el ESP32 reales

Una acción por paso, y cómo saber que funcionó. Si un paso falla, no sigas: el siguiente depende de él.
Diseño: `docs/diseno/2026-10-16-enlace-edge-design.md`. Antes de empezar, la cadena simulada
de `pi-gateway/simulador/README.md` debe funcionar en la laptop.

**Necesitas:** Raspberry Pi + su fuente, microSD de 16 GB o más con lector, ESP32 + cable USB **de datos**,
y nombre y contraseña de una red WiFi de **2.4 GHz** a la que se conecten la laptop, la Pi y el ESP32.

Anota aquí las IPs cuando las sepas:

| Equipo | IP en la LAN |
|---|---|
| Laptop (web) | `192.168.1.___` |
| Raspberry Pi | `192.168.1.___` |

## 1. Sistema de la Pi

1. Con **Raspberry Pi Imager**, graba **Raspberry Pi OS Lite (64-bit)**. En la configuración avanzada (engrane):
   hostname `centinela-pi`, usuario `pi` con contraseña, **SSH activado** y tu WiFi de 2.4 GHz.
2. Mete la microSD, enciende la Pi y espera 2 minutos.
3. Desde la laptop: `ssh pi@centinela-pi.local`.
   ✅ Entras a la terminal de la Pi. ❌ Si no resuelve `.local`, busca la IP en tu router y usa `ssh pi@<ip>`.
4. En la Pi: `hostname -I` → anota la IP.

## 2. Mosquitto en la Pi

```bash
sudo apt update && sudo apt install -y mosquitto mosquitto-clients python3-venv
sudo tee /etc/mosquitto/conf.d/centinela.conf >/dev/null <<'EOF'
# shortcut: sin usuario ni TLS, solo para la LAN de la demo (spec §7). Antes de salir de la LAN: TLS en 8883 + usuarios.
listener 1883 0.0.0.0
allow_anonymous true
EOF
sudo systemctl restart mosquitto
```

✅ `mosquitto_sub -h localhost -t '#' -v` se queda escuchando sin error (Ctrl+C para salir).

## 3. Web accesible desde la Pi

En la laptop, la web tiene que escuchar en la LAN, no solo en `localhost`:

```bash
cd Projects/Centinela
npx next dev -H 0.0.0.0
```

Windows va a preguntar si permites Node en redes privadas: **Permitir**.
✅ Desde la Pi: `curl -s -o /dev/null -w '%{http_code}\n' http://<ip-laptop>:3000/iniciar-sesion` → `200`.

## 4. Vincular la Pi en la web

En el navegador de la laptop: **Centro de Dispositivos → Vincular Raspberry Pi**.
- Nombre: el que quieras (p. ej. "Pi jardín").
- Dirección: `http://<ip-pi>:8000`.

Copia el token (solo se muestra una vez).

## 5. Gateway en la Pi

Copia la carpeta desde la laptop:

```bash
scp -r Projects/Centinela/edge/pi-gateway pi@centinela-pi.local:~/
```

En la Pi:

```bash
cd ~/pi-gateway
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env && nano .env      # CENTINELA_WEB_URL=http://<ip-laptop>:3000 y el token del paso 4
.venv/bin/python -m centinela_gateway
```

✅ En el log aparece `MQTT conectado a 127.0.0.1:1883` sin advertencias de "web inaccesible", y en la web
la Pi pasa a **En línea**.

## 6. Arranque automático (systemd)

```bash
sudo tee /etc/systemd/system/centinela-gateway.service >/dev/null <<EOF
[Unit]
Description=Centinela gateway
After=network-online.target mosquitto.service
Wants=network-online.target

[Service]
User=pi
WorkingDirectory=/home/pi/pi-gateway
ExecStart=/home/pi/pi-gateway/.venv/bin/python -m centinela_gateway
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload && sudo systemctl enable --now centinela-gateway
```

✅ `systemctl status centinela-gateway` → `active (running)`. `sudo reboot`, y al volver sigue activo.
Log en vivo: `journalctl -u centinela-gateway -f`.

## 7. Flashear el ESP32

En la laptop (ver `esp32-node/README.md`):

```bash
cd Projects/Centinela/edge/esp32-node
cp include/config.example.h include/config.h   # WIFI_SSID, WIFI_PASS y MQTT_HOST = <ip-pi>
.venv/Scripts/pio run -e esp32dev -t upload     # o -e esp32s3 si tu placa es S3
.venv/Scripts/pio device monitor
```

✅ El monitor muestra `[mqtt] conectado como node-xxxxxxxxxxxx`.

## 8. Verificar en la web

| Prueba | Qué tienes que ver | Tiempo medido |
|---|---|---|
| Abrir Monitor en Vivo | El nodo **En línea**, con temperatura, señal y uptime moviéndose | |
| Encender LED | El LED de la placa se prende y la web dice **Confirmado (N ms)** | N = |
| Ping | **Confirmado (N ms)** | N = |
| Botón BOOT | Evento en la Bitácora + incidencia nueva + notificación al Operador | |
| Desconectar el USB del ESP32 | **Desconectado** en la web | ≈ s |
| Apagar la Pi | **Sin contacto con la Pi** | ≈ s |

Anota los tiempos reales en `Brain/21_ChangeRecoveryLog.md` §45.

## Si algo falla

| Síntoma | Revisa |
|---|---|
| El ESP32 no pasa de `[wifi] conectando` | Red de 2.4 GHz, contraseña en `config.h` |
| `[mqtt] fallo al conectar ... (estado -2)` | IP de la Pi en `MQTT_HOST`; paso 2 (`listener 1883 0.0.0.0`) |
| Gateway: "web inaccesible" | Paso 3: `next dev -H 0.0.0.0`, firewall de Windows, IP de la laptop en `.env` |
| Gateway: "telemetría rechazada ... 401" | El token del `.env` no es el de la Pi vinculada, o se revocó |
| Comandos: "No hay conexión con la Pi" | Dirección de la Pi en la web (`http://<ip-pi>:8000`); que el gateway esté corriendo |
| Comandos: "El nodo no respondió" | Monitor serie del ESP32; que el nodo siga conectado al broker |
