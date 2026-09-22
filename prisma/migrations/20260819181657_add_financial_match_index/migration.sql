-- CreateTable
CREATE TABLE "financial_match_index" (
    "id" TEXT NOT NULL,
    "profileHash" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_match_index_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_match_index_profileHash_idx" ON "financial_match_index"("profileHash");

-- CreateIndex
CREATE INDEX "financial_match_index_promoId_idx" ON "financial_match_index"("promoId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_match_index_profileHash_promoId_key" ON "financial_match_index"("profileHash", "promoId");

-- AddForeignKey
ALTER TABLE "financial_match_index" ADD CONSTRAINT "financial_match_index_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
