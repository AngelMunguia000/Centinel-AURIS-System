-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "passwordResetTokenExpires" DATETIME;
ALTER TABLE "Usuario" ADD COLUMN "passwordResetTokenHash" TEXT;
