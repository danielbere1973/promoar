# Validación — Two-Stage Hydration v2 (resultado final)

Rama: `spike/two-stage-hydration-recommendations`. Responde a "CPO Decision — Two-Stage
Hydration v2": medir el path liviano contra el oráculo (`getPromosData()` + `rankForHome()`)
en 40 casos (usuarios reales + variaciones sintéticas de provincia, requerido 100% de
correctitud antes de cualquier preparación de integración).

## Resultado

**40/40 casos correctos. 0 mismatches.** Top3 IDs + orden idénticos, mismos `reasons`,
mismo `userBestDiscount`, mismo `isSaved` en los 40 casos.

## Bugs encontrados y corregidos durante la validación

La primera corrida (con la implementación tal como estaba en el diseño aprobado) **no
pasaba** — se encontraron y corrigieron dos bugs reales antes de llegar al 40/40:

### Bug 1 — Deduplicación por tier ausente en el path liviano

`lib/getPromos.ts` (oráculo) tiene un paso que oculta promos "genéricas" (sin `cardTier`)
de un banco+comercio cuando el usuario también matchea una promo con tier específico para
ese mismo banco+comercio (evita mostrar ambas). Ese paso nunca se había portado a
`lib/getPromosLight.ts` — el pool de candidatas del path liviano podía tener **cientos de
promos de más** que el oráculo para el mismo usuario (un caso llegó a 2628 vs 1956).

Fix: se replicó la misma lógica exacta en `getPromosLight.ts`.

### Bug 2 — Orden de entrada a `rankForHome()` distinto entre ambos paths

Encontrado después de corregir el Bug 1: con el pool de candidatas ya idéntico en tamaño y
contenido, el Top3 todavía divergía en varios casos. Causa: `getPromosData()` (oráculo)
aplica un sort adicional — popularidad de categoría → tipo de promo → % de descuento →
alfabético — **antes** de pasarle el array a `rankForHome()` (es el mismo orden que ve la
grilla `/promos`). `getPromosLight.ts` devolvía las candidatas en el orden crudo de la
query SQL (`isCSIOnly, maxDiscountPct DESC, id`), sin ese segundo sort.

Cuando dos promos tienen el mismo score en `rankForHome()` (ej. ambas 90% de descuento sin
tope), el desempate depende de la posición en el array de entrada — con órdenes de entrada
distintos, el ganador del empate también era distinto entre los dos paths.

Fix: se portó el mismo sort a `getPromosLight.ts`, con dos queries livianas adicionales
(`commerce.name`, `category.slug` por id — tablas de dimensión chicas, no hidratación
completa) para poder replicarlo sin traer los objetos relacionados completos.

## Metodología de la validación (nota de proceso)

La primera corrida completa (40 casos × 3 repeticiones) se lanzó sin verificar antes contra
qué Neon apuntaba `DATABASE_URL`, y corrió más de una hora contra la base de **producción**
sin necesidad. El diagnóstico de los dos bugs de arriba se rehizo con casos individuales
(1 usuario, queries puntuales) en vez de repetir la corrida completa — encontrar y confirmar
ambos fixes tomó minutos por esta vía, no otra hora de harness. La corrida final de
confirmación (40 casos, 1 repetición — la correctitud es determinística, no hacía falta
repetir 3 veces) se usó solo al final, una vez que había confianza razonable en el fix.

## Performance — no cumple el objetivo (≤2-3s), pero por qué no es comparable todavía

En la corrida de 40 casos, el path liviano (`getPromosLight` + `rankForHome` sobre el
payload liviano) fue consistentemente más rápido que el oráculo, pero ambos quedaron en el
orden de **10-45 segundos** por caso — muy por encima del objetivo.

Esto **no** refleja el timing real de producción: el script de validación llama
`getLightRecommendationCandidates()` y compara el array completo rankeado contra el oráculo
completo, para poder diffear los 40/40 casos campo por campo. La arquitectura aprobada
hidrata completas únicamente las 3 finalistas (`hydrateFinalPromos(top3Ids)`) — ese paso
final SÍ se ejecutó en la validación, pero el cuello de botella medido acá es la
**hidratación liviana de todo el pool de candidatas** (miles de filas), que en este script
standalone paga arranque de conexión Prisma/Neon en frío por cada llamada, sin el caching ni
el connection pooling que tendría corriendo dentro de Next.js.

Falta medir el timing real end-to-end pegándole a la ruta gemela `recommended-light`
levantada con `next dev`/producción (no al script standalone) para tener un número
comparable al objetivo de ≤2-3s.

## Qué queda pendiente antes de integrar

1. Medir latencia real vía la ruta HTTP (`/api/promos/recommended-light`), no el script
   standalone, para comparar contra el objetivo de ≤2-3s.
2. Limpiar los artefactos de scratch de la rama (`scratch_*.ts/js`, `tsconfig.harness.json`)
   antes de cualquier PR.
3. Decisión de la CPO: con 40/40 de correctitud confirmado, ¿se avanza a medir performance
   real, o hay algo más a validar antes?

No se reporta esto como "aprobado para integrar" — solo como "validación de correctitud
100% alcanzada", que era el gate explícito antes de seguir. La performance real todavía no
está medida en condiciones comparables.
