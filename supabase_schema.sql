-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('CREDIT', 'DEBIT', 'PREPAID', 'ACCOUNT');

-- CreateEnum
CREATE TYPE "CardTier" AS ENUM ('CLASSIC', 'GOLD', 'PLATINUM', 'SIGNATURE', 'BLACK', 'INFINITE', 'EMINENT', 'SELECTA');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE_REINTEGRO', 'PERCENTAGE_DESCUENTO', 'BONIFICACION', 'FIXED_AMOUNT', 'NXM', 'CUOTAS_SIN_INTERES');

-- CreateEnum
CREATE TYPE "CapPeriod" AS ENUM ('PER_TRANSACTION', 'DAILY', 'WEEKLY', 'MONTHLY', 'TOTAL');

-- CreateEnum
CREATE TYPE "CapTarget" AS ENUM ('USER', 'CARD', 'ACCOUNT', 'TRANSACCION');

-- CreateEnum
CREATE TYPE "PromoStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'PAUSED');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('ANY', 'QR', 'NFC', 'TARJETA_FISICA', 'TRANSFERENCIA', 'DINERO_EN_CUENTA');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ANY', 'HABERES', 'JUBILADO', 'ANSES');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('AVIVADA', 'PROMO', 'ERROR_PRECIO', 'COMBO', 'CONSULTA');

