# CTO → CPO: consulta de estrategia — indexación de páginas de promo individual

**Fecha**: 29/8/2026
**De**: CTO (Claude)
**Para**: CPO (Daniel/Gemini)
**Tipo**: Consulta de estrategia, no implementación — requiere decisión de producto antes de tocar código de SEO

## Disparador

Daniel reportó que Neon (la DB) lleva casi 24hs sin bajar de actividad, con el diagnóstico "google no para, me tiene harto". Investigación con Runtime Logs de Vercel confirmó la causa exacta.

## Diagnóstico técnico (cerrado, con evidencia)

Googlebot está rastreando de forma sostenida y continua miles de slugs distintos de `/promos/{slug}` y `/comercios/{slug}` — sin repetir ninguno en ventanas de 30 min, a un ritmo de ~1 request cada 10-90 segundos. No es un bug de caché ni de rate-limit: es indexación de descubrimiento inicial de un catálogo grande, más un volumen no menor de 404s (slugs de promos ya borradas/expiradas que Google sigue re-pidiendo).

**No fue disparado por ningún cambio nuestro.** No corrió ningún scraper en ese período. La explicación real: `app/sitemap.ts` expone el catálogo completo de promos activas (miles de URLs, paginado de a 5000 por sub-sitemap, regenerado cada 24hs) desde hace semanas. Google revisita sitemaps por su cuenta, en su propio calendario — no necesita ningún trigger nuestro para decidir "hoy termino de indexar lo que me falta".

**Fix técnico ya aplicado** (`commit b741ea9` en `main`, cherry-pick de `7bd1d12` en `feature/nueva-home`, **pendiente de push**): cachea con `unstable_cache` la query de resolución de redirect cuando un slug de promo ya no existe (antes: cada re-crawl de una URL muerta disparaba una query nueva a Prisma sin cachear). Esto corta el desperdicio en 404s repetidos, pero **no** afecta el volumen de descubrimiento de slugs que sí existen — eso es indexación legítima de contenido real y termina solo cuando Google completa el barrido.

## La pregunta de fondo (esto es lo que requiere tu decisión)

Daniel hizo la pregunta correcta, y es una de producto, no técnica: **¿tiene sentido indexar 15.000+ páginas de promo individual en Google, en un catálogo que rota constantemente (promos vencen y se reemplazan en semanas)?**

Puntos a favor de reconsiderar la estrategia actual (indexar todo):

- **Contenido fino/casi-duplicado a escala**: miles de páginas con la estructura "[Comercio] + [% descuento] + [Banco]" son exactamente el patrón que Google tiende a tratar como contenido de bajo valor, no el que premia en ranking.
- **Vida útil corta**: una promo dura semanas; la URL indexada persiste en el índice de Google mucho más que la vigencia real de la oferta, generando 404s/redirects que hay que sostener indefinidamente (como el propio caso que disparó esta consulta).
- **Costo de mantenimiento recurrente**: cada slug nuevo/borrado exige trabajo del sitemap, invalidación de caché, y ahora rate-limiting — todo por páginas que probablemente no son las que traccionan las 1230 impresiones/22 clics que ya vimos en Search Console (esas métricas no están desglosadas por tipo de página todavía).
- **Alternativa disponible**: `/comercios/{slug}` (ej. "todas las promos de Coto") y `/bancos/{slug}` son páginas con valor de permanencia real — agregación estable, no rotan cada 2 semanas — y ya están indexadas. Estas podrían ser el eje SEO real, dejando `/promos/{slug}` como páginas funcionales para usuarios que ya llegaron al sitio (compartir, favoritos, deep-link) pero sacadas de sitemap.ts + con noindex.

Puntos en contra / riesgo de tocar esto sin datos:

- No tenemos el desglose de Search Console por tipo de URL — es posible que una porción de las 1230 impresiones/22 clics ya reportadas SÍ vengan de páginas de promo individual (long-tail: "20% Coto Visa hoy"), y sacarlas del índice sería tirar tracción ya ganada.
- Es un cambio "radical" en términos de SEO (palabras de Daniel) — no reversible instantáneamente: Google tarda en des-indexar tanto como en indexar, así que un volantazo mal calibrado puede costar semanas de visibilidad para recuperarlo si nos equivocamos.

## Pedido concreto

Necesitamos definición de producto antes de que el CTO toque `sitemap.ts` o `generateMetadata` (noindex) en las páginas de promo. Opciones sobre la mesa, no excluyentes:

1. **Sacar `/promos/{slug}` del sitemap + noindex**, apostando todo el peso SEO a `/comercios/{slug}` y `/bancos/{slug}`.
2. **Mirar primero Search Console** desglosado por patrón de URL antes de decidir, para no tirar tracción real si ya existe.
3. **Dejarlo como está** — aceptar el rastreo inicial como costo transitorio de tener el catálogo indexado, y confiar en que el fix de caché (b741ea9, listo para push) alivia lo suficiente el desperdicio en 404s.

## Estado técnico actual (sin cambios pendientes de tu decisión)

- Fix de caché de 404 (`b741ea9`): commiteado en `main` local, **no pusheado** — a la espera de definir si esto se enmarca en un cambio más grande de estrategia SEO o se pushea solo como está.
- Nada de `sitemap.ts` ni `generateMetadata` de `/promos/[slug]` fue tocado en esta consulta — es puramente diagnóstico + pedido de decisión.
