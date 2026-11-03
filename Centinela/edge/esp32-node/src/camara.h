// Cámara del nodo (opcional) — edge/PENDIENTES.md "Video y evidencia".
// Con CAMARA_MODELO en config.h, inicia la cámara y sirve /capture (JPEG, puerto 80) y /stream
// (MJPEG, puerto 81) para que la Pi detecte movimiento y guarde evidencia. Sin él, capacidad "ausente".
#pragma once

#define CAMARA_AI_THINKER 1
#define CAMARA_ESP32S3_EYE 2

class Camara {
 public:
  void iniciar();
  const char* capacidad() const { return lista_ ? "real" : "ausente"; }

 private:
  bool lista_ = false;
};
