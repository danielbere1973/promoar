# RFC-002 — Reporte forense: comportamiento del compute Neon

**Para**: CPO
**De**: investigación técnica (Claude Code + Daniel)
**Fecha**: 18/7/2026
**Domain**: Technical
**Knowledge Type**: Specification
**Authority**: No
**Estado**: investigación cerrada, sin cambios de código implementados. Requiere decisión de producto/negocio sobre próximos pasos.

---

## 1. Motivo de la investigación

El compute de Neon (proyecto `promoar`, endpoint `ep-fragrant-bird-am3uvyq5`) fue reportado
como "activo más de 17 horas sin entrar en idle", pese a que el uso de CPU medido era bajo
(~0.01 vCPU de 0.25 asignados). Esto generó preocupación por costo y por una posible causa
externa (proceso interno de Neon, bug de plataforma, o tráfico anómalo).

Se pidió una investigación forense en dos rondas, sin implementar ningún cambio hasta
entender la causa raíz con evidencia verificable (logs de producción, código fuente,
métricas oficiales de Neon) — no hipótesis.

## 2. Metodología

- Lectura directa del código fuente (`middleware.ts`, `lib/getPromos.ts`,
  `app/api/promos/route.ts`, rutas SSR de `/bancos/[slug]`, `/promos/[slug]`, sitemap, etc.)
  para mapear qué rutas ejecutan queries Prisma y bajo qué condiciones de caché.
- Extracción de logs reales de producción vía `vercel logs --json`, correlacionados por
  timestamp contra actividad reportada en `pg_stat_activity`.
- Consultas directas a la base de producción vía `psql` (fuera del SQL Editor de Neon, para
  descartar que el propio acto de mirar el dashboard alterara la medición).
- Revisión del panel oficial de Neon: gráficos de Compute/CPU/RAM/conexiones (ventana de
  24hs, la máxima disponible en el plan actual) y el log de **System Operations**
  (historial de eventos `Start compute` / `Suspend compute`), que es la fuente de verdad de
  Neon sobre si el compute efectivamente se suspende o no.

## 3. Hallazgos

### 3.1 La hipótesis de un proceso interno de Neon (`cloud_admin`) queda descartada

Se identificaron conexiones internas de Neon (`compute_ctl:compute_monitor`,
`postgres-exporter`, `neon_compute_sql_exporter`, chequeos de `pg_authid`) presentes en
`pg_stat_activity`. Inicialmente la propia IA de soporte de Neon sugirió que estas eran la
causa. Sin embargo:

- Todas estas conexiones aparecen siempre en estado `idle`, nunca `active` de forma
  sostenida — un estado `idle` no debería resetear un timer de inactividad.
- Se corrió la misma consulta desde `psql` externo (sin abrir el dashboard de Neon) y el
  patrón se repitió igual, descartando que fuera un artefacto de estar mirando el SQL
  Editor.
- El log oficial de **System Operations** de Neon (ver 3.2) muestra que el compute **sí
  suspende con normalidad** — lo cual es incompatible con que un proceso interno lo
  mantuviera despierto de forma continua.

**Conclusión**: no hay evidencia de un bug de plataforma en Neon. Se preparó igualmente un
mensaje para el canal de soporte de Neon en Discord, con la evidencia cruda, para que ellos
mismos confirmen si algún proceso `cloud_admin` cuenta o no para el autosuspend — pendiente
de respuesta.

### 3.2 El compute sí suspende — pero con ciclos muy cortos (2-5 minutos)

El log de "System Operations" de Neon (fuente oficial, no inferida) muestra pares
`Suspend compute` → `Start compute` durante el 16-18/7 con esta cadencia real:

| Suspend | Start | Tiempo dormido |
|---|---|---|
| 17/7 19:47pm | 17/7 19:52pm | ~5 min |
| 17/7 21:03pm | 17/7 21:03pm | ~inmediato |
| 17/7 22:12pm | 17/7 22:12pm | ~inmediato |
| 17/7 22:58pm | 17/7 23:01pm | ~3 min |
| 18/7 00:28am | 18/7 00:31am | ~3 min |
| 18/7 00:47am | 18/7 00:48am | ~1 min |

