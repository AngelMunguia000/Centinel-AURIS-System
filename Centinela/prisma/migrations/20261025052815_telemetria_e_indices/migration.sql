-- CreateTable
CREATE TABLE "TelemetriaMinuto" (
    "dispositivoId" INTEGER NOT NULL,
    "inicio" DATETIME NOT NULL,
    "muestras" INTEGER NOT NULL,
    "tempSuma" REAL NOT NULL,
    "tempMin" REAL NOT NULL,
    "tempMax" REAL NOT NULL,
    "rssiSuma" REAL NOT NULL,
    "rssiMin" REAL NOT NULL,
    "heapMin" INTEGER NOT NULL,

    PRIMARY KEY ("dispositivoId", "inicio"),
    CONSTRAINT "TelemetriaMinuto_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "Dispositivo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TelemetriaHora" (
    "dispositivoId" INTEGER NOT NULL,
    "inicio" DATETIME NOT NULL,
    "muestras" INTEGER NOT NULL,
    "tempSuma" REAL NOT NULL,
    "tempMin" REAL NOT NULL,
    "tempMax" REAL NOT NULL,
    "rssiSuma" REAL NOT NULL,
    "rssiMin" REAL NOT NULL,
    "heapMin" INTEGER NOT NULL,

    PRIMARY KEY ("dispositivoId", "inicio"),
    CONSTRAINT "TelemetriaHora_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "Dispositivo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TelemetriaMinuto_inicio_idx" ON "TelemetriaMinuto"("inicio");

-- CreateIndex
CREATE INDEX "TelemetriaHora_inicio_idx" ON "TelemetriaHora"("inicio");

-- CreateIndex
CREATE INDEX "EventoDispositivo_ocurridoEn_idx" ON "EventoDispositivo"("ocurridoEn");

-- CreateIndex
CREATE INDEX "EventoDispositivo_tipo_ocurridoEn_idx" ON "EventoDispositivo"("tipo", "ocurridoEn");

-- CreateIndex
CREATE INDEX "Notificacion_createdAt_idx" ON "Notificacion"("createdAt");

-- CreateIndex
CREATE INDEX "Reporte_resueltoEn_idx" ON "Reporte"("resueltoEn");
