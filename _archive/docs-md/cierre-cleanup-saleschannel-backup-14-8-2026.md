# Cierre — DROP `_salesChannel_backup_adr001` ejecutado

**Fecha**: 14/8/2026
**Contexto**: Ejecución de la autorización puntual en "CPO Approval — Cierre de drift previo al baseline". Única acción autorizada y ejecutada: `DROP TABLE "_salesChannel_backup_adr001"` en PROD. Nada más fue tocado.

---

## Antes de ejecutar

1. **FKs/dependientes**: 0 constraints de tipo `FOREIGN KEY` en la tabla, 0 FKs de otras tablas apuntando a ella. Sin dependientes.
2. **Counts de `salesChannel` (pre-drop)**: `UNKNOWN 35599` / `PHYSICAL 4791` / `ONLINE 588`.
3. **Filas en la tabla a borrar**: 5026 (confirmado antes del DROP).

## Comando exacto ejecutado

```sql
DROP TABLE "_salesChannel_backup_adr001";
```

Resultado: `DROP TABLE` (éxito, sin errores).

## Después de ejecutar

1. **La tabla ya no existe**: confirmado — `information_schema.tables` devuelve 0 filas para `_salesChannel_backup_adr001`.
2. **Counts de `promos.salesChannel` se mantienen**: `UNKNOWN 35599` / `PHYSICAL 4791` / `ONLINE 588` — **idénticos** a los del pre-check. El DROP no afectó los datos restaurados.
3. **Diff read-only** (`prisma migrate diff --from-url PROD --to-schema-datamodel schema.prisma --script`) corrido de nuevo.

## Drift resultante

El diff ya **no incluye** ninguna sentencia relacionada a `_salesChannel_backup_adr001` ni a `promos.source`/`externalId` — ambos puntos quedaron completamente resueltos/absorbidos. El único drift restante son exactamente las 8 operaciones de `add_user_rubro_preferences` (todavía en HOLD, sin tocar) más las 4 sentencias `DROP` de `shopping_lists`/`shopping_list_items` (esperadas, intencionalmente no incorporadas a `schema.prisma`, tal como aprobó el CPO — este diff es de solo lectura, nunca se aplica).

```sql
-- CreateEnum
CREATE TYPE "PreferenceSource" AS ENUM ('DECLARED', 'INFERRED');
CREATE TYPE "PreferenceStatus" AS ENUM ('ACTIVE', 'SUPPRESSED');

-- DropForeignKey / DropTable (shopping_lists*, esperado — no ejecutar)
ALTER TABLE "shopping_list_items" DROP CONSTRAINT "shopping_list_items_shoppingListId_fkey";
ALTER TABLE "shopping_lists" DROP CONSTRAINT "shopping_lists_userId_fkey";
DROP TABLE "shopping_list_items";
DROP TABLE "shopping_lists";

-- CreateTable home_rubros, user_rubro_preferences + índices + FKs (add_user_rubro_preferences, en HOLD)
```

Drift total: **13 → 8 operaciones**, todas correspondientes a `add_user_rubro_preferences`. `shopping_lists*` queda fuera del conteo relevante para el baseline por decisión explícita del CPO (no se agregan a `schema.prisma`), no por ausencia de drift físico.

## Estado

- `_salesChannel_backup_adr001`: eliminada. Cleanup cerrado.
- `shopping_lists`/`shopping_list_items`: intactas, sin tocar, documentadas como legacy fuera del baseline administrado por Prisma — sin cambios respecto a la decisión del CPO.
- HOLD sin cambios: no se ejecutó baseline, branch, `migrate resolve`, `migrate deploy`, `db push`, ni la aplicación de `add_user_rubro_preferences`. Único cambio ejecutado en PROD: el `DROP TABLE` puntual autorizado.
- Archivo temporal de credenciales (`env_urls.sh`) eliminado tras su uso, confirmado sin rastro vía `git status --short`.

## Siguiente paso

Queda a la espera de la autorización de la secuencia de baseline completa, según lo indicado: *"Después volvemos con el estado final de PROD y, si queda como esperamos, autorizamos la secuencia de baseline."* El estado de PROD reportado acá es exactamente el esperado.
