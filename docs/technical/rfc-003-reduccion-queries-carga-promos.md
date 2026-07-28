# RFC-003 — Reducción de queries en una carga de `/promos`

**Domain**: Technical
**Knowledge Type**: Specification
**Authority**: No
**Estado**: propuesta, pendiente de aprobación del CPO. **No implementado.**
**Origen**: hallazgo documentado en `rfc-002/neon-compute-forensic-report.md`, sección 6.1
("Hallazgo adicional: ausencia total de cache en rutas de alto tráfico fuera de
`/api/promos`"). El CPO reclasificó la prioridad: el WAF (`log-hot-paths-rate`) queda activo
en modo Log pero deja de ser la acción principal — el problema de mayor impacto es la
amplificación de queries en una carga 100% legítima.

**KPI que este RFC busca mover**: maximizar el tiempo que Neon permanece en autosuspend sin
afectar a usuarios legítimos. No es "menos requests HTTP" — es menos *queries reales contra
Postgres* por unidad de tiempo, sin importar si el tráfico es humano o bot.

---

## 1. Conteo actual de queries por carga de `/promos`

**Baseline verificado (Paso 0, 19/7/2026)**: lectura completa de `PromosClient.tsx` (2753
líneas) + grep de `fetch(` en los 14 componentes que importa/renderiza
(`FilterDrawer`, `EntitiesSheet`, `PromoDetailSheet`, `PromoWizard`, `ProvinceSelector`,
`TourOverlay`, `RegisterUsageModal`, `AdBannerEM`, `CommerceGroupCard`, `PromoCard`,
`ActiveFilters`, `BottomNav`, `OnboardingBanner`, `SplashScreen`, `ThemeToggle`) +
confirmación de que ninguno de esos componentes importa a su vez otro componente con fetch
propio + confirmación de que `app/promos/page.tsx` (SSR) no ejecuta ningún `fetch()` HTTP
(llama a `getPromosData` directo, server-side). El árbol de imports y fetches de `/promos`
quedó completamente auditado; no se encontraron otras consultas ocultas fuera de las
listadas abajo.

Una carga de `/promos` dispara, en la práctica, **seis llamadas que tocan Neon en el mount
inicial** (1 SSR + 5 fetches client-side post-hidratación, todas incondicionales), más un
conjunto de llamadas adicionales gated por interacción del usuario.

### 1.1 SSR — `app/promos/page.tsx` (server component, `revalidate = 0`)

Llama a `getPromosData({ take: 50, view: 'today', ... })` **sin pasar `paginate: true`**.
Esto es clave: `isPublicCacheableView` en `lib/getPromos.ts:335` requiere
`paginate && !userProvince` — como `page.tsx` nunca pasa `paginate`, este SSR **siempre va
por el path directo a Prisma, nunca por `getPublicPromosPage` (la cache de RFC-002 Fase
1)**, sin importar que sea un invitado sin filtros.

Queries reales de esta llamada:
- `prisma.promo.findMany` (con `include` de category, commerce, requirements → 3 joins) — **1 query** (con `take:50`, relativamente barata pero sin cache).
- `prisma.promo.count({ where })` — **1 query** (no usa `getActiveTotalCount()` cacheado porque ese solo se usa cuando `paginate === true`).

**Subtotal SSR: 2 queries, 0% cacheadas.**

### 1.2 Cliente — fetch a `/api/promos` (post-hidratación, `PromosClient.tsx:934`)

Para el caso invitado-sin-filtros (el más común), `app/api/promos/route.ts:56` sí calcula
`paginate = !forMe && !email && !hasFilters` → `true`, y **esta llamada sí entra al path
cacheado** (`getPublicPromosPage`, TTL 10min + invalidación por `revalidateTag`). Cache
HIT esperado en la gran mayoría de requests dentro de la ventana de 10 minutos.

- Cache HIT: **0 queries nuevas** (Next.js sirve el resultado cacheado).
- Cache MISS (1 de cada N según tráfico, o el primero tras invalidación): **2 queries**
  (`promo.findMany` + `getActiveTotalCount()`/`getActiveTodayCount()`, ambos con su propia
  cache in-memory de 5 minutos en `lib/getPromos.ts`).

Para usuarios logueados o con filtros (incluye `province` seteado — ver nota abajo), este
fetch **nunca** pasa por cache (siempre Prisma directo) — ese caso ya estaba fuera del
alcance de RFC-002 Fase 1 por diseño, y sigue fuera del alcance de este RFC.

Nota aparte (no parte del baseline, verificado a raíz de una consulta puntual): un
`province` seteado (ej. filtro de ciudad = CABA) también desactiva `isPublicCacheableView`
aunque no cuente como "filtro" en `hasFilters` de `route.ts:51-55` — es decir, filtrar por
provincia saca al request del path cacheado igual que un filtro de banco. Esto es
comportamiento correcto (el filtro de provincia necesita el universo completo de
`CommerceBranch` antes de recortar), no un bug — pero es relevante para este RFC porque
significa que **cualquier usuario con provincia configurada nunca se beneficia de la cache
de `/api/promos`**, sin importar que no tenga otros filtros activos.

### 1.3 Cliente — `/api/categories` (`PromosClient.tsx:782`, dentro de
`fetchCategorias()`)

