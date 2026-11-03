import { useState } from 'react'

interface ReporteClasificable {
  id: string
  prioridad: string
  categoria: string | null
}

// Compartido por OperadorReportesQueue.tsx y ReportesList.tsx (FE-H2, auditoría
// 26 ago): ambos reclasificaban prioridad/categoría con el mismo fetch PATCH +
// actualización optimista, solo divergían en el resto de la UI alrededor.
export function useReclasificarReporte<T extends ReporteClasificable>(
  setReportes: React.Dispatch<React.SetStateAction<T[]>>
) {
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  const reclasificar = async (id: string, campo: 'prioridad' | 'categoria', valor: string) => {
    setMessage('')
    setMessageType('')

    try {
      const response = await fetch(`/api/reportes/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: campo === 'categoria' && !valor ? null : valor }),
      })

      if (response.ok) {
        const updatedReporte = await response.json()
        setReportes((prev) =>
          prev.map((reporte) =>
            reporte.id === id
              ? { ...reporte, prioridad: updatedReporte.prioridad, categoria: updatedReporte.categoria }
              : reporte
          )
        )
      } else {
        const errorData = await response.json().catch(() => null)
        setMessage(errorData?.error || 'Error al actualizar la clasificación')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage('Error de conexión')
      setMessageType('error')
    }
  }

  return { reclasificar, message, messageType, setMessage, setMessageType }
}
