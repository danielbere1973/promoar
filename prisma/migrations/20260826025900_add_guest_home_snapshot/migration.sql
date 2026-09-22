-- CreateTable
CREATE TABLE "guest_home_snapshots" (
    "id" TEXT NOT NULL,
    "regionKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "operationalDay" TEXT NOT NULL,
    "promoPoolVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_home_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_home_snapshots_regionKey_key" ON "guest_home_snapshots"("regionKey");
