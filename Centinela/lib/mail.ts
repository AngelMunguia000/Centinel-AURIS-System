import { Resend } from "resend"

/**
 * Abstracción mínima de envío de correo.
 *
 * Producción: define `MAIL_PROVIDER=resend`, `RESEND_API_KEY` y `MAIL_FROM_ADDRESS`
 * (remitente verificado en Resend) para activar el envío real. Sin `MAIL_PROVIDER`,
 * en producción esta función no envía nada — solo registra el fallo, sin exponer
 * el contenido del correo (que puede incluir un token).
 *
 * Desarrollo local: sin `MAIL_PROVIDER`, el contenido se imprime en consola del
 * servidor para poder probar el flujo sin infraestructura externa.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const provider = process.env.MAIL_PROVIDER

  if (!provider) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "MAIL_PROVIDER no está configurado: no se puede enviar el correo de recuperación de contraseña en producción."
      )
      return
    }

    console.log("=== CORREO DE RECUPERACIÓN DE CONTRASEÑA (modo desarrollo, sin proveedor configurado) ===")
    console.log("Para:", to)
    console.log("Enlace:", resetUrl)
    return
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.MAIL_FROM_ADDRESS

    if (!apiKey || !from) {
      console.error(
        `MAIL_PROVIDER="resend" está configurado pero falta ${!apiKey ? "RESEND_API_KEY" : "MAIL_FROM_ADDRESS"}. No se envió el correo de recuperación.`
      )
      return
    }

    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to,
      subject: "Recupera tu contraseña — Centinela",
      html: `<p>Solicitaste restablecer tu contraseña en Centinela.</p><p><a href="${resetUrl}">Haz clic aquí para continuar</a></p><p>Este enlace vence en 1 hora. Si no fuiste tú, ignora este mensaje.</p>`,
    })

    if (error) {
      console.error("Resend no pudo enviar el correo de recuperación de contraseña:", error.message)
    }
    return
  }

  throw new Error(
    `MAIL_PROVIDER="${provider}" no tiene una implementación real todavía. Agrega la integración correspondiente en lib/mail.ts antes de usar este valor.`
  )
}

/**
 * Aviso de escalamiento a un Admin (lib/escalamiento.ts). Sin token sensible, así que en
 * desarrollo se imprime completo. `reason` solo viene cuando hay algo que corregir.
 */
export async function sendEscalamientoEmail(to: string, mensaje: string): Promise<{ sent: boolean; reason?: string }> {
  const provider = process.env.MAIL_PROVIDER

  if (!provider) {
    if (process.env.NODE_ENV === "production") {
      return { sent: false, reason: "MAIL_PROVIDER no está configurado en producción." }
    }
    console.log("=== CORREO DE ESCALAMIENTO (modo desarrollo, sin proveedor configurado) ===")
    console.log("Para:", to)
    console.log(mensaje)
    return { sent: false }
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.MAIL_FROM_ADDRESS
    if (!apiKey || !from) {
      return { sent: false, reason: "Falta RESEND_API_KEY o MAIL_FROM_ADDRESS." }
    }
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to,
      subject: "Centinela — reporte sin atender",
      html: `<p>${mensaje.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</p><p>Entra a la consola de Centinela para acusar recibo.</p>`,
    })
    return error ? { sent: false, reason: error.message } : { sent: true }
  }

  return { sent: false, reason: `MAIL_PROVIDER="${provider}" no tiene una implementación real todavía.` }
}

/**
 * Resumen semanal (lib/resumen-semanal.ts). Mismo proveedor que los demás; en desarrollo sin
 * proveedor solo se registra el asunto (el HTML completo se ve en la vista previa de Ajustes).
 */
