-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "password" TEXT,
    "passwordResetTokenHash" TEXT,
    "passwordResetTokenExpires" DATETIME,
    "rolId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoLogin" DATETIME,
    "totpSecreto" TEXT,
    "totpPendiente" TEXT,
    "totpActivadoEn" DATETIME,
    "codigosRespaldo" TEXT,
    "resumenSemanal" BOOLEAN NOT NULL DEFAULT true,
    "resumenEnviadoSemana" TEXT,
    CONSTRAINT "Usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Usuario" ("apellido", "codigosRespaldo", "createdAt", "email", "id", "nombre", "password", "passwordResetTokenExpires", "passwordResetTokenHash", "rolId", "telefono", "totpActivadoEn", "totpPendiente", "totpSecreto", "ultimoLogin", "username") SELECT "apellido", "codigosRespaldo", "createdAt", "email", "id", "nombre", "password", "passwordResetTokenExpires", "passwordResetTokenHash", "rolId", "telefono", "totpActivadoEn", "totpPendiente", "totpSecreto", "ultimoLogin", "username" FROM "Usuario";
DROP TABLE "Usuario";
ALTER TABLE "new_Usuario" RENAME TO "Usuario";
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
