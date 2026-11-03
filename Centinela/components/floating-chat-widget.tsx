"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { TextStreamChatTransport } from "ai"
import { X, Send, Minimize2, Bot, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GlassPanel } from "@/components/glass-panel"
import Logo from "./Logo"

const quickActions = [
  "¿Qué es Centinela AURIS?",
  "Quiero agendar una cita",
  "Información de planes",
  "Soporte técnico",
]

export function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  // See the matching comment in AurisChatClient.tsx: /api/chat-auris streams
  // plain text, so this needs TextStreamChatTransport, not DefaultChatTransport.
  const { messages, sendMessage, status } = useChat({
    transport: new TextStreamChatTransport({ api: "/api/chat-auris" }),
  })
  const isBusy = status === "submitted" || status === "streaming"

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isMinimized) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isMinimized])

  // Widget no modal (no bloquea el resto de la página) pero sí se cierra con
  // Escape y enfoca el input al abrir, mismo criterio de teclado que
  // OperadorAlertaModal.tsx aplica a su propio overlay.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    window.addEventListener("keydown", onKey)
    if (!isMinimized) inputRef.current?.focus()
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, isMinimized])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const text = (formData.get("message") as string)?.trim()
    if (text) {
      sendMessage({ text })
      e.currentTarget.reset()
      inputRef.current?.focus()
    }
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chat-flotante fixed bottom-6 right-6 z-50 group"
          aria-label="Abrir chat AURIS"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-xl" style={{ background: "rgba(158,27,52,0.35)" }} />
            <div className="relative w-16 h-16 rounded-full flex items-center justify-center overflow-hidden bg-white/[0.06] backdrop-blur-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:scale-110 transition-transform duration-300">
              <Logo size={42} isAnimated={true} />
            </div>
            <div
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center"
              style={{ background: "#9e1b34", borderColor: "#0a0a0c" }}
            >
              <span className="text-[10px] font-bold text-white">AI</span>
            </div>
          </div>
        </button>
      )}

      {isOpen && (
        <div
          className={`chat-flotante fixed bottom-6 right-6 z-50 transition-all duration-300 ${isMinimized ? "w-80" : "w-96"}`}
          role="dialog"
          aria-label="Chat con AURIS"
        >
          <GlassPanel
            padding="sm"
            radius="lg"
            className={`overflow-hidden flex flex-col ${isMinimized ? "" : "h-[600px]"}`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
                  <Logo size={28} isAnimated={false} />
                  <div
                    className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                    style={{ background: "#22c55e", borderColor: "#0a0a0c" }}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">AURIS</h3>
                  <p className="text-xs text-white/50">Asistente Virtual</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setIsMinimized(!isMinimized)}
                  aria-label={isMinimized ? "Expandir chat" : "Minimizar chat"}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setIsOpen(false)}
                  aria-label="Cerrar chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {!isMinimized && (
              <>
                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                  {messages.length === 0 && (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 text-white/70 flex items-center justify-center">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] bg-white/[0.06]">
                          <p className="text-sm text-white/80">
                            ¡Hola! Soy AURIS, tu asistente virtual de Centinela AURIS. ¿En qué puedo ayudarte hoy?
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <p className="text-xs text-white/40 px-1">Acciones rápidas:</p>
                        {quickActions.map((action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => sendMessage({ text: action })}
                            className="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white/80"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((message) => (
                    <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          message.role === "user" ? "bg-white text-[#0a0a0c]" : "bg-white/10 text-white/70"
                        }`}
                      >
                        {message.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div
                        className={`rounded-2xl px-4 py-3 max-w-[80%] ${
                          message.role === "user"
                            ? "bg-white text-[#0a0a0c] rounded-tr-sm"
                            : "bg-white/[0.06] text-white/80 rounded-tl-sm"
                        }`}
                      >
                        {message.parts.map((part, index) =>
                          part.type === "text" ? (
                            <p key={index} className="text-sm whitespace-pre-wrap">
                              {part.text}
                            </p>
                          ) : null
                        )}
                      </div>
                    </div>
                  ))}

                  {isBusy && (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 text-white/70 flex items-center justify-center">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white/[0.06]">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" />
                          <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:0.2s]" />
                          <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t border-white/10">
                  <Input
                    ref={inputRef}
                    name="message"
                    placeholder="Escribe tu mensaje..."
                    disabled={isBusy}
                    autoComplete="off"
                    className="flex-1 bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:border-white/30 focus-visible:ring-white/10"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isBusy}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-shadow duration-300"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            )}
          </GlassPanel>
        </div>
      )}
    </>
  )
}
