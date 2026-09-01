/*
  Warnings:

  - You are about to drop the column `deviceId` on the `trusted_devices` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `trusted_devices` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expiresAt` to the `trusted_devices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token` to the `trusted_devices` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "trusted_devices_deviceId_key";

-- AlterTable
ALTER TABLE "trusted_devices" DROP COLUMN "deviceId",
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "token" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_token_key" ON "trusted_devices"("token");
