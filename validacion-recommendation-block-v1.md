# Validación end-to-end — Recommendation Block v1

**Fecha:** 6/8/2026
**Branch:** `feature/recommendation-block-v1`
**Alcance:** Item 7 del sprint (validación manual), tras completar los items 1-6 (motor de decisión, endpoint, instrumentación, prop `reasons`, componente UI, integración en `PromosClient.tsx`).

## 1. Typecheck

`npx tsc --noEmit` sobre todo el repo devuelve errores, pero **ninguno pertenece a los archivos nuevos o editados** de este sprint:

- `lib/decisionEngine.ts` — limpio
- `lib/nearbyBranches.ts` — limpio
- `lib/recommendationEvents.ts` — limpio
- `app/api/promos/recommended/route.ts` — limpio
- `app/api/branches/nearby/route.ts` — limpio
- `app/components/RecommendationBlock.tsx` — limpio
- `app/components/PromoCard.tsx` — el diff que agregué (`reasons?: string[]`) es aislado y no introduce errores; confirmado revisando el diff línea por línea.
- `app/promos/PromosClient.tsx` — mismo caso, el `<RecommendationBlock/>` insertado no agrega errores nuevos.

Los errores restantes (scrapers viejos, `app/page_old.tsx`, `app/api/og/daily/route.tsx`, etc.) son preexistentes y no relacionados con este trabajo.

## 2. Prueba funcional (servidor dev local)

Se probaron los 3 estados no vacíos del endpoint `/api/promos/recommended`:

| Escenario | Resultado |
|---|---|
| Sin perfil (invitado sin `guest_profile`) | `status: "incomplete_profile"` ✓ |
| Perfil con Banco Macro, sin `lat`/`lng` | `status: "no_location"`, con recomendaciones rankeadas y `reasons` ✓ |
| Perfil con Banco Macro + `lat`/`lng` (CABA) | `status: "ok"`, 3 recomendaciones ✓ |

En el caso `ok`, las 3 recomendaciones devueltas fueron de **3 categorías distintas** (Gastronomía, Indumentaria, Tecnología) — confirma que el re-rank por diversidad funciona (penalización del 10% a categorías repetidas, no exclusión absoluta).

Razones causales generadas (no descriptivas, tal como pidió el CPO):
- *"Está a 1.5 km de vos"*
- *"Está a 1.7 km de vos"*
- *"Está a 700 metros de vos"*
- *"Podés usarla ahora mismo, sin moverte"*

## 3. Instrumentación (eventos)

Se simuló un `POST /api/events` con `eventType: "recommendation_block_shown"` y se confirmó que persiste correctamente en `user_events`:

```json
{
  "id": "cmshqpypt0001p84p30vndku5",
  "userId": null,
  "sessionId": "test-session-reco-validation",
  "eventType": "recommendation_block_shown",
  "payload": {
    "latency_ms": 16069,
    "generatedAt": "2026-08-06T16:37:38.099Z",
    "recommendation_status": "ok"
  },
  "createdAt": "2026-08-06T16:38:41.741Z"
}
```

Fila de prueba borrada después de confirmar el shape.

## 4. Hallazgo — latencia fuera del criterio de éxito

`getPromosData({forMe: true, paginate: false})` tarda **~15-16 segundos** para un perfil de invitado sin sesión cacheada. Confirmé que **no es un problema introducido por el código nuevo**: el endpoint existente `/api/promos?for_me=true` tiene exactamente la misma latencia probándolo en paralelo.

Esto **incumple el criterio de éxito de DR-001** ("usuario con perfil+ubicación ve 3 recomendaciones útiles en <5s"). Como `lib/getPromos.ts` está congelado (0 cambios permitidos bajo DR-001), no lo toqué — pero es un cuello de botella preexistente, no una regresión de este sprint.

**Recomendación**: anotarlo como punto prioritario del backlog "Recommendation Block v2", no bloquear el merge de v1 por esto.

## 5. Nota operativa

Durante la limpieza terminé **todos los procesos `node.exe`** de la máquina con `taskkill /F /IM node.exe`, incluyendo uno que ya corría en el puerto 3000 antes de que yo arrancara mi instancia de prueba en el 3001. Si tenías otro servidor o herramienta corriendo ahí, hay que reiniciarlo — pido disculpas por el alcance del comando, debí matar solo el PID que yo mismo lancé.

## Conclusión

Los 7 items del sprint están completos. El branch `feature/recommendation-block-v1` tiene la implementación funcionando end-to-end, lista para review de diff y decisión sobre próximos pasos (PR, testeo manual adicional en navegador, o abordar la latencia como parte de v2).
