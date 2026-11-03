"""Cliente HTTP Pi → web (spec §4.2)."""

import logging
from typing import Any, Dict, List, Optional

import httpx

log = logging.getLogger("centinela.web")

TIMEOUT_S = 5.0


class ClienteWeb:
    def __init__(self, web_url: str, token: str, http: httpx.AsyncClient) -> None:
        # shortcut: HTTP sin TLS en la LAN de la demo; pasar a https:// cuando la web salga de la red local (spec §7).
        self._base = web_url.rstrip("/")
        self._headers = {"authorization": f"Bearer {token}"}
        self._http = http

    async def enviar_telemetria(self, nodos: List[Dict[str, Any]]) -> Optional[bool]:
        """Devuelve si el lugar está armado según la web, o None si no se supo (la web no respondió bien)."""
        try:
            res = await self._http.post(f"{self._base}/api/edge/telemetria", json={"v": 1, "nodos": nodos}, headers=self._headers, timeout=TIMEOUT_S)
        except httpx.HTTPError as error:
            log.warning("web inaccesible al enviar telemetría: %s", error)
            return None
        if res.status_code >= 400:
            log.warning("telemetría rechazada por la web: HTTP %s %s", res.status_code, res.text[:200])
            return None
        try:
            armado = res.json().get("armado")
        except ValueError:
            return None
        return armado if isinstance(armado, bool) else None

    async def enviar_evidencia(self, evento_id: str, jpeg: bytes) -> str:
        """Foto de un evento. "ok", "reintentar" (la web aún no tiene el evento o no respondió) o "descartar"."""
        try:
            res = await self._http.put(
                f"{self._base}/api/edge/evidencia/{evento_id}",
                content=jpeg,
                headers={**self._headers, "content-type": "image/jpeg"},
                timeout=TIMEOUT_S,
            )
        except httpx.HTTPError as error:
            log.warning("web inaccesible al subir evidencia: %s", error)
            return "reintentar"
        if res.status_code < 300:
            return "ok"
        if res.status_code == 404 or res.status_code >= 500:
            return "reintentar"
        log.error("la web rechazó la evidencia %s (HTTP %s): %s — se descarta", evento_id, res.status_code, res.text[:200])
        return "descartar"

    async def enviar_eventos(self, eventos: List[Dict[str, Any]]) -> bool:
        """True si los eventos quedan resueltos (2xx, o 4xx que reintentar no arreglaría)."""
        try:
            res = await self._http.post(f"{self._base}/api/edge/eventos", json={"v": 1, "eventos": eventos}, headers=self._headers, timeout=TIMEOUT_S)
        except httpx.HTTPError as error:
            log.warning("web inaccesible al enviar eventos: %s", error)
            return False
        if res.status_code >= 500:
            log.warning("la web respondió %s a los eventos; se reintentará", res.status_code)
            return False
        if res.status_code >= 400:
            # Un mensaje envenenado no debe bloquear la cola para siempre.
            log.error("la web rechazó %d eventos (HTTP %s): %s — se descartan", len(eventos), res.status_code, res.text[:200])
        return True
