import type { Metadata } from "next"
import { KeyRound, UserCog, FileSearch, Fingerprint, ShieldAlert, WifiOff } from "lucide-react"
import { PaginaLanding, Hero, Consola, Seccion, Rejilla, Estado, CtaFinal } from "@/components/landing/kit"

export const metadata: Metadata = {
  title: "Seguridad y privacidad — Centinela AURIS",
  description: "Roles, permisos, auditoría y datos que se quedan en tu red: cómo Centinela protege la operación.",
}

export default function SeguridadPage() {
  return (
    <PaginaLanding actual="/seguridad">
      <Hero
        etiqueta="Seguridad y privacidad"
        titulo="Un sistema de seguridad tiene que ser seguro."
        acento="Empezando por el suyo."
        bajada="Quién entra, qué puede hacer y qué hizo: Centinela lo controla y lo deja registrado. Y lo que pasa en tu instalación se queda en tu red."
        secundaria={{ texto: "Política de privacidad", href: "/privacidad" }}
        visual={
          <Consola
            titulo="Auditoría"
            lineas={[
              { hora: "09:12:03", texto: "admin · cambio de rol · usuario → Operador", nivel: "ok" },
              { hora: "09:13:27", texto: "admin · permiso cambiado · exportar reportes" },
              { hora: "09:15:02", texto: "admin · cuenta eliminada · prueba@…", nivel: "alta" },
              { hora: "09:20:18", texto: "operador · comando ping · node-02", nivel: "ok" },
            ]}
            pie="Ejemplo ilustrativo del registro de auditoría."
          />
        }
      />

      <Seccion marca="01 — Controles" titulo="Lo que protege la plataforma hoy">
        <Rejilla
          puntos={[
            { icono: UserCog, titulo: "Roles y permisos", texto: "Tres roles y nueve permisos que el Admin puede ajustar por cuenta, con excepciones individuales." },
            { icono: FileSearch, titulo: "Auditoría", texto: "Quedan registrados los cambios de rol y de permisos, las cuentas eliminadas y cada comando enviado a un nodo." },
            { icono: KeyRound, titulo: "Tokens que no se guardan", texto: "El token de cada Raspberry Pi se muestra una sola vez y en la base solo vive su huella (hash)." },
            { icono: Fingerprint, titulo: "Sesión protegida", texto: "Sesión en cookie httpOnly, inicio con Google o GitHub y recuperación de contraseña por correo." },
            { icono: ShieldAlert, titulo: "Defensa en la entrada", texto: "Límite de intentos de acceso, validación de cada dato que entra y cabeceras contra clickjacking." },
            { icono: WifiOff, titulo: "Tus datos, en tu red", texto: "La cadena completa puede correr en una red local, sin enviar eventos a terceros." },
          ]}
        />
      </Seccion>

      <Seccion
        marca="02 — Transparencia"
        titulo="Lo que ya está y lo que falta"
        intro="Preferimos decirlo claro: estas piezas se cierran antes de cualquier instalación fuera de una red local."
      >
        <Estado
          hoy={[
            "Roles, permisos granulares y auditoría de cuentas y comandos",
            "Tokens de gateway guardados solo como hash, revocables",
            "Límite de intentos, validación de entradas y cabeceras de seguridad",
            "Cero vulnerabilidades conocidas en las dependencias de producción",
          ]}
          viene={[
            "HTTPS y MQTT cifrado con usuarios entre la Pi y los nodos",
            "Límite de intentos que sobreviva a un reinicio del servidor",
            "Renovación automática de la sesión",
          ]}
        />
      </Seccion>

      <CtaFinal titulo="¿Tu equipo de TI tiene preguntas?" texto="Te contamos con detalle cómo se protege cada eslabón de la cadena." />
    </PaginaLanding>
  )
}
