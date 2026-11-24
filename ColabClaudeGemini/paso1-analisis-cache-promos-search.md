# PASO 1 — Análisis de `/api/promos` y `/api/search/products` para reducir carga en Neon

Sin modificar nada todavía, como pediste. Esto responde a/b/c/d de tu brief.

## a) ¿Qué parte depende del usuario y qué parte es pública/compartida?

Hay **dos caminos completamente distintos** dentro de `/api/promos`, y tu hipótesis
("candidate-selection + hydration parece user-independent, profileMatch corre en memoria")
es **cierta para uno y falsa para el otro**:

### Camino 1 — Invitado / sin perfil real / sin filtros manuales (`isPublicCacheableView`)
Esto YA está cacheado hoy, con `unstable_cache`, en `getPublicPromosPage` (`lib/getPromos.ts`).
Clave: `page, pageSize, view, dayBit, province, fecha-Argentina, categorySlug`. TTL techo 12h,
invalidado por tag en cada `revalidateTag` real. Es genuinamente público: cero datos de usuario
en la query ni en la clave.

Este camino **nunca** imprime el log `[candidate-selection]` que estás viendo repetirse en tus
logs — eso es importante, lo explico abajo.

### Camino 2 — Usuario logueado con "Para mí" y perfil financiero real (`useCandidates`)
Este es el camino que SÍ dispara `[candidate-selection]` en tus logs. Acá tu hipótesis se cae:
la query SQL (`getCandidatePromosForProfile`, `lib/getPromos.ts:381-444`) recibe directamente
`userBankIds`, `userWalletIds` y `savedPromoIds` del usuario como parámetros de la propia
consulta — no es un post-filtro en memoria, el banco/wallet del usuario está **adentro del
WHERE**, mezclado en el mismo `EXISTS` junto con validez/día/provincia/categoría:

```sql
WHERE p.status = 'ACTIVE'
  AND p."validFrom" <= now()
  AND (p."validUntil" IS NULL OR ...)
  AND (día AND provincia AND categoría...)
  AND (
    p.id = ANY(savedPromoIds)
    OR EXISTS (SELECT 1 FROM promo_requirements r
               WHERE r."bankId" = ANY(userBankIds) OR r."walletId" = ANY(userWalletIds) OR (ambos null))
  )
```

Esto significa que **no se puede separar limpiamente** en "parte pública cacheable" + "parte de
usuario en memoria" sin reimplementar en JS toda la lógica de validez/día/provincia/categoría
sobre un universo mucho más grande de filas sin filtrar — probablemente más lento que dejar que
Postgres lo resuelva con sus índices, y con más superficie para bugs. **Decisión: este camino
queda sin cachear.** Es justamente tu regla de "si no se puede separar con seguridad, no cachear
y decirlo" — la aplico acá explícitamente.

Lo que sí corre en memoria, DESPUÉS de esta query (en ambos caminos):
- Filtro geográfico ADR-001 (`coverageStatus`, por provincia/sucursales del comercio).
- Matching de perfil fino (`matchesProfile`), con un lookup opcional a `FinancialMatchIndex`
  (esto SÍ es una query a DB adicional, no cacheada, pero liviana — una sola tabla por hash de
  perfil).
- Bloque "Alerta Inteligente" (`otherDayPromos`): otra query a DB adicional, acotada a 30
  comercios, solo cuando hay perfil y es la vista default de "hoy".

**Conclusión (a):** tu hipótesis es correcta solo para el camino invitado (que ya está
cacheado). Para el camino logueado/"Para mí", el user-profile está adentro de la query SQL
misma, no es un post-filtro — así que ese camino estructuralmente resiste el cacheo compartido
tal como está hoy. Esto también explica por qué ves `[candidate-selection]` repetirse tanto: es
justamente la parte que no se puede compartir entre usuarios.

## b) Parámetros de los que depende cada etapa

- **Fecha/hora actual**: `getPublicPromosPage` ya usa `getArgentinaDateString()` (UTC-3 fijo,
  sin DST) como parte de la clave de caché — correcto, nunca UTC crudo. El camino `useCandidates`
  usa `now()` de Postgres directamente en el WHERE (no cacheado, así que no hay riesgo de clave
  stale ahí).
- **Día de la semana** (`dayBit`/`validDays` bitmask): estable durante el día, cambia a
  medianoche hora Argentina. Ya es parte de la clave en el camino público.
- **Provincia del usuario**: parte de la clave en ambos caminos (pública: va en la key del
  cache; privada: va en el WHERE de la query no cacheada).
- **Filtros manuales** (banco/wallet/red/canal/tope/categoría/texto/paginación): cualquier
  combinación de estos saca al request del camino cacheable (`isPublicCacheableView` exige
  "sin filtros" y a lo sumo 1 categoría válida) — cae al camino no cacheado de siempre.
- **`categorySlug`**: cacheable solo si es una única categoría del whitelist de 20 slugs
  válidos (ver `VALID_CATEGORY_SLUGS`). Más de una categoría, o una no reconocida, invalida el
  camino cacheado.

## c) ¿`/api/search/products` depende del usuario?

**La etapa de candidatos (la más cara) es 100% pública e independiente del usuario.**
`app/api/search/products/route.ts:63-65`:

```ts
const allMatches = await prisma.commerceProduct.findMany({
  select: { commerceId: true, categoria: true, subcategoria: true, productos: true },
})
```

Esto trae **la tabla `CommerceProduct` completa sin ningún WHERE**, en cada request, y filtra
por texto en JS después (normalización de acentos, plurales, word-boundary). Es exactamente el
peor patrón para Neon: una tabla entera por keystroke, sin cachear nada. Esta parte no toca para
nada el perfil del usuario — el único parámetro real es el texto de búsqueda `q`.

