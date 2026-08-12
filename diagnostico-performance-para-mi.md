# Diagnóstico — Performance "Para mí" (`forMe=true`)

**Fecha:** 6/8/2026
**Contexto:** DR-002 (CPO Review Recommendation Block v1) — Sprint Performance "Para mí" pasa a ser prioridad #1. Este documento es el perfil completo pedido, no una hipótesis.

---

## Resumen ejecutivo

El 99.7% del tiempo (~18.3s de ~18.4s) se consume en **una sola query a Postgres/Neon**: `prisma.promo.findMany()` en `lib/getPromos.ts` líneas 426-449, que trae **las 24.115 promos activas completas** (con todos sus `requirements` + relaciones `bank`/`wallet`/`cardNetwork`) **sin `LIMIT`**, para recién después filtrar por perfil de usuario en JavaScript.

El filtrado en JS, una vez que los datos ya están en memoria, tarda **48 milisegundos**. No es el problema. El problema es que se trae del disco 500x más datos de los que hacen falta.

Esto es **el mismo bug que ya se había identificado y resuelto en el path público** (invitado sin filtros, ver comentarios "RFC-002" en `getPromos.ts`) — pero esa solución (paginación con `LIMIT` en SQL) nunca se extendió al path `forMe=true`, que sigue con el patrón viejo: traer todo, filtrar en memoria.

---

## Medición por etapa

Metodología: instrumentación directa con Prisma query-logging + `Date.now()` alrededor de cada etapa, corrida contra la base real (Neon), simulando un perfil de usuario con Banco Macro (mismo caso usado en la validación de Recommendation Block v1).

| Etapa | Tiempo | % del total | Detalle |
|---|---:|---:|---|
| **Query principal `promo.findMany` (sin `take`)** | ~14.800-18.400 ms | ~90-99% | Trae 24.115 filas completas |
| — sub: `SELECT` de `promos` | 4.163 ms | | Tabla principal |
| — sub: `SELECT` de `promo_requirements` | 2.235 ms | | Resuelto en query separada por Prisma (no JOIN) |
| — sub: `SELECT` de `commerces` | 1.378 ms | | Resuelto en query separada por Prisma (no JOIN) |
| — sub: `SELECT` de `banks` | 335 ms | | Resuelto en query separada por Prisma (no JOIN) |
| — resto (categories, wallets, cardNetworks) | ~lo que falta | | Queries separadas adicionales |
| `promo.count({where})` (en paralelo) | 357 ms | ~2% | Full scan de conteo, corre en paralelo con el findMany |
| **Filtrado en JS por perfil** (`matchesProfile`) | **48 ms** | **~0.3%** | Sobre 24.115 promos ya en memoria → 4.358 matchean |
| Queries auxiliares (`user.findUnique`, `bankSegment.findMany`, `promoUsage.findMany`) | no medidas por separado, pero acotadas — no explican los ~15s | — | Se ejecutan secuencialmente después del findMany principal |

**Cantidad de queries SQL para una sola request**: **14 queries separadas**, no 1-2. Prisma no resuelve `include` anidados con `JOIN`, sino con queries adicionales por relación (`requirements`, `bank`, `wallet`, `cardNetwork`, `category`, `commerce` — cada una es su propio roundtrip a Neon).

**Tamaño del payload**: el `findMany` sin filtrar devuelve un JSON de **87 MB** en memoria antes de aplicar cualquier filtro de perfil. Esto también explica por qué la respuesta HTTP del endpoint (`/api/promos?for_me=true`) es lenta incluso después de que Postgres respondió — serializar 87MB a JSON y transmitirlo tiene su propio costo, aunque el filtrado interno lo recorte a 4.358 antes de enviarlo al cliente.

---

## Causa raíz (exacta, con línea de código)

`lib/getPromos.ts`, líneas 423-455:

```ts
const [promos, totalCount] = isPublicCacheableView
  ? await getPublicPromosPage(page, pageSize, view ?? 'today', defaultDayBit, userProvince)
  : await Promise.all([
      prisma.promo.findMany({
        where,                    // ← filtro grueso: status ACTIVE + vigencia + provincia
        include: { /* category, commerce, requirements+bank+wallet+cardNetwork */ },
        orderBy: paginateOrderBy ?? (take ? [...] : { createdAt: 'desc' }),
        ...(paginate ? { take: pageSize, skip: ... } : take ? { take } : {}),
        //     ↑ forMe=true nunca pasa por acá — ni `paginate` ni `take` están seteados
      }),
      paginate ? getActiveTotalCount() : prisma.promo.count({ where }),
    ])
```

Cuando `forMe=true` (el caso de Recommendation Block y de "Para mí" en general), **ni `paginate` ni `take` están seteados** en `PromoQueryParams` — el `route.ts` de `/api/promos/recommended` llama a `getPromosData({forMe: true, paginate: false, ...})` sin `take`. El resultado: `findMany` corre sin `LIMIT`, trayendo el universo completo de promos ACTIVE (24.115 filas) para descartar el 82% de ellas (20.085) recién en el filtro JS de la línea 744.

El filtro por perfil (`req.bankId`, `req.walletId`, etc.) **vive en el `where` de requirements como posibilidad** (líneas 384-401, `reqFilter`), pero solo se activa cuando el caller pasa `bankIds`/`walletIds`/`networkIds` explícitos en la URL (filtros manuales del usuario en la UI). El path `forMe=true` con perfil real **no** construye ese `reqFilter` — el matching contra el perfil completo (con toda su lógica de REGLA 1/2/3, tiers, segmentos, Cuenta DNI, etc.) es demasiado complejo para expresarse como un `where` de Prisma directo, así que se resolvió históricamente trayendo todo y filtrando en JS. Eso funcionaba cuando la base tenía cientos de promos; con 24.115 activas, es el cuello de botella.

---

## Por qué no es un problema de Prisma, JS, ni de Neon "lento"

- Neon respondiendo un `count()` simple en 357ms-2s confirma que la latencia de red/conexión no es el problema de fondo.
- El filtrado en JS (48ms sobre 24k filas) confirma que Node.js no es el cuello de botella.
- El problema es puramente de **volumen de datos transferidos**: se pide y transporta el 100% de las promos activas del país para usar el 18% de ellas.

---

## Lo que ya existe y se puede reusar (no hace falta inventar de cero)

El path público de invitados (`getPublicPromosPage`, líneas 86-199) ya resuelve exactamente este problema para su caso de uso: usa `$queryRaw` con `WHERE` + `ORDER BY` + `LIMIT`/`OFFSET` directamente en SQL para no traer más filas de las que se van a mostrar. La solución para `forMe=true` es conceptualmente la misma idea — **empujar el filtro al SQL en vez de a JavaScript** — pero el filtro por perfil financiero es mucho más complejo que un filtro por provincia (tiers, segmentos, banco+wallet combinados, Cuenta DNI como caso especial, etc.), por lo que expresarlo 1:1 en SQL crudo no es trivial ni gratis en riesgo de introducir bugs de matching.

No voy a proponer una implementación en este documento — el pedido explícito fue diagnóstico, no solución. Quedo a la espera de luz verde para plantear opciones concretas de rediseño (con sus trade-offs) en un documento aparte.