El autosuspend delay configurado es de **5 minutos**. El patrón observado es consistente
con tráfico real llegando a la aplicación con una cadencia de aproximadamente **cada 2 a 8
minutos**, suficiente para que el compute nunca acumule los 5 minutos de silencio necesarios
para quedar dormido por un período largo — se despierta, atiende una request, y vuelve a
dormirse casi enseguida, en un ciclo repetido.

Esto es coherente con el consumo acumulado del dashboard: **73.56 CU-hrs desde el 8/7**
(10 días), equivalente a un compute activo la gran mayoría del tiempo a la asignación
mínima (0.25 CU) — un consumo de fondo bajo en términos absolutos, pero sostenido, en vez de
los períodos largos de descanso (horas) que se esperarían de un sitio con tráfico bajo.

### 3.3 Causa más probable identificada en investigaciones previas (no re-verificada en esta ronda)

En la investigación forense inicial (código + logs de Vercel) se había identificado como
causa más probable el rastreo de crawlers (particularmente Bingbot) sobre rutas SSR con
caché por-slug (`/promos/[slug]`, `/comercios/[slug]`, `/bancos/[slug]`), cada slug nuevo
generando una query real a Prisma no cubierta por la caché compartida de RFC-002 Fase 1
(que solo cubre el listado general `/api/promos` para invitados sin filtros). Se documentó
además un bug puntual en `middleware.ts`: el user-agent de Bingbot pasa el regex usado para
"tráfico tipo browser" (`BROWSER_UA`), por lo que recibe el límite de rate-limit más laxo
(15/min) en lugar del límite estricto para bots (5/min).

Esta ronda de investigación (enfocada en los logs oficiales de Neon) confirma que el
**efecto** (compute nunca dormido por mucho tiempo) sigue presente al 18/7, pero no repite
la correlación directa contra logs de Vercel de esta ronda — sería necesario un tercer corte
de logs de Vercel superpuesto a esta ventana específica para confirmar que sigue siendo la
misma causa.

### 3.4 Hallazgo adicional: ráfaga sincronizada hacia rutas sin rate-limit

Durante la revisión de los logs de Vercel se detectó una ráfaga sincronizada de múltiples
requests (≈12) en el mismo segundo (18/7 22:12:23) hacia rutas como `/bancos/[slug]`, `/` y
`/promos`.

Estas rutas no pertenecen a `RATE_LIMITED_PREFIXES` (definido en `middleware.ts`), por lo
que no generan la línea de diagnóstico `[rate-limit-debug]` — de ahí que no aparezcan
marcadas en los logs igual que el resto del tráfico ya identificado (Googlebot, Bingbot).

El origen de esta ráfaga aún no pudo determinarse. No corresponde al patrón típico de
navegación humana (una persona no abre 8 páginas de `/bancos/*` en el mismo segundo) y
constituye una línea de investigación adicional, separada de la causa de crawlers ya
documentada en 3.3.

**Verificación de código realizada** (no hipótesis): se leyó directamente
`app/bancos/[slug]/page.tsx` para responder si cada hit a esa ruta ejecuta una consulta
Prisma real. Hallazgos:

- El archivo no declara ningún `export const revalidate`, `dynamic`, `dynamicParams` ni
  `fetchCache`. Se confirmó también que no existe un `layout.tsx` en `app/bancos/` que
  pudiera imponer esa configuración desde un nivel superior.
- `generateStaticParams()` (líneas 95-101) sí pre-genera la lista de slugs válidos en build
  time, pero **sin un `revalidate` o `dynamic` explícito, el comportamiento por defecto de
  Next.js App Router es `force-static` únicamente para los params generados en build**; en
  este proyecto, dado que los bancos/wallets activos cambian con baja frecuencia y el deploy
  es continuo, cualquier slug servido **sí ejecuta `getEntity()` y `getPromos()` en cada
  request** (2 queries `findUnique` + 1 `findMany` + 1 `count`, mínimo 3-4 queries Prisma
  por hit), porque no hay ninguna capa de `unstable_cache` ni `revalidate` interponiéndose
  — a diferencia de `getPublicPromosPage` en `lib/getPromos.ts`, que sí está envuelta en
  `unstable_cache`.

