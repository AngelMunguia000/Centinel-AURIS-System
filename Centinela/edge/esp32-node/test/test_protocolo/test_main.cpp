// Tests nativos (sin placa) del protocolo del nodo — spec 2026-10-16-enlace-edge-design.md §4.1.
// Mismos valores que tests/edge-contrato.test.ts y edge/pi-gateway/tests/test_modelos.py.
#include <string.h>
#include <unity.h>

#include "protocolo.h"

using namespace protocolo;

void setUp() {}
void tearDown() {}

void test_pantilt_limites() {
  TEST_ASSERT_TRUE(validarPantilt(0, -20).ok);
  TEST_ASSERT_TRUE(validarPantilt(180, 45).ok);
  TEST_ASSERT_FALSE(validarPantilt(181, 0).ok);
  TEST_ASSERT_FALSE(validarPantilt(90, -21).ok);
}

void test_parsea_led() {
  Comando c;
  ResultadoParse r = parsearComando("centinel/node-a1b2c3d4e5f6/command/system",
                                    "{\"v\":1,\"cmd_id\":\"c-1\",\"accion\":\"led\",\"encendido\":true}", c);
  TEST_ASSERT_TRUE_MESSAGE(r.ok, r.error);
  TEST_ASSERT_TRUE(c.tipo == TipoComando::System);
  TEST_ASSERT_TRUE(c.accion == Accion::Led);
  TEST_ASSERT_TRUE(c.encendido);
  TEST_ASSERT_EQUAL_STRING("c-1", c.cmdId);
}

void test_led_sin_encendido_falla() {
  Comando c;
  TEST_ASSERT_FALSE(parsearComando("centinel/x/command/system", "{\"v\":1,\"cmd_id\":\"c\",\"accion\":\"led\"}", c).ok);
}

void test_parsea_pantilt_y_rechaza_fuera_de_rango() {
  Comando c;
  ResultadoParse ok = parsearComando("centinel/x/command/pantilt",
                                     "{\"v\":1,\"cmd_id\":\"p\",\"mode\":\"absolute\",\"pan_deg\":45,\"tilt_deg\":10}", c);
  TEST_ASSERT_TRUE_MESSAGE(ok.ok, ok.error);
  TEST_ASSERT_EQUAL_FLOAT(45, c.pan);
  TEST_ASSERT_EQUAL_FLOAT(10, c.tilt);
  TEST_ASSERT_FALSE(parsearComando("centinel/x/command/pantilt",
                                   "{\"v\":1,\"cmd_id\":\"p\",\"mode\":\"absolute\",\"pan_deg\":181,\"tilt_deg\":0}", c).ok);
}

void test_audio_familias_y_rangos() {
  Comando c;
  TEST_ASSERT_TRUE(parsearComando("centinel/x/command/audio", "{\"v\":1,\"cmd_id\":\"a\",\"pattern\":\"sweep_chirp\"}", c).ok);
  TEST_ASSERT_FALSE(parsearComando("centinel/x/command/audio", "{\"v\":1,\"cmd_id\":\"a\",\"pattern\":\"sirena\"}", c).ok);
  TEST_ASSERT_FALSE(parsearComando("centinel/x/command/audio", "{\"v\":1,\"cmd_id\":\"a\",\"pattern\":\"tone_am\",\"duracion_ms\":99}", c).ok);
  TEST_ASSERT_FALSE(parsearComando("centinel/x/command/audio", "{\"v\":1,\"cmd_id\":\"a\",\"pattern\":\"tone_am\",\"ganancia\":1.1}", c).ok);
}

void test_json_invalido_falla_con_error() {
  Comando c;
  ResultadoParse r = parsearComando("centinel/x/command/system", "{no es json", c);
  TEST_ASSERT_FALSE(r.ok);
  TEST_ASSERT_NOT_NULL(r.error);
}

void test_v_distinto_de_1_falla() {
  Comando c;
  TEST_ASSERT_FALSE(parsearComando("centinel/x/command/system", "{\"v\":2,\"cmd_id\":\"c\",\"accion\":\"ping\"}", c).ok);
}

void test_topico_desconocido_falla() {
  Comando c;
  TEST_ASSERT_FALSE(parsearComando("centinel/x/command/formatear", "{\"v\":1,\"cmd_id\":\"c\"}", c).ok);
}

void test_node_id_desde_mac() {
  const uint8_t mac[6] = {0xA1, 0xB2, 0xC3, 0xD4, 0xE5, 0xF6};
  char out[18];
  nodeIdDesdeMac(mac, out);
  TEST_ASSERT_EQUAL_STRING("node-a1b2c3d4e5f6", out);
}

void test_serializa_ack() {
  char buf[160];
  size_t n = serializarAck("c-1", true, nullptr, "{\"led\":true}", buf, sizeof(buf));
  TEST_ASSERT_TRUE(n > 0);
  TEST_ASSERT_EQUAL_STRING("{\"v\":1,\"cmd_id\":\"c-1\",\"ok\":true,\"resultado\":{\"led\":true}}", buf);
  serializarAck("c-2", false, "servo bloqueado", nullptr, buf, sizeof(buf));
  TEST_ASSERT_EQUAL_STRING("{\"v\":1,\"cmd_id\":\"c-2\",\"ok\":false,\"error\":\"servo bloqueado\"}", buf);
}

void test_parsea_armado() {
  bool armado = true;
  TEST_ASSERT_TRUE(parsearArmado("{\"v\":1,\"armado\":false}", armado));
  TEST_ASSERT_FALSE(armado);
  TEST_ASSERT_FALSE(parsearArmado("{\"v\":1,\"armado\":\"no\"}", armado));
  TEST_ASSERT_FALSE(parsearArmado("{\"v\":2,\"armado\":true}", armado));
  TEST_ASSERT_FALSE(parsearArmado("roto", armado));
  TEST_ASSERT_FALSE(armado);  // un mensaje inválido no cambia el estado
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_pantilt_limites);
  RUN_TEST(test_parsea_led);
  RUN_TEST(test_led_sin_encendido_falla);
  RUN_TEST(test_parsea_pantilt_y_rechaza_fuera_de_rango);
  RUN_TEST(test_audio_familias_y_rangos);
  RUN_TEST(test_json_invalido_falla_con_error);
  RUN_TEST(test_v_distinto_de_1_falla);
  RUN_TEST(test_topico_desconocido_falla);
  RUN_TEST(test_node_id_desde_mac);
  RUN_TEST(test_serializa_ack);
  RUN_TEST(test_parsea_armado);
  return UNITY_END();
}
