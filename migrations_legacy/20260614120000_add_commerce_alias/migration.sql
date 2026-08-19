-- CreateTable
CREATE TABLE "commerce_aliases" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "commerceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commerce_aliases_alias_key" ON "commerce_aliases"("alias");

-- AddForeignKey
ALTER TABLE "commerce_aliases" ADD CONSTRAINT "commerce_aliases_commerceId_fkey" FOREIGN KEY ("commerceId") REFERENCES "commerces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
