import type { LucideIcon } from "lucide-react"
import { Wheat, Home, Ship, Repeat, Maximize, Leaf, Bell, Smartphone, Moon, WifiOff, Anchor, Wrench } from "lucide-react"

// Contenido de las landings complementarias. Regla: nada de lo que se describe como "hoy" puede
// faltar en el producto (ver Brain/09 y el paso 7 de la auditoría: el chat ya prometió de más una vez).

export const PAGINAS_LANDING = [
  { href: "/soluciones", titulo: "Soluciones", resumen: "Agricultura, hogar y operación marítima." },
  { href: "/soluciones/agricultura", titulo: "Agricultura", resumen: "Cultivos sin bandadas, sin químicos ni pirotecnia." },
  { href: "/soluciones/hogar", titulo: "Hogar", resumen: "Patios, azoteas y jardines protegidos." },
  { href: "/soluciones/maritimo", titulo: "Marítimo", resumen: "Buques de carga, todo a bordo y sin internet." },
  { href: "/plataforma", titulo: "Plataforma", resumen: "Monitor en vivo, bitácora e incidencias." },
  { href: "/tecnologia", titulo: "Tecnología", resumen: "ESP32, Raspberry Pi y la web, de punta a punta." },
  { href: "/seguridad", titulo: "Seguridad y privacidad", resumen: "Roles, auditoría y datos que no salen." },
  { href: "/descargar", titulo: "Descargar", resumen: "Centinela para Windows." },
] as const

type Punto = { icono: LucideIcon; titulo: string; texto: string }

export type Solucion = {
  slug: string
  nombre: string
  descripcion: string
  icono: LucideIcon
  etiqueta: string
  titulo: string
  acento: string
  bajada: string
  consola: { titulo: string; lineas: { hora: string; texto: string; nivel?: "info" | "ok" | "alta" }[] }
  problemaIntro: string
  problema: Punto[]
  cifras: { valor: string; etiqueta: string }[]
  ventajas: Punto[]
  ctaTitulo: string
}

export const ESTADO_SOLUCIONES = {
  hoy: [
    "Plataforma web: Monitor en vivo, Bitácora, incidencias, avisos y roles",
    "Enlace ESP32 ↔ Raspberry Pi ↔ web probado de punta a punta con nodos simulados",
    "Máquina de disuasión y anti-habituación, simulada en el panel de Prototipo",
  ],
  viene: [
    "Pruebas en campo con la Raspberry Pi y el ESP32 físicos",
    "Cámara y detección de aves en el propio dispositivo",
    "Disuasión adaptativa corriendo en la Pi, no solo en simulación",
  ],
}

