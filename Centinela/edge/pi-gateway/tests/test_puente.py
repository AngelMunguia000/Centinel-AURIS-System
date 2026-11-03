"""Puente MQTT ↔ web — spec 2026-10-16-enlace-edge-design.md §4 y §8; plan Tarea 10."""

import asyncio
import json

import aiomqtt
import httpx
import pytest
import respx

from centinela_gateway.adapters.cola import Cola
from centinela_gateway.adapters.web import ClienteWeb
from centinela_gateway.application.puente import Puente

WEB = "http://web.test"
NODO_A = "node-0000000000a1"
NODO_B = "node-0000000000b2"
CAPS = {"led": "real", "pantilt": "simulado", "audio": "simulado", "camara": "ausente"}
TELE = {"v": 1, "ts_ms": 1, "temp_c": 41.5, "rssi_dbm": -60, "uptime_s": 10, "heap_libre": 200000, "pan_deg": 90, "tilt_deg": 0}


def _j(datos) -> bytes:
    return json.dumps(datos).encode()


@pytest.fixture
async def puente(tmp_path):
    async with httpx.AsyncClient() as http:
        yield Puente(ClienteWeb(WEB, "token-secreto", http), Cola(str(tmp_path / "cola.db")))


def _online(p: Puente, nodo: str):
    p.manejar(f"centinel/{nodo}/status", _j({"v": 1, "state": "online", "fw": "0.1.0", "capacidades": CAPS}))
    p.manejar(f"centinel/{nodo}/telemetry", _j(TELE))


@respx.mock
async def test_latido_envia_los_nodos_en_linea(puente):
    ruta = respx.post(f"{WEB}/api/edge/telemetria").mock(return_value=httpx.Response(200, json={"ok": True}))
    _online(puente, NODO_A)
    _online(puente, NODO_B)
    await puente.latido()
    cuerpo = json.loads(ruta.calls.last.request.content)
    assert cuerpo["v"] == 1
    assert sorted(n["node_id"] for n in cuerpo["nodos"]) == [NODO_A, NODO_B]
    assert cuerpo["nodos"][0]["capacidades"] == CAPS
    assert "v" not in cuerpo["nodos"][0]["telemetria"]
    assert ruta.calls.last.request.headers["authorization"] == "Bearer token-secreto"


@respx.mock
async def test_latido_cada_2s_aunque_no_haya_nodos(puente):
    ruta = respx.post(f"{WEB}/api/edge/telemetria").mock(return_value=httpx.Response(200, json={"ok": True}))
    tarea = asyncio.create_task(puente.bucle_latido(intervalo=0.05))
    await asyncio.sleep(0.18)
    tarea.cancel()
    assert ruta.call_count >= 3
    assert json.loads(ruta.calls.last.request.content)["nodos"] == []


@respx.mock
async def test_nodo_offline_no_va_en_el_latido(puente):
    ruta = respx.post(f"{WEB}/api/edge/telemetria").mock(return_value=httpx.Response(200, json={"ok": True}))
    _online(puente, NODO_A)
    puente.manejar(f"centinel/{NODO_A}/status", _j({"v": 1, "state": "offline", "reason": "lwt"}))
    await puente.latido()
    assert json.loads(ruta.calls.last.request.content)["nodos"] == []


def test_lwt_genera_evento_conexion_offline_media(puente):
    _online(puente, NODO_A)
    puente.manejar(f"centinel/{NODO_A}/status", _j({"v": 1, "state": "offline", "reason": "lwt"}))
    eventos = puente.cola.pendientes()
    assert [(e["tipo"], e["detalle"], e["severidad"]) for e in eventos] == [("conexion", "online", "baja"), ("conexion", "offline", "media")]
    assert all(e["node_id"] == NODO_A for e in eventos)


def test_status_online_repetido_no_genera_otro_evento(puente):
    _online(puente, NODO_A)
    _online(puente, NODO_A)
    assert len(puente.cola.pendientes()) == 1


