# Centinela Desktop

La app de escritorio de Centinela AURIS para Windows, **programada en Qt (sin navegador)**: Inicio, Monitor en
vivo con comandos a los nodos, Bitácora y Reportes, más avisos de Windows (alertas altas, pánico) aunque la
ventana esté cerrada. Se descarga desde
`/descargar` en la web. Diseño: `docs/diseno/2026-10-23-centinela-desktop-v02-design.md`.

## Desarrollo

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
$env:PYTHONPATH = "src"
.venv\Scripts\python -m pytest                       # pruebas (sin red real)
.venv\Scripts\python -m centinela_desktop            # abre la app (pide el servidor la primera vez)
```

Opciones: `--servidor http://IP:3000` (sin guardarla), `--vista monitor` (inicio, monitor, bitacora, reportes),
`--captura salida.png` (guarda una imagen de la ventana y sale; con `CENTINELA_AUTOLOGIN="correo:clave"`
inicia sesión sola — solo para verificar en desarrollo).

> En Git Bash, poner `MSYS_NO_PATHCONV=1` delante, y lanzar el `.exe` desde PowerShell: Git Bash altera las
> rutas de los argumentos.

## Empaquetar y publicar la descarga

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1            # -Salida dist-x si otra copia abierta bloquea dist/
```

Genera `dist/Centinela/Centinela.exe` y deja `Centinela-Desktop-Windows.zip` en
`../Centinela/public/descargas/` (ignorado por git); la página `/descargar` lo detecta y muestra su tamaño.

## Cómo encaja con la web

- La web solo abre la consola (login y vistas internas) a la app de escritorio y a teléfonos: la app se
  identifica con `CentinelaDesktop/<versión>` en el User-Agent (`Projects/Centinela/lib/cliente-app.ts`).
  No es seguridad: la sesión y los permisos siguen siendo los de siempre.
- Habla con la misma API que el navegador (`/api/login`, `/api/me`, `/api/stream`, `/api/edge/*`,
  `/api/reportes*`, `/api/notificaciones`, `/api/panico`); la sesión es la cookie `token`.

## Conocido

- La carpeta pesa ~110 MB (el ZIP ~45 MB). Prototipo muestra solo el catálogo de módulos; la simulación sigue en la web.
- Sin firma de código: Windows SmartScreen advierte la primera vez.
- En esta laptop PyInstaller a veces cae con segfault al analizar; `build.ps1` reintenta hasta 3 veces.
