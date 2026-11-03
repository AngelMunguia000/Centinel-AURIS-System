// Firmware del nodo ESP32 de Centinela — spec docs/diseno/2026-10-16-enlace-edge-design.md §3.1 y §4.1.
//
// WiFi → MQTT (Mosquitto en la Pi) con Last Will: status retenido, telemetría cada 2 s,
// comandos con ack, y el botón BOOT como evento de severidad alta (alarmas sin sensores).
// Con CAMARA_MODELO definido en config.h sirve la cámara (src/camara.h) para que la Pi detecte
// movimiento y guarde evidencia. Obedece el armado del lugar (centinel/sistema/armado).
// Con OTA_PASS definido acepta firmware nuevo por WiFi (ArduinoOTA, puerto 3232): ver README "Actualizar por WiFi".
#include <Arduino.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <PubSubClient.h>
#include <WiFi.h>

#include "config.h"
#include "camara.h"
#include "drivers.h"
#include "protocolo.h"

using namespace protocolo;

namespace {

constexpr unsigned long TELEMETRIA_MS = 2000;
constexpr unsigned long REINTENTO_MS = 3000;
constexpr unsigned long ANTIRREBOTE_MS = 50;

WiFiClient red;
PubSubClient mqtt(red);
Led led(LED_PIN);
PantiltSim pantilt;
AudioSim audio;
Camara camara;
// Armado por lugar: arranca armado; la Pi manda el estado real (retenido) al conectar.
bool armado = true;

char nodeId[18];
char base[40];       // "centinel/<node_id>"
char arranque[9];    // prefijo de ids de evento: distinto en cada arranque (la Pi deduplica por id)
uint32_t secuenciaEvento = 0;
unsigned long ultimaTelemetria = 0, ultimoIntento = 0, cambioBoton = 0;
bool botonAnterior = false, reiniciarPendiente = false;
bool otaIniciada = false;

void topico(char* out, size_t n, const char* sufijo) { snprintf(out, n, "%s/%s", base, sufijo); }

void publicar(const char* sufijo, JsonDocument& doc, bool retenido = false) {
  char t[64], buf[512];
  topico(t, sizeof(t), sufijo);
  size_t n = serializeJson(doc, buf, sizeof(buf));
  // shortcut: PubSubClient solo publica QoS 0; en la LAN basta (un ack perdido se ve como timeout en la Pi).
  mqtt.publish(t, reinterpret_cast<const uint8_t*>(buf), n, retenido);
}

void publicarStatus() {
  JsonDocument doc;
  doc["v"] = 1;
  doc["state"] = "online";
  doc["fw"] = FW_VERSION;
  doc["ip"] = WiFi.localIP().toString();  // la Pi le pide fotos a la cámara en esta IP
  JsonObject cap = doc["capacidades"].to<JsonObject>();
  cap["led"] = led.capacidad();
  cap["pantilt"] = pantilt.capacidad();
  cap["audio"] = audio.capacidad();
  cap["camara"] = camara.capacidad();
  publicar("status", doc, true);
}

void publicarEvento(const char* tipo, const char* severidad, const char* detalle) {
  JsonDocument doc;
  char id[24];
  snprintf(id, sizeof(id), "%s-%lu", arranque, static_cast<unsigned long>(++secuenciaEvento));
  doc["v"] = 1;
  doc["id"] = id;
  doc["tipo"] = tipo;
  doc["severidad"] = severidad;
  doc["detalle"] = detalle;
  doc["ts_ms"] = millis();
  publicar("events", doc);
}

void publicarTelemetria() {
  JsonDocument doc;
  doc["v"] = 1;
  doc["ts_ms"] = millis();
  doc["temp_c"] = temperatureRead();
  doc["rssi_dbm"] = WiFi.RSSI();
  doc["uptime_s"] = millis() / 1000;
  doc["heap_libre"] = ESP.getFreeHeap();
  doc["pan_deg"] = pantilt.pan();
  doc["tilt_deg"] = pantilt.tilt();
  publicar("telemetry", doc);
}

void alRecibir(char* topicoRecibido, uint8_t* payload, unsigned int largo) {
  char json[512];
  if (largo >= sizeof(json)) largo = sizeof(json) - 1;
  memcpy(json, payload, largo);
  json[largo] = '\0';

  if (strcmp(topicoRecibido, TOPICO_ARMADO) == 0) {
    if (parsearArmado(json, armado)) Serial.printf("[armado] lugar %s\n", armado ? "armado" : "desarmado");
    return;
  }

  Comando c;
  ResultadoParse r = parsearComando(topicoRecibido, json, c);
  char resultado[96] = "{}";
  if (r.ok) {
    switch (c.tipo) {
      case TipoComando::System:
        if (c.accion == Accion::Led) {
          led.poner(c.encendido);
          snprintf(resultado, sizeof(resultado), "{\"led\":%s}", led.encendido() ? "true" : "false");
        } else if (c.accion == Accion::Ping) {
          strcpy(resultado, "{\"pong\":true}");
        } else {
          reiniciarPendiente = true;  // se reinicia después de mandar el ack
        }
        break;
      case TipoComando::Pantilt:
        r = pantilt.mover(c);
        snprintf(resultado, sizeof(resultado), "{\"pan_deg\":%.0f,\"tilt_deg\":%.0f}", pantilt.pan(), pantilt.tilt());
        break;
      case TipoComando::Audio:
        if (!armado) {
          r = {false, "lugar desarmado"};  // desarmado silencia la disuasión, también la manual
        } else {
          audio.reproducir(c);
          strcpy(resultado, "{\"simulado\":true}");
        }
        break;
      default:
        break;
    }
  }

  char ack[256], t[64];
  size_t n = serializarAck(c.cmdId, r.ok, r.error, r.ok ? resultado : nullptr, ack, sizeof(ack));
  topico(t, sizeof(t), "ack");
  mqtt.publish(t, reinterpret_cast<const uint8_t*>(ack), n, false);
  Serial.printf("[cmd] %s -> %s\n", topicoRecibido, r.ok ? "ok" : r.error);
}

bool conectarMqtt() {
  char will[64], sub[64];
  topico(will, sizeof(will), "status");
  topico(sub, sizeof(sub), "command/+");
  // Si el nodo muere, el broker publica esto (retenido) y la Pi avisa a la web.
  if (!mqtt.connect(nodeId, will, 1, true, "{\"v\":1,\"state\":\"offline\",\"reason\":\"lwt\"}")) {
    Serial.printf("[mqtt] fallo al conectar a %s:%d (estado %d)\n", MQTT_HOST, MQTT_PORT, mqtt.state());
    return false;
  }
  mqtt.subscribe(sub, 1);
  mqtt.subscribe(TOPICO_ARMADO, 1);
  publicarStatus();
  Serial.printf("[mqtt] conectado como %s\n", nodeId);
  return true;
}

}  // namespace

