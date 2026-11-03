"""API REST de la Pi (spec §4.3): la web le manda comandos; la Pi los publica al nodo.
También reenvía el video de la cámara de un nodo a la web (Monitor en vivo): el nodo no queda expuesto."""

import hmac
import json
from typing import AsyncIterator, Awaitable, Callable, Optional

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError

from centinela_gateway.domain.modelos import PeticionComando, RespuestaComando

Ejecutor = Callable[[PeticionComando], Awaitable[RespuestaComando]]


def crear_app(
    token_hash: str,
    ejecutor: Ejecutor,
    contar_nodos: Callable[[], int],
    url_video: Callable[[str], Optional[str]] = lambda _: None,
) -> FastAPI:
    """token_hash = sha256(CENTINELA_GATEWAY_TOKEN): es lo que la web guarda y manda (spec §4.3)."""
    app = FastAPI(title="Centinela Pi gateway", docs_url=None, redoc_url=None, openapi_url=None)

    def autorizado(request: Request) -> bool:
        recibido = request.headers.get("authorization", "")
        # compare_digest: comparación en tiempo constante, no filtra el hash por timing.
        return recibido.startswith("Bearer ") and hmac.compare_digest(recibido[7:].strip(), token_hash)

    @app.get("/v1/salud")
    async def salud() -> dict:
        return {"ok": True, "nodos": contar_nodos()}

    @app.post("/v1/comandos")
    async def comandos(request: Request) -> JSONResponse:
        if not autorizado(request):
            return JSONResponse({"error": "No autorizado"}, status_code=401)
        try:
            peticion = PeticionComando.model_validate(json.loads(await request.body()))
            respuesta = await ejecutor(peticion)
        except (ValueError, ValidationError) as error:
            # 400 y no el 422 por defecto de FastAPI: es el código del contrato (spec §4.2-4.3).
            return JSONResponse({"error": "Comando inválido", "detalle": str(error).splitlines()[0]}, status_code=400)
        return JSONResponse(respuesta.model_dump(exclude_none=True))

    @app.get("/v1/camaras/{node_id}/stream")
    async def video(node_id: str, request: Request):
        if not autorizado(request):
            return JSONResponse({"error": "No autorizado"}, status_code=401)
        url = url_video(node_id)
        if url is None:
            return JSONResponse({"error": "El nodo no tiene cámara en línea"}, status_code=404)
        # shortcut: una conexión al nodo por espectador; con varios a la vez, repartir un solo stream.
        cliente = httpx.AsyncClient(timeout=httpx.Timeout(5.0, read=None))
        try:
            res = await cliente.send(cliente.build_request("GET", url), stream=True)
        except httpx.HTTPError:
            await cliente.aclose()
            return JSONResponse({"error": "La cámara no responde"}, status_code=502)
        if res.status_code != 200:
            await res.aclose()
            await cliente.aclose()
            return JSONResponse({"error": "La cámara no responde"}, status_code=502)

        async def cuerpo() -> AsyncIterator[bytes]:
            try:
                async for trozo in res.aiter_raw():
                    yield trozo
            finally:  # el espectador cerró: se suelta la conexión con el nodo
                await res.aclose()
                await cliente.aclose()

        return StreamingResponse(cuerpo(), media_type=res.headers.get("content-type", "multipart/x-mixed-replace"))

    return app
