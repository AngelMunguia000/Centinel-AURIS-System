"""Disuasión por presencia en la Pi (edge/PENDIENTES.md "Disuasión en la Pi", decisión del PO 2026-10-24).

Sin servos ni visión con objetivo todavía, la torreta no apunta ni confirma: ante movimiento con
el lugar armado se emite una ráfaga. Conserva lo que hace eficaz a la disuasión, igual que
lib/prototipo/antihabituacion.ts y fsm.ts de la web:
- anti-habituación: nunca uno de los últimos 3 patrones de ese nodo;
- ciclo de trabajo: como mucho 20 % del último minuto sonando (protege al animal, a la bocina y a los vecinos);
- ráfagas de 0.5 a 3 s y un enfriamiento entre ráfagas.
Cuando haya cámara con objetivo, aquí entra la máquina de estados completa (apuntar, confirmar, reintentos).
"""

import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

FAMILIAS = ("sweep_chirp", "sweep_log", "tone_am", "random_mix", "distress")
HISTORIAL = 3
CICLO_MAX = 0.2
VENTANA_MS = 60_000
RAFAGA_MAX_MS = 3_000
RAFAGA_MIN_MS = 500
ENFRIAMIENTO_MS = 8_000


@dataclass
class Rafaga:
    familia: str
    duracion_ms: int
    ganancia: float


@dataclass
class Disuasor:
    rng: random.Random = field(default_factory=random.Random)
    _historial: Dict[str, List[str]] = field(default_factory=dict)
    _emisiones: Dict[str, List[Tuple[int, int]]] = field(default_factory=dict)  # (inicio_ms, duracion_ms)

    def decidir(self, node_id: str, ahora_ms: int) -> Tuple[Optional[Rafaga], str]:
        """La ráfaga a emitir, o None con el motivo por el que no se emite."""
        emisiones = [e for e in self._emisiones.get(node_id, []) if ahora_ms - e[0] < VENTANA_MS]
        self._emisiones[node_id] = emisiones
        if emisiones and ahora_ms - (emisiones[-1][0] + emisiones[-1][1]) < ENFRIAMIENTO_MS:
            return None, "en enfriamiento tras la ráfaga anterior"
        restante = int(CICLO_MAX * VENTANA_MS) - sum(d for _, d in emisiones)
        duracion = min(int(self.rng.uniform(1800, 3000)), RAFAGA_MAX_MS, restante)
        if duracion < RAFAGA_MIN_MS:
            return None, "límite de ciclo de trabajo alcanzado"

        recientes = self._historial.get(node_id, [])[-HISTORIAL:]
        familia = self.rng.choice([f for f in FAMILIAS if f not in recientes])
        self._historial[node_id] = (recientes + [familia])[-HISTORIAL:]
        emisiones.append((ahora_ms, duracion))
        return Rafaga(familia, duracion, round(self.rng.uniform(0.7, 0.95), 2)), ""
