# PromoAR — Incidentes de tráfico no deseado / consumo de Neon (8/7 al 17/7/2026)

**Domain**: Technical
**Knowledge Type**: Support
**Authority**: No

## Contexto
Neon Postgres (plan pago, $0.106/CU-hr, sin CU-hrs gratis incluidas) se mantenía con compute
activo casi sin cortes (casi nunca entraba en idle) pese a tráfico real bajo (~66 visitantes/
140 vistas en 24h). El SSR de `/promos/[slug]` usa `revalidate=0` (query real a Prisma en cada
request), así que cualquier tráfico automatizado sostenido se traduce directo en gasto.

Se descartó de entrada (verificado en código, no supuesto): Vercel Cron Jobs (no existen),
ISR regenerándose sola (es lazy, no hay self-trigger), prefetch de `<Link>` (no se usa para
detalle de promo), webhooks de terceros (no existen), mala higiene de Prisma en los scrapers
(usan un singleton correcto).

## Incidente 1 — 13/7: 3 IPs francesas (OVH) fijas
**Causa**: 3 IPs (145.239.195.38, 147.135.252.138, 62.84.185.63) con conteo idéntico
sospechoso (241 req/24h c/u) + 403s repetidos a las mismas URLs — firma clásica de bot.
**Fix**: bloqueo directo de esas 3 IPs en Vercel Firewall + ruleset nativo "Bot Protection"
pasado de Log → Challenge.
**Resultado**: bajó el consumo pero solo ~22% (de ~7.5 a ~5.8 CU-hrs/día) — no era la causa
dominante.

## Incidente 2 — 14/7: promos vencidas devolviendo 200 + query extra
**Causa**: `app/promos/[slug]/page.tsx` devuelve HTTP 200 (no 404) en promos vencidas
(a propósito, para no matar el SEO de la URL), pero además corría un `findMany` extra sin
condición para mostrar "otras promos activas del comercio". Un bot repitiendo la misma URL
vencida escaló de 0 a 150+ req/hora en 24h, cada hit pagando 2 queries en vez de 1.
**Fix**: se eliminó el `findMany` extra; se reemplazó por un link estático a la página del
comercio usando datos ya cargados (costo Prisma adicional = 0). Commit `eef84b8`.

## Incidente 3 — 15/7: mismo patrón pero con promos borradas (no solo vencidas)
**Causa**: la rama `!promo` (promo eliminada de la DB, no solo vencida) corría 3 queries por
hit (`findUnique` miss + `findFirst` de comercio + `findMany` de requisitos) para armar una
página de "sugerencias" — y esta rama nunca podía cachearse por ISR porque el slug no está en
`generateStaticParams`. Un bot repitiendo `/promos/grimoldi-20pct-galicia-vie-mqq6xzcw`
(promo borrada) pagaba el costo completo por siempre.
**Fix**: reemplazado por una sola query liviana (`findFirst` solo del slug del comercio) +
redirect 301 a la página del comercio — corta a 1 query y le "enseña" a Google/bots a dejar
de re-pedir la URL muerta. Commit `73c203a`.

## Incidente 4 — noche 16→17/7: scraping desde múltiples IPs argentinas rotando
**Causa**: a diferencia del incidente 1 (IPs fijas extranjeras), esta vez fueron varias IPs
residenciales de Argentina (~2500 req/día c/u), rotando — el geo-block por país en
`middleware.ts` no sirve porque son IPs argentinas legítimas en apariencia. Patrón: crawling
secuencial de `/promos/[slug]` y `/comercios/[slug]` a ~1 req/seg sostenido, sin pausas.
**Fix**: rate-limit propio en `middleware.ts` (in-memory, sliding window), en 2 pasos el mismo
día:
1. 40 req/min por IP en `/promos/`, `/comercios/`, `/api/promos`, `/api/search`.
2. Endurecido a 15 req/min general, y **5 req/min para cualquier cliente cuyo User-Agent no
   matchea patrón de navegador real** (`mozilla|chrome|safari|firefox|edg`). Este heurístico
   por tipo de cliente es la parte más durable del fix, porque ataca la clase de cliente
   (script no-navegador) en vez de una lista de IPs que hay que actualizar cada vez.

