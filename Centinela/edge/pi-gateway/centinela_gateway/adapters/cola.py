"""Cola offline de eventos en SQLite (spec §8: si la web cae, nada se pierde)."""

import json
import sqlite3
import time
from typing import Any, Dict, List


class Cola:
    def __init__(self, ruta: str) -> None:
        self._db = sqlite3.connect(ruta, check_same_thread=False)
        self._db.execute("CREATE TABLE IF NOT EXISTS eventos (id TEXT PRIMARY KEY, datos TEXT NOT NULL, creado REAL NOT NULL)")
        self._db.commit()

    def encolar(self, evento: Dict[str, Any]) -> None:
        # OR IGNORE: el mismo id (reentrega QoS 1 del nodo) no se duplica.
        self._db.execute("INSERT OR IGNORE INTO eventos VALUES (?, ?, ?)", (evento["id"], json.dumps(evento), time.time()))
        self._db.commit()

    def pendientes(self, limite: int = 100) -> List[Dict[str, Any]]:
        filas = self._db.execute("SELECT datos FROM eventos ORDER BY creado, rowid LIMIT ?", (limite,)).fetchall()
        return [json.loads(f[0]) for f in filas]

    def confirmar(self, ids: List[str]) -> None:
        self._db.executemany("DELETE FROM eventos WHERE id = ?", [(i,) for i in ids])
        self._db.commit()
