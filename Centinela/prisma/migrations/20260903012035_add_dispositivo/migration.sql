-- CreateTable
CREATE TABLE "Dispositivo" (
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
    CONSTRAINT "Dispositivo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Dispositivo_uid_key" ON "Dispositivo"("uid");

-- CreateIndex
CREATE INDEX "Dispositivo_usuarioId_idx" ON "Dispositivo"("usuarioId");
