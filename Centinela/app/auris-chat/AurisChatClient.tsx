"use client"

import type React from "react"

import { useChat } from "@ai-sdk/react"
import { TextStreamChatTransport } from "ai"
import { LandingNavigation } from "@/components/landing-navigation"
import { GlassBackground, consolaBlobs } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Bot, User, Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

export function AurisChatClient() {
  // /api/chat-auris streams plain text (raw Gemini token chunks), not the AI
  // SDK's UI-message-stream protocol — TextStreamChatTransport is the client
  // built for exactly that backend shape. Using DefaultChatTransport here
  // silently produced zero rendered replies despite the request succeeding.
  const { messages, sendMessage, status } = useChat({
    transport: new TextStreamChatTransport({ api: "/api/chat-auris" }),
  })

  const reduced = useReducedMotion()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastScrollRef = useRef(0)

  const scrollToBottom = useCallback(() => {
    const now = Date.now()
    if (now - lastScrollRef.current < 150) return
    lastScrollRef.current = now
    messagesEndRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
  }, [reduced])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Garantiza el scroll final al terminar el streaming, sin pasar por el
  // throttle (evita que el último chunk quede fuera de vista si cae dentro
  // de la ventana de 150ms).
  useEffect(() => {
    if (status === "ready") {
      lastScrollRef.current = 0
      scrollToBottom()
    }
  }, [status, scrollToBottom])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const input = formData.get("message") as string

    if (input.trim()) {
      sendMessage({ text: input })
      e.currentTarget.reset()
      inputRef.current?.focus()
    }
  }

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <LandingNavigation />

      <div className="container mx-auto px-4 pt-40 pb-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/[0.06] mb-4">
            <Bot className="w-8 h-8" style={{ color: "var(--accent-foreground)" }} />
          </div>
          <h1 className="text-4xl font-semibold tracking-[-0.005em] text-white mb-2">AURIS</h1>
          <p className="text-white/60">Asistente Inteligente de Centinela AURIS</p>
          <p className="text-sm text-white/50 mt-2">
            Pregúntame sobre el sistema, solicita soporte técnico o agenda una demostración
          </p>
        </div>

        {/* Chat Container */}
        <GlassPanel padding="sm" radius="lg" className="overflow-hidden">
          {/* Messages Area */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="w-16 h-16 text-white/20 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Hola, soy AURIS</h3>
                <p className="text-white/50 max-w-md">
                  Estoy aquí para ayudarte con información sobre Centinela AURIS, soporte técnico y agendar
                  demostraciones. ¿En qué puedo asistirte hoy?
                </p>
              </div>
            )}

            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === "user" ? "bg-white text-[#0a0a0c]" : "bg-white/10 text-white/70"
                  }`}
                >
                  {message.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Content */}
                <div className={`flex-1 max-w-[80%] ${message.role === "user" ? "text-right" : "text-left"}`}>
                  <div
                    className={`inline-block px-4 py-3 rounded-lg ${
                      message.role === "user" ? "bg-white text-[#0a0a0c]" : "bg-white/[0.06] text-white/80"
                    }`}
                  >
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <div key={index} className="whitespace-pre-wrap">
                            {part.text}
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>
                </div>
              </motion.div>
            ))}

            <AnimatePresence>
              {(status === "submitted" || status === "streaming") && (
                <motion.div
                  key="typing-indicator"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="flex gap-3"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 text-white/70 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="inline-block px-4 py-3 rounded-lg bg-white/[0.06]">
                      <Loader2 className="w-4 h-4 animate-spin text-white/70" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-white/10 p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                name="message"
                placeholder="Escribe tu mensaje…"
                disabled={(status === "submitted" || status === "streaming")}
                className="flex-1 bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:border-white/30 focus-visible:ring-white/10"
                autoComplete="off"
              />
              <Button
                type="submit"
                disabled={(status === "submitted" || status === "streaming")}
                size="icon"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-shadow duration-300"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </GlassPanel>

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="justify-start border-white/20 text-white hover:bg-white/10 bg-transparent"
            onClick={() => sendMessage({ text: "¿Qué es Centinela AURIS?" })}
            disabled={(status === "submitted" || status === "streaming")}
          >
            ¿Qué es Centinela AURIS?
          </Button>
          <Button
            variant="outline"
            className="justify-start border-white/20 text-white hover:bg-white/10 bg-transparent"
            onClick={() => sendMessage({ text: "Quiero agendar una demostración" })}
            disabled={(status === "submitted" || status === "streaming")}
          >
            Agendar demostración
          </Button>
          <Button
            variant="outline"
            className="justify-start border-white/20 text-white hover:bg-white/10 bg-transparent"
            onClick={() => sendMessage({ text: "¿Qué versiones están disponibles?" })}
            disabled={(status === "submitted" || status === "streaming")}
          >
            Ver versiones disponibles
          </Button>
        </div>
      </div>
    </main>
  )
}
