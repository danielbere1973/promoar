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

-- CreateEnum
CREATE TYPE "NotifType" AS ENUM ('CATEGORY', 'COMMERCE', 'PROXIMITY', 'DIGEST');

-- CreateEnum
CREATE TYPE "LocationModel" AS ENUM ('PHYSICAL_BRANCHES', 'DISTRIBUTED_NETWORK', 'ONLINE_ONLY', 'MOBILE_SERVICE', 'NO_FIXED_LOCATION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('ONLINE', 'PHYSICAL', 'BOTH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "GeographicScope" AS ENUM ('NATIONWIDE', 'PROVINCES', 'BRANCHES', 'SERVICE_AREA', 'NO_GEOGRAPHIC_RESTRICTION', 'UNKNOWN');

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
    "lastLoginAt" TIMESTAMP(3),
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
    "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false,
    "newsletterOptInAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotifType" NOT NULL,
    "categoryId" TEXT,
    "commerceId" TEXT,
    "bankId" TEXT,
    "walletId" TEXT,
    "cardNetworkId" TEXT,
    "cardSegmentId" TEXT,
    "minDiscount" INTEGER,
    "discountFilter" TEXT NOT NULL DEFAULT 'ALL',
    "maxPerWeek" INTEGER NOT NULL DEFAULT 3,
    "sentThisWeek" INTEGER NOT NULL DEFAULT 0,
    "weekStartedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "recommendation_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recommendations" JSONB NOT NULL,
    "profileHash" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_snapshots_pkey" PRIMARY KEY ("id")
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
    "bcraCode" TEXT,
    "codigoModo" TEXT,

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
    "instagramUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultCategoryId" TEXT,
    "activePromoCount" INTEGER NOT NULL DEFAULT 0,
    "locationModel" "LocationModel" NOT NULL DEFAULT 'UNKNOWN',

    CONSTRAINT "commerces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_aliases" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "commerceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_products" (
    "id" TEXT NOT NULL,
    "commerceId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "subcategoria" TEXT,
    "productos" TEXT,
    "source" TEXT NOT NULL DEFAULT 'unicenter',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_branches" (
    "id" TEXT NOT NULL,
    "commerceId" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'OSM',
    "osmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_branches_pkey" PRIMARY KEY ("id")
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
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "maxDiscountPct" INTEGER,
    "isCSIOnly" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "source" TEXT,
    "externalId" TEXT,
    "sourceNote" TEXT,
    "commerceNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceText" TEXT,
    "specificDates" TEXT,
    "salesChannel" "SalesChannel" NOT NULL DEFAULT 'UNKNOWN',
    "geographicScope" "GeographicScope" NOT NULL DEFAULT 'UNKNOWN',
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
    "capUnlimited" BOOLEAN NOT NULL DEFAULT false,
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
CREATE TABLE "promo_usages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "amountUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_usage_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_usage_events_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "vtex_promo_cache" (
    "site" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'generic',
    "productId" TEXT,
    "productName" TEXT,
    "ean" TEXT,
    "listPrice" DOUBLE PRECISION,
    "salePrice" DOUBLE PRECISION,
    "promoCode" TEXT NOT NULL,
    "effectiveDiscount" DOUBLE PRECISION NOT NULL,
    "category" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vtex_promo_cache_pkey" PRIMARY KEY ("site","skuId","segment")
);

-- CreateTable
CREATE TABLE "promo_clicks" (
    "id" TEXT NOT NULL,
    "promoId" TEXT,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_schedules" (
    "id" TEXT NOT NULL,
    "scraperId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'manual',
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "hour" INTEGER NOT NULL DEFAULT 6,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraper_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_runs" (
    "id" TEXT NOT NULL,
    "scraperId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "found" INTEGER,
    "processed" INTEGER,
    "message" TEXT,

    CONSTRAINT "scraper_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_modo_codes" (
    "id" BIGSERIAL NOT NULL,
    "bankId" TEXT NOT NULL,
    "modoCode" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_modo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_calendar" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL DEFAULT 5,
    "pageSizeToday" INTEGER NOT NULL DEFAULT 2000,
    "pageSizeWeek" INTEGER NOT NULL DEFAULT 5000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "site_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "newsletter_log" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "sentTo" INTEGER NOT NULL,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_lists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Mi lista',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" TEXT NOT NULL,
    "shoppingListId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "_WalletToCardSegment" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_token_key" ON "trusted_devices"("token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "notification_preferences_userId_active_idx" ON "notification_preferences"("userId", "active");

-- CreateIndex
CREATE INDEX "user_events_userId_idx" ON "user_events"("userId");

-- CreateIndex
CREATE INDEX "user_events_sessionId_idx" ON "user_events"("sessionId");

-- CreateIndex
CREATE INDEX "user_events_eventType_idx" ON "user_events"("eventType");

-- CreateIndex
CREATE INDEX "user_events_createdAt_idx" ON "user_events"("createdAt");

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
CREATE UNIQUE INDEX "recommendation_snapshots_userId_key" ON "recommendation_snapshots"("userId");

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
CREATE UNIQUE INDEX "commerce_aliases_alias_key" ON "commerce_aliases"("alias");

-- CreateIndex
CREATE INDEX "commerce_products_commerceId_idx" ON "commerce_products"("commerceId");

-- CreateIndex
CREATE INDEX "commerce_products_categoria_idx" ON "commerce_products"("categoria");

-- CreateIndex
CREATE INDEX "commerce_branches_commerceId_idx" ON "commerce_branches"("commerceId");

-- CreateIndex
CREATE INDEX "commerce_branches_lat_lng_idx" ON "commerce_branches"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_branches_source_osmId_key" ON "commerce_branches"("source", "osmId");

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
CREATE INDEX "promos_status_isCSIOnly_maxDiscountPct_idx" ON "promos"("status", "isCSIOnly", "maxDiscountPct" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "promos_source_externalId_key" ON "promos"("source", "externalId");

-- CreateIndex
CREATE INDEX "promo_usages_userId_idx" ON "promo_usages"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_usages_userId_requirementId_periodStart_key" ON "promo_usages"("userId", "requirementId", "periodStart");

-- CreateIndex
CREATE INDEX "promo_usage_events_userId_createdAt_idx" ON "promo_usage_events"("userId", "createdAt");

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
CREATE INDEX "promo_clicks_promoId_idx" ON "promo_clicks"("promoId");

-- CreateIndex
CREATE INDEX "promo_clicks_createdAt_idx" ON "promo_clicks"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "scraper_schedules_scraperId_key" ON "scraper_schedules"("scraperId");

-- CreateIndex
CREATE INDEX "scraper_runs_scraperId_startedAt_idx" ON "scraper_runs"("scraperId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "bank_modo_codes_modoCode_key" ON "bank_modo_codes"("modoCode");

-- CreateIndex
CREATE INDEX "bank_modo_codes_code_idx" ON "bank_modo_codes"("modoCode");

-- CreateIndex
CREATE INDEX "promo_calendar_date_idx" ON "promo_calendar"("date");

-- CreateIndex
CREATE INDEX "shopping_lists_userId_idx" ON "shopping_lists"("userId");

-- CreateIndex
CREATE INDEX "shopping_list_items_shoppingListId_idx" ON "shopping_list_items"("shoppingListId");

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

-- CreateIndex
CREATE UNIQUE INDEX "_WalletToCardSegment_AB_unique" ON "_WalletToCardSegment"("A", "B");

-- CreateIndex
CREATE INDEX "_WalletToCardSegment_B_index" ON "_WalletToCardSegment"("B");

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_commerceId_fkey" FOREIGN KEY ("commerceId") REFERENCES "commerces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_cardNetworkId_fkey" FOREIGN KEY ("cardNetworkId") REFERENCES "card_networks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_cardSegmentId_fkey" FOREIGN KEY ("cardSegmentId") REFERENCES "bank_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_profiles" ADD CONSTRAINT "financial_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_snapshots" ADD CONSTRAINT "recommendation_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "commerces" ADD CONSTRAINT "commerces_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_aliases" ADD CONSTRAINT "commerce_aliases_commerceId_fkey" FOREIGN KEY ("commerceId") REFERENCES "commerces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_products" ADD CONSTRAINT "commerce_products_commerceId_fkey" FOREIGN KEY ("commerceId") REFERENCES "commerces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_branches" ADD CONSTRAINT "commerce_branches_commerceId_fkey" FOREIGN KEY ("commerceId") REFERENCES "commerces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "promo_usages" ADD CONSTRAINT "promo_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usages" ADD CONSTRAINT "promo_usages_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usages" ADD CONSTRAINT "promo_usages_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "promo_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usage_events" ADD CONSTRAINT "promo_usage_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usage_events" ADD CONSTRAINT "promo_usage_events_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usage_events" ADD CONSTRAINT "promo_usage_events_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "promo_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shoppingListId_fkey" FOREIGN KEY ("shoppingListId") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "_WalletToCardSegment" ADD CONSTRAINT "_WalletToCardSegment_A_fkey" FOREIGN KEY ("A") REFERENCES "card_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WalletToCardSegment" ADD CONSTRAINT "_WalletToCardSegment_B_fkey" FOREIGN KEY ("B") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