La segunda mitad del endpoint (líneas 101-247) sí depende del usuario: lee `session`/
`guest_profile`, resuelve `userCards`, y filtra las promos de cada comercio matcheado contra el
perfil (`matchesProfile`, idéntica lógica a `/api/promos`). Pero esta segunda mitad corre sobre
un `commerceIds` ya acotado por la primera etapa (los comercios que matchearon el texto) — un
`commerce.findMany({ where: { id: { in: commerceIds } } })` + filtro en memoria, mucho más
liviano.

**Conclusión (c):** la etapa cara (candidatos por texto) es públicamente cacheable por query
normalizada. La etapa de perfil debe seguir sin cachear (igual regla que en `/api/promos`).

## d) Cardinalidad de combinaciones de parámetros

**`/api/promos` (camino público cacheable):**
- `page/pageSize`: pageSize fijo en la práctica (500), page acotada por el volumen real de
  promos activas (bajo, decenas de páginas como techo).
- `view`: 2 valores (`today`/`week`).
- `dayBit`: 7 valores posibles (día de la semana), pero en la práctica 1 por día real.
- `province`: ~24 provincias + `null`.
- Fecha Argentina: 1 valor por día (se renueva solo).
- `categorySlug`: `VALID_CATEGORY_SLUGS` tiene exactamente **20 slugs** + `null` (sin filtro) = 21.

Cota superior realista: `~pocas page × 2 view × 7 dayBit × 25 province × 21 category` ≈ unos
pocos miles de entradas de caché como techo teórico, pero en la práctica mucho menos porque
`dayBit` y la fecha-Argentina colapsan a 1 valor válido por día — el caché no explota, y además
tiene TTL (12h) que lo poda solo.

**`/api/search/products` (candidatos por texto, propuesto):**
- Clave = texto normalizado (trim + lowercase + sin acentos), largo mínimo 2-3 caracteres.
  Cardinalidad acotada por el espacio real de búsquedas de usuarios (no es combinatorio como
  `/api/promos` — es simplemente "cuántas strings de búsqueda distintas existen"), con un TTL
  corto (5-10 min) que poda solo las que no se repiten. Sin riesgo de crecimiento sin límite si
  se le pone un cap de longitud máxima (evita cachear basura/ataques con strings larguísimas).

## Hallazgos adicionales relevantes para el PASO 2

1. **`robots.txt` (punto 7 de tu brief) — ya está hecho.** `app/robots.ts` ya tiene
   `disallow: ['/admin', '/api/', '/verificar', '/recuperar']`. No hace falta tocar nada ahí.

2. **Middleware NO hace queries a la DB** (punto 6). `middleware.ts` solo mantiene rate-limiting
   en memoria (`Map`s de hits/bans) y decodifica el JWT de sesión (`getToken`, sin DB). No es un
   origen de carga en Neon.

3. **Googlebot UA (punto 8)** — ya se reconoce correctamente por el string completo de UA, sin
   trucos: `ALLOWED_BOT_UA = /googlebot|google-|googleother|-google|chrome-lighthouse|applebot/i`
   contra el header `user-agent` real. No hay nada que cambiar acá, es un match legítimo por
   substring, no un bypass.

4. **Dos logs de debug sin gate (punto 5)**: `[traffic-debug]` (middleware.ts:235) y
   `[rate-limit-debug]` (middleware.ts:249) se imprimen en **cada** request a las rutas pesadas,
   siempre, sin ninguna env var. Hay que meterlos detrás de `DEBUG_TRAFFIC` como pediste.

5. **Discrepancia de formato de logs**: el caché público usa `[promos-cache] MISS ...` (dentro de
   `getPublicPromosPage`), distinto al formato `[cache-miss] <ruta> <key>` que ya usan
   `detailFetchers.ts` (`[cache-miss] promo-detail <slug>`). Al agregar el cache nuevo de
   `/api/search/products` voy a usar el formato `[cache-miss]` consistente con el de detalle, y
   dejo anotado que el de promos públicas quedó con el formato viejo (no lo toco a menos que
   quieras unificarlo también, es un cambio cosmético sin riesgo).

6. **`/api/internal/revalidate`** ya invalida el tag de promos públicas
   (`invalidatePublicPromosCache()`) — cubre el cache existente. Para el cache nuevo de
   `/api/search/products` voy a agregar un tag propio (ej. `SEARCH_PRODUCTS_TAG`) y sumarlo a este
   endpoint para que `npm run revalidate:prod` también lo invalide.

## Qué voy a implementar en PASO 2 (resumen antes de tocar código)

- ✅ Cachear `/api/search/products` (etapa de candidatos por texto) — público, TTL corto, tag
  nuevo en `revalidate`.
- ✅ `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` en responses del camino
  público de `/api/promos` (que ya está cacheado server-side) y del candidate-cache nuevo de
  search; `private, no-store` en las responses personalizadas de ambos endpoints.
- ✅ Gatear `[traffic-debug]`/`[rate-limit-debug]` detrás de `DEBUG_TRAFFIC`.
- ❌ NO voy a tocar el camino `useCandidates` (forMe/perfil real) de `/api/promos` — queda sin
  cachear, por lo explicado en (a). Si en el futuro quisieras explorar cachear por firma de
  perfil (hash de bancos+wallets), es una decisión de producto distinta (cardinalidad alta,
  trade-off de staleness) que prefiero no tomar por mi cuenta.
- ❌ No hace falta tocar `robots.txt` ni la detección de Googlebot — ya están bien.

¿Seguimos con esto para el PASO 2, o querés ajustar algo de lo de arriba primero?
