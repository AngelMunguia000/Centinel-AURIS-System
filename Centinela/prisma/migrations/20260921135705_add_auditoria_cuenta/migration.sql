-- CreateTable
CREATE TABLE "AuditoriaCuenta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accion" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "objetivoId" INTEGER NOT NULL,
    "objetivoEmail" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AuditoriaCuenta_createdAt_idx" ON "AuditoriaCuenta"("createdAt");
