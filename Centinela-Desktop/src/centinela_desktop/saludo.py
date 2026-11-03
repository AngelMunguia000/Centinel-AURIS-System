"""Saludo según la hora local: mismo texto que lib/saludo.ts de la web."""
from __future__ import annotations

FRASES: list[tuple[int, list[str]]] = [
    (5, ["Trasnochando", "Desvelado", "La noche es larga"]),
    (7, ["Desmañanado", "Madrugaste", "Temprano hoy"]),
    (12, ["Buenos días", "Buen día"]),
    (19, ["Buenas tardes", "Qué tal la tarde"]),
    (24, ["Buenas noches", "Buena noche"]),
]


def nombre_corto(nombre: str, apellido: str) -> str:
    """'Angel David' + 'Munguía Zúñiga' -> 'Angel Munguía'."""
    partes = [p.split()[0] for p in (nombre or "", apellido or "") if p.strip()]
    return " ".join(partes)


def saludo(hora: int, nombre: str, dia: int = 0) -> str:
    frases = next((f for hasta, f in FRASES if hora < hasta), FRASES[-1][1])
    frase = frases[abs(dia) % len(frases)]
    return f"{frase}, {nombre}" if nombre else frase
