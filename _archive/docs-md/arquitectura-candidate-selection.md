# Arquitectura — Candidate Selection para "Para mí" (DR-003)

**Fecha:** 6/8/2026
**Contexto:** siguiendo [diagnóstico-performance-para-mi.md](diagnostico-performance-para-mi.md) y la dirección aprobada en DR-003 (Respuesta 2 de ChatGPT): no optimizar `findMany()`, invertir el flujo. La DB filtra lo grueso y muy selectivo (vigencia, estado, geografía, salesChannel, categoría, provincia, comercio); el matching complejo de perfil (tiers, segmentos, Cuenta DNI, banco+wallet combinados) se queda en TypeScript. Objetivo: trabajar con cientos de candidatas, no con 24.000. Sin código todavía — esto es evaluación de arquitectura.

---

## Datos de base para evaluar las alternativas

- 24.443 promos ACTIVE totales (24.423 con requirements — prácticamente el 100%).
- `PromoRequirement` **no tiene ningún índice propio** hoy (ni sobre `promoId`, ni `bankId`, ni `walletId`) — solo la FK implícita. Cualquier alternativa que filtre por esa tabla en SQL necesita agregar índices.
- 41 bancos, 17 wallets en catálogo.
- Un perfil de usuario promedio tiene **~22 cards** (combinaciones banco×red×tier), no 1-2 — esto importa: un filtro `IN (bankIds del usuario)` no es tan selectivo como parece a primera vista, porque el usuario "cubre" una fracción grande del universo de bancos/redes posibles.
- El filtro geográfico (ADR-001: `salesChannel`, `geographicScope`, `provinces[]`, `locationModel`+branches) ya vive en columnas indexables de `Promo`/`Commerce` — el filtro grueso más "gratis" de mover a SQL.

---

## Alternativa 1 — Empujar el filtro grueso actual a SQL con `$queryRaw` (mismo patrón que `getPublicPromosPage`)

**Idea general**: replicar exactamente lo que ya hace el path de invitados (líneas 86-199 de `getPromos.ts`) para el path `forMe=true`. Resolver en SQL crudo: `status`, `validFrom`/`validUntil`, `validDays` (bitmask), `provinces[]`, `salesChannel`/`geographicScope`. Traer solo esas candidatas (con `LIMIT` generoso, ej. 1.500-2.000) y recién ahí aplicar el matching de perfil + geografía fina (branches) en TypeScript, igual que hoy.

**Cambios necesarios**: una función nueva tipo `getCandidatePromosForProfile()` que reutilice el SQL crudo ya probado en `getPublicPromosPage`, con `LIMIT` en vez de traer todo.

**Impacto esperado**: alto. De 24.115 filas hidratadas a ~1.500-2.000. Reduce el tiempo de la query principal en un orden de magnitud (de ~18s a probablemente 1-3s), sin tocar la lógica de matching que ya funciona y está probada.

**Riesgos**: el `LIMIT` es una apuesta — si se pone muy bajo, se puede cortar candidatas válidas antes de que el matching de perfil las evalúe (falso negativo: una promo que sí aplicaba al usuario queda afuera solo porque no entró en el top N traído). Mitigable con un `ORDER BY` que priorice como hoy (mayor descuento, `isCSIOnly` último), pero no elimina el riesgo del todo — hay que validarlo con datos reales, no asumirlo.

**Complejidad**: baja-media. Es extender un patrón ya existente y probado (no inventar uno nuevo), pero migrar el SQL crudo del filtro de invitados (más simple) al caso de perfil real (con branches, ADR-001 completo) agrega superficie de bugs.

**Compatibilidad con Recommendation Block**: alta — es exactamente el endpoint que hoy sufre el problema.

**Compatibilidad con Decision Engine futuro**: alta — cualquier motor de recomendación futuro necesita partir de un conjunto acotado de candidatas; esta alternativa es la base mínima para eso.

**Impacto sobre mantenimiento**: medio. Dos caminos de SQL crudo (invitados + perfil) en vez de uno, con lógica parecida pero no idéntica — riesgo de que diverjan con el tiempo si se toca uno y no el otro.

---

## Alternativa 2 — Filtro grueso por banco/wallet directo en SQL (`requirements.bankId IN (...)`)

