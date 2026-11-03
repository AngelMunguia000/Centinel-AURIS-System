"""Espejo de tests/edge-contrato.test.ts: mismos valores, mismo contrato v1.

Spec: docs/diseno/2026-10-16-enlace-edge-design.md §4.
"""

import pytest
from pydantic import ValidationError

from centinela_gateway.domain.modelos import (
    Ack,
    ComandoAudio,
    ComandoPantilt,
    ComandoSystem,
    EventoNodo,
    PeticionComando,
    Status,
    Telemetria,
)

TELE = {"ts_ms": 1, "temp_c": 41.5, "rssi_dbm": -60, "uptime_s": 10, "heap_libre": 200000, "pan_deg": 90, "tilt_deg": 0}


def test_telemetria_valida():
    assert Telemetria.model_validate({"v": 1, **TELE}).temp_c == 41.5


def test_rechaza_v_distinto_de_1():
    with pytest.raises(ValidationError):
        Telemetria.model_validate({"v": 2, **TELE})


@pytest.mark.parametrize("pan,tilt,ok", [(181, 0, False), (90, -21, False), (0, -20, True), (180, 45, True)])
def test_limites_pantilt(pan, tilt, ok):
    datos = {"v": 1, "cmd_id": "c1", "mode": "absolute", "pan_deg": pan, "tilt_deg": tilt}
    if ok:
        ComandoPantilt.model_validate(datos)
    else:
        with pytest.raises(ValidationError):
            ComandoPantilt.model_validate(datos)


def test_audio_familias_y_rangos():
    ComandoAudio.model_validate({"v": 1, "cmd_id": "c", "pattern": "sweep_chirp"})
    for malo in ({"pattern": "sirena"}, {"pattern": "tone_am", "duracion_ms": 99}, {"pattern": "tone_am", "ganancia": 1.1}):
        with pytest.raises(ValidationError):
            ComandoAudio.model_validate({"v": 1, "cmd_id": "c", **malo})


def test_system_solo_led_ping_reboot():
    ComandoSystem.model_validate({"v": 1, "cmd_id": "c", "accion": "led", "encendido": True})
    ComandoSystem.model_validate({"v": 1, "cmd_id": "c", "accion": "ping"})
    with pytest.raises(ValidationError):
        ComandoSystem.model_validate({"v": 1, "cmd_id": "c", "accion": "formatear"})


def test_led_exige_encendido():
    with pytest.raises(ValidationError):
        ComandoSystem.model_validate({"v": 1, "cmd_id": "c", "accion": "led"})


def test_peticion_rechaza_node_id_malo():
    base = {"v": 1, "cmd_id": "c", "tipo": "system", "payload": {"accion": "ping"}}
    PeticionComando.model_validate({**base, "node_id": "node-a1b2c3d4e5f6"})
    with pytest.raises(ValidationError):
        PeticionComando.model_validate({**base, "node_id": "node-A1B2C3D4E5F6"})


def test_status_con_capacidades_y_lwt():
    s = Status.model_validate(
        {"v": 1, "state": "online", "fw": "0.1.0", "capacidades": {"led": "real", "pantilt": "simulado", "audio": "simulado", "camara": "ausente"}}
    )
    assert s.capacidades and s.capacidades.led == "real"
    assert Status.model_validate({"v": 1, "state": "offline", "reason": "lwt"}).state == "offline"


def test_evento_severidad_desconocida():
    with pytest.raises(ValidationError):
        EventoNodo.model_validate({"v": 1, "id": "e1", "tipo": "boton", "severidad": "critica", "ts_ms": 1})


def test_ack():
    assert Ack.model_validate({"v": 1, "cmd_id": "c", "ok": True, "resultado": {"pong": True}}).ok
