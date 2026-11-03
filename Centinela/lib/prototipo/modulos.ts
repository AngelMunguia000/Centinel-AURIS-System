// Catálogo de módulos del prototipo Centinel v2. Fuente: PDF Parte II; las cifras
// se copian de las secciones citadas en `pdf` (verificadas contra el BOM §6.1–§6.6).
export const GRUPOS_MODULO = [
  'Cómputo', 'Nodo periférico', 'Visión', 'Sensado', 'Mecánica', 'Audio', 'Energía', 'Seguridad', 'Software',
] as const
export type GrupoModulo = (typeof GRUPOS_MODULO)[number]

export interface Modulo {
  id: string
  grupo: GrupoModulo
  nombre: string
  funcion: string
  especificacion: string
  pdf: string
  conexion: string
}

export const MODULOS: Modulo[] = [
  {
    id: 'raspberry-pi-5', grupo: 'Cómputo', nombre: 'Raspberry Pi 5, 8 GB',
    funcion: 'Cerebro del sistema: corre la inferencia de visión, la máquina de estados de misión, el backend FastAPI, el broker MQTT y SQLite.',
    especificacion: '5.1 V / 5 A con fuente USB-C PD de 27 W aislada; ventilador activo obligatorio; Raspberry Pi OS Bookworm 64 bit.',
    pdf: '§6.1, §1.2',
    conexion: 'Reenvía las alertas del prototipo a esta plataforma vía FastAPI; Centinela nunca habla MQTT directo con el hardware.',
  },
  {
    id: 'esp32-s3', grupo: 'Nodo periférico', nombre: 'ESP32-S3-WROOM-1 N16R8',
    funcion: 'Nodo único que concentra cámara, servos, audio, sensores y seguridad, con ejecución determinista en tiempo real.',
    especificacion: '16 MB de flash y 8 MB de PSRAM (imprescindible para el framebuffer); 3.3 V de lógica, 5 V de entrada.',
    pdf: '§6.1, §1.1',
    conexion: 'Publica telemetría y alertas; si pierde a la Pi conserva reglas locales (home + MUTE) y aquí se refleja como dispositivo desconectado.',
  },
  {
    id: 'ov5640', grupo: 'Visión', nombre: 'Cámara OV5640 (DVP)',
    funcion: 'Captura el video que la Pi analiza para detectar aves.',
    especificacion: '3.3 V, 120 mA; lente de 2.8 mm; campo de visión horizontal de 72°.',
    pdf: '§6.2',
    conexion: 'Su campo de visión es el que se dibuja en la pestaña Simulación.',
  },
  {
    id: 'yolov8n', grupo: 'Visión', nombre: 'YOLOv8n + ByteTrack',
    funcion: 'Detecta aves y les da identidad persistente entre marcos; decide si hay o no un ave.',
    especificacion: 'NCNN int8, umbral de detección 0.55; 28 FPS medidos en Raspberry Pi 5.',
    pdf: '§3, §D.4',
    conexion: 'Su confirmación (12 de 20 marcos) separa una alerta real de una falsa alarma.',
  },
  {
    id: 'c4001', grupo: 'Sensado', nombre: 'DFRobot C4001 (mmWave 24 GHz)',
    funcion: 'Vigila con bajo consumo y despierta al sistema; no decide, solo avisa.',
    especificacion: 'Enlace UART; ~70 mA en vigilancia continua.',
    pdf: '§6.6, §4.1',
    conexion: 'Su disparo es la entrada "presencia" de la simulación.',
  },
  {
    id: 'servo-pan', grupo: 'Mecánica', nombre: 'Servo Pan MG996R',
    funcion: 'Gira la torreta en horizontal para apuntar al ave.',
    especificacion: '6 V, 11 kg·cm, engranes metálicos; rango 0–180°.',
    pdf: '§6.4',
    conexion: 'Su ángulo es el indicador Pan de la simulación.',
  },
  {
    id: 'servo-tilt', grupo: 'Mecánica', nombre: 'Servo Tilt DS3218MG',
    funcion: 'Inclina la torreta en vertical; más torque por el peso combinado de driver y cámara.',
    especificacion: '6 V, 20 kg·cm, engranes metálicos; rango −20° a +45°.',
    pdf: '§6.4',
    conexion: 'Su ángulo es el indicador Tilt de la simulación.',
  },
  {
    id: 'pcm5102a', grupo: 'Audio', nombre: 'DAC PCM5102A',
    funcion: 'Convierte el flujo digital I²S en audio analógico.',
    especificacion: '5 V, 32 bit / 384 kHz, reloj interno.',
    pdf: '§6.3, §5.2',
    conexion: 'El ESP32 sintetiza el patrón en tiempo real; la Pi solo envía parámetros (familia, duración, ganancia).',
  },
  {
    id: 'pam8403', grupo: 'Audio', nombre: 'Amplificador PAM8403',
    funcion: 'Etapa de potencia clase D que alimenta el driver.',
    especificacion: '5 V, clase D sin filtro, ~3 W sobre 8 Ω en puente (BTL); pin SHDN accesible.',
    pdf: '§6.3',
    conexion: 'Su alimentación es el riel de 5 V que vigila el INA219.',
  },
  {
    id: 'driver-066-619', grupo: 'Audio', nombre: 'Driver de neodimio 066-619',
    funcion: 'Emisor acústico direccional, montado coaxialmente con la cámara.',
    especificacion: '8 Ω, 105 dB/W/m, operado a ~3 W; ~108–110 dB SPL a 1 m; banda de 300 Hz a 6 kHz.',
    pdf: '§6.3, §1.5',
    conexion: 'Apuntar cámara y emisor a la vez es lo que rompe la predictibilidad del estímulo.',
  },
  {
    id: 'fuente-24v', grupo: 'Energía', nombre: 'Fuente de 24 V / 5 A (120 W)',
    funcion: 'Bus principal de potencia para servos y lógica.',
    especificacion: 'Con fusible de 4 A, TVS SMBJ26A y diodo antirretorno SS54.',
    pdf: '§6.5, §9.2',
    conexion: 'Una subtensión (bus < 21 V) se reportaría como dispositivo degradado.',
  },
  {
    id: 'bucks', grupo: 'Energía', nombre: 'Reguladores Buck 24→6 V y 24→5 V',
    funcion: 'Alimentan por separado los servos (6 V / 5 A) y la lógica (5 V / 3 A).',
    especificacion: 'XL4016 o LM2596HV-ADJ ajustado a 6.0 V; MP1584 o LM2596-5.0.',
    pdf: '§6.5',
    conexion: 'Separar servos y lógica evita que los picos de arranque reinicien el nodo.',
  },
  {
    id: 'ina219', grupo: 'Seguridad', nombre: 'INA219',
    funcion: 'Mide tensión y corriente del amplificador y corta el audio ante una sobrecorriente.',
    especificacion: 'I²C 0x40, ALERT a GPIO2; corte a 1.3 A por software y a 1.6 A por hardware.',
    pdf: '§6.6, §9.2',
    conexion: 'Su corte es el escenario "Sobrecorriente de audio" y genera un Reporte.',
  },
  {
    id: 'tps3813', grupo: 'Seguridad', nombre: 'Watchdog TPS3813K33',
    funcion: 'Corta el amplificador si el firmware se cuelga, sin depender del software.',
    especificacion: 'Ventana de 20 a 640 ms; independiente del ESP32.',
    pdf: '§6.6, §9.3',
    conexion: 'Es la barrera 5 de 6: sigue actuando aunque el firmware esté corrupto.',
  },
  {
    id: 'ds18b20', grupo: 'Seguridad', nombre: 'Sensor térmico DS18B20',
    funcion: 'Vigila la temperatura del disipador del amplificador.',
    especificacion: '1-Wire; MUTE inmediato por encima de 85 °C.',
    pdf: '§6.6, §9.2',
    conexion: 'Una sobretemperatura se reportaría como alerta de severidad S3.',
  },
  {
    id: 'mosquitto', grupo: 'Software', nombre: 'Broker Mosquitto (MQTT v3.1.1)',
    funcion: 'Bus de mensajes entre la Pi y el ESP32, con detección de caída por heartbeat.',
    especificacion: 'Tópicos centinel/telemetry, centinel/command/pantilt y centinel/command/audio; heartbeat de 10 s con Last Will.',
    pdf: '§1.4, §3',
    conexion: 'El log "Tópicos MQTT" de la simulación muestra mensajes con esta forma.',
  },
  {
    id: 'panel-auris', grupo: 'Software', nombre: 'Panel AURIS (esta aplicación)',
    funcion: 'Plataforma de gestión: monitoreo, bitácora y administración por roles.',
    especificacion: 'Next.js 16 + React 19; recibe las alertas a través de FastAPI.',
    pdf: '§1.4, §3',
    conexion: 'Aquí se materializan las alertas como Reportes y Notificaciones.',
  },
]