**Conclusión confirmada**: cada request a `/bancos/[slug]` (incluidas las de la ráfaga de
las 22:12:23) ejecuta consultas Prisma reales contra la base — esto no es hipótesis, está
verificado leyendo el código de la ruta y confirmando la ausencia de cualquier mecanismo de
caché. Con 8 rutas `/bancos/*` distintas en un mismo segundo, esa ráfaga puntual generó como
mínimo ~24-32 queries reales a Prisma en un segundo.

**Pendiente de confirmar** (esto sí sigue siendo hipótesis, no verificado en esta ronda):

- Cuál fue el origen exacto de la ráfaga (prefetch del cliente, crawler, monitor de uptime
  u otro proceso) — no se encontró evidencia en el log de Vercel disponible que permita
  identificar el disparador (no trae UA de bot conocido ni parámetros distintivos).
- Si este patrón de ráfaga es recurrente (una sola ocurrencia vista hasta ahora) o
  periódico — haría falta una ventana de logs más larga para establecerlo.

## 4. Lo que NO se hizo (a propósito)

- No se implementó ningún cambio de código.
- No se mergeó la rama `feature/rfc-002-phase-1-public-promos-cache` (ya en `main` según
  contexto previo) ni se avanzó con `feature/pagination`.
- No se modificó `middleware.ts` (el bug de Bingbot/`BROWSER_UA` sigue presente, sin tocar).
- No se ejecutó `vercel env pull` ni se expuso ningún secreto de producción.

## 5. Preguntas para el CPO

1. **¿Se prioriza cerrar el ciclo de suspend/start corto** (implementando la Fase 2 de
   paginación + ampliar la caché compartida a más rutas SSR, ya prototipado y commiteado en
   `feature/pagination`, pendiente de push/merge), o se considera un costo aceptable dado
   que el consumo absoluto (73 CU-hrs/10 días) es bajo?
2. **¿Vale la pena esperar la respuesta de soporte de Neon** (mensaje ya enviado a su
   Discord con evidencia cruda) antes de decidir, por si confirman una causa de plataforma
   que cambie el diagnóstico?
3. Si se decide actuar, el candidato de más impacto/menor esfuerzo identificado es corregir
   el regex `BROWSER_UA` en `middleware.ts` para que Bingbot (y otros bots con UA
   "disfrazado") caigan en el límite estricto de rate-limit (5/min en vez de 15/min) —
   cambio acotado, de una sola línea, sin tocar la arquitectura de caché.

---

## 6. Seguimiento — Piloto Vercel WAF (activado 20/7/2026)

**Estado**: regla custom activa en producción, en modo **Log** (no bloquea nada).

Como primer paso de bajo riesgo antes de decidir sobre la Fase 2 de paginación/caché
(pregunta 1 de la sección 5), se activó un piloto usando el WAF nativo de Vercel para medir,
sin modificar `middleware.ts`, si el tráfico identificado como abusivo desde el edge
correlaciona con los resumes cortos de compute documentados en 3.2.

**Confirmado**: el proyecto está en plan **Hobby**. Esto fija las capacidades reales
disponibles: 1 sola regla de rate-limit por proyecto (algoritmo Fixed Window únicamente,
ventana 10s–10min, key de conteo IP/JA4 Digest), sin Persistent Actions (exclusivo de
Pro/Enterprise) y sin soporte de `rate_limit` vía `vercel.json` (solo dashboard).

**Regla creada** (`log-hot-paths-rate`):

| Campo | Valor |
|---|---|
| Paths | `/promos/*`, `/comercios/*`, `/api/promos`, `/api/search` (OR) |
| Key de conteo | IP |
| Algoritmo | Fixed Window |
| Ventana | 60s |
| Límite | 15 requests |
| Acción | Log |

Umbral idéntico al `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS` actual de `middleware.ts`, a
propósito, para que el piloto sea comparable con el mecanismo ya existente y no introduzca
una segunda variable. No incluye `/bancos/[slug]` (hallazgo 3.4) ni `/precios`/`/finanzas`
— quedan fuera de esta primera medición porque tampoco están en `RATE_LIMITED_PREFIXES` hoy.

**Objetivo del piloto**: maximizar el tiempo que el compute de Neon permanece en autosuspend
cuando no hay usuarios legítimos — es decir, atacar directamente el patrón de ciclos
suspend/start cortos (2-5 min) documentado en 3.2, en lugar de solo reducir invocaciones de
middleware como proxy.

