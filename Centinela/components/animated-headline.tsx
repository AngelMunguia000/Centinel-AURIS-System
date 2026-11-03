"use client"

import React from "react"
import { motion } from "motion/react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

export function AnimatedHeadline({
  text,
  className,
  acento,
}: {
  text: string
  className?: string
  /** Palabra que va en carmesí (identidad 2026-10-23). */
  acento?: string
}) {
  const prefersReducedMotion = useReducedMotion()
  const words = text.split(" ")
  const color = (word: string) => (word === acento ? "text-signal" : "")

  if (prefersReducedMotion) {
    return (
      <span className={className}>
        {words.map((word, i) => (
          <React.Fragment key={`${word}-${i}`}>
            <span className={color(word)}>{word}</span>
            {i < words.length - 1 && " "}
          </React.Fragment>
        ))}
      </span>
    )
  }

  return (
    <span className={className}>
      {words.map((word, i) => (
        <React.Fragment key={`${word}-${i}`}>
          <motion.span
            className={`inline-block mr-[0.25em] will-change-transform ${color(word)}`}
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.05 + i * 0.045, ease: [0.16, 1, 0.3, 1] }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 && " "}
        </React.Fragment>
      ))}
    </span>
  )
}
