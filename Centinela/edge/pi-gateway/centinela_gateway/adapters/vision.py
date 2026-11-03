"""Visión por computadora en la Pi: qué hay en la foto que disparó el movimiento.

Primer caso real (PO, 2026-10-29): ahuyentar aves en buques que transportan maíz. Las clases a
ahuyentar se configuran (VISION_OBJETIVOS), así otras plagas son un cambio de configuración.
Ultralytics es opcional: solo se importa si VISION_MODELO está configurado (requirements-vision.txt).
Licencia AGPL-3.0: para vender Centinela hace falta su licencia comercial o cambiar de modelo.
"""

import io
from dataclasses import dataclass
from typing import List, Tuple

from PIL import Image


@dataclass(frozen=True)
class Hallazgo:
    clase: str  # nombre COCO en inglés, como lo da el modelo ("bird", "person")
    confianza: float
    caja: Tuple[int, int, int, int] = (0, 0, 0, 0)  # x1, y1, x2, y2 en pixeles de la foto


class DetectorYolo:
    def __init__(self, modelo: str, confianza: float) -> None:
        from ultralytics import YOLO

        self._modelo = YOLO(modelo, task="detect")
        self.confianza = confianza

    def detectar(self, jpeg: bytes) -> List[Hallazgo]:
        resultado = self._modelo(Image.open(io.BytesIO(jpeg)).convert("RGB"), verbose=False, conf=self.confianza)[0]
        return [Hallazgo(resultado.names[int(c.cls)], float(c.conf), tuple(int(v) for v in c.xyxy[0])) for c in resultado.boxes]
