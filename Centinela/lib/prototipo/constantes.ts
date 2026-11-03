// Umbrales del prototipo Centinel v2. Fuente: PDF Parte II (§1.5, §4, §9, Apéndice A).
// Las marcadas "no PDF" son atajos de la simulación, documentados en el spec §6.
export const C = {
  DT_MS: 100, // paso de simulación (no PDF)
  HOME_PAN: 90,
  HOME_TILT: 0,
  PAN_MIN: 0,
  PAN_MAX: 180,
  TILT_MIN: -20,
  TILT_MAX: 45,
  HFOV_DEG: 72,
  VFOV_DEG: 54,
  DEADBAND_DEG: 2.0, // Apéndice A (§4.3 da ±5 %; se adopta la constante del firmware)
  CONF_DETECCION: 0.55,
  CONF_CONFIRMACION: 0.65,
  MARCOS_ESTABLES: 3,
  VENTANA_CONFIRMACION: 20,
  POSITIVOS_MIN: 12,
  DESPLAZAMIENTO_MAX: 0.25,
  OBJETIVO_PERDIDO_MS: 1500,
  REPOSO_MS: 90_000,
  INTENTOS_MAX: 3,
  ENFRIAMIENTO_MS: 8_000,
  RAFAGA_MAX_MS: 3_000,
  RAFAGA_MIN_MS: 500, // no PDF: por debajo no vale la pena emitir
  CICLO_TRABAJO_MAX: 0.2,
  VENTANA_CICLO_MS: 60_000,
  HISTORIAL_POR_SECTOR: 3,
  HEARTBEAT_TIMEOUT_MS: 10_000,
  CORRIENTE_CORTE_A: 1.3,
  SOBRECORRIENTE_VENTANA_MS: 600_000,
  SOBRECORRIENTE_MAX: 3,
  SAFE_MUTE_MS: 30_000,
  ARRANQUE_MS: 500, // no PDF: duración de BOOT y de SELFTEST
  HOMING_MS: 1_000, // no PDF: tiempo de retorno de la torreta
  FRAMES_VACIOS_DESCARTE: 10, // no PDF: descarta un candidato visto y luego perdido
  GANANCIA_APUNTADO: 0.6, // no PDF: fracción del error corregida por marco
  APUNTADO_MAX_MS: 5_000, // no PDF: si el apuntado no converge, se abandona
} as const
