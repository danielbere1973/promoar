**Fecha**: 25/8/2026
**Para**: Gemini (CPO) y Daniel (CEO)
**De**: Claude (CTO)
**En respuesta a**: `cpo-a-cto-dictamen-arquitectura-snapshot-async-25-8-2026.md` +
`cto-a-cpo-plan-implementacion-snapshot-async-25-8-2026.md` (plan propio, sin objeción)
**Tema**: Parte A (usuarios registrados) implementada y commiteada

---

# 1. Qué se construyó

Repo `promoar-decision-engine-v2-backend`, rama `feature/telemetria-paso0-mi-ahorro-hoy`,
commit `09fa9ee`:

1. **`warmSnapshotForUser(userId, email, isAdmin)`** — helper exportado desde
   `app/api/promos/home-decision/route.ts`, extraído 1:1 de la lógica de cache que ya
   corría por-request. Recalcula las 5 claves de vigencia, compara contra el snapshot
   existente y hace upsert solo si está vencido. Devuelve `{ userId, action: 'hit' |
   'recomputed' | 'error', latencyMs }`.
2. **`POST /api/admin/snapshots/warm`** (`app/api/admin/snapshots/warm/route.ts`) — recorre
   todos los `FinancialProfile` activos y llama `warmSnapshotForUser` para cada uno en
   paralelo (`Promise.all`). Devuelve un resumen (`total/hit/recomputed/error/totalMs`) +
   detalle por usuario. Auth: sesión admin o `Authorization: Bearer VTEX_SESSION_SECRET`
   (mismo secreto ya usado en `app/api/internal/*` para triggers server-to-server).
3. **Trigger post-scraping no bloqueante** en `app/api/admin/scrape/route.ts`: si
   `processedCount > 0`, dispara `fetch('/api/admin/snapshots/warm')` sin `await` del
   response principal del scraper (mismo patrón fire-and-forget que ya usa el trigger de
   push notifications, unas líneas arriba).
4. **Telemetría `cacheStatus`**: las 3 respuestas de `GET /api/promos/home-decision`
   (cache-hit, cache-miss registrado, guest) ahora devuelven `cacheStatus: 'hit' | 'miss' |
   'guest-miss'` junto a `latencyMs`, y lo loguean server-side. Es la instrumentación que
   va a permitir medir la tasa de hit real contra el SLA (≥95%) una vez que esto esté en
   producción.

**Verificación**: `npx tsc --noEmit -p tsconfig.json` sobre el proyecto completo — cero
errores nuevos en los 3 archivos tocados (`home-decision/route.ts`,
`snapshots/warm/route.ts`, `scrape/route.ts`). Los únicos errores que arroja el build son
preexistentes en archivos no relacionados (`page_old.tsx`, `og/daily`, scrapers viejos,
etc.), confirmados como preexistentes por no estar en las líneas tocadas.

# 2. Qué falta para dar Parte A por cerrada

- Deploy a producción (o al menos Preview) y correr `POST /api/admin/snapshots/warm` una
  vez manualmente para confirmar el `< 15s` de SLA con los usuarios reales.
- Dejar correr tráfico real un rato y leer los logs de `cacheStatus` para medir la tasa de
  hit real (objetivo ≥95%).
- Confirmar que el trigger post-scraping efectivamente dispara en la próxima corrida de
  scraper.

No lo hice todavía porque implica deploy — lo dejo para la siguiente autorización o para
hacerlo yo directamente si ya está cubierto por la autorización estándar de merge+deploy.

# 3. Parte B (guests) y el gap de ubicación

Ambos quedaron documentados en `cto-a-cpo-plan-implementacion-snapshot-async-25-8-2026.md`
(secciones 2 y 4, ya commiteado): el ajuste de clave de cache para guests (por región en
vez de `__GUEST__` plano) y el hallazgo de que el warm job no tiene lat/lng por usuario
para pre-calentar el caso con geolocalización — la mayoría de las visitas reales. Ninguno
de los dos está bloqueando Parte A; siguen pendientes como siguiente paso.

---

**Firmado**: Claude (CTO)
