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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reporte_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reporte_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Reporte" ("createdAt", "descripcion", "estado", "id", "resueltoPorId", "titulo", "usuarioId") SELECT "createdAt", "descripcion", "estado", "id", "resueltoPorId", "titulo", "usuarioId" FROM "Reporte";
DROP TABLE "Reporte";
ALTER TABLE "new_Reporte" RENAME TO "Reporte";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