void setup() {
  Serial.begin(115200);
  led.iniciar();
#if BOTON_PIN >= 0
  pinMode(BOTON_PIN, INPUT_PULLUP);
#endif
  WiFi.mode(WIFI_STA);
  camara.iniciar();  // después de WiFi.mode: sus servidores HTTP necesitan la pila TCP/IP ya iniciada
  uint8_t mac[6];
  WiFi.macAddress(mac);
  nodeIdDesdeMac(mac, nodeId);
  snprintf(base, sizeof(base), "centinel/%s", nodeId);
  snprintf(arranque, sizeof(arranque), "%08lx", static_cast<unsigned long>(esp_random()));
  Serial.printf("\nCentinela nodo %s (fw %s)\n", nodeId, FW_VERSION);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setKeepAlive(10);
  mqtt.setBufferSize(1024);
  mqtt.setCallback(alRecibir);
}

void loop() {
  unsigned long ahora = millis();

#ifdef OTA_PASS
  // Antes del chequeo de MQTT: si el broker cae, el nodo aún se puede reparar por WiFi.
  if (WiFi.status() == WL_CONNECTED) {
    if (!otaIniciada) {
      ArduinoOTA.setHostname(nodeId);
      ArduinoOTA.setPassword(OTA_PASS);
      ArduinoOTA.onStart([] { Serial.println("[ota] recibiendo firmware"); });
      ArduinoOTA.onEnd([] { Serial.println("[ota] listo, reiniciando"); });
      ArduinoOTA.onError([](ota_error_t e) { Serial.printf("[ota] error %u\n", e); });
      ArduinoOTA.begin();
      otaIniciada = true;
    }
    ArduinoOTA.handle();
  }
#endif

  if (WiFi.status() != WL_CONNECTED || !mqtt.connected()) {
    if (ahora - ultimoIntento >= REINTENTO_MS) {
      ultimoIntento = ahora;
      if (WiFi.status() != WL_CONNECTED) {
        Serial.printf("[wifi] conectando a %s...\n", WIFI_SSID);
      } else {
        conectarMqtt();
      }
    }
    return;
  }

  mqtt.loop();

  if (reiniciarPendiente) {
    mqtt.loop();
    delay(200);
    ESP.restart();
  }

  if (ahora - ultimaTelemetria >= TELEMETRIA_MS) {
    ultimaTelemetria = ahora;
    publicarTelemetria();
  }

#if BOTON_PIN >= 0
  bool presionado = digitalRead(BOTON_PIN) == LOW;
  if (presionado != botonAnterior && ahora - cambioBoton >= ANTIRREBOTE_MS) {
    cambioBoton = ahora;
    botonAnterior = presionado;
    if (presionado) publicarEvento("boton", "alta", "Botón BOOT presionado en el nodo");
  }
#endif
}
