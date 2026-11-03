# Paso 6: piezas para ahuyentar de verdad (audio + paneo)

Hoy el ESP32 responde a los comandos de audio y servos en modo "simulado": solo los imprime. Con estas piezas, los drivers reales sustituyen a `AudioSim` y `PantiltSim` en `esp32-node/src/drivers.*` sin cambiar nada más (spec 2026-10-16 §3.1).

Las piezas del manual v2 ya están en `lib/prototipo/modulos.ts` (página `/prototipo`). Esta lista las separa en lo mínimo para una demo y lo que pide el manual completo.

## A. Mínimo para la primera demo (ahuyentar con sonido)

| Pieza | Para qué | Nota |
|---|---|---|
| Amplificador I²S **MAX98357A** | Recibe audio digital del ESP32 y mueve la bocina | Una sola placa. El manual usa PCM5102A + PAM8403 (dos placas); para la demo basta esta |
| Bocina 4-8 Ω, 3 W | El sonido que ahuyenta | Cualquiera de 3 W sirve para probar; la del manual (066-619, 105 dB) es para el buque |
| Cables dupont hembra-hembra | Conexiones | |

Se alimenta del mismo USB del ESP32 (5 V), a volumen moderado. Con esto suenan las ráfagas que ya decide la Pi (anti-habituación, ciclo de trabajo).

## B. Paneo y apuntado (servos)

| Pieza | Para qué | Nota |
|---|---|---|
| Servo **MG996R** | Pan (girar), 0-180° | 6 V, 11 kg·cm |
| Servo **DS3218MG** | Tilt (inclinar), −20° a +45° | 6 V, 20 kg·cm |
| Soporte pan-tilt para servos de ese tamaño | La torreta | |
| **Fuente de 6 V, 3 A o más**, o una de 12/24 V con buck ajustable (LM2596HV / XL4016) puesto a 6.0 V | Los servos | **No** salen del USB: al arrancar jalan más de 1 A cada uno y reinician el ESP32 |
| Capacitor electrolítico 1000 µF / 16 V | En la entrada de 6 V de los servos | Evita bajones al moverse |

La tierra (GND) de la fuente de 6 V se une con la del ESP32.

## C. Manual completo (para el buque, después)

PCM5102A + PAM8403 + driver 066-619; fuente 24 V / 5 A con fusible, TVS y diodo; INA219 (corte por sobrecorriente); watchdog TPS3813; DS18B20 (temperatura); radar mmWave C4001. Detalle y razones: `/prototipo` o `lib/prototipo/modulos.ts`.

## Pines libres en esta placa (ESP32-S3 N16R8 con cámara)

La cámara usa los GPIO 4-13 y 15-18. La PSRAM octal usa los 35-37. El 0 es el botón BOOT y el 2 el LED. Propuesta (**verificar contra la serigrafía de la placa antes de conectar**):

| Señal | GPIO |
|---|---|
| I²S BCLK (MAX98357A `BCLK`) | 39 |
| I²S LRCLK (MAX98357A `LRC`) | 40 |
| I²S datos (MAX98357A `DIN`) | 38 |
| Servo pan (señal) | 41 |
| Servo tilt (señal) | 42 |
| Libres de reserva | 1, 14, 21, 47 |

Ojo: el manual pone el `ALERT` del INA219 en el GPIO 2, que aquí es el LED. Cuando llegue el INA219, se mueve a uno de reserva.
