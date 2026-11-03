-- CreateTable
CREATE TABLE "HistorialReporte" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reporteId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistorialReporte_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HistorialReporte_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HistorialReporte_reporteId_idx" ON "HistorialReporte"("reporteId");
