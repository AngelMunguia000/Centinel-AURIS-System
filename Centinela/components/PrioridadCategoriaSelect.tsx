'use client'

import { PRIORIDADES, CATEGORIAS, PRIORIDAD_LABELS } from '@/lib/reportes-catalogos'

interface PrioridadCategoriaSelectProps {
  prioridad: string
  categoria: string | null
  onChange: (campo: 'prioridad' | 'categoria', valor: string) => void
  prioridadClassName?: string
  categoriaClassName?: string
}

// Compartido por OperadorReportesQueue.tsx y ReportesList.tsx (FE-H2, auditoría
// 26 ago): mismos dos selects, cada uno con su propio estilo vía className.
export function PrioridadCategoriaSelect({
  prioridad,
  categoria,
  onChange,
  prioridadClassName,
  categoriaClassName,
}: PrioridadCategoriaSelectProps) {
  return (
    <>
      <select
        value={prioridad}
        onChange={(e) => onChange('prioridad', e.target.value)}
        className={prioridadClassName}
      >
        {PRIORIDADES.map((valor) => (
          <option key={valor} value={valor} className="bg-popover text-white">
            {PRIORIDAD_LABELS[valor]}
          </option>
        ))}
      </select>
      <select
        value={categoria ?? ''}
        onChange={(e) => onChange('categoria', e.target.value)}
        className={categoriaClassName}
      >
        <option value="" className="bg-popover text-white">
          Sin categoría
        </option>
        {CATEGORIAS.map((valor) => (
          <option key={valor} value={valor} className="bg-popover text-white">
            {valor}
          </option>
        ))}
      </select>
    </>
  )
}
