-- CreateTable
CREATE TABLE "Notificacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "destinatarioId" INTEGER NOT NULL,
    "mensaje" TEXT NOT NULL,
    "reporteId" INTEGER,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notificacion_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Notificacion_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Notificacion_destinatarioId_idx" ON "Notificacion"("destinatarioId");

-- CreateIndex
CREATE INDEX "Notificacion_destinatarioId_leida_idx" ON "Notificacion"("destinatarioId", "leida");
