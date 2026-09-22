# Recommendation Snapshot v1 — Revisión técnica (v2, corrige CPO Review)

## 1. ¿Dónde guardarías el snapshot?

Tabla Postgres nueva, misma DB (`dev-promoar`/Neon):

```prisma
model RecommendationSnapshot {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  status         String   // 'ok' | 'incomplete_profile' | 'no_location' | 'empty'
  recommendations Json    // [{ promoId, reasons }] — solo IDs + reasons, NO la promo completa
  profileHash    String   // hash de banks+wallets+cards del perfil que generó este snapshot
  catalogVersion String   // ver punto 3
  generatedAt    DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("recommendation_snapshots")
}
```

Se guardan `promoId` + `reasons`, no el objeto promo completo — la hidratación final (3 promos por
`id: { in }`, sin el `include` pesado innecesario) sigue pasando por el único camino existente de
lectura de promos, sin duplicar su forma de datos acá.

No cache en memoria/`unstable_cache`: se pierde en cada cold start serverless de Vercel y no sirve
como fuente persistente por usuario — necesitamos que sobreviva entre requests y deploys.

## 2. ¿Cómo dispararías el recálculo cuando cambia el perfil? — CORREGIDO

**Verificación pedida**: `fire-and-forget` desnudo (`promise.catch(...)` sin `await`, sin más) no tiene
garantía en Vercel. El runtime de Vercel Functions puede congelar/matar el proceso apenas se envía la
respuesta (`NextResponse.json(...)`) — no hay compromiso de que un `Promise` no esperado siga
ejecutándose después de ese punto. Confirmado además que este repo corre **Next.js 14.2.35** (no 15+):
`after()` de `next/server`, que sí resuelve esto de forma nativa, no existe en esta versión.

**Mecanismo correcto disponible en este stack**: `waitUntil()` del paquete `@vercel/functions`. Es la
API soportada explícitamente por Vercel para "trabajo después de la respuesta" en runtimes anteriores a
`after()` — le dice a la plataforma "no congelés la función todavía, hay una promesa pendiente", sin
bloquear el `Response` ya enviado al cliente. No está instalado en el proyecto hoy (`@vercel/functions`
ausente en `node_modules` y en `package.json`) — se agrega como dependencia nueva.

Uso conceptual en `app/api/perfil/route.ts`:

```text
import { waitUntil } from '@vercel/functions'
...
waitUntil(recalculateSnapshot(userId))
return NextResponse.json({ ok: true })
```

Sigue sin bloquear la respuesta (el usuario no espera el recálculo) y sin duplicar lógica financiera
— pero ahora con garantía real de que el proceso no se corta a mitad del recálculo, en vez de una
promesa "a la suerte" post-response.

Misma corrección aplica al punto 4 (refresh de un snapshot stale desde `/api/promos/recommended`):
el recálculo en background ahí también debe ir envuelto en `waitUntil()`, no en un `.catch()` suelto.

Si en algún momento se migra el proyecto a Next 15+, `after()` de `next/server` sería el reemplazo
directo y más idiomático — mismo contrato, sin dependencia externa — pero no es una opción hoy.

## 3. ¿Cómo detectarías que cambió el catálogo de promociones? — CORREGIDO

**No** distribuir el bump de `catalogVersion` manualmente en los 8 call sites que hoy llaman
`invalidatePublicPromosCache()`. Se centraliza en un único helper que reemplaza a ese, no que lo
acompaña:

```text
// lib/cache/promosCache.ts

export function invalidatePromoCatalog() {
  try {
    revalidateTag(PROMOS_PUBLIC_TAG)
  } catch (error) { ...log, no throw... }

  try {
    bumpCatalogVersion() // UPDATE SiteConfig SET value = value + 1 WHERE key = 'catalogVersion'
  } catch (error) { ...log, no throw... }
}
```

Los 8 call sites no cambian su cantidad de líneas ni agregan una segunda responsabilidad — siguen
llamando **la misma función que ya llaman hoy** (`invalidatePublicPromosCache`, renombrada a
`invalidatePromoCatalog` o mantenida como alias), que ahora internamente hace las dos cosas. Cero
puntos nuevos de divergencia: es imposible invalidar el tag y olvidarse de bumpear la versión, porque
es un solo call site interno.

**Sobre el scraper masivo**: sí, conviene bumpear una sola vez al final del run exitoso, no por cada
promo tocada. Hoy `app/api/admin/scrape/route.ts` ya es uno de los 8 call sites — revisar si llama a
`invalidatePublicPromosCache()` una vez al final del batch (patrón correcto, se mantiene igual) o
dentro de un loop por promo (habría que sacarlo del loop y dejar una sola llamada post-batch). Mismo
criterio para `auto-validate` y `cleanup`, que también procesan en lote.

El snapshot guarda el `catalogVersion` con el que fue generado. En el `GET` (punto 4), si
`snapshot.catalogVersion !== current.catalogVersion` el snapshot se considera stale — mismo criterio
que `profileHash` desactualizado.

No se recalculan todos los snapshots cuando cambia el catálogo (sería un fan-out caro e innecesario
para v1) — se recalculan de forma perezosa, solo para el usuario que efectivamente abre la Home.

## 4. ¿Cómo evitarías bloquear la Home si el snapshot quedó viejo?

`GET /api/promos/recommended` (o un nuevo `GET /api/promos/recommended-snapshot`, a decidir en
implementación) hace **stale-while-revalidate**:

1. Lee el snapshot existente (si hay) — respuesta inmediata, sin esperar recálculo.
2. Si `profileHash` o `catalogVersion` no matchean el estado actual → devuelve igual el snapshot
   stale (mejor un dato levemente viejo en <100ms que 9s de espera), y dispara el recálculo en
   background (`.catch()` silencioso, no bloquea la response).
3. Si no hay snapshot (usuario nuevo, primera vez) → único caso que corre el pipeline pesado
   sincrónico, como hoy. Esto solo pasa una vez por usuario.

La Home nunca espera un recálculo completo salvo en ese primer request de un usuario sin snapshot
previo.

## 5. ¿Qué archivos tocarías? — actualizado

- `package.json` — agregar dependencia `@vercel/functions`.
- `prisma/schema.prisma` — nuevo modelo `RecommendationSnapshot` (+ relación en `User`).
- `lib/recommendationSnapshot.ts` (nuevo) — `recalculateSnapshot(userId)`, `getOrRecalculate(userId, profileHash, catalogVersion)`. Único lugar que llama a `getPromosData` + `rankForHome` para este flujo.
- `app/api/perfil/route.ts` — `waitUntil(recalculateSnapshot(userId))` al final del `POST`, sin bloquear.
- `app/api/promos/recommended/route.ts` — reemplazar el cálculo sincrónico por lectura del snapshot + stale-while-revalidate con `waitUntil()` para el refresh en background.
- `lib/cache/promosCache.ts` — el `invalidatePublicPromosCache()` existente pasa a hacer también el bump de `catalogVersion` internamente (ver punto 3). No se tocan los 8 call sites — siguen llamando la misma función.
- `app/api/admin/scrape/route.ts` (y `auto-validate`/`cleanup` si aplica) — confirmar que la invalidación ya está fuera del loop por promo, al final del batch.

No se toca: `lib/getPromos.ts`, `lib/decisionEngine.ts`, `matchesProfile()`, `/api/promos`, filtros,
catálogo. Se reutilizan tal cual.

## 6. ¿Requiere migración? — respuesta al punto 3 del CPO Review

Las dos correcciones **no cambian la migración ni el modelo `RecommendationSnapshot`** propuestos
originalmente — siguen siendo una migración: `npx prisma db push` agregando la tabla
`recommendation_snapshots`, solo en `dev-promoar`, nunca en la DB de producción real
(`ep-fragrant-bird`).

Lo único que se agrega al alcance es una dependencia de código (`@vercel/functions`, sin impacto en
schema) y un cambio de forma —no de contrato— en `invalidatePublicPromosCache()`, que ya existe y ya
es llamada por los 8 call sites: pasa a hacer una cosa más puertas adentro, sin que ningún caller deba
cambiar su código.