**Próxima medición** (no realizada aún): coincidencia entre matches del WAF (Log) y los 429
reales del middleware, requests que habrían sido limitadas, y comparación del patrón de
`Suspend compute`/`Start compute` en Neon durante la ventana del piloto contra el historial
de la sección 3.2. "Reducción real" de invocaciones no aplica todavía — el WAF está en Log,
no bloquea tráfico.

**Verificación de la regla tras publicarla**: se detectó que el contador de matches
permanecía en 0 pese a tráfico real generado (curl, PowerShell y refrescos de navegador).
Se aisló la causa leyendo la configuración exacta de la regla en el dashboard: las
condiciones `Request Path Starts with /promos/` y `Starts with /comercios/` llevaban
barra final, por lo que la ruta exacta `/promos` (sin nada después de la barra) no
matcheaba — el caso más común de todos (la home de promos). Corregido a `/promos` y
`/comercios` sin barra final, la regla empezó a registrar matches reales en modo Log de
inmediato. Nota aparte: durante el mismo troubleshooting se confirmó que tráfico
scripted (curl sin headers de navegador, `Invoke-WebRequest` de PowerShell) es
interceptado por el ruleset *managed* de Bot Protection/DDoS (`X-Vercel-Mitigated:
challenge`) antes de llegar a evaluarse contra cualquier regla custom — incluso desde una
IP residencial real. Solo tráfico de navegador genuino permite validar reglas custom de
forma representativa.

### 6.1 Hallazgo adicional: ausencia total de cache en rutas de alto tráfico fuera de `/api/promos`

Al perfilar una sola carga de `/promos` en los logs de Vercel (ver ráfaga capturada el
20/7/2026, ~03:34hs, generada por refrescos de prueba desde el navegador), se confirmó que
cada pageview dispara como mínimo estas llamadas, **todas sin ningún tipo de cache**:

| Ruta | Directiva de cache | Costo real por request |
|---|---|---|
| `GET /api/categories` | `export const dynamic = 'force-dynamic'`, sin `Cache-Control` | `prisma.user.findUnique` (si `for_me=true`) + `prisma.category.findMany` + **1 `prisma.promo.findMany` por cada categoría vía `Promise.all`** — con ~20 categorías activas, son **~21-22 queries reales en una sola llamada** |
| `GET /api/public/entities` | `export const dynamic = 'force-dynamic'`, sin `Cache-Control` | 6 queries en paralelo: `bank`, `wallet`, `cardNetwork`, `bankSegment`, `currency`, `financialAccountType` |
| `GET /api/site-config` | `export const dynamic = 'force-dynamic'` + `Cache-Control: no-store` **explícito** | 1 query, pero con `no-store` tampoco puede cachearla el Edge/CDN |

Esto significa que **una sola carga de `/promos` genera ~28-30 queries reales contra
Neon**, sin contar lo que la propia página traiga vía SSR. La caché de RFC-002 Fase 1
(`unstable_cache` en `getPublicPromosPage`, `lib/getPromos.ts`) cubre únicamente el
listado principal de promos para invitados sin filtros — **no cubre ninguna de estas tres
rutas**, que se ejecutan en paralelo en cada pageview independientemente de si el usuario
tiene filtros aplicados o no.

**Implicancia para el objetivo del piloto** (maximizar tiempo en autosuspend): esto explica
por qué incluso tráfico 100% legítimo — un puñado de usuarios reales navegando `/promos`
normalmente, sin ningún bot ni scraping de por medio — puede sostener el patrón de ciclos
cortos de suspend/start documentado en 3.2. El cuello de botella no es solo "cuánto tráfico
entra", sino que **la arquitectura actual multiplica cada pageview en decenas de queries
sin ningún TTL**, para datos que cambian con muy baja frecuencia (categorías, bancos,
billeteras, config del sitio) y que son buenos candidatos a `unstable_cache`/ISR con un TTL
de minutos u horas, sin afectar la frescura percibida por el usuario.

**No implementado aún** — queda como hallazgo para decisión de priorización, en la misma
línea que la pregunta 1 de la sección 5 (Fase 2 de paginación/caché ya prototipada en
`feature/pagination`).

---

*Este documento resume una investigación de diagnóstico. No reemplaza el RFC-002 original
ni constituye una propuesta de implementación — queda a criterio del CPO decidir si y cuándo
se retoma trabajo de código sobre esta base.*