**Idea general**: además del filtro geográfico/vigencia de la Alternativa 1, empujar también un filtro grueso por entidad financiera: `WHERE requirements.some({bankId: {in: userBankIds}} OR {walletId: {in: userWalletIds}})`. La idea es que la DB descarte de entrada las promos de bancos/wallets que el usuario ni siquiera tiene, antes de aplicar el matching fino (tiers, segmentos, Cuenta DNI) en TypeScript.

**Cambios necesarios**: los mismos de la Alternativa 1, más **2 índices nuevos** en `PromoRequirement` (`bankId`, `walletId`) — sin eso, este filtro sería un scan completo de 40.000+ requirements igual, sin ninguna ganancia.

**Impacto esperado**: medio-alto, pero **menor al esperado ingenuamente**. Con un perfil promedio de ~22 cards cubriendo buena parte de los 41 bancos + 17 wallets del catálogo, este filtro es menos selectivo de lo que parece — no va a recortar tan agresivo como "vigencia+geografía" de la Alternativa 1. Complementa a la Alternativa 1, no la reemplaza.

**Riesgos**: el requirement "sin restricciones" (banco null + wallet null, aplica a todos — REGLA 1 en `getPromos.ts` línea 646) NO puede expresarse bien en un filtro `IN`, porque esas promos deben incluirse siempre, no solo cuando matchean un banco puntual. Hay que armar el `OR` con cuidado para no perder ese caso silenciosamente — es exactamente el tipo de bug sutil que ya pasó antes en este proyecto (ver notas de "Requisito sin entidad financiera" en CLAUDE.md, auto-validador).

**Complejidad**: media. Requiere migración (2 índices — permitido bajo DR-003, a diferencia de DR-001 que congelaba migraciones; hay que confirmar con el CPO si esa restricción sigue en pie o se levanta para este sprint).

**Compatibilidad con Recommendation Block**: alta.

**Compatibilidad con Decision Engine futuro**: alta — cualquier scoring por perfil se beneficia de partir de un set ya pre-filtrado por entidad financiera.

**Impacto sobre mantenimiento**: medio-alto. El filtro SQL tiene que mantenerse sincronizado con las reglas de matching en TypeScript (REGLA 1/2/3) — si cambia una regla de negocio en `matchesProfile`, hay que recordar reflejarla también en el `WHERE` grueso, o se corre el riesgo de que la DB descarte de más (falsos negativos silenciosos, el peor tipo de bug para este caso).

---

## Alternativa 3 — Tabla de índice invertido (`promo_id` × `bank_id`/`wallet_id` materializada)

**Idea general**: en vez de filtrar sobre `PromoRequirement` en tiempo real, mantener una tabla derivada simple (`PromoBankIndex` o similar) con una fila por cada combinación `(promoId, bankId)` / `(promoId, walletId)` que aparece en algún requirement de esa promo, poblada en el momento del scraping/upsert (igual que ya se hace hoy con `activePromoCount` en `Commerce` o `maxDiscountPct`/`isCSIOnly` en `Promo`, ver punto 13 de CLAUDE.md — "Sort DB-level"). Consultar esa tabla index-friendly en vez de la tabla completa de requirements.

**Cambios necesarios**: modelo Prisma nuevo + migración, lógica de recálculo en el scraper (`app/api/admin/scrape/route.ts`) al hacer upsert de cada promo, backfill inicial con script.

**Impacto esperado**: alto — sería la opción más rápida en lectura, porque la tabla índice puede ser angosta (solo IDs, sin el resto de columnas de `PromoRequirement`) y con índice compuesto perfecto para el caso de uso.

**Riesgos**: es la alternativa con más superficie de "estado derivado que se puede desincronizar" — mismo patrón de riesgo que `activePromoCount`, que ya tuvo bugs de sincronización en este proyecto (requiere recalcularse en cada scraper run, cada edición manual desde el admin, cada auto-validación). Agrega una fuente más de verdad para mantener consistente.

**Complejidad**: alta. Es la única alternativa que agrega un modelo nuevo y lógica de mantenimiento de estado derivado, no solo un índice sobre datos existentes.

**Compatibilidad con Recommendation Block**: alta, pero es "usar un cañón para matar una mosca" en esta etapa — el volumen actual (24k promos) probablemente no lo justifique todavía.

**Compatibilidad con Decision Engine futuro**: alta a largo plazo (si el catálogo crece 10x, esta es la alternativa que mejor escala), pero prematura para el volumen de hoy.

