# Empaqueta Centinela Desktop para Windows y deja el ZIP donde la web lo sirve (/descargar).
# Uso (desde Projects/Centinela-Desktop):  powershell -ExecutionPolicy Bypass -File build.ps1
param([string]$Salida = "dist")  # otra carpeta si la anterior está en uso (una copia abierta bloquea los archivos)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$py = ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { throw "Falta el entorno: python -m venv .venv; .venv\Scripts\pip install -r requirements.txt" }

# 1. Icono .ico a partir del mismo dibujo que usa la app.
New-Item -ItemType Directory -Force build | Out-Null
$env:PYTHONPATH = "src"
& $py -c "from PySide6.QtWidgets import QApplication; app = QApplication([]); from centinela_desktop.icono import pixmap_logo; assert pixmap_logo(256).save('build/centinela.ico')"
if ($LASTEXITCODE -ne 0) { throw "No se pudo generar el icono" }

# 2. Ejecutable (carpeta, arranque rápido; sin consola). trio no se usa y su análisis tumba el subproceso
#    de PyInstaller. En esta laptop Python a veces cae con segfault al analizar (fallo nativo intermitente,
#    ver Brain/09 del proyecto web): se reintenta hasta 3 veces.
$ok = $false
foreach ($intento in 1..3) {
    & $py -m PyInstaller --noconfirm --windowed --name Centinela --icon build/centinela.ico `
        --paths src --distpath $Salida --workpath build/pyinstaller `
        --exclude-module trio --exclude-module anyio._backends._trio `
        --add-data "src/centinela_desktop/fuentes;centinela_desktop/fuentes" `
        --add-data "src/centinela_desktop/iconos;centinela_desktop/iconos" src/centinela_desktop/__main__.py
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    Write-Host "PyInstaller falló (intento $intento), reintentando..."
}
if (-not $ok) { throw "PyInstaller falló 3 veces" }

# 3. ZIP en la web (Projects/Centinela/public/descargas, ignorado por git).
$destino = Join-Path $PSScriptRoot "..\Centinela\public\descargas"
New-Item -ItemType Directory -Force $destino | Out-Null
$zip = Join-Path $destino "Centinela-Desktop-Windows.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $Salida "Centinela") -DestinationPath $zip -CompressionLevel Optimal
$mb = [math]::Round((Get-Item $zip).Length / 1MB)
Write-Host "Listo: $zip ($mb MB)"
