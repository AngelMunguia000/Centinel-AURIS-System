"use client"

import { useEffect, useState } from "react"
import type { Permiso } from "@/lib/permisos"

// 06_UI_UX.md §F: solo para mostrar/ocultar controles — el servidor vuelve a
// verificar cada acción. Mientras carga, `permisos` está vacío (nada visible).
export function usePermisos(): { permisos: Permiso[]; cargando: boolean } {
  const [permisos, setPermisos] = useState<Permiso[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPermisos(data?.user?.permisos ?? []))
      .catch(() => setPermisos([]))
      .finally(() => setCargando(false))
  }, [])

  return { permisos, cargando }
}
