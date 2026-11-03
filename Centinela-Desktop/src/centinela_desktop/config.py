"""Constantes y validación de la dirección del servidor de Centinela."""
from __future__ import annotations

from urllib.parse import urlsplit

VERSION = "0.5.0"
SERVIDOR_POR_DEFECTO = "http://localhost:3000"
INTERVALO_AVISOS_MS = 15_000
# La web solo abre la consola a clientes que traen esta marca en el User-Agent (lib/cliente-app.ts).
MARCA_UA = f"CentinelaDesktop/{VERSION}"


def normalizar_servidor(texto: str) -> str | None:
    """'192.168.1.5:3000/' -> 'http://192.168.1.5:3000'. None si no parece una dirección web."""
    t = texto.strip()
    if not t:
        return None
    if "://" not in t:
        t = "http://" + t
    partes = urlsplit(t)
    if partes.scheme not in ("http", "https") or not partes.hostname:
        return None
    return f"{partes.scheme}://{partes.netloc}"
