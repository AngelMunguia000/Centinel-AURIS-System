-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "codigosRespaldo" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "totpActivadoEn" DATETIME;
ALTER TABLE "Usuario" ADD COLUMN "totpPendiente" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "totpSecreto" TEXT;
