-- Restores legacy salesChannel values (FISICA/ONLINE) lost when
-- 20260725175450_add_promo_coverage_model dropped and recreated the
-- "salesChannel" column as an enum without a USING cast.
--
-- Depends on a manual, out-of-band snapshot table "_salesChannel_backup_adr001"
-- (id, legacy_value) created against production BEFORE this migration runs,
-- via: CREATE TABLE "_salesChannel_backup_adr001" AS
--        SELECT id, "salesChannel" AS legacy_value FROM promos WHERE "salesChannel" IS NOT NULL;
--
-- No-op everywhere the backup table doesn't exist (dev, other environments
-- where ADR-001 already ran without a snapshot) — safe to apply anywhere.
--
-- Intentionally does NOT drop "_salesChannel_backup_adr001" — kept around
-- temporarily for post-migration validation, dropped later as a separate,
-- explicit operation once counts are confirmed correct.

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables WHERE table_name = '_salesChannel_backup_adr001'
  ) THEN
    UPDATE "promos" p
    SET "salesChannel" = CASE b.legacy_value
      WHEN 'FISICA' THEN 'PHYSICAL'::"SalesChannel"
      WHEN 'ONLINE' THEN 'ONLINE'::"SalesChannel"
      ELSE 'UNKNOWN'::"SalesChannel"
    END
    FROM "_salesChannel_backup_adr001" b
    WHERE p.id = b.id;
  END IF;
END $$;
