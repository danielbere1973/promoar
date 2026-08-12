# Medición HTTP — Two-Stage Hydration v2 (Parte A + Parte B)

Rama: `spike/two-stage-hydration-recommendations`. Responde a "CPO Decision — Two-Stage
Hydration: siguiente gate" — medir `/api/promos/recommended-light` contra el oráculo
`/api/promos/recommended`, vía HTTP real contra un servidor Next.js corriendo, no contra
el script standalone usado en la validación de correctitud.

## Disciplina de entorno (verificada antes de correr)

- `DATABASE_URL` efectivo (`.env.local`, que pisa a `.env`): host `ep-cool-lake-ammkwaug`.
- Confirmado que **no** es producción: prod es `ep-fragrant-bird-am3uvyq5` (línea 7-9 de
  `.env`, comentada en `.env.local`). `ep-cool-lake` es la branch de desarrollo
  (`dev-promoar`, sprint cobertura-ubicación).
- Confirmado antes de lanzar cada uno de los dos scripts (Parte A y Parte B) — no solo una
  vez al principio.
- El proceso Next.js se lanzó siempre con `npm run dev`, leyendo `.env.local` primero
  (confirmado por el propio log de arranque: `Environments: .env.local, .env`).

## Resultado de correctitud

**100% — 25 de 25 requests HTTP (5 de la Parte A + 20 de la Parte B) con el mismo Top3,
mismo orden, mismos `reasons`.** La optimización sigue entregando la misma decisión en
todos los casos, cold y warm.

## Parte A — Cold request (5 ciclos, servidor reiniciado en cada uno)

| Ciclo | Oráculo (ms) | Light (ms) | Top3 coincide |
|---|---|---|---|
| 1 | 12.781 | 8.569 | Sí |
| 2 | 12.046 | 9.028 | Sí |
| 3 | 11.997 | 8.638 | Sí |
| 4 | 12.383 | 9.147 | Sí |
| 5 | 11.992 | 8.721 | Sí |
| **Promedio** | **12.240** | **8.821** | 5/5 |

Ninguno de los 5 ciclos es una "primera compilación" real de Next.js (esa ya había pasado
antes de arrancar la medición) — cada ciclo es un proceso nuevo con Prisma/Neon conectando
desde cero. Aun así, el tiempo **no varía apenas entre el ciclo 1 y el ciclo 5** — si el
costo fuera arranque en frío de la conexión, se esperaría una caída notoria del ciclo 1 al
2. No la hay.

## Parte B — Warm request (mismo servidor sin reiniciar, 20 + 20 alternados)

| Endpoint | Promedio | Mediana | p95 | Máx | Mín |
|---|---|---|---|---|---|
| Oráculo | 11.227 ms | 7.975 ms | **25.271 ms** | 26.381 ms | 5.989 ms |
| Light | 8.208 ms | 6.348 ms | **15.752 ms** | 15.930 ms | 5.880 ms |

Sin cache de recomendaciones (ninguno de los dos endpoints lo usa). 20/20 pares con Top3 y
`reasons` idénticos.

## Diagnóstico — dónde se va el tiempo

El desglose interno (`perf`) de cada request muestra que el costo no está en la query SQL
de candidatas (`candidateQueryMs`, estable en 350-900ms en los 25 requests) sino en la
**hidratación del pool completo de candidatas** (2.303 filas):

- Oráculo: `hydrationMs` varió entre **4.196 ms y 22.693 ms** entre iteraciones consecutivas
  del mismo servidor, sin reiniciar nada.
- Light: `rankingHydrationMs` varió entre **2.148 ms y 10.381 ms** en el mismo rango de
  iteraciones.
- La hidratación final de las 3 promotoras ganadoras (`finalHydrationMs` en light) es
  consistentemente barata: ~1-2 segundos, sin importar el resto.

Esto descarta la hipótesis que la CPO pidió explícitamente probar: **no es arranque en frío
de Prisma/Neon** (eso ya se había pagado antes de la Parte B, servidor corriendo todo el
tiempo). El patrón — mismo servidor, mismo query, tiempos que varían 5x entre requests
consecutivos — es compatible con variabilidad de latencia de red hacia Neon (dev branch en
`us-east-1`, cada fila del pool de candidatas dispara resolución de relaciones vía Prisma)
más que con un problema de lógica en el código del spike.

## Contra los criterios de éxito del CPO

| Criterio | Objetivo | Resultado | Cumple |
|---|---|---|---|
| Correctitud | 100% | 100% (25/25) | **Sí** |
| Warm p95 | < 3 s (obligatorio) | 15,75 s | **No** |
| Warm p95 | ≤ 2 s (objetivo) | 15,75 s | **No** |
| Cold request | idealmente < 3 s | 8,8-12,2 s promedio | **No**, y tampoco lo cumple el oráculo actual en producción |

**No se cumple el criterio obligatorio.** Ni el oráculo ni el light bajan de los 3 segundos
en ningún escenario medido — el piso real, incluso en el mejor caso individual, es ~6
segundos.

## Conclusión

Light es consistentemente más rápido que el oráculo (30-45% menos tiempo en promedio,
40% menos en p95), y la corrección se mantiene 100% en las 25 mediciones HTTP. Pero **el
objetivo de performance no se alcanza** — ni por el oráculo actual (que ya está en
producción) ni por el spike. La causa no es el diseño de la optimización en sí, sino el
costo de hidratar ~2.300 filas candidatas contra Neon antes de rankear, con latencia de red
variable que en el peor caso multiplica por 5 el tiempo de un mismo request repetido.

No se avanza a preparar diff de integración ni se declara este problema resuelto. Según lo
que indicó la CPO, se reporta el desglose exacto en vez de seguir optimizando a ciegas.

## Qué mediría distinto una optimización real (no propuesto, solo diagnóstico)

- El pool de 2.303 candidatas se hidrata completo antes de rankear y descartar la mayoría.
  Si el ranking pudiera aproximarse con menos columnas por fila, o si se pudiera paginar/
  limitar el pool antes de hidratar, el costo bajaría proporcionalmente.
- La variabilidad 4x-5x en la misma métrica con servidor caliente y sin cambios de código
  sugiere que el techo real está en el round-trip de red a Neon (dev branch), no en CPU
  local — algo a confirmar con métricas de Neon (latencia por query) antes de tocar más
  código.

## Artefactos generados en esta medición

- `scratch_measure_cold.sh` / `scratch_measure_warm.sh` — scripts de medición.
- `scratch_cold_results.jsonl`, `scratch_warm_results.jsonl` — resultados crudos.
- `scratch_cold_*_{oracle,light}.json`, `scratch_warm_*_{oracle,light}.json` — respuestas
  completas por request (incluye `perf` detallado).
- `scratch_devserver_cold_*.log`, `scratch_devserver_warm.log` — logs de arranque del
  servidor.

Pendientes de limpiar recién cuando la CPO decida el siguiente paso (no se limpia todavía,
por si hace falta revisar algún caso puntual del desglose).
