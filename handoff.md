# Handoff — PromoAR

_Generado: 2026-08-02_

## 1) Estado actual del proyecto

PromoAR es una app Next.js 14 (App Router) + Prisma + PostgreSQL (Neon) que agrega y
muestra promociones bancarias de Argentina, con matching por perfil financiero del
usuario (banco, tarjeta, billetera). Migrada de CockroachDB a Neon el 27/6/2026.

**Terminado y estable**: 23 scrapers de bancos/billeteras/redes, categorías dinámicas,
filtros avanzados, búsqueda de productos por comercio, tarjetas agrupadas por comercio,
SSR de `/promos`, auto-validador de promos DRAFT, tour guiado, paginación (rama
`feature/pagination`, commiteada pero sin mergear a `main`).

**En curso ahora mismo — sprint `sprint/cobertura-ubicacion-explorar`**: ADR-001 (modelo
de cobertura geográfica: `LocationModel`, `SalesChannel`, `GeographicScope`) implementado,
PR #9 abierto hacia `main`. El Preview de ese PR estaba roto (P2022: `geographicScope` no
existía en la DB que usaba el Preview) — **ya resuelto esta sesión** separando las
variables de entorno de Vercel (ver sección 2). Falta mergear el PR.

**Bug descubierto y arreglado esta sesión (sin commitear todavía)**: el scraper de BBVA
tenía un off-by-one de paginación que hacía que 4 comercios (Dexter, Moov, Stock Center,
Zara) nunca se descubrieran pese a existir. Fix aplicado en código, pendiente de correr
localmente contra producción para confirmar y de commitear.

## 2) Decisiones importantes tomadas esta sesión

### a) Todos los Preview de Vercel usan `dev-promoar`, sin overrides por branch
**Decisión**: `DATABASE_URL`/`DIRECTURL` con scope `Preview` (global, todo el proyecto)
apuntan siempre a la base de desarrollo (`ep-cool-lake`, alias "dev-promoar"). Production
sigue apuntando a `ep-fragrant-bird` (producción real). Ningún branch tiene su propio
override.

**Por qué**: antes, Preview y Production compartían la misma variable — por eso el Preview
de PR #9 fallaba (código con schema ADR-001 corriendo contra una base sin esa migración).
El usuario prefirió esta solución global (en vez de un override específico para la rama del
PR) para no tener que mantener configuraciones por branch en el futuro — menos fricción de
mantenimiento a largo plazo.

**Alternativa descartada**: crear un override de `DATABASE_URL` específico solo para la
branch `integration/cobertura-ubicacion` (Vercel permite scope Preview + branch puntual).
Se descartó explícitamente porque obligaría a repetir la configuración en cada PR/branch
nuevo — el usuario prefirió la solución global de una sola vez.

**Cómo se hizo (importante para no repetir el problema)**: Vercel no permite tener dos
variables con el mismo nombre si sus scopes se superponen. Como ya existía una variable
`DATABASE_URL` con scope combinado `Production, Preview`, hubo que primero achicar su
scope a solo `Production` (esto se hizo **manualmente por el dashboard de Vercel**, no por
CLI, para evitar tener que re-tipear el valor de producción desde la CLI — `vercel env
update` exige reingresar el valor incluso si solo cambiás el scope, y `vercel env pull`
redacta los valores sensibles así que no hay forma de verificar que quedó igual). Recién
después se agregó por CLI la nueva variable `DATABASE_URL`/`DIRECTURL` con scope `Preview`
apuntando a dev-promoar.

### b) Nunca tocar producción sin autorización explícita — regla dura de la sesión
**Decisión**: ninguna migración nueva, ningún cambio a `main`, ningún dato de producción
tocado sin que el usuario lo pida explícitamente palabra por palabra.

