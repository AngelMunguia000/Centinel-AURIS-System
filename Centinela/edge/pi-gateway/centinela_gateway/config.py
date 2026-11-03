"""Configuración del gateway, leída del entorno (y de .env si existe)."""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple


def _cargar_env(ruta: Path) -> None:
    """Lector mínimo de .env (KEY=valor por línea): evita una dependencia solo para esto."""
    if not ruta.exists():
        return
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if linea and not linea.startswith("#") and "=" in linea:
            clave, valor = linea.split("=", 1)
            os.environ.setdefault(clave.strip(), valor.strip())


@dataclass(frozen=True)
class Config:
    web_url: str
    gateway_token: str
    mqtt_host: str = "127.0.0.1"
    mqtt_port: int = 1883
    cola_db: str = "cola.db"
    evidencias_dir: str = "evidencias"
    vision_modelo: str = ""  # vacío: sin visión, todo movimiento se disuade
    vision_objetivos: Tuple[str, ...] = ("bird",)
    vision_confianza: float = 0.5

    @classmethod
    def desde_entorno(cls, env_file: Path = Path(".env")) -> "Config":
        _cargar_env(env_file)
        faltan = [k for k in ("CENTINELA_WEB_URL", "CENTINELA_GATEWAY_TOKEN") if not os.environ.get(k)]
        if faltan:
            raise SystemExit(f"Faltan variables de entorno: {', '.join(faltan)} (ver .env.example)")
        return cls(
            web_url=os.environ["CENTINELA_WEB_URL"].rstrip("/"),
            gateway_token=os.environ["CENTINELA_GATEWAY_TOKEN"],
            mqtt_host=os.environ.get("MQTT_HOST", "127.0.0.1"),
            mqtt_port=int(os.environ.get("MQTT_PORT", "1883")),
            cola_db=os.environ.get("COLA_DB", "cola.db"),
            evidencias_dir=os.environ.get("EVIDENCIAS_DIR", "evidencias"),
            vision_modelo=os.environ.get("VISION_MODELO", ""),
            vision_objetivos=tuple(c.strip() for c in os.environ.get("VISION_OBJETIVOS", "bird").split(",") if c.strip()),
            vision_confianza=float(os.environ.get("VISION_CONFIANZA", "0.5")),
        )
