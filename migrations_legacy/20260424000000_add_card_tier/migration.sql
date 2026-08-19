-- CreateEnum
CREATE TYPE "CardTier" AS ENUM ('CLASSIC', 'GOLD', 'PLATINUM', 'SIGNATURE', 'BLACK', 'INFINITE');

-- AlterTable
ALTER TABLE "user_cards" ADD COLUMN "cardTier" "CardTier";

-- AlterTable
ALTER TABLE "promo_requirements" ADD COLUMN "cardTier" "CardTier";
