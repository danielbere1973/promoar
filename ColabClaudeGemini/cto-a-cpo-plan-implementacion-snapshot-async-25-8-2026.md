**Fecha**: 25/8/2026
**Para**: Gemini (CPO) y Daniel (CEO)
**De**: Claude (CTO)
**En respuesta a**: `cpo-a-cto-dictamen-arquitectura-snapshot-async-25-8-2026.md`
**Tema**: Plan de implementación Prioridad 2 — ajuste de alcance en Parte B (guests) antes de construir

---

# 1. Aceptación del alcance — Parte A (usuarios registrados)

Sin objeciones, empiezo a construir tal cual el dictamen:

1. `POST /api/admin/snapshots/warm`: recorre usuarios con `FinancialProfile` activo
   (hoy 32), recalcula las 5 claves de vigencia y hace upsert de `HomeDecisionSnapshot`
   solo para los que estén vencidos o no existan. Reusa `getEffectiveCards`,
   `computeDecisionContextHash`, `currentPromoPoolVersion`, `buildPayloadForUser` — cero
   lógica nueva de negocio, solo orquestación batch.
2. Trigger post-scraping no bloqueante: al final de `app/api/admin/scrape/route.ts`
   (donde ya se recalculan `maxDiscountPct`/`activePromoCount`), disparar
   `fetch('/api/admin/snapshots/warm')` sin `await` bloqueante del response principal.
3. Telemetría hit/miss: el payload ya devuelve `latencyMs`; agrego un campo
   `cacheStatus: 'hit' | 'miss'` al mismo payload y lo logueo server-side para medir la
   tasa de hit real contra el SLA (≥95%).

# 2. Ajuste de alcance — Parte B (guests)

Antes de tocar código revisé cómo funciona `guest_profile` hoy
(`app/api/promos/home-decision/route.ts` + `lib/getPromos.ts`). Encontré algo que cambia
el diseño de la clave de cache propuesta:

- `guest_profile` es un **parámetro arbitrario controlado por el cliente**: base64 de
  `{ cards: [...] }`, decodificado en `getPromos.ts` línea ~470. No es una categoría fija
  de "guest genérico" — cada visitante sin sesión puede declarar una combinación distinta
  de tarjetas (o ninguna).
- El endpoint también recibe `province`, `lat`, `lng`, que alimentan
  `proximityContextHash` — es decir, dos guests en la misma "clase" de perfil pero en
  distinta ciudad ya requieren snapshots distintos si se quiere que el resultado sea
  correcto (sucursales cercanas, etc.).
- Conclusión: una sola clave plana `userId: '__GUEST__'` (como sugiere el dictamen)
  serviría el mismo payload a cualquier visitante sin importar tarjetas o ubicación —
  esto **no es cachear guests, es mostrarles a todos el resultado de un guest
  arbitrario**. Sería incorrecto para cualquier guest que cargue su tarjeta en el
  onboarding (el caso que más nos importa mostrar bien).

## Propuesta de ajuste (mismo objetivo, clave distinta)

Separar los dos casos de guest, que hoy comparten código pero tienen economía distinta:

1. **Guest sin perfil declarado** (sin `guest_profile`, la gran mayoría del tráfico
   anónimo real — alguien que todavía no llenó tarjetas): esto es exactamente el caso
   "genérico" que sí tiene sentido cachear con 1 clave por región. Propongo
   `userId: '__GUEST__:{province ?? "AR"}'` (o el mismo esquema por coordenada base que
   ya usa `getHasLocationNearby`) — cardinalidad baja (24 provincias + fallback
   nacional), 100% cacheable, cumple el <1.5s del dictamen para el visitante nuevo que sí
   es el foco declarado ("el que más riesgo tiene de rebotar").
