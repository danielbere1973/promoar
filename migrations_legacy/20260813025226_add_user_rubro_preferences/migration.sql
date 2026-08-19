-- Modelo de preferencias de usuario por rubro (Home personalizada)
-- Ver propuesta-modelo-preferencias-usuario.md v2, CPO Approval 13/8/2026.
--
-- Nota de generación: este archivo se escribió a mano en vez de generarse con
-- `prisma migrate dev --create-only`, porque el entorno de ejecución no soporta modo
-- interactivo (requerido por ese comando) y porque tanto `prisma migrate diff` contra el
-- historial de migraciones como contra la base real arrastran drift preexistente no
-- relacionado (cambios de schema aplicados históricamente vía `db push` que nunca se
-- registraron como migraciones) — incluir ese ruido hubiera violado el pedido de una
-- migración limpia y revisable para este cambio puntual. El SQL de abajo es exactamente
-- el aislado a `HomeRubro` + `UserRubroPreference`, extraído a mano del diff completo
-- (que sí se generó y se revisó para confirmar que Prisma no proponía nada distinto para
-- estas dos tablas) y no toca ninguna tabla/columna existente.

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

-- Seed: HomeRubro debe tener una fila por cada entrada activa de RUBRO_CATALOG
-- (lib/rubroCatalog.ts) para que la FK de user_rubro_preferences tenga algo válido a qué
-- apuntar. Ver propuesta-modelo-preferencias-usuario.md v2 §8 e invariante de la CPO
-- Approval (todo id activo usado por RUBRO_CATALOG debe existir en HomeRubro).
INSERT INTO "home_rubros" ("id", "label", "active") VALUES
    ('supermercados', 'Supermercados', true),
    ('combustible', 'Combustible', true),
    ('farmacias', 'Farmacias', true),
    ('gastronomia', 'Gastronomía', true),
    ('indumentaria', 'Indumentaria', true)
ON CONFLICT ("id") DO NOTHING;
