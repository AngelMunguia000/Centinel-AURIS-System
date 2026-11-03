import type { Variants } from "motion/react"

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
}

export function staggerContainer(stagger = 0.08): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: stagger } },
  }
}

export const viewportOnce = { once: true, margin: "-80px" } as const

export const alertBanner: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } },
}
