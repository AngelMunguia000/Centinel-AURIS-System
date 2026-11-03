import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../lib/prisma"
import bcrypt from "bcrypt"
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from "@/lib/rate-limit"
import { isValidEmail } from "@/lib/validation"

export async function POST(request: NextRequest) {
  try {
    // Sin clave de correo: por IP únicamente, para que crear cuentas con correos distintos
    // desde el mismo origen no evada el límite (protege contra creación masiva automatizada,
    // no reemplaza la corrección pendiente de enumeración vía "correo ya registrado").
    const rateLimitId = getRateLimitIdentifier("register", request)
    const rateLimit = checkRateLimit(rateLimitId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      )
    }
    recordAttempt(rateLimitId)

    const data = await request.json()

    // Validate only the fields that the registration form actually sends
    const requiredFields = ["email", "password"]
    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json({ success: false, error: `El campo ${field} es requerido` }, { status: 400 })
      }
    }

    // Validate email format
    if (!isValidEmail(data.email)) {
      return NextResponse.json({ success: false, error: "El correo electrónico no es válido" }, { status: 400 })
    }

    // Validate password strength
    if (data.password.length < 8) {
      return NextResponse.json(
        { success: false, error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 },
      )
    }

    // El correo NO puede diferenciarse de un registro nuevo — corrige la enumeración de
    // cuentas señalada en la Fase 24.2 (Brain/21_ChangeRecoveryLog.md §19.9).
    const emailOwner = await prisma.usuario.findUnique({ where: { email: data.email }, select: { id: true } })

    // El registro público siempre crea una Cuenta con Rol "Usuario" (16§4.3, 19§5.1).
    // El Rol se resuelve por nombre, nunca por un id fijo: el cliente nunca decide el Rol.
    const rolUsuario = await prisma.rol.findUnique({ where: { nombre: "Usuario" } })
    if (!rolUsuario) {
      console.error("Rol 'Usuario' no existe en la base de datos. Ejecutar el seed antes de aceptar registros.")
      return NextResponse.json(
        { success: false, error: "El sistema no está listo para registrar cuentas. Intenta más tarde." },
        { status: 500 },
      )
    }

    // El hash se calcula siempre, exista o no el correo, para no introducir una diferencia
    // de tiempo obvia entre "correo nuevo" y "correo ya registrado" — bcrypt es el costo
    // dominante de esta ruta.
    const hashedPassword = await bcrypt.hash(data.password, 10)

    if (emailOwner) {
      // Correo ya registrado: no se crea una segunda cuenta ni se envía nada a la cuenta
      // real. Se responde con la misma forma exacta que un alta nueva exitosa, usando solo
      // los datos que el propio cliente envió (nunca datos de la cuenta real), para que la
      // respuesta sea indistinguible de un registro genuino.
      const maxIdRow = await prisma.usuario.aggregate({ _max: { id: true } })
      const fakeId = (maxIdRow._max.id ?? 0) + 1
      return NextResponse.json({
        success: true,
        message: "Registro exitoso.",
        user: {
          id: fakeId,
          nombre: data.nombre ?? "",
          apellido: data.apellido ?? "",
          email: data.email,
          telefono: data.telefono ?? "",
          createdAt: new Date(),
        },
      })
    }

    // nombre, apellido, telefono son opcionales — se completan después en el
    // perfil. `username` ya no es un dato de pre-registro (queda null; se
    // asigna en la futura pantalla de completar perfil, igual que en OAuth).
    const newUser = await prisma.usuario.create({
      data: {
        username: null,
        nombre: data.nombre ?? "",
        apellido: data.apellido ?? "",
        email: data.email,
        telefono: data.telefono ?? "",
        password: hashedPassword,
        rolId: rolUsuario.id,
      }
    })

    return NextResponse.json({
      success: true,
      message: "Registro exitoso.",
      user: {
        id: newUser.id,
        nombre: newUser.nombre,
        apellido: newUser.apellido,
        email: newUser.email,
        telefono: newUser.telefono,
        createdAt: newUser.createdAt
      }
    })
  } catch (error) {
    console.error("Error en el registro:", error)
    return NextResponse.json(
      { success: false, error: "Error al procesar el registro. Intenta nuevamente." },
      { status: 500 },
    )
  }
}