**Se ejecuta en toda carga de `/promos`**, sin gating — corre en el mismo `useEffect` que
`/api/public/entities` (línea 768-808), disparado al montar el componente,
independientemente de si el usuario interactúa con categorías o filtros. No es exclusivo
de `/explorar`: `/explorar` también lo llama por separado, pero `/promos` lo llama siempre
por su cuenta.

Queries reales de esta llamada:
- `prisma.user.findUnique` — 1 query, solo si `for_me=true` y hay email.
- `prisma.category.findMany` — 1 query.
- `prisma.promo.findMany` **una vez por categoría**, dentro de `Promise.all` — con ~20
  categorías activas, **~20 queries**.

**Subtotal: ~21-22 queries, 0% cacheadas.**

### 1.4 Cliente — `/api/public/entities` (`PromosClient.tsx:771`, dentro de
`fetchEntities()`)

**Se ejecuta en toda carga de `/promos`**, en el mismo `useEffect` incondicional que
`/api/categories` (línea 768-808) — no depende de abrir el drawer de filtros. Se ejecuta
una **segunda vez** si el usuario abre el wizard de perfil (`PromoWizard.tsx:565`, gated
por `if (!open) return`, así que esa segunda llamada sí es solo bajo interacción).
`FilterDrawer.tsx` no llama a `/api/public/entities` — llama a un endpoint distinto,
`/api/public/commerces` (línea 138, gated por `if (!isOpen) return`, ver sección 1.6).

Queries reales de esta llamada:
- 6 queries en paralelo (`bank`, `wallet`, `cardNetwork`, `bankSegment`, `currency`,
  `financialAccountType`), cada una con post-procesamiento JS (`groupByPopularity`,
  `sortCards`) que no agrega queries pero sí trabajo de CPU en el runtime serverless.

**Subtotal: 6 queries, 0% cacheadas.**

### 1.5 `/api/site-config` (badge "Última actualización", `PromosClient.tsx:629`)

Se ejecuta en toda carga de `/promos`, sin gating.

- 1 query (`prisma.siteConfig.findMany()`), con `Cache-Control: no-store` **explícito** —
  el propio código le dice al Edge/CDN que nunca lo sirva de cache, aunque el dato cambia
  con frecuencia de días/semanas (se edita a mano desde el admin).

**Subtotal: 1 query, 0% cacheadas, y activamente bloqueada de cachearse.**

### 1.6 Llamadas adicionales gated por interacción (no forman parte del mount inicial)

Confirmadas por el mismo audit, incluidas por completitud del árbol — no suman al conteo
de "una carga de `/promos`":

