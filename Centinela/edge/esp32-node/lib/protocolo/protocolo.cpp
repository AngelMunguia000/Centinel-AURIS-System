#include "protocolo.h"

#include <ArduinoJson.h>
#include <stdio.h>
#include <string.h>

namespace protocolo {

namespace {

const ResultadoParse OK = {true, nullptr};
ResultadoParse falla(const char* e) { return {false, e}; }

const char* FAMILIAS[] = {"sweep_chirp", "sweep_log", "tone_am", "random_mix", "distress"};

// Último segmento del tópico, solo si el penúltimo es "command".
const char* sufijoComando(const char* topico) {
  const char* ultima = strrchr(topico, '/');
  if (!ultima || ultima - topico < 8) return nullptr;
  if (strncmp(ultima - 8, "/command", 8) != 0) return nullptr;
  return ultima + 1;
}

}  // namespace

ResultadoParse validarPantilt(float pan, float tilt) {
  if (pan < PAN_MIN || pan > PAN_MAX) return falla("pan fuera de rango (0-180)");
  if (tilt < TILT_MIN || tilt > TILT_MAX) return falla("tilt fuera de rango (-20-45)");
  return OK;
}

ResultadoParse parsearComando(const char* topico, const char* json, Comando& out) {
  out = Comando();
  const char* tipo = sufijoComando(topico);
  if (!tipo) return falla("topico invalido");
  if (strcmp(tipo, "pantilt") == 0) out.tipo = TipoComando::Pantilt;
  else if (strcmp(tipo, "audio") == 0) out.tipo = TipoComando::Audio;
  else if (strcmp(tipo, "system") == 0) out.tipo = TipoComando::System;
  else return falla("tipo de comando desconocido");

  JsonDocument doc;
  if (deserializeJson(doc, json)) return falla("JSON invalido");
  if (!doc["v"].is<int>() || doc["v"].as<int>() != 1) return falla("version de contrato no soportada");
  const char* cmdId = doc["cmd_id"] | "";
  if (!*cmdId || strlen(cmdId) >= sizeof(out.cmdId)) return falla("cmd_id ausente o demasiado largo");
  strcpy(out.cmdId, cmdId);

  if (out.tipo == TipoComando::Pantilt) {
    const char* modo = doc["mode"] | "";
    if (strcmp(modo, "home") == 0) {
      out.modo = ModoPantilt::Inicio;
      return OK;
    }
    if (strcmp(modo, "absolute") == 0) out.modo = ModoPantilt::Absoluto;
    else if (strcmp(modo, "relative") == 0) out.modo = ModoPantilt::Relativo;
    else return falla("mode invalido");
    if (!doc["pan_deg"].is<float>() || !doc["tilt_deg"].is<float>()) return falla("faltan pan_deg/tilt_deg");
    out.pan = doc["pan_deg"].as<float>();
    out.tilt = doc["tilt_deg"].as<float>();
    // En relativo son deltas: el driver valida el ángulo final.
    return out.modo == ModoPantilt::Absoluto ? validarPantilt(out.pan, out.tilt) : OK;
  }

  if (out.tipo == TipoComando::Audio) {
    const char* patron = doc["pattern"] | "";
    bool conocido = false;
    for (const char* f : FAMILIAS) conocido = conocido || strcmp(patron, f) == 0;
    if (!conocido) return falla("pattern desconocido");
    strcpy(out.patron, patron);
    if (!doc["duracion_ms"].isNull()) {
      out.duracionMs = doc["duracion_ms"].as<int>();
      if (out.duracionMs < 100 || out.duracionMs > 10000) return falla("duracion_ms fuera de rango (100-10000)");
    }
    if (!doc["ganancia"].isNull()) {
      out.ganancia = doc["ganancia"].as<float>();
      if (out.ganancia < 0 || out.ganancia > 1) return falla("ganancia fuera de rango (0-1)");
    }
    return OK;
  }

  const char* accion = doc["accion"] | "";
  if (strcmp(accion, "led") == 0) {
    if (!doc["encendido"].is<bool>()) return falla("accion led exige encendido");
    out.accion = Accion::Led;
    out.encendido = doc["encendido"].as<bool>();
  } else if (strcmp(accion, "ping") == 0) {
    out.accion = Accion::Ping;
  } else if (strcmp(accion, "reboot") == 0) {
    out.accion = Accion::Reboot;
  } else {
    return falla("accion desconocida");
  }
  return OK;
}

size_t serializarAck(const char* cmdId, bool ok, const char* error, const char* resultadoJson, char* buf, size_t len) {
  JsonDocument doc;
  doc["v"] = 1;
  doc["cmd_id"] = cmdId;
  doc["ok"] = ok;
  if (error) doc["error"] = error;
  if (resultadoJson) doc["resultado"] = serialized(resultadoJson);
  if (measureJson(doc) >= len) return 0;
  return serializeJson(doc, buf, len);
}

bool parsearArmado(const char* json, bool& armado) {
  JsonDocument doc;
  if (deserializeJson(doc, json)) return false;
  if (!doc["v"].is<int>() || doc["v"].as<int>() != 1 || !doc["armado"].is<bool>()) return false;
  armado = doc["armado"].as<bool>();
  return true;
}

void nodeIdDesdeMac(const uint8_t mac[6], char out[18]) {
  snprintf(out, 18, "node-%02x%02x%02x%02x%02x%02x", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

}  // namespace protocolo
