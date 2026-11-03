#include "drivers.h"

#include <Arduino.h>

using namespace protocolo;

void Led::iniciar() {
  pinMode(pin_, OUTPUT);
  digitalWrite(pin_, LOW);
}

void Led::poner(bool encendido) {
  encendido_ = encendido;
  digitalWrite(pin_, encendido ? HIGH : LOW);
}

ResultadoParse PantiltSim::mover(const Comando& c) {
  float pan = 90, tilt = 0;  // ModoPantilt::Inicio
  if (c.modo == ModoPantilt::Absoluto) {
    pan = c.pan;
    tilt = c.tilt;
  } else if (c.modo == ModoPantilt::Relativo) {
    pan = pan_ + c.pan;
    tilt = tilt_ + c.tilt;
  }
  ResultadoParse r = validarPantilt(pan, tilt);
  if (r.ok) {
    pan_ = pan;
    tilt_ = tilt;
    Serial.printf("[pantilt simulado] pan=%.0f tilt=%.0f\n", pan_, tilt_);
  }
  return r;
}

void AudioSim::reproducir(const Comando& c) {
  Serial.printf("[audio simulado] %s %d ms ganancia %.2f\n", c.patron, c.duracionMs, c.ganancia);
}