**Bug encontrado el mismo día — el rate-limit nunca se disparaba**: la detección de IP usaba
`x-real-ip` ?? `x-forwarded-for`, pero en Vercel Edge Middleware ninguno de los dos llega
seteado de forma confiable — caía siempre a `'unknown'`, y el código explícitamente se salta
el rate-limit cuando la IP es `'unknown'`. Por eso nunca se vio ni un solo 429 pese al tráfico
sostenido. **Fix**: agregar `x-vercel-forwarded-for` (el header que Vercel sí garantiza con la
IP real) como primer fallback. Confirmado funcionando en producción con un log de debug
temporal (dejado activo a pedido explícito, no genera problema real) — se vieron 429 reales
contra la IP scraper `190.227.142.90`.

**También se activó**: el ruleset nativo "AI Bots" de Vercel Firewall (Log → Block) — bloquea
bots de scraping/LLM conocidos (GPTBot, ClaudeBot, CCBot, etc.), independiente del heurístico
propio.

**Hallazgo importante**: al revisar el log de debug, buena parte del tráfico "sospechoso" de
esa noche resultó ser **Googlebot y Bingbot reales** (verificado por rango de IP oficial:
`66.249.65.x` Google, `52.167.144.x`/`40.77.167.x` Microsoft/Bing), no un atacante. Como su
User-Agent contiene "Mozilla/Chrome/Safari" igual que un navegador real, caen en el límite de
15/min (no en el de 5/min de bots), y como Google/Bing reparten los requests entre muchas IPs
rotativas, ninguna IP individual cruzaba el umbral — de ahí la carga sostenida sin ningún 429.
Esto también explica por qué Vercel Analytics no mostraba a nadie online: Analytics solo
cuenta ejecución de JS del lado del cliente, que ningún crawler dispara.

**Causa raíz del volumen de crawling**: Google Search Console mostró un salto de ~15k a ~44.1k
URLs conocidas desde ~9/7 (coincide con que el sitemap ahora incluye todo el catálogo de
promos/comercios). El propio gráfico de "Estadísticas de rastreo" de GSC confirma un pico real
de ~40k requests/día alrededor del 3/7, bajando hacia baseline para el 15/7 — con el matiz de
que GSC tiene varios días de demora en sus datos, así que no se pudo confirmar en el momento
si lo que se veía en vivo el 17/7 era una ola nueva o el mismo fenómeno ya conocido.

Se verificó que Google no tiene throttle manual de crawl-rate disponible (lo deprecó, ahora es
automático); Bing sí respeta `Crawl-delay` de `robots.txt` pero Google lo ignora.

**Postura de Dani**: pagar el costo de indexar 44k páginas *una vez* está bien; que Google
recrawlee el catálogo completo todo el tiempo, para siempre, sí sería un problema de costo
real. Pendiente: revisar de nuevo el gráfico de GSC en 2-3 días para ver si el pico fue
puntual (como el del 3/7) o es un nuevo piso más alto sostenido.

## Estado actual (17/7)
- Rate-limit en `middleware.ts` funcionando y confirmado con 429 reales.
- Firewall bloqueando IPs específicas conocidas + rulesets "AI Bots" y "Bot Protection" activos.
- Log de debug temporal dejado corriendo a propósito (no genera costo relevante).
- Abierto: confirmar si 3 IPs nuevas con volumen alto (`40.77.167.121` — probablemente Bing
  legítimo, mismo rango ya confirmado; `181.8.130.154` y `181.9.208.143` — a confirmar) son
  scrapers nuevos o tráfico legítimo, antes de bloquear.
- Pendiente explorar si Vercel Firewall tiene, en el plan de Dani, una regla nativa de
  "rate limiting por volumen" (no la encontró en su dashboard) como alternativa más robusta
  al rate-limit propio en memoria (que es best-effort, por instancia de Edge, no compartido).

## Filosofía general (aclarada explícitamente por Dani)
"A mí no me jode que me scrapeen. Me jode que me generan un gasto para beneficio de otros."
El objetivo no es bloquear el acceso a datos públicos por principio, sino evitar que terceros
externalicen su costo de infraestructura sobre la cuenta de Neon/Vercel de PromoAR.
