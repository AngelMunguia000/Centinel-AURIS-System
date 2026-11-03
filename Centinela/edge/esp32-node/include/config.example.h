// Copiar a include/config.h (fuera de git) y completar antes de compilar.
#pragma once

// WiFi de 2.4 GHz (el ESP32 no se conecta a 5 GHz).
#define WIFI_SSID "tu-red-2.4GHz"
#define WIFI_PASS "tu-contrasena"

// Broker Mosquitto de la Raspberry Pi: su IP en la LAN (p. ej. 192.168.1.50) o centinela-pi.local.
#define MQTT_HOST "192.168.1.50"
#define MQTT_PORT 1883

// LED integrado: casi todas las placas lo traen en el GPIO 2; si la tuya lo tiene en otro, cámbialo aquí.
#define LED_PIN 2
// Botón BOOT de la placa: dispara un evento de severidad alta para probar alarmas sin sensores.
// -1 lo apaga. En la ESP32-CAM (AI-Thinker) el GPIO0 es el reloj de la cámara: ahí debe ser -1.
#define BOTON_PIN 0

// Cámara (opcional). Descomenta UNA según la placa; sin ninguna, el nodo funciona sin cámara.
//   CAMARA_AI_THINKER  → ESP32-CAM AI-Thinker con OV2640 (la más común). Compilar con: pio run -e esp32cam
//   CAMARA_ESP32S3_EYE → ESP32-S3-WROOM CAM / S3-EYE con OV2640 u OV5640. Compilar con: pio run -e esp32s3
// Sirve /capture (foto JPEG) en el puerto 80 y /stream (video MJPEG) en el 81, solo dentro de la LAN.
// #define CAMARA_MODELO CAMARA_AI_THINKER

// Actualizar el firmware por WiFi (README "Actualizar por WiFi"). Sin esta línea el nodo solo acepta USB.
// Usa una contraseña larga y propia: quien la sepa puede cargarle cualquier firmware al nodo.
// #define OTA_PASS "cambia-esta-contrasena"

#define FW_VERSION "0.2.0"