| Endpoint | Origen | Gate |
|---|---|---|
| `/api/public/commerces` | `FilterDrawer.tsx:138` | `if (!isOpen) return` — solo al abrir el drawer de filtros |
| `/api/public/entities` (2ª vez) | `PromoWizard.tsx:565` | `if (!open) return` — solo al abrir el wizard de perfil |
| `/api/promos/upcoming` | `PromosClient.tsx:968` | Solo al togglear "Próximamente" |
| `/api/promos` (focused category) | `PromosClient.tsx:998` | Solo al abrir "ver todas" de una categoría |
| `/api/search/products` | `PromosClient.tsx:1036` | Solo con búsqueda de productos activa (debounced) |
| `/api/promos/:id/save` (POST) | `PromosClient.tsx:1248` | Solo al tocar favorito |
| `/api/perfil/import-guest` (POST) | `PromosClient.tsx:668` | Solo login con perfil guest pendiente |
| `/api/track/click` (POST) | `AdBannerEM.tsx:29` | Solo al clickear el banner |
| `/api/promo-usage` (POST) | `RegisterUsageModal.tsx:89` | Solo al registrar uso |
| `/api/branches/nearby` | `PromosClient.tsx:640,650` | Solo si hay geolocalización cacheada o permitida |
| Nominatim (externo, OSM) | `PromosClient.tsx:712` | Solo si no hay provincia guardada y hay geolocalización |

### Total verificado por carga de `/promos` (invitado, sin filtros, mount inicial)

| Fuente | Queries | Cacheado hoy |
|---|---:|---|
| SSR `page.tsx` (preview 50) | 2 | No |
| Cliente `/api/promos` (cache MISS) | 2 | Sí (10min TTL), pero MISS cuenta igual |
| Cliente `/api/categories` | ~21-22 | No |
| Cliente `/api/public/entities` | 6 | No |
| Cliente `/api/site-config` | 1 | No (`no-store` explícito) |
| **Total** | **~32-33** | — |

**`/api/categories` y `/api/public/entities` se ejecutan siempre, en toda carga de
`/promos`, sin gating** — ambos corren en el mismo `useEffect` de mount
(`PromosClient.tsx:768-808`). El número verificado para **una sola carga de `/promos`** es
**~32-33 queries** (bajando a ~11 en cache HIT de `/api/promos`, ya que `/api/categories` y
`/api/public/entities` no tienen cache propia hoy). Esto reemplaza toda estimación previa
que excluía `/api/categories` del conteo de `/promos` — esa exclusión era incorrecta.

---

## 2. Conteo esperado después del cambio

| Endpoint | Queries hoy | Queries después | Mecanismo |
|---|---:|---:|---|
| `/api/categories` | ~21-22 (1 + 1 + N por categoría) | **2** (1 agregación + 1 `findMany` categorías), luego **0 en cache HIT** | `groupBy`/agregación única + `unstable_cache` |
| `/api/public/entities` | 6 (en paralelo, sin cache) | 6 en cache MISS, **0 en cache HIT** | Mismas 6 queries, envueltas en `unstable_cache` sobre el resultado combinado |
| `/api/site-config` | 1 (nunca cacheado) | 1 en cache MISS, **0 en cache HIT** | Quitar `no-store`, envolver en `unstable_cache` con invalidación por evento |
| SSR `page.tsx` (preview) | 2 (siempre Prisma directo) | 2 en cache MISS, **0 en cache HIT** (si aplica) | Pasar `paginate: true` cuando el caso sea invitado-sin-filtros, reusando `getPublicPromosPage` ya existente |

**Total estimado por carga de `/promos` (invitado, cache caliente, caso típico):**
de ~32-33 queries hoy a **~0-2** (solo el count cacheado in-memory si vence su TTL de 5
min) — bajan `/api/categories` (~21-22 → 0), `/api/public/entities` (6 → 0) y
`/api/site-config` (1 → 0) simultáneamente, ya que las tres viven en el mismo mount.

**Total estimado por visita a `/explorar`:** de ~21-22 queries a **2 en MISS, 0 en HIT**
(mismo mecanismo de cache reutilizado, ya que `/explorar` llama al mismo endpoint
`/api/categories`).

Esto no es "menos requests" — sigue habiendo el mismo número de llamadas HTTP. Es "casi
todas esas llamadas dejan de tocar Postgres", que es exactamente la palanca sobre el KPI de
autosuspend: una ventana de 5-10 minutos sin escritura/lectura nueva en Neon ahora es
alcanzable incluso con tráfico humano activo navegando la página.

---

## 3. Archivos y rutas a modificar

