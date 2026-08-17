/*
  Warnings:

  - Added the required column `proximityContextHash` to the `home_decision_snapshots` table without a default value. This is not possible if the table is not empty.

  CPO decisión 17/8/2026 — proximityContextHash pasa a ser columna propia,
  separada de decisionContextHash (antes plegada ahí, ver reporte de
  implementación §4). Backfill de filas existentes con el mismo sentinel que
  usa computeProximityContextHash() para "sin contexto de proximidad"
  ('no-proximity-context') — es un valor seguro: si la fila existente
  realmente tenía proximidad real, el próximo GET la va a detectar como no
  vigente (mismatch) y recalcula una sola vez; no hay forma de reconstruir el
  hash real retroactivamente porque la columna no existía antes.
*/
-- AlterTable
ALTER TABLE "home_decision_snapshots" ADD COLUMN     "proximityContextHash" TEXT NOT NULL DEFAULT 'no-proximity-context';

-- Backfill explícito (por si el DEFAULT no alcanzó a aplicar a filas ya existentes según el motor)
UPDATE "home_decision_snapshots" SET "proximityContextHash" = 'no-proximity-context' WHERE "proximityContextHash" IS NULL;

-- El DEFAULT era solo para permitir el backfill de filas existentes sin romper
-- la constraint NOT NULL; el código siempre escribe proximityContextHash
-- explícitamente en cada upsert, así que no hace falta mantener el default
-- para nuevas filas.
ALTER TABLE "home_decision_snapshots" ALTER COLUMN "proximityContextHash" DROP DEFAULT;
