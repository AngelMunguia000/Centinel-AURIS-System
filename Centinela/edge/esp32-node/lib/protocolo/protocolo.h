// Protocolo del nodo (contrato v1) — spec docs/diseno/2026-10-16-enlace-edge-design.md §4.1.
// C++ puro (sin Arduino.h) para que los tests corran en la PC: pio test -e native.
// Espejo de lib/edge/contrato.ts y edge/pi-gateway/centinela_gateway/domain/modelos.py.
#pragma once

#include <stddef.h>
#include <stdint.h>

namespace protocolo {

// Límites mecánicos del Pan-Tilt: el nodo los valida aunque la Pi ya lo haya hecho (protege al servo real).
constexpr float PAN_MIN = 0, PAN_MAX = 180, TILT_MIN = -20, TILT_MAX = 45;

enum class TipoComando { Pantilt, Audio, System, Desconocido };
enum class Accion { Led, Ping, Reboot, Ninguna };
enum class ModoPantilt { Absoluto, Relativo, Inicio };

struct ResultadoParse {
  bool ok;
  const char* error;  // literal estático; nullptr si ok
};

struct Comando {
  TipoComando tipo = TipoComando::Desconocido;
  char cmdId[48] = {0};
  // pantilt
  ModoPantilt modo = ModoPantilt::Absoluto;
  float pan = 90, tilt = 0;
  // audio
  char patron[16] = {0};
  int duracionMs = 1000;
  float ganancia = 1;
  // system
  Accion accion = Accion::Ninguna;
  bool encendido = false;
};

ResultadoParse validarPantilt(float pan, float tilt);

// topico: "centinel/<node_id>/command/<pantilt|audio|system>".
ResultadoParse parsearComando(const char* topico, const char* json, Comando& out);

// resultadoJson: objeto JSON ya serializado (p. ej. "{\"led\":true}") o nullptr. Devuelve bytes escritos (0 si no cupo).
size_t serializarAck(const char* cmdId, bool ok, const char* error, const char* resultadoJson, char* buf, size_t len);

// Armado por lugar: la Pi lo publica retenido aquí como {v:1, armado:bool}. Desarmado = no disuadir.
constexpr const char* TOPICO_ARMADO = "centinel/sistema/armado";
bool parsearArmado(const char* json, bool& armado);

// "node-" + MAC en hex minúsculas, sin separadores (17 caracteres + NUL).
void nodeIdDesdeMac(const uint8_t mac[6], char out[18]);

}  // namespace protocolo
