import { Camera } from 'lucide-react'

// Foto de evidencia de un evento (cámara del nodo → Pi → web, lib/edge/evidencia.ts). Abre en grande
// en una pestaña nueva. La ruta revisa permisos: si no la puede ver, la imagen no carga.

export function EvidenciaFoto({ eventoId, compacta = false }: { eventoId: string; compacta?: boolean }) {
  const src = `/api/evidencia/${eventoId}`
  if (compacta) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-signal hover:underline">
        <Camera className="h-3.5 w-3.5" aria-hidden="true" />
        Ver foto
      </a>
    )
  }
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block" title="Abrir la foto en grande">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen privada servida por la API, next/image no aplica */}
      <img src={src} alt="Foto de evidencia tomada por la cámara del nodo" loading="lazy" className="h-32 w-auto rounded-md border border-foreground/10 object-cover" />
    </a>
  )
}
