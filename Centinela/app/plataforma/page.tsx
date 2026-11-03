import type { Metadata } from "next"
import { Activity, ScrollText, ClipboardList, Cpu, Bell, BarChart3, User, Headset, ShieldCheck } from "lucide-react"
import { PaginaLanding, Hero, Consola, Cifras, Seccion, Rejilla, Pasos, CtaFinal } from "@/components/landing/kit"

export const metadata: Metadata = {
  title: "Plataforma — Centinela AURIS",
  description: "Monitor en vivo, bitácora, incidencias y avisos: la web que gobierna los nodos de Centinela.",
}

export default function PlataformaPage() {
  return (
    <PaginaLanding actual="/plataforma">
      <Hero
        etiqueta="La plataforma web"
        titulo="Cada nodo, cada evento, cada respuesta."
        acento="En una sola pantalla."
        bajada="Centinela AURIS es la web desde donde se ve lo que pasa en el campo, en tiempo real, y desde donde se ordena lo que hay que resolver."
        secundaria={{ texto: "Entrar a la plataforma", href: "/iniciar-sesion" }}
        visual={
          <Consola
            titulo="Monitor en vivo"
            lineas={[
              { hora: "19:22:26", texto: "node-01 · conexión · en línea", nivel: "ok" },
              { hora: "19:22:46", texto: "node-02 · movimiento · baja" },
              { hora: "19:23:10", texto: "node-01 · intruso · incidencia abierta", nivel: "alta" },
              { hora: "19:23:11", texto: "Operador avisado", nivel: "ok" },
              { hora: "19:24:02", texto: "Pi \"Parcela norte\" · 42.3 °C · -55 dBm" },
            ]}
            pie="Ejemplo con la cadena de nodos simulados."
          />
        }
      />

      <Cifras
        items={[
          { valor: "3", etiqueta: "roles: Usuario, Operador y Admin" },
          { valor: "9", etiqueta: "permisos ajustables por cuenta" },
          { valor: "60 s", etiqueta: "sin contacto y la Pi caída se avisa sola" },
          { valor: "CSV", etiqueta: "exportación de reportes" },
        ]}
      />

      <Seccion marca="01 — Módulos" titulo="Todo lo que necesitas para operar" intro="Cada módulo existe y funciona hoy contra la cadena simulada; la verificación con hardware físico está en curso.">
        <Rejilla
          puntos={[
            { icono: Activity, titulo: "Monitor en vivo", texto: "Nodos en línea, telemetría y eventos al instante. Desde aquí se prueba el LED, el ping y el pan/tilt de cada nodo." },
            { icono: ScrollText, titulo: "Bitácora", texto: "El historial de todo lo que reportan los nodos, con hora, tipo y severidad." },
            { icono: ClipboardList, titulo: "Incidencias", texto: "Los eventos graves abren una incidencia sola. Prioridad, categoría, comentarios e historial completo." },
            { icono: Cpu, titulo: "Dispositivos", texto: "Vincula una Raspberry Pi con un token que se muestra una sola vez; revócala cuando quieras." },
            { icono: Bell, titulo: "Avisos", texto: "La campanita avisa de incidencias, asignaciones y de una Pi que deja de responder o vuelve." },
            { icono: BarChart3, titulo: "Resumen y reportes", texto: "Panel de estado, gráficas por prioridad y categoría, y exportación a CSV." },
          ]}
        />
      </Seccion>

      <Seccion marca="02 — Del evento a la solución" titulo="Nada se queda en el aire">
        <Pasos
          pasos={[
            { titulo: "Evento", texto: "Un nodo detecta algo y la Raspberry Pi lo envía a la web." },
            { titulo: "Incidencia", texto: "Si la severidad es alta, se abre una incidencia automáticamente." },
            { titulo: "Aviso", texto: "El dueño y los Operadores reciben la notificación en su campanita." },
            { titulo: "Resolución", texto: "Se asigna, se comenta y se cierra; todo queda en el historial." },
          ]}
        />
      </Seccion>

      <Seccion marca="03 — Roles" titulo="Cada quien ve lo que le toca">
        <Rejilla
          puntos={[
            { icono: User, titulo: "Usuario", texto: "Reporta y sigue sus propias incidencias. No ve las de los demás." },
            { icono: Headset, titulo: "Operador", texto: "Atiende la cola de incidencias, recibe los avisos y resuelve." },
            { icono: ShieldCheck, titulo: "Admin", texto: "Gestiona cuentas, roles, permisos, dispositivos y la auditoría." },
          ]}
        />
      </Seccion>

      <CtaFinal titulo="Mírala funcionando." texto="Te mostramos el Monitor, la Bitácora y las incidencias con nodos simulados en vivo." />
    </PaginaLanding>
  )
}
