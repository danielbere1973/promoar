-- CreateEnum
CREATE TYPE "PreferenceSource" AS ENUM ('DECLARED', 'INFERRED');

-- CreateEnum
CREATE TYPE "PreferenceStatus" AS ENUM ('ACTIVE', 'SUPPRESSED');

-- CreateTable
CREATE TABLE "home_rubros" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_rubros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_rubro_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rubroId" TEXT NOT NULL,
    "source" "PreferenceSource" NOT NULL,
    "status" "PreferenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "suppressedAt" TIMESTAMP(3),

    CONSTRAINT "user_rubro_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_rubro_preferences_userId_status_idx" ON "user_rubro_preferences"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_rubro_preferences_userId_rubroId_source_key" ON "user_rubro_preferences"("userId", "rubroId", "source");

-- AddForeignKey
ALTER TABLE "user_rubro_preferences" ADD CONSTRAINT "user_rubro_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_rubro_preferences" ADD CONSTRAINT "user_rubro_preferences_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "home_rubros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: catálogo de rubros de referencia (RFC-008 §2.3 / lib/rubroCatalog.ts).
-- Datos de referencia requeridos por el schema funcional, no datos de demo/test.
-- Idempotente: reruns de esta migration (o reaplicación manual) no duplican filas.
INSERT INTO "home_rubros" ("id", "label") VALUES
    ('supermercados', 'Supermercados'),
    ('combustible', 'Combustible'),
    ('farmacias', 'Farmacias'),
    ('gastronomia', 'Gastronomía'),
    ('indumentaria', 'Indumentaria')
ON CONFLICT ("id") DO NOTHING;
