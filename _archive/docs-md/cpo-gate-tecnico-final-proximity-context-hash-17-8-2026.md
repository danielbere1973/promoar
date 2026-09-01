# Gate Técnico Final — proximityContextHash como columna propia

**Fecha**: 17/8/2026
**Autoriza**: CPO — "CPO decisión — corregir antes de commit/push"
**Gate anterior**: `cpo-gate-tecnico-final-etapa1-tus-rubros-16-8-2026.md` (16/8/2026)
**Estado**: código, schema y migration DEV listos. **Sin commit, sin push, sin merge, sin deploy a PROD** — pendiente de autorización explícita.

---

## 1. Qué pidió el CPO

> Autorizo corregir el diseño de proximityContextHash antes del commit de Etapa 1.
> Quiero una columna propia proximityContextHash en HomeDecisionSnapshot, separada de decisionContextHash.
> La hash debe representar el contexto real que utiliza la cercanía: commerceId, minDistKm, count de sucursales cercanas.
> **No inventes nuevos thresholds ni cambies la lógica de scoring. La modificación debe limitarse a mejorar la detección de invalidación/observabilidad.**

Este Gate cubre exclusivamente esa corrección. No es una re-entrega de Etapa 1 completa — el Gate del 16/8 sigue vigente para todo lo que no cambió.

---

## 2. Qué cambió respecto del Gate del 16/8

El Gate anterior describía `HomeDecisionSnapshot` con **4 llaves de vigencia**: `operationalDay`, `declaredUniverseHash`, `decisionContextHash` (con la proximidad plegada adentro), `promoPoolVersion`. Ese diseño quedó documentado en el reporte de implementación (`reporte-implementacion-etapa1-tus-rubros-16-8-2026.md`, §4 y §8) como la decisión pendiente de revisar.

Este Gate reemplaza ese punto puntual. Todo lo demás del Gate del 16/8 (declaredUniverse, resolveDeclaredUniverse, los otros 3 hashes, el resto del contrato del endpoint, el resto de Etapa 1 "Tus rubros") **no se tocó** — ver §5.

### 2.1 — proximityContextHash pasa a ser columna propia

**Antes** (16/8): `proximityContextHash` se calculaba pero se plegaba dentro del JSON canónico de `decisionContextHash` — no existía como columna independiente en `HomeDecisionSnapshot`, y su fórmula era `` `${commerceId}:${v.minDistKm}` `` (sin `count`).

**Ahora** (17/8):
- Columna propia `proximityContextHash String` en `HomeDecisionSnapshot`, con su propio backfill/migration.
- `computeDecisionContextHash` ya **no** recibe ni usa `proximityContextHash` — su input type y su JSON canónico lo eliminaron por completo.
- `computeProximityContextHash` pasó de función privada a exportada, y su fórmula canónica ahora es:
  ```ts
  `${commerceId}:${v.minDistKm}:${v.count}`
  ```
  (agrega `count`, antes ausente).
- El check `vigente` en `GET` pasó de 4 a **5 términos AND** (se agregó `snapshot.proximityContextHash === proximityContextHash`).
- El `upsert` (`create` y `update`) escribe `proximityContextHash` como campo propio en ambos branches.

### 2.2 — Por qué (justificación de cada pieza, contra el pedido explícito)

| Pedido del CPO | Cómo se cumplió |
|---|---|
| "columna propia... separada de decisionContextHash" | Columna nueva en el modelo; `decisionContextHash` ya no incluye proximidad en su cálculo ni en su input type — separación real, no solo nominal. |
| "commerceId, minDistKm, count" | Los 3 están en la fórmula canónica: `commerceId` es la key del map, `minDistKm` y `count` van en el string por entrada. |
| "no inventes thresholds ni cambies scoring" | No se tocó `lib/decisionEngineV2.ts` (scoring), ni `nearbyBranches.ts` (cómo se calculan `count`/`minDistKm`), ni ningún radio/threshold de distancia. Solo se cambió qué se **hashea** de un dato que ya existía, para observabilidad/invalidación. |
| "mejorar detección de invalidación/observabilidad" | Antes un cambio en `count` (ej. abre una sucursal nueva cerca, o cierra una) sin que cambie `minDistKm` de la más cercana **no invalidaba** el snapshot — quedaba servido un dato stale del contexto de cercanía. Ahora sí invalida. Además, tener la columna separada permite debuggear cuál de los 5 hashes causó una invalidación sin tener que deserializar el JSON compuesto de `decisionContextHash`. |