| # | Archivo | Cambio |
|---|---|---|
| 1 | `app/api/categories/route.ts` | Reemplazar el `Promise.all` de N queries por 1 query agregada (`groupBy` de Prisma sobre `promoId`/`categoryId`, o un `$queryRaw` si `groupBy` no soporta el filtro de bitmask de días) + envolver la función en `unstable_cache` con tag propio |
| 2 | `app/api/public/entities/route.ts` | Envolver el bloque completo de `Promise.all` (las 6 queries + post-procesamiento) en una función `unstable_cache` única, tag propio |
| 3 | `app/api/site-config/route.ts` | Quitar el header `Cache-Control: no-store`; envolver `prisma.siteConfig.findMany()` en `unstable_cache` con tag propio |
| 4 | `app/promos/page.tsx` | Pasar `paginate: true` a `getPromosData` cuando el request sea invitado-sin-filtros (mismo criterio que ya usa `app/api/promos/route.ts:56`), para que el preview SSR reuse `getPublicPromosPage` en vez de ir directo a Prisma |
| 5 (nuevo) | `lib/cache/categoriesCache.ts`, `lib/cache/entitiesCache.ts`, `lib/cache/siteConfigCache.ts` (o un único `lib/cache/filtersCache.ts` con 3 tags) | Definir los tags de invalidación, siguiendo el mismo patrón que `lib/cache/promosCache.ts` ya existente |
| 6 | Puntos de escritura relevantes (ver sección 5) | Agregar la llamada a `revalidateTag(...)` correspondiente tras cada mutación |

No se toca `lib/getPromos.ts` más que el punto 4 (un flag adicional pasado desde
`page.tsx`) — la lógica interna de `getPublicPromosPage` ya existe y se reutiliza tal cual.

---

## 4. Estrategia de cache

Mismo patrón ya validado en producción por RFC-002 Fase 1 (`getPublicPromosPage`):
`unstable_cache` de Next.js, con:

- **Clave de cache**: nombre de función fijo (sin params variables, ya que estos 3
  endpoints no reciben query params que cambien el resultado — `/api/categories` sí recibe
  `for_me`, pero el camino personalizado ya usa Prisma directo hoy y puede seguir así,
  igual que `getPromosData` separa invitado-cacheable de personalizado).
- **TTL de seguridad**: 10 minutos para `entities` y `site-config` (datos que cambian con
  baja frecuencia — altas de bancos/billeteras, ediciones de config desde el admin). Para
  `categories`, TTL más corto sugerido: **2-3 minutos**, porque `promoCount`/`totalCount`
  por categoría cambia con cada corrida de scraper y es contenido visible/usado para
  decidir qué categoría explorar — un TTL de 10 min ahí generaría counts visiblemente
  desactualizados tras un scrape.
- **Invalidación por evento** (`revalidateTag`), no solo TTL — igual que
  `invalidatePublicPromosCache()` ya hace hoy.

---

## 5. Eventos de invalidación

| Cache | Tag propuesto | Se invalida cuando... |
|---|---|---|
| `categories-public` | `categories-public` | Mismo conjunto de eventos que ya invalidan `promos-public` hoy: `app/api/admin/scrape/route.ts`, `app/api/admin/pending-promos/route.ts` y `[id]/route.ts`, `app/api/admin/auto-validate/route.ts`, `app/api/admin/cleanup/route.ts`, `app/api/admin/promos/route.ts`, `app/api/internal/expire-promos/route.ts`. Cualquier cambio de `status`/`categoryId` de una promo afecta los counts por categoría — mismo set de disparadores que `PROMOS_PUBLIC_TAG`, se puede invalidar en la misma llamada. |
| `entities-public` | `entities-public` | Altas/bajas/ediciones de `Bank`, `Wallet`, `CardNetwork` en `app/api/admin/entities/route.ts` (POST/PUT/DELETE), de `BankSegment` en `app/api/admin/segments/route.ts` (POST/DELETE), de `Currency` en `app/api/admin/currencies/route.ts` (POST/DELETE), y de `FinancialAccountType` en `app/api/admin/account-types/route.ts` (POST/DELETE). Lista confirmada por lectura directa de los 4 archivos. Cambia con muy baja frecuencia (altas de bancos son eventos raros). |
| `site-config-public` | `site-config-public` | `app/api/admin/site-config/route.ts` (POST) — ya es el único punto de escritura conocido. |