export const SOLUCIONES: Solucion[] = [
  {
    slug: "agricultura",
    nombre: "Agricultura",
    descripcion: "Cultivos y naves industriales sin bandadas.",
    icono: Wheat,
    etiqueta: "Empresa · Agrícola",
    titulo: "La cosecha no se negocia con las aves.",
    acento: "Se protege.",
    bajada:
      "Centinela vigila el cultivo, confirma la presencia de la bandada y responde con un pulso de audio dirigido solo al punto detectado. Sin químicos, sin pirotecnia y sin ruido todo el día.",
    consola: {
      titulo: "Parcela norte · nodo-02",
      lineas: [
        { hora: "06:41:08", texto: "Bandada detectada · sector 3", nivel: "alta" },
        { hora: "06:41:09", texto: "Pan 34° · tilt -12° · objetivo fijado" },
        { hora: "06:41:09", texto: "Pulso de disuasión 4 s · patrón B", nivel: "ok" },
        { hora: "06:41:14", texto: "Sector 3 despejado", nivel: "ok" },
        { hora: "06:58:30", texto: "Paso de ave aislada · sin acción" },
      ],
    },
    problemaIntro:
      "Las aves consumen y dañan cultivos en las etapas críticas de siembra y maduración. Los métodos de siempre pierden efecto en semanas.",
    problema: [
      { icono: Repeat, titulo: "Habituación", texto: "Espantapájaros, redes y cohetes dejan de funcionar porque las aves se acostumbran a estímulos fijos." },
      { icono: Maximize, titulo: "Cobertura", texto: "Los métodos convencionales cubren áreas pequeñas y no escalan a grandes extensiones." },
      { icono: Leaf, titulo: "Costo e impacto", texto: "Repelentes químicos y mantenimiento constante elevan el costo y dañan el entorno." },
    ],
    cifras: [
      { valor: "3–5 s", etiqueta: "por pulso, solo tras confirmar presencia" },
      { valor: "180°", etiqueta: "de cobertura horizontal por unidad" },
      { valor: "IP66", etiqueta: "carcasa sellada para intemperie" },
      { valor: "-10/60 °C", etiqueta: "rango de operación" },
    ],
    ventajas: [
      { icono: Repeat, titulo: "Pensado contra la costumbre", texto: "El patrón de sonido está diseñado para cambiar entre eventos, de modo que la bandada no aprenda a ignorarlo." },
      { icono: Maximize, titulo: "Varias unidades", texto: "Cada Raspberry Pi coordina sus nodos y la web los muestra juntos en el Monitor." },
      { icono: Leaf, titulo: "Limpio", texto: "Sin químicos ni pirotecnia; los nodos de campo pueden alimentarse con energía solar." },
    ],
    ctaTitulo: "Pon a prueba Centinela en tu parcela.",
  },
  {
    slug: "hogar",
    nombre: "Hogar",
    descripcion: "Patios, azoteas y jardines.",
    icono: Home,
    etiqueta: "Hogar",
    titulo: "Tu azotea vuelve a ser tuya.",
    acento: "Sin ruido constante.",
    bajada:
      "Un nodo discreto que solo actúa cuando confirma la presencia de aves, y que deja registro de cada intervención para que sepas qué pasó mientras no estabas.",
    consola: {
      titulo: "Azotea · nodo-01",
      lineas: [
        { hora: "14:02:51", texto: "Palomas en el borde norte", nivel: "alta" },
        { hora: "14:02:52", texto: "Pulso 3 s dirigido · volumen bajo", nivel: "ok" },
        { hora: "14:02:56", texto: "Zona despejada", nivel: "ok" },
        { hora: "14:03:00", texto: "Registrado en la Bitácora" },
      ],
    },
    problemaIntro: "Las palomas ensucian, dañan instalaciones y vuelven cada día al mismo sitio.",
    problema: [
      { icono: Repeat, titulo: "Vuelven siempre", texto: "Los objetos que asustan funcionan unos días; después las aves los ignoran." },
      { icono: Wrench, titulo: "Daño y limpieza", texto: "Las deyecciones corroen superficies y obligan a limpiar una y otra vez." },
      { icono: Bell, titulo: "No sabes qué pasa", texto: "Sin registro no hay forma de saber cuándo vienen ni si algo funcionó." },
    ],
    cifras: [
      { valor: "3–5 s", etiqueta: "de sonido, solo cuando hace falta" },
      { valor: "WiFi", etiqueta: "2.4 GHz, sin cables a tu red" },
      { valor: "IP66", etiqueta: "aguanta lluvia y polvo" },
      { valor: "1", etiqueta: "cuenta para ver todo desde la web" },
    ],
    ventajas: [
      { icono: Bell, titulo: "Te enteras", texto: "Las intervenciones quedan en la Bitácora y las de severidad alta llegan a la campanita de tu cuenta." },
      { icono: Moon, titulo: "Discreto", texto: "Nada de alarmas todo el día: el audio sale en pulsos cortos y dirigidos." },
      { icono: Smartphone, titulo: "Desde tu navegador", texto: "El panel funciona en el teléfono; la app móvil propia está en camino." },
    ],
    ctaTitulo: "Recupera tu azotea.",
  },
  {
    slug: "maritimo",
    nombre: "Marítimo",
    descripcion: "Buques de carga y puertos, sin internet.",
    icono: Ship,
    etiqueta: "Barco · Alta seguridad",
    titulo: "En altamar no hay nube.",
    acento: "Centinela no la necesita.",
    bajada:
      "Todo el análisis ocurre a bordo, en la Raspberry Pi. Si el enlace con la web se cae, los eventos esperan en una cola local y se entregan al volver, sin perder ninguno.",
    consola: {
      titulo: "Bodega 2 · nodo-04",
      lineas: [
        { hora: "03:17:40", texto: "Enlace con la web perdido · modo cola" },
        { hora: "03:21:05", texto: "Aves sobre la escotilla", nivel: "alta" },
        { hora: "03:21:06", texto: "Pulso 5 s · patrón C", nivel: "ok" },
        { hora: "03:44:12", texto: "Enlace restablecido · 3 eventos entregados", nivel: "ok" },
      ],
    },
    problemaIntro: "En la carga a granel, las aves contaminan el grano y aceleran la corrosión de las estructuras.",
    problema: [
      { icono: Wheat, titulo: "Grano contaminado", texto: "Las deyecciones degradan la calidad de la carga transportada." },
      { icono: Wrench, titulo: "Corrosión", texto: "Obstruyen sistemas mecánicos y deterioran las estructuras navales." },
      { icono: WifiOff, titulo: "Sin conexión", texto: "Las soluciones en la nube no sirven donde no hay internet ni se permite sacar datos." },
    ],
    cifras: [
      { valor: "0", etiqueta: "datos enviados fuera del barco" },
      { valor: "100%", etiqueta: "del análisis en el dispositivo" },
      { valor: "Cola", etiqueta: "local: ningún evento se pierde sin enlace" },
      { valor: "IP66", etiqueta: "para cubierta y bodega" },
    ],
    ventajas: [
      { icono: WifiOff, titulo: "Offline de verdad", texto: "La web corre en la red local del barco; nada depende de un servidor externo." },
      { icono: Anchor, titulo: "Hecho para cubierta", texto: "Carcasa sellada y rango de operación de -10 a 60 °C." },
      { icono: Repeat, titulo: "Cola persistente", texto: "La Pi guarda los eventos en disco mientras no hay enlace y los entrega al reconectar." },
    ],
    ctaTitulo: "Lleva Centinela a bordo.",
  },
]
