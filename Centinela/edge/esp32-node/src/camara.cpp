#include "camara.h"

#include <Arduino.h>

#include "config.h"

#ifndef CAMARA_MODELO

void Camara::iniciar() {}

#else

#include <esp_camera.h>
#include <esp_http_server.h>

namespace {

// Pines de esp32-camera (camera_pins.h del ejemplo CameraWebServer) para cada placa.
#if CAMARA_MODELO == CAMARA_AI_THINKER
constexpr int XCLK_HZ = 20000000;
constexpr bool ESPEJO = false;
constexpr int PWDN = 32, RESET = -1, XCLK = 0, SIOD = 26, SIOC = 27;
constexpr int Y9 = 35, Y8 = 34, Y7 = 39, Y6 = 36, Y5 = 21, Y4 = 19, Y3 = 18, Y2 = 5, VSYNC = 25, HREF = 23, PCLK = 22;
#elif CAMARA_MODELO == CAMARA_ESP32S3_EYE
// La S3-WROOM CAM real (OV3660, 2026-10-29): 20 MHz da JPEG corruptos, 16 MHz no entrega cuadros,
// 10 y 8 MHz dan imagen con líneas finas iguales. 10 MHz: el más rápido que sirve.
constexpr int XCLK_HZ = 10000000;
constexpr bool ESPEJO = true;  // la OV3660 de esta placa entrega la imagen volteada de lado
constexpr int PWDN = -1, RESET = -1, XCLK = 15, SIOD = 4, SIOC = 5;
constexpr int Y9 = 16, Y8 = 17, Y7 = 18, Y6 = 12, Y5 = 10, Y4 = 8, Y3 = 9, Y2 = 11, VSYNC = 6, HREF = 7, PCLK = 13;
#else
#error "CAMARA_MODELO desconocido: usa CAMARA_AI_THINKER o CAMARA_ESP32S3_EYE"
#endif

#define LIMITE "centinelaframe"
const char* TIPO_STREAM = "multipart/x-mixed-replace;boundary=" LIMITE;
const char* SEPARADOR = "\r\n--" LIMITE "\r\n";
const char* CABECERA_PARTE = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

esp_err_t foto(httpd_req_t* req) {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) return httpd_resp_send_500(req);
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  esp_err_t r = httpd_resp_send(req, reinterpret_cast<const char*>(fb->buf), fb->len);
  esp_camera_fb_return(fb);
  return r;
}

esp_err_t video(httpd_req_t* req) {
  if (httpd_resp_set_type(req, TIPO_STREAM) != ESP_OK) return ESP_FAIL;
  char cabecera[64];
  while (true) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) return ESP_FAIL;
    size_t n = snprintf(cabecera, sizeof(cabecera), CABECERA_PARTE, static_cast<unsigned>(fb->len));
    esp_err_t r = httpd_resp_send_chunk(req, SEPARADOR, strlen(SEPARADOR));
    if (r == ESP_OK) r = httpd_resp_send_chunk(req, cabecera, n);
    if (r == ESP_OK) r = httpd_resp_send_chunk(req, reinterpret_cast<const char*>(fb->buf), fb->len);
    esp_camera_fb_return(fb);
    if (r != ESP_OK) return r;  // el cliente cerró la conexión
  }
}

// Dos servidores, como CameraWebServer: el stream ocupa su tarea mientras dura, y /capture debe
// poder responder a la vez (la Pi toma fotos aunque alguien esté viendo el video).
void servir(uint16_t puerto, const char* ruta, esp_err_t (*manejador)(httpd_req_t*)) {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = puerto;
  config.ctrl_port = 32768 + puerto;
  httpd_handle_t servidor = nullptr;
  if (httpd_start(&servidor, &config) != ESP_OK) {
    Serial.printf("[camara] no se pudo abrir el puerto %u\n", puerto);
    return;
  }
  httpd_uri_t uri = {ruta, HTTP_GET, manejador, nullptr};
  httpd_register_uri_handler(servidor, &uri);
}

}  // namespace

void Camara::iniciar() {
  camera_config_t c = {};
  c.pin_pwdn = PWDN;
  c.pin_reset = RESET;
  c.pin_xclk = XCLK;
  c.pin_sccb_sda = SIOD;
  c.pin_sccb_scl = SIOC;
  c.pin_d7 = Y9;
  c.pin_d6 = Y8;
  c.pin_d5 = Y7;
  c.pin_d4 = Y6;
  c.pin_d3 = Y5;
  c.pin_d2 = Y4;
  c.pin_d1 = Y3;
  c.pin_d0 = Y2;
  c.pin_vsync = VSYNC;
  c.pin_href = HREF;
  c.pin_pclk = PCLK;
  c.xclk_freq_hz = XCLK_HZ;
  c.ledc_timer = LEDC_TIMER_0;
  c.ledc_channel = LEDC_CHANNEL_0;
  c.pixel_format = PIXFORMAT_JPEG;
  // VGA basta para detectar movimiento y como evidencia; con PSRAM caben 2 cuadros (video más fluido).
  // SXGA (1280x1024): a 640 px YOLO no ve aves pequeñas ni parvadas (Brain/21 §75). Sin PSRAM no cabe.
  c.frame_size = psramFound() ? FRAMESIZE_SXGA : FRAMESIZE_VGA;
  c.jpeg_quality = 12;
  c.fb_count = psramFound() ? 2 : 1;
  c.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  c.grab_mode = CAMERA_GRAB_LATEST;

  esp_err_t r = esp_camera_init(&c);
  if (r != ESP_OK) {
    Serial.printf("[camara] no inició (error 0x%x): revisa CAMARA_MODELO y el cable plano\n", r);
    return;
  }
  // PID del sensor: 0x26 OV2640, 0x3660 OV3660, 0x5640 OV5640 (cada uno se ajusta distinto).
  sensor_t* s = esp_camera_sensor_get();
  Serial.printf("[camara] sensor PID 0x%x\n", s->id.PID);
  if (ESPEJO) s->set_hmirror(s, !s->status.hmirror);
  servir(80, "/capture", foto);
  servir(81, "/stream", video);
  lista_ = true;
  Serial.println("[camara] lista: /capture en :80, /stream en :81");
}

#endif
