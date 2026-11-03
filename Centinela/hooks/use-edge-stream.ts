"use client"

import { useEffect, useState } from "react"
import type { EventoVivo, NodoVivo } from "@/lib/edge/estado"

// Spec 2026-10-16-enlace-edge-design.md §4.4. EventSource reconecta solo; el servidor
// manda un snapshot completo al reconectar y cada 5 s, así que nunca quedan datos congelados.
const MAX_EVENTOS = 100

export function useEdgeStream(): { nodos: NodoVivo[]; conectado: boolean; eventos: EventoVivo[] } {
  const [nodos, setNodos] = useState<NodoVivo[]>([])
  const [eventos, setEventos] = useState<EventoVivo[]>([])
  const [conectado, setConectado] = useState(false)

  useEffect(() => {
    const fuente = new EventSource("/api/stream")
    const leer = <T,>(e: Event) => JSON.parse((e as MessageEvent<string>).data) as T

    fuente.onopen = () => setConectado(true)
    fuente.onerror = () => setConectado(false)
    fuente.addEventListener("snapshot", (e) => {
      setNodos(leer<NodoVivo[]>(e))
      setConectado(true)
    })
    fuente.addEventListener("dispositivo.telemetria", (e) => {
      const d = leer<{ dispositivoId: number; telemetria: NodoVivo["telemetria"]; capacidades: NodoVivo["capacidades"]; ultimoContacto: string }>(e)
      setNodos((prev) =>
        prev.map((n) =>
          n.id === d.dispositivoId
            ? { ...n, telemetria: d.telemetria, capacidades: d.capacidades ?? n.capacidades, ultimoContacto: d.ultimoContacto }
            : n,
        ),
      )
    })
    fuente.addEventListener("dispositivo.estado", (e) => {
      const d = leer<{ dispositivoId: number; conexion: string }>(e)
      setNodos((prev) =>
        prev.map((n) => (n.id === d.dispositivoId ? { ...n, estado: d.conexion === "DESCONECTADO" ? "desconectado" : "en_linea" } : n)),
      )
    })
    fuente.addEventListener("evento.nuevo", (e) => {
      const ev = leer<EventoVivo>(e)
      setEventos((prev) => [ev, ...prev.filter((p) => p.id !== ev.id)].slice(0, MAX_EVENTOS))
    })

    return () => fuente.close()
  }, [])

  return { nodos, conectado, eventos }
}
