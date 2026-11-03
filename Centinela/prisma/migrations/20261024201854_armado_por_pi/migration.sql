-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Gateway" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "urlBase" TEXT NOT NULL,
    "revocadoEn" DATETIME,
    "ultimoContacto" DATETIME,
    "avisoSinContactoEn" DATETIME,
    "modoArmado" TEXT NOT NULL DEFAULT 'armado',
    "horarioArmado" TEXT,
    "vacacionesHasta" DATETIME,
    "armadoCambiadoPor" TEXT,
    "armadoCambiadoEn" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Gateway_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Gateway" ("avisoSinContactoEn", "createdAt", "id", "nombre", "revocadoEn", "tokenHash", "ultimoContacto", "urlBase", "usuarioId") SELECT "avisoSinContactoEn", "createdAt", "id", "nombre", "revocadoEn", "tokenHash", "ultimoContacto", "urlBase", "usuarioId" FROM "Gateway";
DROP TABLE "Gateway";
ALTER TABLE "new_Gateway" RENAME TO "Gateway";
CREATE UNIQUE INDEX "Gateway_tokenHash_key" ON "Gateway"("tokenHash");
CREATE INDEX "Gateway_usuarioId_idx" ON "Gateway"("usuarioId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