---

## 3. Secuencia de trabajo ejecutada (los 6 pasos pedidos)

1. **Schema + migration** — ✅. Ver §4.
2. **Cálculo y comparación de vigencia** — ✅. `computeProximityContextHash` actualizado (agrega `count`), `computeDecisionContextHash` ya no la incluye, `vigente` pasó a 5 términos.
3. **Tests con los 6 casos explícitos** — ✅. Ver §6 (todos con nombre verbatim del pedido).
4. **Suite completa** — ✅. Ver §7.
5. **Build** — ✅. Ver §7.
6. **Diff completo + SQL de la migration** — ✅. Ver §8.

---

## 4. Schema + migration

### 4.1 — Diff de `prisma/schema.prisma` (solo el fragmento tocado esta sesión)

```diff
 model HomeDecisionSnapshot {
   id                    String   @id @default(cuid())
   userId                String   @unique
   payload               Json
   operationalDay        String
   declaredUniverseHash  String // hash determinístico del conjunto de rubros DECLARED/ACTIVE — observabilidad
-  decisionContextHash   String // hash determinístico de perfil financiero + favoritos + PersonaPreferences + proximidad
+  decisionContextHash   String // hash determinístico de perfil financiero + favoritos + PersonaPreferences (no incluye proximidad — ver proximityContextHash)
+  proximityContextHash  String // hash determinístico de nearbyByCommerceId (commerceId + minDistKm + count por comercio) — CPO decisión 17/8/2026: columna propia para observabilidad/debug de invalidación por cercanía, separada de decisionContextHash
   promoPoolVersion      String
   generatedAt           DateTime @default(now())
   updatedAt             DateTime @updatedAt
   user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

   @@map("home_decision_snapshots")
 }
```

Comentario de cabecera del modelo actualizado: "4 llaves" → "5 llaves (4 hashes + operationalDay)".

### 4.2 — SQL de la migration

Archivo: `prisma/migrations/20260817045332_add_proximity_context_hash_column/migration.sql`

```sql
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
```

**Por qué el DEFAULT temporal**: la tabla tenía 1 fila al momento de generar la migration (`prisma migrate dev --create-only` la bloqueó con ese motivo exacto). Patrón estándar: agregar la columna con un DEFAULT que permite el backfill, `UPDATE` explícito, y `DROP DEFAULT` porque el código de aplicación siempre escribe el campo en cada `upsert` — no hace falta sostener el default para filas futuras.

**Aplicación**: `npx prisma migrate dev` (sin flags) contra DEV (`ep-cool-lake-ammkwaug-pooler`, Neon). Confirmado sin drift:

```
$ npx prisma migrate status
5 migrations found in prisma/migrations
Database schema is up to date!
```

**PROD no fue tocado** — ninguna conexión ni comando corrió contra el connection string de PROD en esta sesión.

---

## 5. Confirmación de alcance — qué NO se modificó

`git status --porcelain` al momento de este Gate:

```
 M app/api/promos/home-decision/route.test.ts
 M app/api/promos/home-decision/route.ts
 M app/perfil/page.tsx
 M lib/decisionEngineV2.test.ts
 M lib/decisionEngineV2.ts
 M lib/rubroPreferences.test.ts
 M lib/rubroPreferences.ts
 M prisma/schema.prisma
?? app/api/perfil/rubros/
?? app/components/perfil/
?? cpo-gate-tecnico-final-etapa1-tus-rubros-16-8-2026.md
?? definicion-tus-rubros-ux-16-8-2026.md
?? prisma/migrations/20260816043643_add_home_decision_snapshot/
?? prisma/migrations/20260817045332_add_proximity_context_hash_column/
?? propuesta-tecnica-etapa1-tus-rubros-15-8-2026.md
?? reporte-implementacion-etapa1-tus-rubros-16-8-2026.md
```

De esta lista, **lo único tocado en esta sesión** (post-Gate del 16/8) es:

- `app/api/promos/home-decision/route.ts`
- `app/api/promos/home-decision/route.test.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260817045332_add_proximity_context_hash_column/` (carpeta nueva)

`app/perfil/page.tsx`, `lib/decisionEngineV2.ts`/`.test.ts`, `lib/rubroPreferences.ts`/`.test.ts`, `app/api/perfil/rubros/`, `app/components/perfil/`, la migration `20260816043643_...`, y los 4 documentos `.md` de Etapa 1 son **trabajo preexistente de la sesión del 16/8**, ya cubierto y explicado por el Gate anterior — no fueron tocados por esta corrección.

**No se modificó**: `lib/decisionEngineV2.ts` (scoring), `lib/nearbyBranches.ts` (cálculo de distancia/count), ni ningún threshold de radio/distancia en ningún archivo.

---

## 6. Tests — los 6 casos pedidos explícitamente

Todos agregados en `app/api/promos/home-decision/route.test.ts`, nombrados verbatim contra el pedido del CPO:

| # | Caso pedido | Test | Tipo |
|---|---|---|---|
| 1 | mismo contexto → mismo hash | `computeProximityContextHash > mismo contexto → mismo hash` | unitario |
| 2 | cambia minDistKm → invalida | `computeProximityContextHash > cambia minDistKm → invalida (hash distinto)` | unitario |
| 3 | cambia count → invalida | `computeProximityContextHash > cambia count → invalida (hash distinto), aunque minDistKm sea igual` | unitario |
| 4 | cambia solo el origen GPS pero el contexto efectivo es igual → no invalida | `GET ... > cambia solo el origen GPS pero el contexto efectivo (nearbyByCommerceId) es igual → no invalida` | integración (endpoint) |
| 5 | null/sin proximidad → contexto determinístico | `computeProximityContextHash > null/sin proximidad → contexto determinístico (mismo sentinel siempre)` | unitario |
| 6 | transición sin proximidad → proximidad real → invalida | `GET ... > transición sin proximidad → proximidad real → invalida` | integración (endpoint) |

Casos 4 y 6 verifican contra el endpoint completo (mockeando `getNearbyBranchesByCommerce` con `nearbyImpl` controlable por test), no solo la función pura — confirman que el `upsert` real se dispara o no según corresponda.

---

## 7. Suite completa y build

```
$ npx vitest run
...
Test Files  ... passed
     Tests  86 passed (86)
```

Archivo específico re-confirmado en este turno:

```
$ npx vitest run app/api/promos/home-decision/route.test.ts
 Test Files  1 passed (1)
      Tests  14 passed (14)
```

```
$ npm run build
...
exit code 0
```

Sin regresiones. Se verificó previamente que no había un dev server activo reteniendo el lock del engine de Prisma en Windows (`netstat -ano` sobre puertos 3000/3001) antes de correr el build — no fue necesario ningún workaround.

---

## 8. Diffs completos

### 8.1 — `prisma/schema.prisma`

Ver §4.1 (diff acotado al fragmento del modelo `HomeDecisionSnapshot`).

### 8.2 — `app/api/promos/home-decision/route.ts` (cambios de esta sesión)

```diff
- * 4 llaves de vigencia independientes: operationalDay, declaredUniverseHash,
- * decisionContextHash, promoPoolVersion.
+ * 5 llaves de vigencia independientes: operationalDay, declaredUniverseHash,
+ * decisionContextHash, proximityContextHash, promoPoolVersion.
+ * (ajustado por CPO decisión 17/8/2026 — proximityContextHash pasa a ser
+ * columna propia, separada de decisionContextHash)
```

```diff
-function computeProximityContextHash(nearbyByCommerceId: NearbyMap): string {
+// CPO decisión 17/8/2026: incluye count además de minDistKm — un cambio en la
+// cantidad de sucursales cercanas (sin que la más cercana cambie) es un cambio
+// relevante en el contexto de cercanía y antes no invalidaba el snapshot.
+export function computeProximityContextHash(nearbyByCommerceId: NearbyMap): string {
   const entries = Object.entries(nearbyByCommerceId)
   if (entries.length === 0) return 'no-proximity-context'
   const canonical = entries
-    .map(([commerceId, v]) => `${commerceId}:${v.minDistKm}`)
+    .map(([commerceId, v]) => `${commerceId}:${v.minDistKm}:${v.count}`)
     .sort()
     .join('|')
   return sha256(canonical)
 }
```

```diff
 function computeDecisionContextHash(input: {
   effectiveCards: { bankId?: string | null; walletId?: string | null; cardNetworkId?: string | null; cardSegmentId?: string | null }[] | null
   favoritedPromoIds: string[]
   declaredCategorySlugs: string[] | undefined
-  proximityContextHash: string
 }): string {
   const canonical = JSON.stringify({
     cards: [...(input.effectiveCards ?? [])]
       .map(c => `${c.bankId ?? ''}:${c.walletId ?? ''}:${c.cardNetworkId ?? ''}:${c.cardSegmentId ?? ''}`)
       .sort(),
     favorites: [...input.favoritedPromoIds].sort(),
     afinidad: [...(input.declaredCategorySlugs ?? [])].sort(),
-    proximity: input.proximityContextHash,
   })
   return sha256(canonical)
 }
```

```diff
   const decisionContextHash = computeDecisionContextHash({
     effectiveCards,
     favoritedPromoIds,
     declaredCategorySlugs,
-    proximityContextHash,
   })
```

```diff
   const vigente =
     !!snapshot &&
     snapshot.operationalDay === operationalDay &&
     snapshot.declaredUniverseHash === declaredUniverseHash &&
     snapshot.decisionContextHash === decisionContextHash &&
+    snapshot.proximityContextHash === proximityContextHash &&
     snapshot.promoPoolVersion === promoPoolVersion
```

```diff
   await prisma.homeDecisionSnapshot.upsert({
     where: { userId: user.id },
     create: {
       userId: user.id,
       payload: payload as any,
       operationalDay,
       declaredUniverseHash,
       decisionContextHash,
+      proximityContextHash,
       promoPoolVersion,
     },
     update: {
       payload: payload as any,
       operationalDay,
       declaredUniverseHash,
       decisionContextHash,
+      proximityContextHash,
       promoPoolVersion,
       generatedAt: new Date(),
     },
   })
```

### 8.3 — `app/api/promos/home-decision/route.test.ts` (cambios de esta sesión)

```diff
 import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { computeProximityContextHash } from './route'
```

```diff
+let nearbyImpl: () => Promise<Record<string, { count: number; minDistKm: number }>> = async () => ({})
+
 vi.mock('@/lib/nearbyBranches', () => ({
-  getNearbyBranchesByCommerce: async () => ({}),
+  getNearbyBranchesByCommerce: (...args: any[]) => nearbyImpl(),
 }))
```

```diff
 beforeEach(async () => {
   ...
+  nearbyImpl = async () => ({})
   ...
 })
```

Más los 2 nuevos `describe` blocks completos (`computeProximityContextHash` — 4 tests unitarios; `GET ... — invalidación por proximidad` — 2 tests de integración), contenido íntegro en §6.

*(El diff crudo de `git diff` sobre este archivo también incluye trabajo de la sesión del 16/8 — la reescritura de mocks de Prisma para `HomeDecisionSnapshot` — porque el archivo es nuevo en esta rama. Lo de arriba es el delta real agregado en esta sesión.)*

---

## 9. Riesgos / notas para quien revise antes de autorizar commit

- **Backfill sentinel**: la única fila existente en DEV al momento de la migration quedó con `proximityContextHash = 'no-proximity-context'`. Si esa fila realmente tenía proximidad real calculada, el próximo `GET` la va a detectar como no-vigente (mismatch en esa llave) y va a recalcular una vez — comportamiento esperado, no requiere acción manual.
- **PROD**: esta migration todavía no se aplicó a PROD. Cuando se autorice el commit/push/merge, aplicar la misma migration ahí (mismo patrón: no hay atajos, es la migration ya generada).
- Nada de esto cambia el contrato HTTP del endpoint (`HomeDecisionPayload` no tiene nuevos campos) — es puramente interno a la capa de cache/invalidación.

---

## 10. Qué falta para poder commitear

Pendiente de autorización explícita del CPO para: `git add` + commit de los 4 paths de §5, push, y (más adelante) aplicar la migration a PROD. No se ejecutó ninguna de estas acciones.
