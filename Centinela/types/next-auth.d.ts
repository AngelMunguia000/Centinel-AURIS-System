import type { DefaultSession } from "next-auth"

// Se augmenta "@auth/core/types"/"@auth/core/jwt" (no "next-auth"/"next-auth/jwt")
// porque ahí es donde `interface Session`/`interface JWT` están realmente
// declaradas — next-auth solo las re-exporta con `export type`, y una
// declaración `declare module "next-auth"` no llega a fusionarse con el tipo
// real (verificado: sin esto, `token.usuarioId` resolvía a `unknown` por el
// índice `Record<string, unknown>` que JWT hereda de @auth/core).
declare module "@auth/core/types" {
  interface Session {
    user: {
      usuarioId?: number
      role?: string
    } & DefaultSession["user"]
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    usuarioId?: number
    role?: string
  }
}