**Impacto sobre mantenimiento**: alto — nueva tabla, nueva lógica de sincronización, nuevo lugar donde puede haber bugs de datos desactualizados.

---

## Alternativa 4 — Cache de candidatas por perfil (no por promo individual)

**Idea general**: en vez de optimizar la query en cada request, cachear el resultado ya filtrado por perfil financiero (no por usuario individual, sino por "firma" de perfil — ej. hash de `{bankIds, walletIds, networkIds, tiers}` ordenados). Perfiles idénticos o muy similares (ej. dos usuarios con Banco Macro + Visa) reusan el mismo cómputo. TTL corto (mismo patrón que `unstable_cache` + `revalidateTag` ya usado en `getPublicPromosPage`).

**Cambios necesarios**: función de hash de perfil, capa de cache nueva con invalidación por tag en cada mutación de promos (scraper, admin, auto-validate, expiración) — reusa la infraestructura de `lib/cache/promosCache.ts` que ya existe.

**Impacto esperado**: alto para usuarios recurrentes o perfiles comunes (ej. "Banco Macro + Visa" probablemente lo tengan cientos de usuarios), pero **cero impacto en el primer request de un perfil nuevo** (cache miss) — no resuelve el problema de fondo, solo lo amortiza.

**Riesgos**: la cardinalidad de perfiles únicos puede ser alta (con ~22 cards promedio, las combinaciones posibles son enormes) — el cache podría tener una hit rate mucho menor de lo esperado, y la ganancia real dependería de datos reales de uso que hoy no tenemos.

**Complejidad**: baja — es la alternativa más simple de implementar, porque reusa un patrón que ya existe en el código.

**Compatibilidad con Recommendation Block**: media — ayuda al request repetido pero no resuelve el peor caso (usuario nuevo, primer request), que es justamente el momento más crítico para "no perder al usuario en los primeros segundos" (la razón por la que este sprint es prioritario).

**Compatibilidad con Decision Engine futuro**: baja-media — es una capa de optimización, no un cambio de arquitectura de datos. No resuelve el problema si el Decision Engine necesita personalización más fina que "perfil de tarjetas" (ej. ubicación exacta, que ya varía por usuario aunque compartan banco).

**Impacto sobre mantenimiento**: bajo-medio — reusa infraestructura existente, pero suma una responsabilidad más a `lib/cache/promosCache.ts`.

**Nota**: esta alternativa **no compite** con la 1/2 — es un complemento posible una vez que el flujo de candidatas ya sea rápido, no un sustituto.

---

## Comparación rápida

| | Impacto | Riesgo | Complejidad | Resuelve el "primer request" |
|---|---|---|---|---|
| **1. SQL crudo grueso (geografía+vigencia)** | Alto | Bajo-medio | Baja-media | Sí |
| **2. + filtro banco/wallet en SQL** | Medio-alto | Medio (falsos negativos si el `OR` está mal armado) | Media (+ migración) | Sí |
| **3. Tabla índice invertido** | Alto | Alto (estado derivado) | Alta (+ migración + scraper) | Sí |
| **4. Cache por firma de perfil** | Alto solo en cache-hit | Medio (hit rate incierto) | Baja | **No** |

---

## Lectura personal (no es la decisión final, es para facilitar la del CPO)

La Alternativa 1 es la que mejor calza con la restricción explícita de DR-003 ("no intentar expresar todo el perfil en SQL, eso lo vuelve inmantenible — la DB hace el trabajo grueso y selectivo, TypeScript resuelve el matching complejo"). Reusa un patrón ya construido y en producción (`getPublicPromosPage`), tiene el menor riesgo de introducir bugs de matching, y no requiere ninguna migración — es coherente con no depender de comprar más hardware/plan de Neon.

La Alternativa 2 es un complemento natural de la 1 una vez validada en producción, no un punto de partida — su selectividad real (con perfiles de ~22 cards) es una incógnita que conviene medir con la Alternativa 1 ya funcionando, antes de invertir en el índice + la migración.

La 3 y la 4 tienen su lugar, pero en etapas distintas: la 3 cuando el catálogo escale mucho más allá de 24k promos, la 4 como optimización adicional una vez que el camino frío (primer request) ya sea rápido por sí solo.
