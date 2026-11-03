import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Este script crea/actualiza 3 cuentas con contraseña hardcodeada ('admin123').
  // Nunca debe correr contra una base de datos real de producción.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      "prisma/seed.ts fue detenido: NODE_ENV='production'. Este script crea cuentas con " +
        'contraseña hardcodeada y nunca debe ejecutarse contra una base de datos de producción.'
    )
  }

  // Crear roles
  const adminRole = await prisma.rol.upsert({
    where: { nombre: 'Admin' },
    update: {},
    create: { nombre: 'Admin' }
  })

  const operadorRole = await prisma.rol.upsert({
    where: { nombre: 'Operador' },
    update: {},
    create: { nombre: 'Operador' }
  })

  const usuarioRole = await prisma.rol.upsert({
    where: { nombre: 'Usuario' },
    update: {},
    create: { nombre: 'Usuario' }
  })

  console.log('Roles creados:', { adminRole, operadorRole, usuarioRole })

  // Crear usuario de prueba admin
  const hashedPassword = await import('bcrypt').then(bcrypt => bcrypt.hash('admin123', 10))

  const adminUser = await prisma.usuario.upsert({
    where: { email: 'admin@auris.com' },
    update: {},
    create: {
      username: 'admin',
      nombre: 'Administrador',
      apellido: 'Sistema',
      email: 'admin@auris.com',
      telefono: '123456789',
      password: hashedPassword,
      rolId: adminRole.id
    }
  })

  // Crear usuario de prueba operador
  const operadorUser = await prisma.usuario.upsert({
    where: { email: 'operador@auris.com' },
    update: {},
    create: {
      username: 'operador',
      nombre: 'Operador',
      apellido: 'Sistema',
      email: 'operador@auris.com',
      telefono: '987654321',
      password: hashedPassword,
      rolId: operadorRole.id
    }
  })

  // Crear usuario de prueba normal
  const normalUser = await prisma.usuario.upsert({
    where: { email: 'usuario@auris.com' },
    update: {},
    create: {
      username: 'usuario',
      nombre: 'Usuario',
      apellido: 'Normal',
      email: 'usuario@auris.com',
      telefono: '555666777',
      password: hashedPassword,
      rolId: usuarioRole.id
    }
  })

  console.log('Usuarios de prueba creados')

  // Sembrar el equipo de ejemplo del Centro de Dispositivos (2 sep 2026) en el
  // usuario de prueba normal — traducido de
  // Prototypes/stitch_centinela_ui_seguridad/centro_de_dispositivos_modo_oscuro/code.html.
  const dispositivosEjemplo = [
    { nombre: 'Hub de Entrada Principal', uid: 'CC-455-GTW', tipo: 'gateway', conexion: 'ESTABLE', bateria: null, variableLabel: 'Latencia', variableValor: '14ms prom.' },
    { nombre: 'Biométrico Sala de Servidores', uid: 'CC-102-BIO', tipo: 'biometrico', conexion: 'ACTIVA', bateria: 64, variableLabel: 'Integridad', variableValor: '100% segura' },
    { nombre: 'Muro Perimetral', uid: 'CC-990-FRW', tipo: 'firewall', conexion: 'LATENCIA', bateria: 88, variableLabel: 'Flujo', variableValor: '2.4 GB/s cifrado' },
    { nombre: 'Muelle de Carga', uid: 'CC-112-BIO', tipo: 'biometrico', conexion: 'DESCONECTADO', bateria: 4, variableLabel: 'Integridad', variableValor: 'Sin verificar' },
    { nombre: 'Cámara Exterior', uid: 'CC-EXT-02', tipo: 'camara', conexion: 'ESTABLE', bateria: null, variableLabel: 'Señal', variableValor: 'Fuerte' },
    { nombre: 'Clima del Archivo', uid: 'CC-303-SNS', tipo: 'sensor', conexion: 'ESTABLE', bateria: 92, variableLabel: 'Temperatura', variableValor: '21.4°C' },
  ]

  for (const d of dispositivosEjemplo) {
    await prisma.dispositivo.upsert({
      where: { uid: d.uid },
      update: {},
      create: { ...d, usuarioId: normalUser.id },
    })
  }

  console.log('Equipo de ejemplo creado para usuario@auris.com')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })