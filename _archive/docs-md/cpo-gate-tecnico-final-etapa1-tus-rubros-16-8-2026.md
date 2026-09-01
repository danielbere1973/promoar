# CPO Gate Técnico Final — Etapa 1 "Tus rubros"

**Fecha**: 16/8/2026
**Alcance de este documento**: exclusivamente inspección y reporte. **No se hizo commit, push, merge, migrate deploy ni ningún cambio de código o DB durante esta auditoría.**
**Rama auditada**: `feature/decision-engine-v2-backend`
**Baseline correcto de comparación**: `origin/main` (ver §0 — importante, no es lo mismo que el `main` local)

---

## 0. Nota previa obligatoria — estado real de `main`

Antes de leer el resto del Gate, una aclaración que cambia cómo interpretar "qué está pusheado":

- El `main` local de este repo está desactualizado (`af51c7b`).
- `origin/main` en GitHub (`46914d6`) es un **merge commit de la PR #13**, cuyo segundo padre es exactamente el HEAD actual de esta rama (`f150738`).
- Es decir: **los 7 commits de infraestructura previos a "Tus rubros"** (Decision Engine v2 core, endpoint `home-decision`, RFC-008, el cierre de la brecha de impersonación) **ya están mergeados en `origin/main`**. Esto pasó por fuera de esta sesión — antes de que empezara esta auditoría de solo lectura — y no involucra la implementación de "Tus rubros".
- **La implementación de "Tus rubros" en sí (Etapa 1) sigue 100% sin commitear.** Es exactamente el `git status` de más abajo: 8 archivos modificados + 6 rutas nuevas, todo en working tree local, nada en el índice, nada en el historial de commits.

Esta distinción importa para el punto 7 del pedido — "confirmá que no existe ningún commit/push nuevo de esta implementación" se responde correctamente como: **cierto para Etapa 1**; **no aplica** a los 7 commits previos, que son trabajo ya aprobado y mergeado en una etapa anterior, ajeno a esta auditoría.

Evidencia:
```
git rev-parse main            → af51c7be5888c1c1ff5e8a227b91df8a23bdb57d
git rev-parse origin/main     → 46914d61a13203ca7051ea4ac9f778c2c6e31cdb
git log -1 --format="%H %P" 46914d6
  → 46914d61... af51c7be... f150738854f910f24b0112bc67390b6ed430b19e
git rev-parse HEAD                                      → f150738...
git rev-parse origin/feature/decision-engine-v2-backend → f150738...  (idéntico — la rama está 100% pusheada)
```

---

## 1. Git diff completo — auditoría archivo por archivo

`git status --porcelain=v1` (estado actual, sin cambios durante esta sesión):

```
Changes not staged for commit:
  modified:   app/api/promos/home-decision/route.test.ts
  modified:   app/api/promos/home-decision/route.ts
  modified:   app/perfil/page.tsx
  modified:   lib/decisionEngineV2.test.ts
  modified:   lib/decisionEngineV2.ts
  modified:   lib/rubroPreferences.test.ts
  modified:   lib/rubroPreferences.ts
  modified:   prisma/schema.prisma
Untracked files:
  app/api/perfil/rubros/
  app/components/perfil/
  definicion-tus-rubros-ux-16-8-2026.md
  prisma/migrations/20260816043643_add_home_decision_snapshot/
  propuesta-tecnica-etapa1-tus-rubros-15-8-2026.md
  reporte-implementacion-etapa1-tus-rubros-16-8-2026.md
```

`git diff --cached --stat` → **vacío**. Nada está en el índice de staging.

Diff real (`origin/main` como baseline, no el `main` local stale):

| Archivo | Líneas | Veredicto |
|---|---|---|
| `prisma/schema.prisma` | +20 / −0 | Aditivo puro — 1 relación en `User` + modelo `HomeDecisionSnapshot` completo. Sin tocar ningún modelo existente. |
| `lib/decisionEngineV2.ts` | +33 / −48 (neto −15) | Elimina `pickFallbackRubro` y `DEFAULT_RUBRO_SELECTION` por completo, agrega `selectTopRubroSlots`. |
| `lib/rubroPreferences.ts` | ~25 líneas netas | Elimina `selectRubrosForHome` (fallback+fill), agrega `resolveDeclaredUniverse` (función pura, sin fallback). |
| `app/perfil/page.tsx` | +11 / −6 | Únicamente agrega la 5ª pestaña "Rubros": union type, restore de URL param, import de `RubrosTab`, 1 branch de render nuevo. Cero cambios en el contenido de las otras 4 pestañas. |
| `app/api/promos/home-decision/route.ts` | ~319 líneas de diff (reescritura sustancial) | Agrega: hashing (`sha256`, 4 funciones `compute*`), `currentOperationalDay`, `currentPromoPoolVersion`, `getEffectiveCards`, resolución de `HomeDecisionSnapshot` (cache read/upsert), y refactor a `buildPayloadForUser` para compartir lógica entre el path cacheado (con `userId`) y el path guest (sin cache). Ver §4 para el detalle funcional. |
| `lib/decisionEngineV2.test.ts` | 168 líneas cambiadas | Suite actualizada al nuevo contrato de `selectTopRubroSlots` (scoring top-N, no fallback). |
| `lib/rubroPreferences.test.ts` | 127 líneas cambiadas | Suite reescrita para `resolveDeclaredUniverse`: se eliminan los tests de fallback/fill-hasta-N (ya no existen en el código), se agregan tests de universo sin cap, dedup, exclusión de inactivos — ver extracto abajo. |
| `app/api/promos/home-decision/route.test.ts` | 93 líneas cambiadas | Cobertura del nuevo cache (hit/miss/invalidación por cada una de las 4 llaves). |
| `app/api/perfil/rubros/` (nuevo) | `route.ts` + `route.test.ts` | GET/PUT de preferencias declaradas por usuario. |
| `app/components/perfil/` (nuevo) | `RubrosTab.tsx` | UI de la pestaña. Contiene el comentario explícito de scope (ver §6). |
| `prisma/migrations/20260816043643_add_home_decision_snapshot/` (nuevo) | `migration.sql` | Única migración nueva — coincide exactamente con el modelo del schema. |
| `definicion-tus-rubros-ux-16-8-2026.md`, `propuesta-tecnica-etapa1-tus-rubros-15-8-2026.md`, `reporte-implementacion-etapa1-tus-rubros-16-8-2026.md` | — | Documentación de producto/spec, no código. |

**Confirmación clave sobre `lib/getPromos.ts`**: este archivo apareció en un diff preliminar contra el `main` local (stale) con cambios grandes. **No forma parte del diff de Etapa 1.** `git status` actual no lo lista como modificado — sus cambios (`forceProfileMatching` opt-in) pertenecen al commit `b1495a1`, ya mergeado en `origin/main` antes de esta auditoría. Mencionarlo acá para que no se confunda con trabajo pendiente de Etapa 1.

### Extracto — migración del test suite de `rubroPreferences` (evidencia de intencionalidad, no accidente)

```diff
-  it('usuario sin preferencias mantiene los 5 defaults actuales (orden de catálogo)', () => {
-    const selection = selectRubrosForHome([], ALL_ACTIVE)
-    expect(selection).toHaveLength(HOME_RUBRO_COUNT)
+  it('usuario sin preferencias devuelve universo vacío — sin fallback al catálogo', () => {
+    const universe = resolveDeclaredUniverse([], ALL_ACTIVE)
+    expect(universe).toEqual([])
   })
...
-  it('más de N declaradas trunca a N respetando orden de catálogo', () => {
+  it('más de N (8) declaradas no truncan — resolveDeclaredUniverse no aplica HOME_RUBRO_COUNT', () => {
```

Confirma en código ejecutable (no solo en comentarios) que el viejo mecanismo de fallback-a-catálogo-externo y relleno hasta N fue removido a propósito, con tests que ahora afirman explícitamente el comportamiento contrario.

---

## 2. Clasificación explícita: nuevo / modificado / fuera de alcance

**Nuevos** (6 rutas): `app/api/perfil/rubros/*`, `app/components/perfil/RubrosTab.tsx`, la migración `20260816043643_add_home_decision_snapshot`, y 3 documentos `.md` de spec/reporte.

**Modificados** (8 archivos): `prisma/schema.prisma`, `lib/decisionEngineV2.ts` (+test), `lib/rubroPreferences.ts` (+test), `app/api/promos/home-decision/route.ts` (+test), `app/perfil/page.tsx`.

**Explícitamente fuera de alcance — confirmado NO tocado**:
- Bloque B / "También te podría interesar" (Etapa 2) — no existe en ningún archivo de esta rama.
- Afinidad / oportunidad excepcional / writer INFERRED — no implementados (el campo `declaredCategorySlugs` en `computeDecisionContextHash` siempre se pasa `undefined` desde `route.ts`, ver §4).
- Favoritos/estrellas de rubros — no implementados.
- Cualquier pestaña de `/perfil` distinta de "Rubros" — diff confirma cero líneas tocadas fuera de la agregación de la 5ª pestaña (ver tabla §1).
- Home v2 visual completa — no tocada.

---

## 3. Tests y build

**Tests**: `npx vitest run` fresco → **11 test files, 80/80 tests passed** (920ms).

**Build de producción**: se encontró un bloqueo real durante esta auditoría — un proceso `node.exe` (PID 39928) del dev server local tenía tomado el `.dll` del query engine de Prisma (`EPERM` al regenerar), y ese engine binario en disco tenía fecha anterior al último cambio de schema (adición de `HomeDecisionSnapshot`). Confiar en ese build habría sido no confiable para esta auditoría específica, así que se pidió autorización antes de cerrar el proceso — autorizado explícitamente por el usuario. Se cerró el proceso (ya había terminado por su cuenta al momento del kill, no se interrumpió nada en curso), se regeneró Prisma limpio, y **`npm run build` completó exitosamente** contra el schema actual.

**Typecheck**: `npx tsc --noEmit` — sin errores nuevos. Los únicos errores presentes son preexistentes en `scripts/*.ts` (utilidades de mantenimiento fuera del build de Next.js: `find-mixed-commerce.ts`, `migrate-to-neon.ts`, etc. — todos por falta de `downlevelIteration`/tipos de `pg`, nada relacionado con Etapa 1).

**Migraciones DEV**: `npx prisma migrate status` → **"Database schema is up to date!"** (4 migraciones encontradas, incluida la nueva de `HomeDecisionSnapshot`). Sin drift.

---

## 4. `HomeDecisionSnapshot` / hashing / invalidación mid-day

### Las 4 llaves persistidas

```prisma
model HomeDecisionSnapshot {
  id                   String   @id @default(cuid())
  userId               String   @unique
  payload              Json
  operationalDay       String
  declaredUniverseHash String
  decisionContextHash  String
  promoPoolVersion     String
  generatedAt          DateTime @default(now())
  updatedAt            DateTime @updatedAt
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("home_decision_snapshots")
}
```

Chequeo de vigencia (`route.ts`, único punto de verdad):

```ts
const vigente =
  !!snapshot &&
  snapshot.operationalDay === operationalDay &&
  snapshot.declaredUniverseHash === declaredUniverseHash &&
  snapshot.decisionContextHash === decisionContextHash &&
  snapshot.promoPoolVersion === promoPoolVersion
```

Es una comparación **AND de las 4** — si cualquiera cambió, se recalcula. No hay TTL por tiempo: la única causa de invalidación es que uno de estos 4 valores, recalculado en el momento del request, difiera del guardado.

### Triggers de invalidación mid-day (todos los que existen, con su mecanismo exacto)

| # | Trigger | Vía qué llave | Cómo se dispara |
|---|---|---|---|
| 1 | Cambia el día operativo (rollover 00:00 ART) | `operationalDay` | `currentOperationalDay()` usa `Date.now() - 3h` (offset fijo a ART) truncado a `YYYY-MM-DD`. Al cruzar medianoche ART, el string cambia y cualquier request posterior recalcula. |
| 2 | Usuario declara/quita rubros en "Tus rubros" | `declaredUniverseHash` | Hash de `rubroId:updatedAt` (ordenado) sobre filas `UserRubroPreference` DECLARED/ACTIVE. Cualquier alta, baja o reactivación cambia al menos un `updatedAt`, cambia el hash. Confirmado empíricamente en DEV: PUT de 3→2 rubros cambió `declaredUniverseHash` (`4739...`→`d71a...`) dejando las otras 3 llaves intactas. |
| 3 | Cambia el perfil financiero efectivo (tarjetas/bancos/wallets) | `decisionContextHash` | `getEffectiveCards()` lee `FinancialProfile.{cards,banks,wallets}` en cada request y los serializa como parte del hash. |
| 4 | Usuario guarda/quita un favorito (`SavedPromo`) | `decisionContextHash` | `favoritedPromoIds` (ordenado) es otro input del mismo hash. |
| 5 | Cambia el contexto de proximidad (ubicación / sucursales cercanas) | `decisionContextHash` (vía `proximityContextHash` plegado adentro — ver §5) | `computeProximityContextHash` sobre `nearbyByCommerceId`. |
| 6 | Cambia el pool de promos activas cubiertas por `RUBRO_CATALOG` (alta, baja, o edición de una promo existente) | `promoPoolVersion` | `MAX(updatedAt)` + `COUNT` sobre promos `ACTIVE` en las categorías del catálogo. Cualquier upsert del scraper que toque una de esas promos avanza el `MAX(updatedAt)`, o el `COUNT` si se crea/expira una. |

**No hay ningún trigger adicional** — no hay invalidación manual, no hay webhook, no hay TTL. Los 6 triggers de la tabla son el universo completo de causas de recálculo, derivados directamente de las 4 comparaciones del `vigente`.

**Caso confirmado funcionalmente en DEV** (no solo por lectura de código): PUT de rubros declarados 3→2, seguido de GET a `home-decision`, seguido de inspección directa vía Prisma de la fila `HomeDecisionSnapshot` — misma fila (`id` sin cambiar, upsert correcto, no duplicó filas), `declaredUniverseHash` cambió, las otras 3 llaves se mantuvieron estables porque nada más cambió, `updatedAt` avanzó.

---

## 5. `proximityContextHash` — qué información queda representada y qué se pierde

**Sin cambios de código en esta sección — solo lectura y análisis, como se pidió explícitamente.**

### Dónde vive hoy

No es una columna independiente de `HomeDecisionSnapshot`. Se calcula como string intermedio y se pliega como uno de los 4 inputs de `decisionContextHash`:

```ts
function computeProximityContextHash(nearbyByCommerceId: NearbyMap): string {
  const entries = Object.entries(nearbyByCommerceId)
  if (entries.length === 0) return 'no-proximity-context'
  const canonical = entries
    .map(([commerceId, v]) => `${commerceId}:${v.minDistKm}`)
    .sort()
    .join('|')
  return sha256(canonical)
}

function computeDecisionContextHash(input: {
  effectiveCards: ...
  favoritedPromoIds: string[]
  proximityContextHash: string   // ← se pliega acá
  declaredCategorySlugs: string[] | undefined
}): string {
  const canonical = JSON.stringify({
    cards: [...],
    favorites: [...],
    proximity: input.proximityContextHash,
    afinidad: [...],
  })
  return sha256(canonical)
}
```

### Qué información entra al hash

Por cada comercio con sucursales dentro del radio (`NEARBY_RADIUS_KM = 5`): **únicamente `commerceId` + `minDistKm`** (la distancia mínima a la sucursal más cercana de ese comercio). Eso, ordenado y concatenado, es todo lo que representa la proximidad real del usuario en ese momento.

### Pérdida de información confirmada — concreta, no hipotética

`NearbyMap` (tipo real, definido en `decisionEngineV2.ts`) trae, por comercio, más de un campo — incluye también un `count` de sucursales dentro del radio. **`computeProximityContextHash` solo lee `minDistKm`, nunca `count`.**

Consecuencia directa y verificable: si el número de sucursales cercanas de un comercio cambia (ej. una sucursal nueva abre a 2km cuando ya había una a 1km — la mínima no cambia, pero pasaron de 1 a 2 sucursales cercanas) **el hash no cambia**, porque `minDistKm` sigue siendo el mismo. El snapshot cacheado se sigue sirviendo como vigente aunque el contexto real de proximidad haya cambiado.

Es una pérdida de información real, no un caso de borde teórico: cualquier cambio en `CommerceBranch` (altas/bajas de sucursales, ver punto 10 del roadmap del proyecto) que no mueva la distancia mínima existente pasa desapercibido para la invalidación, incluso aunque ese cambio sea relevante para lo que el usuario debería ver (ej. un badge de "N sucursales cerca" en la UI, si en algún momento se usa `count` para eso, quedaría desincronizado del caché).

**Alcance de este hallazgo**: es información que el hash *no representa*, no un bug de invalidación al revés — nunca invalida de más, solo puede fallar en invalidar cuando debería. El riesgo es de **staleness silencioso**, no de recomputo innecesario.

---

## 6. Confirmación — sin dependencia de Etapa 2, sin cambios visuales fuera de "Tus rubros"

Evidencia de código, no solo inferencia — comentario explícito en el propio componente:

```tsx
// app/components/perfil/RubrosTab.tsx
// Tab "Tus rubros" — CPO Approval "Tus rubros" Etapa 1 (16/8/2026), punto 8.
// UI de Bloque A únicamente (definicion-tus-rubros-ux-16-8-2026.md §3, §6, §7):
// selección libre 0..universo activo, sin recomendación de cantidad, sin fill
// automático, guardado explícito con diff. Bloque B ("También te podría
// interesar") es producto no autorizado todavía — no se implementa acá.
```

Búsqueda de texto (`Bloque B`, `también te podría interesar`, `oportunidad excepcional`, `INFERRED`) en el árbol de la rama no encuentra ninguna implementación — solo este comentario de scope, deliberadamente negativo.

Confirmado además por el diff de `app/perfil/page.tsx` (§1): la única modificación es agregar la 5ª pestaña; cero líneas tocadas en el contenido de Personal/Financiero/Historial/Alertas.

---

## 7. PROD no tocado / sin commit ni push de Etapa 1

- `git diff --cached --stat` → vacío. Nada fue agregado al índice durante esta auditoría.
- `git reflog -5` → las 5 entradas más recientes son commits preexistentes (`f150738`, `624b8cb`, `9ef68c5`, `b1495a1`, `203be54`). **No se creó ningún commit durante esta sesión.**
- La migración `20260816043643_add_home_decision_snapshot` se aplicó únicamente contra la base de DEV (`ep-cool-lake-ammkwaug-pooler...neon.tech`, database `neondb`). No hay ningún registro de que se haya corrido `migrate deploy` contra PROD.
- Repitiendo la nota del §0 para que quede inequívoco: los 7 commits ya en `origin/main` son trabajo de infraestructura previo a Etapa 1, aprobado y mergeado antes de que empezara esta auditoría — no son parte de lo que este Gate está evaluando, y no contradicen la afirmación de que Etapa 1 en sí sigue sin commitear.

---

## 8. Recomendación técnica — `proximityContextHash`: columna propia vs. absorbido

### Opción A — mantener absorbido en `decisionContextHash` (estado actual)

- **Costo de cambio**: cero, ya está así.
- **Observabilidad**: baja. Para saber si un recálculo fue causado por proximidad vs. tarjetas vs. favoritos hay que decodificar manualmente el JSON canónico y comparar contra un valor anterior — no hay forma de consultarlo en una fila de `HomeDecisionSnapshot` sin recomputar el hash fuera de banda.
- **Debugging**: para responder "¿por qué se invalidó el caché de este usuario a las 14:32?" hoy hace falta loguear o reconstruir los 4 componentes de `decisionContextHash` por separado — el hash combinado no distingue la causa.
- **Migración/mantenimiento**: ninguno adicional.

### Opción B — columna propia `proximityContextHash` en `HomeDecisionSnapshot`

- **Costo de cambio**: migración menor (1 columna `String`), sin downtime — cambio aditivo puro, igual que fue agregar `HomeDecisionSnapshot` en sí. `route.ts` ya calcula el valor, solo cambia dónde se guarda/compara.
- **Observabilidad**: alta. Permite un query directo tipo "¿cuántos snapshots se invalidaron hoy por proximidad vs. por perfil?" sin decodificar nada.
- **Debugging**: al reportar un bug de "veo promos de sucursales que ya no me quedan cerca", se puede confirmar en 1 query si el snapshot tiene el `proximityContextHash` esperado, sin reconstruir el JSON completo de `decisionContextHash`.
- **Invalidación**: el comportamiento *funcional* es exactamente el mismo en ambos casos — hoy, cualquier cambio de proximidad ya cambia `decisionContextHash` (porque está plegado adentro), así que separar la columna **no cambia qué se invalida**, solo mejora la trazabilidad de *por qué*.
- **Mantenimiento**: una columna más para mantener en sync con el resto (aunque el cálculo ya existe, solo cambia el destino).

### Recomendación

**Separar `proximityContextHash` en su propia columna.** El cambio funcional es nulo (la invalidación ya funciona igual hoy), el costo de migración es mínimo (aditivo, sin downtime, mismo patrón ya usado en esta etapa), y la ganancia de observabilidad/debugging es real y se va a notar apenas el punto 10 del roadmap (filtrado por ubicación con `CommerceBranch`) tenga más tráfico — ahí es donde recién va a importar poder diagnosticar invalidaciones de proximidad de forma aislada. No es urgente resolverlo ahora (nada se rompe dejándolo como está), pero es más barato hacerlo en el mismo ciclo que ya está tocando este modelo que volver más adelante a migrar en caliente.

Combinado con el hallazgo del §5 (pérdida de `count` de sucursales cercanas), si en algún momento se decide que ese campo también debe invalidar caché, el momento natural para incorporarlo es el mismo cambio de columna — no antes, no requiere resolverse en esta entrega.

---

## 9. Resumen ejecutivo

| Ítem del pedido | Estado |
|---|---|
| 1. Diff completo archivo por archivo | ✅ §1 |
| 2. Clasificación nuevo/modificado/fuera de alcance | ✅ §2 |
| 3. 80/80 tests verdes + build de producción | ✅ §3 |
| 4. Revisión de `HomeDecisionSnapshot`/hashes + triggers mid-day | ✅ §4 (6 triggers, todos documentados con mecanismo) |
| 5. `proximityContextHash` — qué representa, cómo se calcula, pérdida de información (sin cambiar nada) | ✅ §5 — pérdida confirmada: `count` de sucursales no entra al hash |
| 6. Sin dependencia de Etapa 2, sin cambios visuales fuera de "Tus rubros" | ✅ §6 |
| 7. PROD no tocado, sin commit/push nuevo de esta implementación | ✅ §7 (con la aclaración necesaria del §0) |
| 8. Recomendación técnica `proximityContextHash` | ✅ §8 — recomienda columna propia, cambio no urgente |

**Etapa 1 "Tus rubros" queda funcionalmente cerrada en DEV.** Este documento no autoriza commit, push, ni deploy a PROD — queda a decisión del CPO.