def test_evento_del_nodo_recibe_uuid_determinista(puente):
    crudo = _j({"v": 1, "id": "boot7-1", "tipo": "boton", "severidad": "alta", "ts_ms": 5})
    puente.manejar(f"centinel/{NODO_A}/events", crudo)
    puente.manejar(f"centinel/{NODO_A}/events", crudo)  # reentrega QoS 1
    eventos = puente.cola.pendientes()
    assert len(eventos) == 1
    assert len(eventos[0]["id"]) == 36 and eventos[0]["tipo"] == "boton"
    assert eventos[0]["ocurrido_en"].endswith("Z")


@respx.mock
async def test_web_caida_encola_y_reenvia_sin_duplicar(puente):
    ruta = respx.post(f"{WEB}/api/edge/eventos").mock(
        side_effect=[httpx.Response(503), httpx.Response(200, json={"ok": True, "nuevos": 1})]
    )
    puente.manejar(f"centinel/{NODO_A}/events", _j({"v": 1, "id": "x", "tipo": "boton", "severidad": "baja", "ts_ms": 1}))
    assert await puente.drenar() is False
    assert len(puente.cola.pendientes()) == 1
    assert await puente.drenar() is True
    assert puente.cola.pendientes() == []
    ids = [json.loads(c.request.content)["eventos"][0]["id"] for c in ruta.calls]
    assert ids[0] == ids[1]


@respx.mock
async def test_4xx_se_confirma_para_no_bloquear_la_cola(puente):
    respx.post(f"{WEB}/api/edge/eventos").mock(return_value=httpx.Response(400, json={"error": "Contrato inválido"}))
    puente.manejar(f"centinel/{NODO_A}/events", _j({"v": 1, "id": "x", "tipo": "boton", "severidad": "baja", "ts_ms": 1}))
    assert await puente.drenar() is True
    assert puente.cola.pendientes() == []


def test_payload_malformado_no_tumba_el_puente(puente, caplog):
    puente.manejar(f"centinel/{NODO_A}/telemetry", b"{no es json")
    puente.manejar(f"centinel/{NODO_A}/telemetry", _j({**TELE, "pan_deg": 999}))
    puente.manejar("centinel/esp32/telemetry", _j(TELE))
    puente.manejar("otro/topico", b"x")
    assert puente.nodos_en_linea() == []
    assert "descartado" in caplog.text


async def test_puente_recibe_de_mosquitto_real(puente, broker):
    host, puerto = broker
    async with aiomqtt.Client(host, puerto) as entrada, aiomqtt.Client(host, puerto) as nodo:
        await puente.suscribir(entrada)
        escucha = asyncio.create_task(puente.escuchar(entrada))
        await nodo.publish(f"centinel/{NODO_A}/status", _j({"v": 1, "state": "online", "capacidades": CAPS}), qos=1)
        await nodo.publish(f"centinel/{NODO_A}/telemetry", _j(TELE), qos=1)
        for _ in range(50):
            if puente.nodos_en_linea():
                break
            await asyncio.sleep(0.05)
        escucha.cancel()
    assert [n["node_id"] for n in puente.nodos_en_linea()] == [NODO_A]


@respx.mock
async def test_latido_reparte_el_armado_solo_cuando_cambia(puente):
    ruta = respx.post(f"{WEB}/api/edge/telemetria")
    publicados = []

    async def publicar(topico, datos, retener=False):
        publicados.append((topico, json.loads(datos), retener))

    ruta.mock(return_value=httpx.Response(200, json={"ok": True, "armado": False}))
    await puente.latido(publicar)
    await puente.latido(publicar)  # sin cambio: no se vuelve a publicar
    assert publicados == [("centinel/sistema/armado", {"v": 1, "armado": False}, True)]

    ruta.mock(return_value=httpx.Response(500))
    await puente.latido(publicar)  # la web falló: se conserva el último estado
    assert puente.armado is False and len(publicados) == 1

    ruta.mock(return_value=httpx.Response(200, json={"ok": True, "armado": True}))
    await puente.latido(publicar)
    assert publicados[-1][1] == {"v": 1, "armado": True} and puente.armado is True


@respx.mock
async def test_armado_sin_broker_se_reintenta(puente):
    respx.post(f"{WEB}/api/edge/telemetria").mock(return_value=httpx.Response(200, json={"ok": True, "armado": False}))

    async def sin_broker(topico, datos, retener=False):
        raise ConnectionError("sin conexión al broker")

    await puente.latido(sin_broker)
    assert puente.armado is None  # no se marcó como repartido
