"""Contrato v1 del enlace edge, lado Pi.

Espejo exacto de Projects/Centinela/lib/edge/contrato.ts (zod): cambiar uno obliga
a cambiar el otro. Spec: docs/diseno/2026-10-16-enlace-edge-design.md §4.
"""

from typing import Any, Dict, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Límites mecánicos del Pan-Tilt (LIMITES_SERVO en lib/monitor/servo.ts).
PAN_MIN, PAN_MAX = 0, 180
TILT_MIN, TILT_MAX = -20, 45
NODE_ID_PATRON = r"^node-[0-9a-f]{12}$"

Capacidad = Literal["real", "simulado", "ausente"]
Severidad = Literal["baja", "media", "alta"]
Familia = Literal["sweep_chirp", "sweep_log", "tone_am", "random_mix", "distress"]


class _Mensaje(BaseModel):
    # Los campos desconocidos se ignoran: un firmware más nuevo no rompe una Pi más vieja.
    model_config = ConfigDict(extra="ignore")
    v: Literal[1]


class Capacidades(BaseModel):
    led: Capacidad
    pantilt: Capacidad
    audio: Capacidad
    camara: Capacidad


class Status(_Mensaje):
    state: Literal["online", "offline"]
    fw: Optional[str] = Field(default=None, max_length=32)
    capacidades: Optional[Capacidades] = None
    reason: Optional[str] = None
    # IP del nodo en la LAN: la Pi la usa para pedirle fotos a su cámara (/capture). El firmware manda
    # la IP sola (puerto 80); el nodo virtual agrega ":puerto" porque varios comparten 127.0.0.1.
    ip: Optional[str] = Field(default=None, pattern=r"^\d{1,3}(\.\d{1,3}){3}(:\d{1,5})?$")


class Telemetria(_Mensaje):
    ts_ms: int = Field(ge=0)
    temp_c: float
    rssi_dbm: float
    uptime_s: int = Field(ge=0)
    heap_libre: int = Field(ge=0)
    pan_deg: float = Field(ge=PAN_MIN, le=PAN_MAX)
    tilt_deg: float = Field(ge=TILT_MIN, le=TILT_MAX)


class ComandoPantilt(_Mensaje):
    cmd_id: str = Field(min_length=1)
    mode: Literal["absolute", "relative", "home"]
    pan_deg: float = Field(ge=PAN_MIN, le=PAN_MAX)
    tilt_deg: float = Field(ge=TILT_MIN, le=TILT_MAX)
    speed_dps: Optional[float] = Field(default=None, gt=0, le=360)
    deadline_ms: Optional[int] = Field(default=None, gt=0, le=10000)


class ComandoAudio(_Mensaje):
    cmd_id: str = Field(min_length=1)
    pattern: Familia
    duracion_ms: Optional[int] = Field(default=None, ge=100, le=10000)
    ganancia: Optional[float] = Field(default=None, ge=0, le=1)


class ComandoSystem(_Mensaje):
    cmd_id: str = Field(min_length=1)
    accion: Literal["led", "ping", "reboot"]
    encendido: Optional[bool] = None

    @model_validator(mode="after")
    def _led_exige_encendido(self) -> "ComandoSystem":
        if self.accion == "led" and self.encendido is None:
            raise ValueError("accion led exige encendido")
        return self


class Ack(_Mensaje):
    cmd_id: str
    ok: bool
    error: Optional[str] = None
    resultado: Optional[Dict[str, Any]] = None


class EventoNodo(_Mensaje):
    id: str = Field(min_length=1, max_length=64)
    tipo: str = Field(min_length=1, max_length=40)
    severidad: Severidad
    detalle: Optional[str] = Field(default=None, max_length=500)
    ts_ms: int = Field(ge=0)


class PeticionComando(_Mensaje):
    """Cuerpo de POST /v1/comandos (web → Pi, spec §4.3)."""

    cmd_id: str = Field(min_length=1)
    node_id: str = Field(pattern=NODE_ID_PATRON)
    tipo: Literal["pantilt", "audio", "system"]
    payload: Dict[str, Any]

    def comando(self) -> Union[ComandoPantilt, ComandoAudio, ComandoSystem]:
        """Valida el payload según su tipo (los rangos se revisan otra vez en este salto)."""
        modelo = {"pantilt": ComandoPantilt, "audio": ComandoAudio, "system": ComandoSystem}[self.tipo]
        return modelo.model_validate({**self.payload, "v": 1, "cmd_id": self.cmd_id})


class RespuestaComando(BaseModel):
    estado: Literal["ok", "error", "timeout"]
    error: Optional[str] = None
    resultado: Optional[Dict[str, Any]] = None
    latencia_ms: float