-- CreateEnum
CREATE TYPE "FinanceItemType" AS ENUM ('PLAZO_FIJO', 'CAUCION', 'LECAP', 'LECER', 'BOPREAL', 'ON', 'FCI_MM', 'DOLAR_TIPO');

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "codeExpires" TIMESTAMP(3),
    "verificationCode" TEXT,
    "addressApt" TEXT,
    "addressCity" TEXT,
    "addressCountry" TEXT,
    "addressFloor" TEXT,
    "addressNumber" TEXT,
    "addressState" TEXT,
    "addressStreet" TEXT,
    "addressZipCode" TEXT,
    "documentNumber" TEXT,
    "documentType" TEXT,
    "lastName" TEXT,
    "phoneFixed" TEXT,
    "phoneMobile" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "financial_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_banks" (
    "id" TEXT NOT NULL,
    "financialProfileId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_wallets" (
    "id" TEXT NOT NULL,
    "financialProfileId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_cards" (
    "id" TEXT NOT NULL,
    "financialProfileId" TEXT NOT NULL,
    "bankId" TEXT,
    "cardNetworkId" TEXT,
    "cardType" "CardType" NOT NULL,
    "cardTier" "CardTier",
    "cardSegmentId" TEXT,
    "isVirtual" BOOLEAN NOT NULL DEFAULT false,
    "walletId" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFour" TEXT,
    "segment" TEXT,
    "segmentId" TEXT,
    "accountNumber" TEXT,
    "bankAccountType" TEXT,
    "currency" TEXT,
    "shortAccountNumber" TEXT,
    "alias" TEXT,
    "isPayroll" BOOLEAN NOT NULL DEFAULT false,
    "isPensioner" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_segments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,

    CONSTRAINT "bank_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "bcraCode" VARCHAR(5),
    "codigoModo" VARCHAR(5),

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_networks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "card_networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_segments" (
    "id" TEXT NOT NULL,
    "cardNetworkId" TEXT NOT NULL,
    "cardType" "CardType" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "card_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "website" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "commerces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "uniqueUsePerPeriod" BOOLEAN NOT NULL DEFAULT false,
    "maxUsesPerPeriod" INTEGER,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "stackableNote" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "validDays" INTEGER NOT NULL DEFAULT 127,
    "validDaysNote" TEXT,
    "validFromHour" INTEGER,
    "validToHour" INTEGER,
    "categoryId" TEXT NOT NULL,
    "commerceId" TEXT NOT NULL,
    "status" "PromoStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceUrl" TEXT,
    "sourceNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceText" TEXT,
    "specificDates" TEXT,
    "provinces" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "slug" TEXT,

    CONSTRAINT "promos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_requirements" (
    "id" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "bankId" TEXT,
    "walletId" TEXT,
    "cardNetworkId" TEXT,
    "cardType" "CardType",
    "cardTier" "CardTier",
    "cardSegmentId" TEXT,
    "note" TEXT,
    "accountType" "AccountType" NOT NULL DEFAULT 'ANY',
    "paymentChannel" "PaymentChannel" NOT NULL DEFAULT 'ANY',
    "cap" DOUBLE PRECISION,
    "capPeriod" "CapPeriod",
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE_REINTEGRO',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minPurchase" DOUBLE PRECISION,
    "nxmM" INTEGER,
    "nxmN" INTEGER,
    "segment" TEXT,
    "segmentId" TEXT,
    "accountTypeId" TEXT,
    "capTarget" "CapTarget" DEFAULT 'USER',

    CONSTRAINT "promo_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_posts" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "PostType" NOT NULL,
    "body" TEXT NOT NULL,
    "commerce" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_likes" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_reports" (
    "id" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_items" (
    "id" TEXT NOT NULL,
    "type" "FinanceItemType" NOT NULL,
    "entityName" TEXT NOT NULL,
    "code" TEXT,
    "rateTNA" DOUBLE PRECISION,
    "rateTEA" DOUBLE PRECISION,
    "rateTEM" DOUBLE PRECISION,
    "rateAdjust" TEXT,
    "term" INTEGER,
    "maturityDate" TIMESTAMP(3),
    "auctionDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "notes" TEXT,
    "sourceUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_promos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_promos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_account_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_account_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_modo_codes" (
    "id" SERIAL NOT NULL,
    "bankId" TEXT NOT NULL,
    "modoCode" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_modo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BankToCardNetwork" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_BankToCardSegment" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_WalletToCardNetwork" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_token_key" ON "trusted_devices"("token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "financial_profiles_userId_key" ON "financial_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_banks_financialProfileId_bankId_key" ON "user_banks"("financialProfileId", "bankId");

-- CreateIndex
CREATE UNIQUE INDEX "user_wallets_financialProfileId_walletId_key" ON "user_wallets"("financialProfileId", "walletId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_segments_bankId_name_key" ON "bank_segments"("bankId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "banks_name_key" ON "banks"("name");

-- CreateIndex
CREATE UNIQUE INDEX "banks_slug_key" ON "banks"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "banks_bcraCode_key" ON "banks"("bcraCode");

-- CreateIndex
CREATE INDEX "banks_codigo_modo_idx" ON "banks"("codigoModo");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_name_key" ON "wallets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_slug_key" ON "wallets"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "card_networks_name_key" ON "card_networks"("name");

-- CreateIndex
CREATE UNIQUE INDEX "card_networks_slug_key" ON "card_networks"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "card_segments_cardNetworkId_cardType_name_key" ON "card_segments"("cardNetworkId", "cardType", "name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "commerces_name_key" ON "commerces"("name");

-- CreateIndex
CREATE UNIQUE INDEX "commerces_slug_key" ON "commerces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "promos_slug_key" ON "promos"("slug");

-- CreateIndex
CREATE INDEX "promos_categoryId_idx" ON "promos"("categoryId");

-- CreateIndex
CREATE INDEX "promos_commerceId_idx" ON "promos"("commerceId");

-- CreateIndex
CREATE INDEX "promos_status_idx" ON "promos"("status");

-- CreateIndex
CREATE INDEX "promos_validUntil_idx" ON "promos"("validUntil");

-- CreateIndex
CREATE INDEX "community_posts_type_idx" ON "community_posts"("type");

-- CreateIndex
CREATE INDEX "community_posts_createdAt_idx" ON "community_posts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "post_likes_postId_userId_key" ON "post_likes"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_reports_promoId_userId_key" ON "promo_reports"("promoId", "userId");

-- CreateIndex
CREATE INDEX "finance_items_type_idx" ON "finance_items"("type");

-- CreateIndex
CREATE INDEX "finance_items_active_idx" ON "finance_items"("active");

-- CreateIndex
CREATE UNIQUE INDEX "saved_promos_userId_promoId_key" ON "saved_promos"("userId", "promoId");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_name_key" ON "currencies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "financial_account_types_name_key" ON "financial_account_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bank_modo_codes_modoCode_key" ON "bank_modo_codes"("modoCode");

-- CreateIndex
CREATE INDEX "bank_modo_codes_code_idx" ON "bank_modo_codes"("modoCode");

-- CreateIndex
CREATE UNIQUE INDEX "_BankToCardNetwork_AB_unique" ON "_BankToCardNetwork"("A", "B");

-- CreateIndex
CREATE INDEX "_BankToCardNetwork_B_index" ON "_BankToCardNetwork"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_BankToCardSegment_AB_unique" ON "_BankToCardSegment"("A", "B");

-- CreateIndex
CREATE INDEX "_BankToCardSegment_B_index" ON "_BankToCardSegment"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_WalletToCardNetwork_AB_unique" ON "_WalletToCardNetwork"("A", "B");

-- CreateIndex
CREATE INDEX "_WalletToCardNetwork_B_index" ON "_WalletToCardNetwork"("B");

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_profiles" ADD CONSTRAINT "financial_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_banks" ADD CONSTRAINT "user_banks_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_banks" ADD CONSTRAINT "user_banks_financialProfileId_fkey" FOREIGN KEY ("financialProfileId") REFERENCES "financial_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_financialProfileId_fkey" FOREIGN KEY ("financialProfileId") REFERENCES "financial_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_cardNetworkId_fkey" FOREIGN KEY ("cardNetworkId") REFERENCES "card_networks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_cardSegmentId_fkey" FOREIGN KEY ("cardSegmentId") REFERENCES "card_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_financialProfileId_fkey" FOREIGN KEY ("financialProfileId") REFERENCES "financial_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "bank_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_segments" ADD CONSTRAINT "bank_segments_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_segments" ADD CONSTRAINT "card_segments_cardNetworkId_fkey" FOREIGN KEY ("cardNetworkId") REFERENCES "card_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_commerceId_fkey" FOREIGN KEY ("commerceId") REFERENCES "commerces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_requirements" ADD CONSTRAINT "promo_requirements_accountTypeId_fkey" FOREIGN KEY ("accountTypeId") REFERENCES "financial_account_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_requirements" ADD CONSTRAINT "promo_requirements_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_requirements" ADD CONSTRAINT "promo_requirements_cardNetworkId_fkey" FOREIGN KEY ("cardNetworkId") REFERENCES "card_networks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_requirements" ADD CONSTRAINT "promo_requirements_cardSegmentId_fkey" FOREIGN KEY ("cardSegmentId") REFERENCES "card_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_requirements" ADD CONSTRAINT "promo_requirements_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_requirements" ADD CONSTRAINT "promo_requirements_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "bank_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_requirements" ADD CONSTRAINT "promo_requirements_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_reports" ADD CONSTRAINT "promo_reports_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_reports" ADD CONSTRAINT "promo_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_promos" ADD CONSTRAINT "saved_promos_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_promos" ADD CONSTRAINT "saved_promos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_modo_codes" ADD CONSTRAINT "bank_modo_codes_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "_BankToCardNetwork" ADD CONSTRAINT "_BankToCardNetwork_A_fkey" FOREIGN KEY ("A") REFERENCES "banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BankToCardNetwork" ADD CONSTRAINT "_BankToCardNetwork_B_fkey" FOREIGN KEY ("B") REFERENCES "card_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BankToCardSegment" ADD CONSTRAINT "_BankToCardSegment_A_fkey" FOREIGN KEY ("A") REFERENCES "banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BankToCardSegment" ADD CONSTRAINT "_BankToCardSegment_B_fkey" FOREIGN KEY ("B") REFERENCES "card_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WalletToCardNetwork" ADD CONSTRAINT "_WalletToCardNetwork_A_fkey" FOREIGN KEY ("A") REFERENCES "card_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WalletToCardNetwork" ADD CONSTRAINT "_WalletToCardNetwork_B_fkey" FOREIGN KEY ("B") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

