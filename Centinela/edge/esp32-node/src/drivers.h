// Drivers del nodo — spec 2026-10-16-enlace-edge-design.md §3.1.
// Cada periférico declara su capacidad ("real" | "simulado" | "ausente"); conectar un servo real
// es reemplazar PantiltSim por un driver real con la misma interfaz. Nada más cambia.
#pragma once

#include "protocolo.h"

class Led {
 public:
  explicit Led(int pin) : pin_(pin) {}
  void iniciar();
  void poner(bool encendido);
  bool encendido() const { return encendido_; }
  const char* capacidad() const { return "real"; }

 private:
  int pin_;
  bool encendido_ = false;
};

class PantiltSim {
 public:
  protocolo::ResultadoParse mover(const protocolo::Comando& c);
  float pan() const { return pan_; }
  float tilt() const { return tilt_; }
  const char* capacidad() const { return "simulado"; }

 private:
  float pan_ = 90, tilt_ = 0;
};

class AudioSim {
 public:
  void reproducir(const protocolo::Comando& c);
  const char* capacidad() const { return "simulado"; }
};