**Riesgo de invalidación incompleta**: si `categories-public` se ata al mismo set de
triggers que `promos-public`, cualquier olvido futuro en un nuevo punto de escritura de
promos afecta ambas caches por igual (mismo riesgo que ya existe hoy para `promos-public`,
no es un riesgo nuevo introducido por este RFC).

---

## 6. Riesgos de datos obsoletos

- **`/api/categories`**: un `promoCount`/`totalCount` desactualizado por hasta el TTL (2-3
  min) o hasta la próxima invalidación. Impacto UX: un usuario podría ver "12 promos" en
  una categoría que en realidad ya tiene 13 tras un scrape reciente — desajuste menor,
  mismo tipo de staleness que RFC-002 Fase 1 ya aceptó para el listado principal de promos
  (10 min TTL).
- **`/api/public/entities`**: bajísimo riesgo — bancos/billeteras/redes cambian con
  frecuencia de semanas o meses. Un alta nueva tarda hasta el TTL en aparecer en el
  filtro si se olvida invalidar desde el punto de alta correspondiente.
- **`/api/site-config`**: el admin ya edita este valor manualmente y espera verlo
  reflejado — acá si conviene invalidar inmediatamente (`revalidateTag` en el POST) en vez
  de depender del TTL, para no generar la sensación de "guardé pero no cambió nada".
- **SSR preview (`page.tsx` con `paginate: true`)**: mismo riesgo ya aceptado en
  `getPublicPromosPage` hoy (10 min TTL) — no es un riesgo nuevo, es extender el mismo
  camino ya en producción a una llamada que hoy lo evita por accidente (falta de flag).

Ninguno de estos afecta corrección de datos financieros (montos, topes, requisitos de
promo) — todo lo que se cachea acá es metadata de navegación/filtrado, no el contenido de
la promo en sí.

---

## 7. Plan de validación

El baseline de la sección 1 ya quedó cerrado con evidencia (Paso 0, 19/7/2026) — el plan
de validación arranca directamente en la implementación:

1. **Local**: activar logging temporal (`console.log` en cada handler, mismo patrón que ya
   existe en `getPublicPromosPage` con `[promos-cache] MISS`) para contar HIT/MISS reales
   durante una sesión de navegación manual simulando invitado, logueado, y con filtros
   (incluyendo el caso `province` seteado, que también cae fuera de cache — ver sección 1.2).
2. **Staging/preview de Vercel**: repetir la captura de logs de producción usada en
   `rfc-002/fase-1-baseline.md` (ventana de ~90s con `vercel logs`) antes y después del
   deploy, comparando cantidad de líneas `MISS` vs `HIT` por endpoint.
3. **Neon**: comparar CU-hours/día de una semana post-deploy contra el baseline de
   `rfc-002/neon-compute-forensic-report.md` (sección 3.2) y contra `rfc-002/fase-1-baseline.md`
   (~6.8 CU-hours/día). Es la única métrica que valida el KPI real (tiempo en autosuspend),
   las anteriores son proxies.
4. **Regresión funcional manual**: verificar que el badge "Última actualización" en el
   cartel de promos siga reflejando cambios del admin en tiempo razonable (no más de
   `TTL + invalidación esperada`), que los counts de categorías (en `/promos` y en
   `/explorar`) no queden pegados tras un scrape, y que el filtro de bancos/billeteras en
   `FilterDrawer`/`PromoWizard` siga mostrando altas nuevas tras el TTL correspondiente.

---

## 8. Impacto esperado sobre resumes y tiempo activo de Neon

No hay forma de calcular esto con precisión sin datos de Vercel Analytics por endpoint
(misma limitación ya declarada en `rfc-002/fase-1-baseline.md`, sección 2). Estimación
cualitativa:

- Antes de este cambio, incluso con el cache de RFC-002 Fase 1 ya activo, una sesión de
  navegación humana normal (`/promos` → `/explorar` → volver a `/promos`) sigue generando
  **~30+ queries reales** distribuidas en un lapso de segundos a minutos — suficiente para
  mantener a Neon fuera de la ventana de autosuspend (5 min de inactividad) de forma casi
  continua mientras haya *cualquier* usuario navegando, sin necesidad de bots.
