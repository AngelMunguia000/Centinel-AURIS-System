-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reporte" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "categoria" TEXT,
    "usuarioId" INTEGER NOT NULL,
    "resueltoPorId" INTEGER,
    "operadorAsignadoId" INTEGER,
    "atendidoEn" DATETIME,
    "atendidoPorId" INTEGER,
    "resueltoEn" DATETIME,
    "motivoCierre" TEXT,
    "escaladoEn" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reporte_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reporte_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reporte_operadorAsignadoId_fkey" FOREIGN KEY ("operadorAsignadoId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reporte_atendidoPorId_fkey" FOREIGN KEY ("atendidoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Reporte" ("categoria", "createdAt", "descripcion", "estado", "id", "operadorAsignadoId", "prioridad", "resueltoPorId", "titulo", "usuarioId") SELECT "categoria", "createdAt", "descripcion", "estado", "id", "operadorAsignadoId", "prioridad", "resueltoPorId", "titulo", "usuarioId" FROM "Reporte";
DROP TABLE "Reporte";
ALTER TABLE "new_Reporte" RENAME TO "Reporte";
CREATE INDEX "Reporte_usuarioId_idx" ON "Reporte"("usuarioId");
CREATE INDEX "Reporte_estado_idx" ON "Reporte"("estado");
CREATE INDEX "Reporte_createdAt_idx" ON "Reporte"("createdAt");
CREATE INDEX "Reporte_operadorAsignadoId_idx" ON "Reporte"("operadorAsignadoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