export async function sendResumenEmail(to: string, asunto: string, html: string): Promise<{ sent: boolean; reason?: string }> {
  const provider = process.env.MAIL_PROVIDER

  if (!provider) {
    if (process.env.NODE_ENV === "production") {
      return { sent: false, reason: "MAIL_PROVIDER no está configurado en producción." }
    }
    console.log("=== RESUMEN SEMANAL (modo desarrollo, sin proveedor configurado) ===")
    console.log("Para:", to, "·", asunto)
    return { sent: false, reason: "Sin proveedor de correo configurado (modo desarrollo)." }
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.MAIL_FROM_ADDRESS
    if (!apiKey || !from) {
      return { sent: false, reason: "Falta RESEND_API_KEY o MAIL_FROM_ADDRESS." }
    }
    const { error } = await new Resend(apiKey).emails.send({ from, to, subject: asunto, html })
    return error ? { sent: false, reason: error.message } : { sent: true }
  }

  return { sent: false, reason: `MAIL_PROVIDER="${provider}" no tiene una implementación real todavía.` }
}

const TIPO_LABELS: Record<string, string> = {
  vigilancia: "Vigilancia — detectar y dar seguimiento a incidentes",
  "vigilancia-disuasion": "Vigilancia con disuasión activa",
  disuasion: "Disuasión, sin vigilancia constante",
  "disuasion-agricola": "Disuasión especializada para fauna en zonas agrícolas",
}

const URGENCIA_LABELS: Record<string, string> = {
  ya: "lo necesitan ya",
  meses: "lo necesitan en los próximos meses",
  explorando: "están explorando opciones",
}

/**
 * Correo personalizado tras completar el cuestionario "Encuentra tu Centinela".
 * Usa el mismo remitente/proveedor que sendPasswordResetEmail — sujeto a la
 * misma limitación del sandbox de Resend (onboarding@resend.dev): solo entrega
 * a la cuenta dueña de la API key hasta que se verifique un dominio propio.
 *
 * A diferencia de sendPasswordResetEmail, esta función SÍ devuelve el
 * resultado (no solo lo registra en consola) porque no maneja un token
 * sensible y el llamador necesita saber si de verdad se envió.
 */
export async function sendCuestionarioEmail(
  to: string,
  answers: Record<string, string | undefined>,
  registerUrl: string
): Promise<{ sent: boolean; reason?: string }> {
  const provider = process.env.MAIL_PROVIDER

  const tipoLabel = answers.tipo ? TIPO_LABELS[answers.tipo] : undefined
  const urgenciaLabel = answers.urgencia ? URGENCIA_LABELS[answers.urgencia] : undefined

  const intro = tipoLabel
    ? `<p>Nos contaste que buscas: <strong>${tipoLabel}</strong>.</p>`
    : ""
  const urgencia = urgenciaLabel ? `<p>También nos dijiste que ${urgenciaLabel}.</p>` : ""

  const html = `
    <p>Gracias por contarnos sobre tu organización.</p>
    ${intro}
    ${urgencia}
    <p>El siguiente paso es crear tu cuenta para empezar a usar Centinela:</p>
    <p><a href="${registerUrl}">Crear mi cuenta en Centinela</a></p>
    <p>Si prefieres que te contactemos directamente antes de crear una cuenta, responde este correo.</p>
  `

  if (!provider) {
    if (process.env.NODE_ENV === "production") {
      return { sent: false, reason: "MAIL_PROVIDER no está configurado en producción." }
    }
    console.log("=== CORREO DEL CUESTIONARIO (modo desarrollo, sin proveedor configurado) ===")
    console.log("Para:", to)
    console.log("Enlace de registro:", registerUrl)
    return { sent: false, reason: "Sin proveedor configurado (modo desarrollo): revisa la consola del servidor." }
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.MAIL_FROM_ADDRESS

    if (!apiKey || !from) {
      return { sent: false, reason: "Falta RESEND_API_KEY o MAIL_FROM_ADDRESS." }
    }

    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to,
      subject: "Centinela AURIS — gracias por tu interés",
      html,
    })

    if (error) {
      return { sent: false, reason: error.message }
    }
    return { sent: true }
  }

  return { sent: false, reason: `MAIL_PROVIDER="${provider}" no tiene una implementación real todavía.` }
}
