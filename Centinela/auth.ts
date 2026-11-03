import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import { prisma } from "@/lib/prisma"
import { resolveOAuthSignIn } from "@/lib/oauth-signin"

// Auth.js se usa únicamente para el handshake OAuth con Google/GitHub. No
// autoriza nada por sí mismo en el resto de la app: el callback `signIn`
// decide si la Cuenta puede continuar (bloqueando colisión de correo con una
// Cuenta de registro manual), y app/api/auth/complete/route.ts es quien emite
// la sesión real (el JWT propio, lib/auth.ts) a partir de lo que aquí se deja
// en el token de Auth.js.
export const { handlers, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Sin esto, Google reautentica en silencio con la última cuenta usada
      // (prompt=none) y nunca muestra el selector — mala UX para un botón
      // "Continuar con Google" que el usuario acaba de hacer clic a propósito.
      authorization: { params: { prompt: "select_account" } },
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      return resolveOAuthSignIn(user.email)
    },
    async jwt({ token, user }) {
      const email = user?.email ?? token.email
      if (email) {
        const usuario = await prisma.usuario.findUnique({
          where: { email },
          include: { rol: true },
        })
        if (usuario) {
          token.usuarioId = usuario.id
          token.role = usuario.rol.nombre
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.usuarioId = token.usuarioId
        session.user.role = token.role
      }
      return session
    },
  },
})

export { resolveOAuthSignIn } from "@/lib/oauth-signin"
