-- CreateTable
CREATE TABLE "Disuasion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dispositivoId" INTEGER NOT NULL,
    "ocurridoEn" DATETIME NOT NULL,
    "ejecutada" BOOLEAN NOT NULL,
    "motivo" TEXT,
    "patron" TEXT,
    "duracionMs" INTEGER,
    "ganancia" REAL,
    "exito" BOOLEAN,
    "medidoEn" DATETIME,
    CONSTRAINT "Disuasion_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "Dispositivo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Disuasion_dispositivoId_ocurridoEn_idx" ON "Disuasion"("dispositivoId", "ocurridoEn");

-- CreateIndex
CREATE INDEX "Disuasion_patron_idx" ON "Disuasion"("patron");
