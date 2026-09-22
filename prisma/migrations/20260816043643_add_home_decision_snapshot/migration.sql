-- CreateTable
CREATE TABLE "home_decision_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "operationalDay" TEXT NOT NULL,
    "declaredUniverseHash" TEXT NOT NULL,
    "decisionContextHash" TEXT NOT NULL,
    "promoPoolVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_decision_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_decision_snapshots_userId_key" ON "home_decision_snapshots"("userId");

-- AddForeignKey
ALTER TABLE "home_decision_snapshots" ADD CONSTRAINT "home_decision_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