**Por qué**: instrucción explícita y repetida del usuario ("NADA DE PRODUCCION PUEDE
CAMBIAR", "No tocar producción ni ejecutar migraciones nuevas"). Se mantuvo estricta incluso
cuando hacía el trabajo más lento (ej. no reconstruir el valor de la connection string de
producción de memoria, preferir que el usuario lo edite él mismo en el dashboard).

**Alternativa descartada**: en un momento fue necesario correr un chequeo de solo lectura
contra la base de producción (ver si tenía el schema ADR-001) — el propio sistema de
permisos bloqueó el intento por tener la connection string de producción embebida en un
comando. No se buscó ningún workaround; se reportó el bloqueo al usuario en vez de
sortearlo.

### c) Diagnóstico del Preview vía bypass de Vercel Deployment Protection, no compartiendo credenciales del usuario
**Decisión**: para poder hacer `curl` a un Preview con SSO activado, se usó el mecanismo
oficial "Protection Bypass for Automation" de Vercel (secret por proyecto, pasado como
query params `?x-vercel-protection-bypass=...&x-vercel-set-bypass-cookie=true`), no pedirle
al usuario que comparta una sesión de navegador ni cookies personales.

**Por qué**: es el mecanismo soportado por Vercel específicamente para este caso
(automatización/testing contra Preview protegido), evita depender de sesión humana.

### d) Root cause del P2024 (`generateStaticParams` con 16.180 páginas) — reportado, NO arreglado
**Decisión**: se identificó que `app/comercios/[slug]/page.tsx` intenta pre-renderizar
16.180 páginas en build, saturando el pool de conexiones de `dev-promoar` (más chica/menos
provisionada que producción). Se probaron 3 variantes de `connection_limit` en la connection
string (sin setear, 10, 3) — ninguna resolvió el síntoma, confirmando que el cuello de
botella es volumen de concurrencia en build, no tuning de pool por cliente.

**Por qué no se arregló**: no bloquea el deploy (Next.js hace fallback a render on-demand,
`status: Ready` igual) y no afecta al endpoint que el usuario necesitaba validar
(`/api/promos`, 0 ocurrencias de esa ruta en los logs de error). Se decidió reportarlo como
hallazgo informativo y no tocar código sin pedido explícito del usuario — consistente con la
regla de "no cambios no solicitados".

**Alternativa descartada**: seguir ajustando `connection_limit`/`pgbouncer` en la connection
string. Descartada porque ya se probó exhaustivamente (3 valores distintos, mismo error
persistente) — no vale la pena reintentar por esa vía; si se ataca, hay que limitar la
concurrencia de `generateStaticParams` o reducir cuántos slugs pre-renderiza.

### e) Fix del bug de paginación de BBVA (off-by-one)
**Decisión**: en `lib/scrapers/bbva.ts`, cambiar `let pager = 1` a `let pager = 0`, y el
corte de página final de `pager >= totalPages` a `pager >= totalPages - 1`.

**Por qué**: la API de BBVA (`communications?rubros={id}&pager={n}`) pagina desde `pager=0`
(confirmado inspeccionando qué pide el navegador real: `pager=0` es la página 1 visible en
el sitio). El scraper arrancaba en `pager=1`, saltándose siempre los primeros 20 resultados
de cada uno de los 13 rubros. En el rubro "Moda" (`idRubro=170`), esos 20 items salteados
incluían justo a Dexter, Moov, Stock Center y Zara (IDs 86596/86597/86598 y el de Zara) —
por eso nunca se descubrían pese a existir y responder bien vía `/communication/{id}`
directo.

**Cómo se confirmó**: se comparó el request real que hace el navegador (`pager=0`, provisto
por el usuario) contra `curl` manual — `pager=0` sí trae a los 4 comercios en la respuesta;
`pager=1` (lo que usaba el scraper) no.

**Alternativa descartada**: se había planteado inicialmente la hipótesis de que fuera un
"gap estructural" de cómo BBVA expone su índice (promos accesibles solo por ID directo,
nunca listadas) — se descartó una vez confirmado el patrón real (simple off-by-one), no
hace falta investigar un endpoint alternativo de descubrimiento ni hacer range-scan de IDs.

**Estado**: el fix está aplicado en el archivo, **sin commitear**. No se corrió el scraper
completo contra producción todavía — el último intento de correrlo dio `403 No disponible
fuera de Argentina` porque se corrió sin querer desde `promoar.com.ar` (Vercel, fuera de
Argentina) en vez de localhost.

### f) BBVA debe correrse siempre local, nunca desde Vercel/GitHub Actions
**Decisión**: documentado en CLAUDE.md, mismo patrón que ya existía para ICBC.

**Por qué**: BBVA devuelve `403 {"error":"No disponible fuera de Argentina"}` cuando el
request viene de un servidor de Vercel (geo-IP fuera de Argentina). Confirmado que el mismo
request desde `localhost` (IP residencial de Buenos Aires) responde `200` sin problema.

**Alternativa descartada**: ninguna investigada aún (ej. proxy con IP argentina) — no se
evaluó porque correr local ya es un patrón conocido y aceptado para ICBC, se aplicó el mismo
criterio sin buscar alternativas más complejas.

## 3) Próximo paso

**Tarea inmediata pendiente**: correr el scraper de BBVA **localmente** (con `.env`
apuntando a producción, que el usuario ya dejó configurado así) para confirmar que el fix
de paginación efectivamente descubre las promos de Dexter, Moov, Stock Center y Zara. Una
vez confirmado:
1. Commitear el fix de `lib/scrapers/bbva.ts`.
2. Volver a dejar `.env` apuntando a `dev-promoar` (no a producción) si corresponde al flujo
   normal de trabajo local.

**Después de eso**, según lo que quede abierto de esta sesión:
- Decidir si mergear PR #9 (ADR-001) a `main` — el Preview ya está validado y funcionando.
- Decidir si vale la pena atacar el issue de `generateStaticParams` en
  `app/comercios/[slug]/page.tsx` (16.180 páginas, satura pool de `dev-promoar` en build) o
  dejarlo como está dado que no bloquea nada hoy.

## 4) Información útil para la próxima conversación

### Arquitectura / stack
- Next.js 14 App Router, Prisma ORM, PostgreSQL en Neon (migrado de CockroachDB el
  27/6/2026). Scrapers con Playwright + fetchers custom en `lib/scrapers/`.
- `prisma/schema.prisma` línea 8: Prisma lee `DIRECTURL` (sin guion bajo), no `DIRECT_URL`
  — error fácil de cometer al crear variables de entorno nuevas.
- `lib/prisma.ts`: singleton `PrismaClient` correctamente implementado (dedupe dentro de
  una invocación warm), pero no ayuda entre invocaciones serverless separadas — cada
  función de Vercel es su propio proceso con su propio pool de conexiones.

### Vercel — entornos y bases de datos (estado actual, post esta sesión)
- **Production**: `DATABASE_URL`/`DIRECTURL` → `ep-fragrant-bird` (Neon prod real).
- **Preview** (todos los branches, sin overrides): `DATABASE_URL`/`DIRECTURL` →
  `ep-cool-lake` ("dev-promoar"), con `pgbouncer=true&channel_binding=require&connection_limit=3`
  en `DATABASE_URL`.
- **Localhost** (`.env` del repo): normalmente apunta a `ep-cool-lake` (dev-promoar) también
  — el usuario lo cambia manualmente a producción cuando necesita correr un scraper real
  (como BBVA) y probar contra datos reales. Recordar preguntar/confirmar a qué apunta antes
  de correr algo que escriba en la DB.
- `vercel env pull` redacta (blanquea) valores marcados como sensibles — no sirve para leer
  secretos hacia atrás.
- Deployment Protection (SSO) en Preview: bypass vía "Protection Bypass for Automation"
  (secret por proyecto, Settings → Deployment Protection), pasado como
  `?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true` — primera respuesta
  es un 307 que setea cookie `_vercel_jwt`; hay que reusar esa cookie en el siguiente
  request para llegar a la respuesta real de la app.

### Scrapers con restricción de origen (correr SIEMPRE local, nunca Vercel/GH Actions)
- **ICBC** (`lib/scrapers/icbc.ts`): WAF de `utilidades-icbc-prod.pisol.net` bloquea IPs de
  datacenter de GitHub Actions runners.
- **BBVA** (`lib/scrapers/bbva.ts`): geo-IP block, `403 No disponible fuera de Argentina`
  cuando el request no viene de una IP argentina (Vercel corre fuera de Argentina).

### BBVA scraper — detalle técnico del fix de esta sesión
- API pública: `https://go.bbva.com.ar/willgo/fgo/API/v3/communications?rubros={id}&pager={n}`.
- Paginación 0-origen: `pager=0` es la primera página (20 items). El mensaje de respuesta
  dice `"Comunicaciones: N   paginas: M"` con `M` en formato "cantidad de páginas" (1-origen
  conceptualmente), así que la última página válida es `pager === M - 1`.
- Rubros se obtienen dinámicamente de `GET /rubros/filtro?filtro_padre=true` (no hardcodeado
  en el scraper) — 13 rubros activos, incluyendo `idRubro=170` = "Moda".
- Fix aplicado en `lib/scrapers/bbva.ts` líneas ~184-206 (`let pager = 0` en vez de `1`,
  corte en `pager >= totalPages - 1`). **Sin commitear.**

### Convención de trabajo con el usuario (importante)
- Nunca tocar producción, nunca ejecutar migraciones, nunca mergear a `main` sin pedido
  explícito y literal del usuario.
- Ante cualquier acción irreversible o que exponga secretos (re-tipear connection strings,
  etc.), preferir que el usuario la haga manualmente por el dashboard en vez de que el
  agente reconstruya el valor de memoria.
- El usuario se frustra fuerte si se pierde contexto de sesiones anteriores por
  compactación automática — cuando se detecte que un tema "ya se habló" pero no está claro
  el detalle, conviene grepear la transcripción completa en
  `C:\Users\pablo\.claude\projects\c--Users-pablo-Proyectos-promoar\*.jsonl` antes de asumir
  o re-preguntar desde cero.
- Ver también memoria persistente en
  `C:\Users\pablo\.claude\projects\c--Users-pablo-Proyectos-promoar\memory\MEMORY.md` — tiene
  el estado acumulado de sesiones previas (Cencosud, MODO, SSR/paginación, Neon, ADR-001,
  etc.), conviene revisarla al arrancar la próxima conversación.

### Problemas conocidos, no resueltos, fuera del alcance de esta sesión
- `generateStaticParams()` en `app/comercios/[slug]/page.tsx` pre-renderiza 16.180 páginas
  en build, satura el pool de `dev-promoar` (errores P2024 en logs de build), no bloquea el
  deploy pero es una señal de que el dev DB está sub-provisionado para el volumen actual.
- Rama `feature/pagination` (Fase 2 de SSR+paginación) commiteada localmente, nunca
  pusheada ni mergeada a `main`.
- Detección de cambios en scrapers (evitar upsert de promos sin cambios) sigue pendiente,
  prioritario según notas de sesiones previas.