- Después del cambio, en el caso más común (invitado, cache caliente en los 4 endpoints),
  una sesión completa del mismo recorrido podría generar **0-4 queries reales** (solo
  overhead de invalidación puntual o vencimientos de TTL escalonados), permitiendo que
  Neon efectivamente entre en autosuspend entre sesiones de usuarios distintos si no se
  solapan en una ventana de ~5-10 minutos.
- El impacto real depende de cuántos usuarios concurrentes hay en un momento dado y con
  qué frecuencia sus TTLs individuales vencen — con tráfico bajo (el caso actual de
  PromoAR, según sesiones previas: 2 usuarios registrados, tráfico mayormente invitado),
  el efecto esperado es alto: la mayoría de ventanas de 5-10 minutos sin visitas nuevas
  ahora sí deberían traducirse en autosuspend real, cosa que hoy no ocurre por los 4
  endpoints sin cache.

**Este RFC no cuantifica un % de reducción de CU-hours prometido** — eso solo se puede
confirmar con la medición post-deploy del punto 4 del plan de validación.

---

## 9. Plan de implementación

Baseline y diseño de cache ya cerrados (secciones 1-6). Este plan secuencia los 6 cambios
de la sección 3 en pasos ejecutables, cada uno con su criterio de aceptación. Orden pensado
para poder mergear/deployar de forma incremental (cada paso deja el sitio funcional) en vez
de un solo cambio grande.

### Paso 1 — Infra de cache compartida (sin cambios de comportamiento todavía)

Crear `lib/cache/filtersCache.ts` con 3 tags (`categories-public`, `entities-public`,
`site-config-public`) y una función helper por endpoint, siguiendo el mismo patrón de
`lib/cache/promosCache.ts` (`PROMOS_PUBLIC_TAG` + `invalidatePublicPromosCache()`):

```ts
export const CATEGORIES_PUBLIC_TAG = 'categories-public'
export const ENTITIES_PUBLIC_TAG = 'entities-public'
export const SITE_CONFIG_PUBLIC_TAG = 'site-config-public'

export function invalidateCategoriesCache() { revalidateTag(CATEGORIES_PUBLIC_TAG) }
export function invalidateEntitiesCache() { revalidateTag(ENTITIES_PUBLIC_TAG) }
export function invalidateSiteConfigCache() { revalidateTag(SITE_CONFIG_PUBLIC_TAG) }
```

**Aceptación**: archivo creado, sin ningún import todavía desde rutas existentes — build
pasa igual que antes (cambio inerte, cero riesgo).

### Paso 2 — `/api/site-config` (el más simple, buen primer caso de prueba end-to-end)

1. En `app/api/site-config/route.ts`: quitar el header `Cache-Control: no-store`, envolver
   `prisma.siteConfig.findMany()` en `unstable_cache(fn, ['site-config-public'], {
   revalidate: 600, tags: [SITE_CONFIG_PUBLIC_TAG] })`.
2. En `app/api/admin/site-config/route.ts` (POST): agregar `invalidateSiteConfigCache()`
   inmediatamente después del `prisma.siteConfig.upsert(...)` (invalidación inmediata, no
   depender del TTL — ver sección 6, el admin espera ver el cambio reflejado al toque).

**Aceptación**: guardar un valor nuevo desde el admin → recargar `/promos` en otra pestaña
→ el badge cambia sin esperar 10 min. Log `[site-config-cache] MISS/HIT` (agregar
temporalmente, mismo patrón que `getPublicPromosPage`) confirma HIT en cargas subsiguientes.

### Paso 3 — `/api/public/entities`

1. Envolver el bloque completo de 6 queries en paralelo + post-procesamiento
   (`groupByPopularity`, `sortCards`) en una única función `unstable_cache`, tag
   `entities-public`, `revalidate: 600`.
2. Agregar `invalidateEntitiesCache()` en los 4 archivos confirmados en la sección 5:
   `app/api/admin/entities/route.ts` (POST, PUT, DELETE), `app/api/admin/segments/route.ts`
   (POST, DELETE), `app/api/admin/currencies/route.ts` (POST, DELETE),
   `app/api/admin/account-types/route.ts` (POST, DELETE).

**Aceptación**: dar de alta un banco de prueba desde el admin → `/api/public/entities`
refleja el alta tras invalidación inmediata (no esperar TTL) → borrar el banco de prueba.
Verificar que `PromoWizard` y `FilterDrawer` (que consume `/api/public/commerces`, endpoint
distinto, no tocado por este paso) siguen funcionando sin cambios visuales.