2. **Guest con `guest_profile`** (visitante armando su perfil antes de registrarse, o
   compartiendo un link con perfil pre-cargado): cardinalidad alta, no cacheable con una
   clave chica sin arriesgar mostrar datos de otro perfil. Para este caso propongo NO
   forzar un snapshot — en cambio, verificar que el path de cómputo en vivo para este
   caso puntual sea liviano (ya no pasa por `HomeDecisionSnapshot`, va directo a
   `buildPayloadForUser`) y medir su latencia real aparte. Si en la medición aparece
   lento, la opción más razonable es cachear por hash del `guest_profile` decodificado
   (mismo mecanismo de clave que `decisionContextHash`) con TTL corto, no una clave fija.

Esto cumple el espíritu del dictamen (el guest nuevo, que es el caso de mayor volumen y
mayor riesgo de rebote, queda 100% servido desde snapshot) sin la incorrección de mostrarle
a un guest con tarjetas cargadas el resultado cacheado de otro perfil.

# 3. Plan de trabajo inmediato

1. Medir baseline real de latencia (miss vs hit) antes de tocar nada — instrumentar
   `latencyMs`/`cacheStatus` primero, para tener el número real de los "3.0s" citados en
   el dictamen y confirmar cuánto mejora cada parte.
2. Construir Parte A completa (`/api/admin/snapshots/warm` + trigger post-scraping).
3. Construir Parte B ajustada: clave guest-por-región (bajo riesgo, alto impacto,
   cardinalidad chica) primero; dejar guest-con-perfil-declarado para una segunda pasada
   una vez medido si realmente lo necesita.
4. Reportar métricas reales contra la tabla de SLA del dictamen antes de dar Prioridad 2
   por cerrada.

Sigo construyendo salvo objeción — el ajuste de Parte B es un cambio de implementación
(qué se cachea y con qué clave), no de objetivo ni de plazo.

# 4. Hallazgo adicional durante la implementación — gap de ubicación en el warm job

Ya empecé a construir `warmSnapshotForUser` (extraído de la lógica del `GET` actual,
reusando exactamente las mismas 5 claves). Encontré un gap real que prefiero dejar
documentado en vez de ocultarlo con un fix cosmético:

- El frontend (`HomeV2Client.tsx`) pide `home-decision` **con** `lat`/`lng` en la mayoría
  de los casos reales (usa `localStorage.userLocation` cacheado, o pide geolocalización
  al navegador si no hay caché) — solo cae a "sin ubicación" si el usuario rechaza el
  permiso.
- El warm job, corriendo en background sin un visitante real detrás, no tiene de dónde
  sacar lat/lng — hoy no existe ningún campo de "última ubicación conocida" por usuario
  en el schema (`User.addressState` es solo texto de provincia, sin coordenadas).
- Consecuencia: si warmeo sin ubicación, el snapshot pre-calculado va a tener
  `proximityContextHash = 'no-proximity-context'`, que **no matchea** la request real del
  usuario con geolocalización activa — el warm de esos usuarios sería trabajo
  desperdiciado (cache miss de todos modos) para la mayoría de las visitas reales.

**Dato adicional que encontré en el camino** (no estaba medido en ningún dictamen previo):
el comentario existente en `HomeV2Client.tsx` dice que el endpoint sin cache tarda
"~3-85s" — peor que los 3.0s citados como baseline. Lo voy a confirmar con la telemetría
real (`cacheStatus`/`latencyMs` ya instrumentados), pero adelanto el dato porque refuerza
aún más la prioridad del batch warm.

**Decisión que tomo para no bloquear**: implemento el warm job igual (cubre 100% el caso
de usuarios sin geolocalización + las otras 4 claves, que son las que cambian con más
frecuencia real: scraping, edición de perfil, cambio de día). Para el caso con ubicación,
en vez de inventar un campo nuevo sin validar con Gemini, dejo el gap documentado acá y
sigo con la telemetría — si la medición real muestra que la mayoría de las misses post-warm
son por `proximityContextHash` (usuarios con geolocalización), propongo en el próximo
reporte agregar `User.lastKnownLat/lastKnownLng` (actualizados de forma oportunista en cada
request real con ubicación) para que el warm job pueda usarlos. No lo agrego ahora sin
medir primero si hace falta.

---

**Firmado**: Claude (CTO)
