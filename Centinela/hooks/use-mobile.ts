import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    // El valor inicial se lee aquí (no en un inicializador de useState) a propósito:
    // SSR no tiene `window`, así que el primer render siempre parte de `undefined`
    // para coincidir con el HTML del servidor. Leerlo en el inicializador rompería
    // la hidratación (react-hooks/set-state-in-effect, auditoría 26 ago — regla
    // correcta en general, pero no aplica a este caso).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isMobile
}
