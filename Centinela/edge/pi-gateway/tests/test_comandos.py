"""API de comandos de la Pi — spec 2026-10-16-enlace-edge-design.md §4.3; plan Tarea 11."""

import asyncio
import hashlib
import json

import httpx
import pytest

from centinela_gateway.adapters.cola import Cola
from centinela_gateway.adapters.http import crear_app
from centinela_gateway.adapters.web import ClienteWeb
from centinela_gateway.application.comandos import ejecutar
from centinela_gateway.application.puente import Puente
from centinela_gateway.domain.modelos import PeticionComando

TOKEN = "token-de-la-pi"
HASH = hashlib.sha256(TOKEN.encode()).hexdigest()
NODO = "node-0000000000a1"


@pytest.fixture
async def puente(tmp_path):
    async with httpx.AsyncClient() as http:
        yield Puente(ClienteWeb("http://web.test", "x", http), Cola(str(tmp_path / "c.db")))


def peticion(tipo="system", payload=None):
    return PeticionComando.model_validate(
        {"v": 1, "cmd_id": "cmd-1", "node_id": NODO, "tipo": tipo, "payload": payload or {"accion": "ping"}}
    )


async def test_ack_ok_devuelve_latencia(puente):
    publicados = []

    async def publicar(topico, datos):
        publicados.append((topico, json.loads(datos)))
        # El nodo responde un poco después, por el tópico de ack.
        asyncio.get_running_loop().call_later(
            0.02, puente.manejar, f"centinel/{NODO}/ack", json.dumps({"v": 1, "cmd_id": "cmd-1", "ok": True, "resultado": {"pong": True}}).encode()
        )

    r = await ejecutar(puente, publicar, peticion())
    assert r.estado == "ok"
    assert r.resultado == {"pong": True}
    assert 10 <= r.latencia_ms < 1000
    assert publicados[0][0] == f"centinel/{NODO}/command/system"
    assert publicados[0][1] == {"v": 1, "cmd_id": "cmd-1", "accion": "ping"}


async def test_ack_con_error_del_nodo(puente):
    async def publicar(topico, datos):
        asyncio.get_running_loop().call_soon(
            puente.manejar, f"centinel/{NODO}/ack", json.dumps({"v": 1, "cmd_id": "cmd-1", "ok": False, "error": "servo bloqueado"}).encode()
        )

    r = await ejecutar(puente, publicar, peticion())
    assert (r.estado, r.error) == ("error", "servo bloqueado")


async def test_sin_ack_en_3s_devuelve_timeout(puente):
    async def publicar(topico, datos):
        pass

    r = await ejecutar(puente, publicar, peticion(), timeout=0.05)
    assert r.estado == "timeout"
    # La latencia refleja la espera; el temporizador de asyncio en Windows tiene ~15 ms de resolución.
    assert r.latencia_ms >= 35


async def test_broker_caido_devuelve_error(puente):
    async def publicar(topico, datos):
        raise ConnectionError("broker no disponible")

    r = await ejecutar(puente, publicar, peticion())
    assert r.estado == "error"
    assert "MQTT" in (r.error or "")


def _app(puente, llamadas):
    async def publicar(topico, datos):
        llamadas.append(topico)
        asyncio.get_running_loop().call_soon(
            puente.manejar, f"centinel/{NODO}/ack", json.dumps({"v": 1, "cmd_id": "cmd-1", "ok": True}).encode()
        )

    return crear_app(HASH, lambda p: ejecutar(puente, publicar, p), lambda: len(puente.nodos_en_linea()))


async def _post(app, cuerpo, auth=f"Bearer {HASH}"):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://pi") as c:
        return await c.post("/v1/comandos", json=cuerpo, headers={"authorization": auth} if auth else {})


async def test_token_incorrecto_401(puente):
    llamadas = []
    app = _app(puente, llamadas)
    cuerpo = {"v": 1, "cmd_id": "cmd-1", "node_id": NODO, "tipo": "system", "payload": {"accion": "ping"}}
    assert (await _post(app, cuerpo, auth="Bearer otro")).status_code == 401
    assert (await _post(app, cuerpo, auth=None)).status_code == 401
    assert (await _post(app, cuerpo, auth=f"Bearer {TOKEN}")).status_code == 401  # el token en claro tampoco vale
    assert llamadas == []


async def test_comando_valido_responde_ok(puente):
    llamadas = []
    res = await _post(_app(puente, llamadas), {"v": 1, "cmd_id": "cmd-1", "node_id": NODO, "tipo": "system", "payload": {"accion": "led", "encendido": True}})
    assert res.status_code == 200
    assert res.json()["estado"] == "ok"
    assert llamadas == [f"centinel/{NODO}/command/system"]


async def test_pan_fuera_de_rango_400_sin_publicar(puente):
    llamadas = []
    cuerpo = {"v": 1, "cmd_id": "cmd-1", "node_id": NODO, "tipo": "pantilt", "payload": {"mode": "absolute", "pan_deg": 181, "tilt_deg": 0}}
    res = await _post(_app(puente, llamadas), cuerpo)
    assert res.status_code == 400
    assert llamadas == []


async def test_cuerpo_malformado_400(puente):
    llamadas = []
    res = await _post(_app(puente, llamadas), {"v": 1, "node_id": "esp32"})
    assert res.status_code == 400


async def test_salud_sin_auth(puente):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=_app(puente, [])), base_url="http://pi") as c:
        res = await c.get("/v1/salud")
    assert res.json() == {"ok": True, "nodos": 0}
