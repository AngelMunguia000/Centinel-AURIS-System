import type { NextRequest } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from "@/lib/rate-limit"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { seleccionarPrompt } from "@/lib/chat-auris-prompts"

// Sin sesión requerida a propósito: /api/chat-auris atiende tanto la página
// /auris-chat como el widget de venta de la landing (floating-chat-widget.tsx),
// que Brain/11_ProductDefinition.md §7.2 documenta como atención pre-venta para
// un cliente potencial anónimo — exigir login rompería ese uso ya congelado en
// Brain. Límite por IP más alto que el resto de endpoints (20 vs 5 / 15 min)
// porque una conversación legítima supera fácilmente 5 mensajes.
const CHAT_MAX_MESSAGES = 20

// Fase 49: antes caía a "" si faltaba la variable — el cliente se creaba igual y
// cada llamada real fallaba tarde, contra la API de Google, en vez de fallar aquí
// con un motivo claro. Mismo criterio ya establecido para JWT_SECRET en lib/auth.ts.
// Perezoso (no al cargar el módulo): así una falta de esta key no afecta otras rutas.
let cachedClient: GoogleGenAI | null = null

function getGoogleGenAIClient(): GoogleGenAI {
  if (cachedClient) return cachedClient

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY no está configurado. AURIS Chat no puede funcionar sin esta variable de entorno."
    )
  }

  cachedClient = new GoogleGenAI({ apiKey })
  return cachedClient
}

export async function POST(request: NextRequest) {
  const rateLimitId = getRateLimitIdentifier("chat-auris", request)
  const rateLimit = checkRateLimit(rateLimitId, CHAT_MAX_MESSAGES)
  if (!rateLimit.allowed) {
    return new Response("Demasiados mensajes. Intenta de nuevo más tarde.", {
      status: 429,
      headers: { "Content-Type": "text/plain", "Retry-After": String(rateLimit.retryAfterSeconds) },
    })
  }
  recordAttempt(rateLimitId)

  try {
    // Personalización por rol (best-effort): sin cookie válida, se atiende como
    // público — nunca se exige sesión (ver comentario de CHAT_MAX_MESSAGES arriba).
    const usuario = await getAuthenticatedUsuario(request.cookies)
    const systemPrompt = seleccionarPrompt(usuario?.rol.nombre)

    const { messages } = await request.json()

    // Stateless multi-turn: the client sends the full conversation on every
    // request (unchanged contract from the previous generateContent-based
    // implementation), so history is passed inline via `input` instead of
    // relying on server-side `previous_interaction_id` chaining.
    //
    // Both real callers (AurisChatClient, floating-chat-widget) use the AI SDK's
    // useChat hook, which sends UIMessage v5 shape — text lives in `parts`, there
    // is no `.content` string field. Reading `msg.content` here silently produced
    // `text: undefined`, which JSON.stringify drops entirely, so Gemini rejected
    // every request with "Missing text in content of type text." — a live bug
    // caught by browser-testing the chat widget, not by tsc/build.
    type IncomingMessage = { role: string; parts?: { type: string; text?: string }[] }
    const history = messages.map((msg: IncomingMessage) => ({
      type: msg.role === "user" ? ("user_input" as const) : ("model_output" as const),
      content: [
        {
          type: "text" as const,
          text: (msg.parts ?? [])
            .filter((part) => part.type === "text")
            .map((part) => part.text ?? "")
            .join(""),
        },
      ],
    }))

    const response = await getGoogleGenAIClient().interactions.create({
      model: "gemini-3.6-flash",
      system_instruction: systemPrompt,
      input: history,
      stream: true,
      store: false,
    })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of response) {
            if (event.event_type === "step.delta" && event.delta.type === "text") {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Error en chat AURIS:", error)
    return new Response("Error al procesar el mensaje. Por favor intenta de nuevo.", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    })
  }
}
