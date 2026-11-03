-- CreateTable
CREATE TABLE "Gateway" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "urlBase" TEXT NOT NULL,
    "revocadoEn" DATETIME,
    "ultimoContacto" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Gateway_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventoDispositivo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dispositivoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "severidad" TEXT NOT NULL,
    "detalle" TEXT,
    "ocurridoEn" DATETIME NOT NULL,
    "recibidoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoDispositivo_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "Dispositivo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComandoDispositivo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dispositivoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "latenciaMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Dispositivo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "conexion" TEXT NOT NULL DEFAULT 'ESTABLE',
    "bateria" INTEGER,
    "variableLabel" TEXT,
    "variableValor" TEXT,
    "usuarioId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gatewayId" INTEGER,
    "nodeId" TEXT,
    "capacidades" TEXT,
    "firmware" TEXT,
    "ultimoContacto" DATETIME,
    CONSTRAINT "Dispositivo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispositivo_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Dispositivo" ("bateria", "conexion", "createdAt", "id", "nombre", "tipo", "uid", "usuarioId", "variableLabel", "variableValor") SELECT "bateria", "conexion", "createdAt", "id", "nombre", "tipo", "uid", "usuarioId", "variableLabel", "variableValor" FROM "Dispositivo";
DROP TABLE "Dispositivo";
ALTER TABLE "new_Dispositivo" RENAME TO "Dispositivo";
CREATE UNIQUE INDEX "Dispositivo_uid_key" ON "Dispositivo"("uid");
CREATE UNIQUE INDEX "Dispositivo_nodeId_key" ON "Dispositivo"("nodeId");
CREATE INDEX "Dispositivo_usuarioId_idx" ON "Dispositivo"("usuarioId");
CREATE INDEX "Dispositivo_gatewayId_idx" ON "Dispositivo"("gatewayId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Gateway_tokenHash_key" ON "Gateway"("tokenHash");

-- CreateIndex
CREATE INDEX "Gateway_usuarioId_idx" ON "Gateway"("usuarioId");

-- CreateIndex
CREATE INDEX "EventoDispositivo_dispositivoId_ocurridoEn_idx" ON "EventoDispositivo"("dispositivoId", "ocurridoEn");

-- CreateIndex
CREATE INDEX "ComandoDispositivo_dispositivoId_createdAt_idx" ON "ComandoDispositivo"("dispositivoId", "createdAt");
