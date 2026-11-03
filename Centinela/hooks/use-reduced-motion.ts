import * as React from 'react'

/**
 * Reads the `prefers-reduced-motion` media query.
 *
 * Deliberately does NOT use `motion/react`'s built-in `useReducedMotion()`:
 * that hook lazily initializes its state from `window.matchMedia` on the very
 * first render, which on an SSR page is also the hydration commit. When the
 * server (no `window`) and client (real preference) disagree, React's
 * hydration algorithm logs a mismatch warning and leaves the server-rendered
 * DOM attributes in place ("This won't be patched up") — so a client value
 * computed synchronously during hydration is silently dropped.
 *
 * This hook always starts `false` (matching what SSR renders), then flips to
 * the real value inside a `useEffect`, which runs after hydration completes.
 * That makes it a genuine client-side update, which React does apply.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener('change', onChange)
    onChange()
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return reduced
}
