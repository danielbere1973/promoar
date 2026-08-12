# Recommendation Snapshot v1 — Propuesta de refactor estructural en `decisionEngine.ts`

## Contexto

Feature en curso: **Recommendation Snapshot v1** — precalcular y persistir en DB
(`RecommendationSnapshot`, tabla ya migrada en `dev-promoar`) las recomendaciones de
la Home por usuario, para que `/api/promos/recommended` deje de correr el pipeline
pesado (candidate selection + matching financiero + ranking) en cada request, y en
su lugar lea un snapshot ya calculado (stale-while-revalidate).

Restricción original del sprint: **no tocar `lib/decisionEngine.ts`** — motor de
ranking congelado vía DR-001 (6/8/2026), con su propia memoria de decisiones
(`project_recommendation_block_v1`).

## Decisión de diseño ya cerrada (no reabrir)

La ubicación (lat/lng) es una señal **dinámica del request** (viene del browser en
cada GET), no un atributo persistente del perfil del usuario — no se guarda en DB.
Por eso el snapshot no puede incluir el factor "cercanía" ya resuelto.

**Decisión CPO (9/8/2026):** el snapshot no persiste solo el Top-3 final, sino un
conjunto mayor de candidatas (arrancar con **Top-20**). Cuando el GET trae lat/lng:

- se aplica el factor cercanía **solo sobre esas 20**;
- se resuelve el Top-3 final ahí;
- **nunca** se vuelve a tocar `getPromosData` ni se re-consulta todo el catálogo.

> "La ubicación debe comportarse como una señal dinámica aplicada sobre un conjunto
> previamente resuelto, no como un motivo para invalidar el snapshot completo."

## El bloqueo técnico encontrado

`rankForHome(promos, ctx)`, la única función pública de `decisionEngine.ts`, hace
**todo en una sola pasada** y no es componible desde afuera:

```ts
export function rankForHome(promos: any[], context: DecisionContext): RankedRecommendation[] {
  const candidates = promos.filter(p => passesVigencia(p, context.todayBit))   // 1. gate vigencia
  const scored = candidates.map(promo => { ... scorePromo ... })                // 2. scoring (4 factores)
  const topSavingId = scored.reduce(...)                                       // 3. detectar "mayor ahorro"
  const picked = selectWithDiversity(scored)                                   // 4. diversidad + corte a Top-3
  return picked.map(...)                                                       // 5. reasons
}

const MAX_RECOMMENDATIONS = 3 // <- poda a 3 ANTES de devolver, siempre
```

Consecuencia: **no existe forma de pedirle a `rankForHome` "dame el Top-20 scoreado
sin diversidad ni corte"** — devuelve máximo 3 resultados sin importar cuántas
promos candidatas reciba. Cualquier intento de "guardar el Top-20" llamando a esta
función tal cual es imposible por diseño actual.

## Alternativas descartadas (por la CPO, explícitamente)

1. **Reimplementar el ordenamiento por ahorro en `recommendationSnapshot.ts`** (fuera
   de `decisionEngine.ts`), guardando 20 candidatas por un proxy de score, y
   siempre llamando `rankForHome` real en el GET para el Top-3 con reasons.
   → Rechazada: duplica parte de la lógica del motor en dos archivos.

2. **Aceptar que el snapshot solo guarde 3** (lo que `rankForHome` ya devuelve hoy),
   re-rankeando ese universo de 3 con cercanía en el GET.
   → Rechazada: degrada el valor del snapshot (universo demasiado chico para que
     cercanía tenga margen de reordenar nada útil).

## Propuesta actual — refactor puramente estructural (pendiente de aprobación)

Extraer dos funciones nuevas y exportarlas, **sin modificar ninguna línea de lógica
interna** (`passesVigencia`, `scoreAhorro`, `scoreCercania`, `scoreOnline`,
`scoreFavoritos`, `scorePromo`, `buildReasons`, `selectWithDiversity`,
`DIVERSITY_PENALTY`, `WEIGHTS`, `MAX_RECOMMENDATIONS` quedan byte-a-byte iguales):

```ts
// Etapa 1 — filtro de vigencia + scoring de los 4 factores, SIN corte a 3,
// SIN diversidad, SIN reasons. Es literalmente lo que hoy son las primeras
// 2 líneas de rankForHome, con nombre propio.
export function scoreCandidates(
  promos: any[],
  context: DecisionContext
): { promo: any; score: number; factors: any }[] {
  const candidates = promos.filter(p => passesVigencia(p, context.todayBit))
  return candidates.map(promo => {
    const { score, factors } = scorePromo(promo, context)
    return { promo, score, factors }
  })
}

// Etapa 2 — topSavingId + diversidad + corte a 3 + reasons. Es literalmente
// lo que hoy son las últimas 3 líneas de rankForHome.
export function selectTop3WithReasons(
  scored: { promo: any; score: number; factors: any }[],
  context: DecisionContext
): RankedRecommendation[] {
  if (!scored.length) return []
  const topSavingId = scored.reduce((max, cur) => (cur.factors.ahorro > max.factors.ahorro ? cur : max), scored[0])?.promo?.id
  const picked = selectWithDiversity(scored)
  return picked.map(({ promo, score, factors }) => ({
    promo,
    score,
    reasons: buildReasons(promo, factors, context, promo.id === topSavingId),
  }))
}

// rankForHome: API pública sin cambios de firma ni de comportamiento — ahora
// es la composición literal de las dos etapas de arriba.
export function rankForHome(promos: any[], context: DecisionContext): RankedRecommendation[] {
  const scored = scoreCandidates(promos, context)
  if (!scored.length) return []
  return selectTop3WithReasons(scored, context)
}
```

**Por qué el comportamiento observable no cambia:** para cualquier `(promos, context)`
que ya se le pase hoy a `rankForHome`, el resultado es idéntico — es la misma
secuencia de operaciones, solo con un corte de función en el medio. Ningún caller
existente (`app/api/promos/recommended/route.ts`) necesita cambiar su código.

**Cómo lo usaría `recommendationSnapshot.ts`:**

```ts
// Al generar el snapshot (sin ubicación):
const scored = scoreCandidates(promos, { hasLocation: false, nearbyByCommerceId: {}, todayBit })
const top20 = scored.sort((a, b) => b.score - a.score).slice(0, 20)
// se persiste top20.map(s => s.promo) — objetos promo completos, sin reasons
// (reasons se generan siempre en el GET, es barato sobre 20 elementos)

// En el GET (con o sin lat/lng reales):
const ctx = { hasLocation, nearbyByCommerceId, todayBit }
const rescored = scoreCandidates(snapshotPromos, ctx) // re-chequea vigencia también
const top3 = selectTop3WithReasons(rescored, ctx)
```

## Lo que pide la CPO ahora

> "No implementar todavía. Solo mostrar cómo quedaría esa estructura y demostrar
> que el comportamiento permanece idéntico. Si la única forma de evitar
> duplicación es levantar la restricción sobre `decisionEngine.ts`, prefiero
> hacerlo explícitamente antes que copiar parte del algoritmo en otro archivo."

**Pregunta para ChatGPT**: ¿esta partición en 2 etapas es realmente
comportamiento-preservante (no hay ningún caso borde donde `scoreCandidates` +
`selectTop3WithReasons` compuestas difieran de `rankForHome` actual)? ¿Es un buen
punto de corte, o convendría exponer una etapa distinta (por ejemplo, separar
"scoring puro" de "filtro de vigencia", o exponer `selectWithDiversity` +
`buildReasons` por separado en vez de fusionados en `selectTop3WithReasons`)?
