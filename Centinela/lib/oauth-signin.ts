import { prisma } from "./prisma"

// Extraída de auth.ts (callback `signIn`) a su propio módulo para poder
// probarla sin arrastrar next-auth — importar auth.ts completo hace que
// Vitest intente resolver "next/server" fuera del bundler de Next y falla
// (DX-05, auditoría integral 26 ago). Sigue siendo el mismo código que
// corre en producción, solo que ahora vive donde no depende de next-auth.
export async function resolveOAuthSignIn(email: string): Promise<true | string> {
  const existente = await prisma.usuario.findUnique({ where: { email } })

  // Cuenta ya registrada por el flujo manual (tiene password propio):
  // se bloquea, no se vincula automáticamente (16§7.2 — decisión del PO,
  // 2026-08-16).
  if (existente && existente.password !== null) {
    return "/iniciar-sesion?error=correo_ya_registrado"
  }

  // Ni cuenta manual ni cuenta OAuth previa: se crea aquí mismo. `username`
  // queda en null a propósito — ya no es un dato de pre-registro, se asigna
  // en la futura pantalla de completar perfil (igual que el registro manual).
  // nombre/apellido/telefono en "" siguen el mismo patrón que ese flujo.
  if (!existente) {
    const rolUsuario = await prisma.rol.findUnique({ where: { nombre: "Usuario" } })
    if (!rolUsuario) return "/iniciar-sesion?error=oauth_fallido"

    await prisma.usuario.create({
      data: {
        username: null,
        nombre: "",
        apellido: "",
        email,
        telefono: "",
        password: null,
        rolId: rolUsuario.id,
      },
    })
  }

  return true
}