### Paso 4 — `/api/categories` (el más grande: requiere reescribir la query, no solo envolverla)

1. Reemplazar el `Promise.all` de N queries (una por categoría) por una sola agregación:
   intentar primero `prisma.promo.groupBy({ by: ['categoryId'], where: {...}, _count: true })`;
   si el filtro de bitmask de `validDays` no es expresable en `groupBy` de Prisma, usar
   `$queryRaw` (mismo patrón ya usado en `getPublicPromosPage` para el filtro de día).
   Mantener el `prisma.category.findMany()` para nombres/slugs/orden.
   Mantener `prisma.user.findUnique` fuera de la cache (solo corre si `for_me=true`, ya es
   condicional y depende del usuario — no cacheable de forma pública).
2. Envolver el resultado combinado (categorías + counts, para el caso público/`for_me=false`)
   en `unstable_cache`, tag `categories-public`, `revalidate: 180` (2-3 min, más corto que
   los otros dos por sensibilidad a scrapes recientes — ver sección 4).
3. Agregar `invalidateCategoriesCache()` en los mismos puntos de escritura que ya invalidan
   `PROMOS_PUBLIC_TAG` hoy: `app/api/admin/scrape/route.ts`,
   `app/api/admin/pending-promos/route.ts` y `[id]/route.ts`,
   `app/api/admin/auto-validate/route.ts`, `app/api/admin/cleanup/route.ts`,
   `app/api/admin/promos/route.ts`, `app/api/internal/expire-promos/route.ts` — misma
   llamada donde ya se invoca `invalidatePublicPromosCache()`, agregar
   `invalidateCategoriesCache()` al lado.

**Aceptación**: comparar el JSON de `/api/categories?for_me=false` antes/después del cambio
byte a byte (mismos counts, mismo orden) contra un snapshot tomado antes de tocar el código.
Correr un scrape de prueba → confirmar que los counts de categoría en `/promos` y
`/explorar` se actualizan tras la invalidación (no quedan pegados al valor cacheado viejo).

### Paso 5 — SSR de `page.tsx` reusando `getPublicPromosPage`

En `app/promos/page.tsx`: calcular el mismo criterio invitado-sin-filtros que ya usa
`app/api/promos/route.ts:56` (`!forMe && !email && !hasFilters`, adaptado a los params que
recibe el server component) y pasar `paginate: true` a `getPromosData` en ese caso. No
tocar `lib/getPromos.ts` — la función `getPublicPromosPage` ya existe y ya maneja este path
para el fetch client-side; este paso solo hace que el SSR inicial la reutilice en vez de ir
directo a Prisma.

**Aceptación**: `curl` al HTML de `/promos` sin cookies de sesión, sin querystring →
confirmar mismo contenido/orden de promos que antes del cambio. Verificar en logs locales
que la segunda carga dentro de la ventana de 10 min genera cache HIT (no una nueva query
`findMany`+`count`).

### Paso 6 — Validación integral y medición

Ejecutar el plan de validación ya descrito en la sección 7 (local con logging temporal,
staging con `vercel logs`, comparación de CU-hours en Neon contra el baseline de RFC-002,
regresión funcional manual del badge/categorías/filtros). Quitar los `console.log`
temporales de HIT/MISS agregados en los pasos 2-5 antes de mergear a `main` (o dejarlos si
Pablo prefiere mantener visibilidad continua — mismo criterio que ya se usa hoy en
`getPublicPromosPage`, que sí dejó su log de MISS en producción).

### Orden y dependencias

Los pasos 2, 3 y 4 son independientes entre sí (tocan archivos distintos, tags distintos) —
se pueden implementar y deployar en cualquier orden o en paralelo. El paso 5 depende de que
`getPublicPromosPage` siga tal cual está (no depende de 2/3/4). El paso 1 es prerequisito
de los 4 siguientes. El paso 6 va al final, pero conviene medir HIT/MISS local
incrementalmente después de cada paso (2, 3, 4, 5) en vez de esperar a tener los 4 mergeados
para detectar temprano si alguno no cachea como se espera.
