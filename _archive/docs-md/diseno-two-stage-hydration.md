# Diseño — Two-Stage Hydration para Recommendation Block

Estado: propuesta, sin implementar. Responde a la CPO Decision "Nuevo diagnóstico del
problema" (7/8/2026). No modifica `matchesProfile()`, reglas del Decision Engine, schema
Prisma, índices, cache ni la UI del Recommendation Block.

**Revisión CPO (v2)**: corregidos 2 puntos señalados en el review — (a) `scoreCercania` no
puede depender de `promo.commerce?.id` en la etapa liviana, porque en esa etapa no hay
objeto `commerce`; usar `promo.commerceId` directo. (b) la hidratación de las 3 finalistas
vía `findMany({ where: { id: { in: top3Ids } } })` no garantiza devolver las filas en el
orden de `top3Ids` — Postgres/Prisma pueden devolverlas en cualquier orden. Hay que
reordenar explícitamente en memoria según el orden ya decidido por `rankForHome()`. Ambos
puntos están incorporados en las secciones 1.2, 4 y 7 de abajo.

## 1. Qué campos necesita cada etapa

### 1.1 `matchesProfile()` (gate financiero, por requirement)

Recorriendo `lib/getPromos.ts:850-948`, la función solo lee columnas escalares de
`PromoRequirement` — **nunca** los objetos relacionados `bank`/`wallet`/`cardNetwork`:

```
req.bankId, req.walletId, req.cardNetworkId, req.cardType,
req.segmentId, req.cardSegmentId, req.cardTier, req.accountType
```

Y a nivel `Promo`: `promo.requirements` (array), `promo.id` (para `savedSet`).

`userBestDiscount` (`getPromos.ts:1034-1089`) reutiliza la misma lógica y agrega:

```
req.discountValue, req.discountType, req.cap, req.capUnlimited
```

Ningún campo de `bank.name`, `bank.logoUrl`, `wallet.name`, `cardNetwork.name`, etc. se lee
en esta etapa. Son datos de presentación, no de decisión.

### 1.2 `rankForHome()` (scoring + diversidad + razones)

Recorriendo `lib/decisionEngine.ts`:

- `scoreAhorro`: `promo.userBestDiscount.{discountType, discountValue, capUnlimited, cap}`
  (ya calculado en la etapa anterior a partir de columnas escalares).
- `scoreCercania`: hoy lee `promo.commerce?.id`, pero en etapa 1 no hay objeto `commerce`
  — el campo correcto a usar es `promo.commerceId` directo (columna escalar de `Promo`,
  ya está en el `select` de 1.3). `decisionEngine.ts` debe cambiar `promo.commerce?.id` por
  `promo.commerceId ?? promo.commerce?.id` (o directamente `promo.commerceId` si ya no
  queda ningún caller que pase el objeto completo en esta etapa) para que el score de
  cercanía no se rompa silenciosamente al eliminar el join. Mismo caso en `buildReasons`
  (línea 86, usa el mismo `commerceId` para buscar en `nearbyByCommerceId`).
- `scoreOnline`: `promo.salesChannel` (columna escalar de `Promo`).
- `scoreFavoritos`: `promo.isSaved` (calculado, no relación).
- `passesVigencia`: `promo.validDays` (columna escalar).
- `selectWithDiversity`: `promo.category?.slug ?? promo.categoryId` — el código ya tiene
  fallback al id crudo, es decir el diseño actual ya anticipa no depender del objeto join.
- `buildReasons`: `promo.validUntil`, más los mismos `commerceId`/`nearby` de arriba.

**Conclusión**: rankeo completo (gate financiero + scoring + diversidad + razones causales)
es 100% calculable con columnas escalares de `Promo` + `PromoRequirement`, sin ningún
`include` de `category`, `commerce`, `bank`, `wallet` o `cardNetwork`. Los `?.slug`/`?.id`
que hoy se leen de los objetos joined son redundantes con las FK planas (`categoryId`,
`commerceId`) que ya existen en la fila de `Promo`.

### 1.3 Payload mínimo de etapa 1 (ranking)

```ts
prisma.promo.findMany({
  where: { id: { in: candidateIds } },
  select: {
    id: true,
    categoryId: true,
    commerceId: true,
    salesChannel: true,
    validDays: true,
    validUntil: true,
    requirements: {
      select: {
        id: true,
        bankId: true, walletId: true, cardNetworkId: true, cardType: true,
        segmentId: true, cardSegmentId: true, cardTier: true, accountType: true,
        discountValue: true, discountType: true, cap: true, capUnlimited: true,
      },
    },
  },
})
```

Sin ningún `include` de relación a otra tabla — todo son columnas propias de `Promo` y
`PromoRequirement`. Esto es lo que elimina los roundtrips: no hay `category`, `commerce`,
`bank`, `wallet` ni `cardNetwork` que Prisma tenga que resolver por separado.

## 2. Relaciones evitadas en la primera etapa

De las 6 relaciones que hoy se hidratan para las ~8.000 candidatas (`category`, `commerce`
con su `_count`/`branches`, `requirements→bank`, `requirements→wallet`,
`requirements→cardNetwork`), **las 5 relacionales se evitan por completo** en etapa 1
(`category`, `commerce`, `bank`, `wallet`, `cardNetwork`). Solo se necesita la tabla
`requirements` en sí (no es una relación externa cara — es 1:N sobre la misma promo, ya
viene filtrada a las candidatas).

Esto reduce la query de etapa 1 de "8-11 queries secuenciales sobre miles de filas" a
"2 queries" (`Promo` + `PromoRequirement`, ambas con `select` mínimo, sin relaciones a otras
tablas) — el mismo patrón que ya se validó rápido en el smoke test cuando se probó
`select: { id: true }` puro.

## 3. Cuántas promos hidratar completas al final

**Propuesta: 3.**

Justificación:
- `MAX_RECOMMENDATIONS = 3` está fijo en `decisionEngine.ts:19` y no está bajo discusión
  (congelado por DR-001).
- `selectWithDiversity` es determinístico dado el mismo input: no hay aleatoriedad ni
  segunda pasada que pueda cambiar el resultado si se hidrata solo el Top 3 exacto que ya
  salió de `rankForHome()`.
- No hay ningún paso posterior a `rankForHome()` en el flujo actual (`recommended/route.ts`)
  que necesite ver más de 3 promos — la respuesta HTTP ya recorta a `ranked` (que es como
  máximo 3).

Alternativa descartada: hidratar Top 10 o Top 20 "por las dudas" (ej. para permitir reordenar
en cliente o A/B testing futuro) — no hay ningún requerimiento actual que lo pida, y
agregar margen no solicitado va contra el principio de no over-engineering. Si en el futuro
se necesita mostrar más de 3 o permitir "ver más recomendaciones", ese es un cambio de
producto explícito que puede volver a ajustar este número — no hay que anticiparlo ahora.

## 4. Cómo preservar exactamente el mismo Top 3 actual

El cambio es un refactor de **qué datos se cargan y cuándo**, no de **qué lógica decide**.
Puntos de garantía:

1. `matchesProfile()` no cambia una línea — solo cambia el shape del objeto `req` que recibe
   (mismos campos, distinto origen: antes venían embebidos en el objeto Prisma con relación
   resuelta, ahora vienen del mismo `select` pero sin el join). Los campos que lee ya son
   escalares hoy — el include actual de `bank`/`wallet`/`cardNetwork` nunca aportó campos
   que `matchesProfile()` usara.
2. `rankForHome()` cambia en un solo punto puntual: `scoreCercania`/`buildReasons` deben leer
   `promo.commerceId` en vez de `promo.commerce?.id` (ver 1.2 — corrección del review). Para
   `category?.slug ?? categoryId` el fallback existente ya cubre el caso sin cambios de
   código. Es el único ajuste de lógica que introduce este diseño — todo lo demás en
   `matchesProfile()`/`rankForHome()` queda intacto.
3. El orden de ejecución (candidate selection → gate financiero → scoring → diversidad →
   Top 3) es idéntico; solo se inserta una hidratación completa **después** de tener los 3
   ids finales, antes de devolver la respuesta HTTP.
4. **Reordenar explícitamente tras la hidratación final** (corrección del review): el
   `findMany({ where: { id: { in: top3Ids } } })` de etapa 2 NO garantiza devolver las filas
   en el orden de `top3Ids` — ni Postgres ni Prisma dan esa garantía sobre un `IN (...)`.
   `rankForHome()` ya decidió el orden final (mejor score primero, con diversidad aplicada);
   ese orden debe preservarse explícitamente reindexando el resultado de la hidratación,
   igual que ya se hace hoy para las candidatas en `getPromos.ts` (`orderIndex`/`.sort()`
   sobre `candidates.ids`, mismo patrón, ver 7):
   ```ts
   const hydratedById = new Map(hydratedRows.map(r => [r.id, r]))
   const finalTop3 = top3Ids.map(id => hydratedById.get(id)!)
   ```
5. Validación: correr el mismo harness de 40 casos ya usado en el spike de `relationJoins`
   (correctitud: mismatches de rows y de Top3 contra la implementación actual, que queda
   como oráculo) — mismo protocolo, ya probado y disponible. El harness debe comparar Top3
   **como array ordenado** (no como set), precisamente para detectar una regresión de orden
   si el reordenamiento de 4 se implementa mal u omite.

## 5. Riesgos de separar selección/ranking de hidratación

- **Inconsistencia entre lecturas** (baja probabilidad, ya existe hoy): entre la query de
  ranking liviana y la hidratación final de las 3 promos, una promo podría cambiar de estado
  (ej. desactivada) en ese instante. Ya es un riesgo latente en el diseño actual de dos
  queries secuenciales (candidate selection → hydration) — two-stage solo agrega una tercera
  query al mismo patrón, no un tipo de riesgo nuevo. Mitigación: no requiere ninguna, dado el
  volumen de tráfico y la ventana de milisegundos entre queries.
- **Deriva de campos**: si en el futuro `matchesProfile()` o `rankForHome()` empiezan a leer
  un campo nuevo (ej. un campo de `commerce` para un factor de scoring nuevo), hay que
  recordar agregarlo al `select` de etapa 1 — si no, el campo llega `undefined` y falla en
  silencio (ej. un factor que siempre da 0). Mitigación: comentario explícito en el `select`
  de etapa 1 apuntando a este documento + a `matchesProfile`/`rankForHome`, para que
  cualquier cambio futuro en esas funciones dispare la pregunta "¿este campo nuevo está en
  el select de etapa 1?". No es un chequeo automático — es un costo de mantenimiento real,
  el más importante de los riesgos listados.
- **Doble código de shape de `req`**: durante la transición, dos "vistas" de `requirement`
  (la liviana de etapa 1, la completa de etapa 2 con `bank`/`wallet`/`cardNetwork` incluidos)
  conviven en el mismo archivo. Riesgo de confundir cuál se está usando dónde. Mitigación:
  nombrar los tipos explícitamente (`RankingPromo` vs `HydratedPromo`) para que TypeScript
  marque el error si se usa el shape equivocado en el lugar equivocado.
- **Orden silenciosamente perdido en la hidratación final** (señalado en el review): si se
  omite el reordenamiento explícito de 4, el bug no lanza ningún error — la respuesta sigue
  teniendo 3 promos válidas, solo que en un orden distinto al que decidió el score. Es el
  tipo de regresión que un test de "mismos ids presentes" no detecta, pero un test de
  "mismo array ordenado" sí. Mitigación: el harness de validación debe comparar Top3 como
  array (posición por posición), no como set — ya incorporado en el punto 4 de la sección 4.
- **`isSaved`/`userBestDiscount` se calculan hoy sobre el objeto completo** (`getPromos.ts:1018-1090`,
  parte del mismo `finalPromos.map()` que ya corre sobre todas las candidatas filtradas, no
  solo sobre el Top 3). Estos cálculos ya son sobre columnas escalares (ver 1.1) así que no
  cambian de costo — pero hay que confirmar que se sigan ejecutando en etapa 1 (sobre el
  payload liviano) y no se muevan sin querer a etapa 2, porque `rankForHome` los necesita
  para *todas* las candidatas con vigencia, no solo para las 3 finalistas.

## 6. Impacto esperado

Baseline actual (`query` strategy, medido en el spike de `relationJoins`, 40 casos):
`candidateQueryMs` avg 1181ms, `hydrationMs` avg 8157ms (miles de filas), `totalMs` avg
13052ms / p95 15950ms, payload ~11.4MB.

| | Hoy | Two-stage (estimado) |
|---|---|---|
| Queries SQL | ~8-11 (hidratación de miles de filas con relaciones) | ~2 en etapa 1 (select liviano, sin relaciones) + ~4-6 en etapa 2 (relaciones completas, pero sobre 3 filas en vez de miles) |
| Payload transferido DB→app | ~11.4MB (miles de promos completas) | Cientos de KB en etapa 1 (miles de filas pero solo columnas escalares, sin objetos anidados) + unos pocos KB en etapa 2 (3 promos completas) |
| Memoria de proceso | picos correlacionados con miles de objetos completos en memoria | picos mucho menores — miles de objetos livianos (10-15 campos escalares) en vez de miles de objetos con 5 relaciones anidadas cada uno |
| `hydrationMs` (equivalente etapa 1) | ~8.2s avg (relaciones completas × miles de filas) | esperable **sub-segundo** — incluso a 8000 filas, `select: { id: true }` puro ya se midió rápido durante el diagnóstico previo; agregar ~12 columnas escalares más no debería cambiar el orden de magnitud |
| Hidratación final (3 promos, relaciones completas) | ya incluida en el hydrationMs de arriba | nueva query separada, pero sobre 3 filas — costo despreciable (mismo tipo de query que hoy tarda ~8s sobre miles de filas, tarda milisegundos sobre 3) |
| `totalMs` estimado | ~13.1s avg / ~16.0s p95 | candidateQueryMs (~1.2s, sin cambios — Alternativa 2 ya está aprobada) + ranking liviano (sub-segundo estimado) + hidratación final de 3 (milisegundos) + profileMatch/decisionEngine (~10-30ms, sin cambios) → **orden de magnitud de 1.5-2.5s totales**, dentro del objetivo de ≤3s y con margen para el objetivo preferido de ≤2s |

Los números de la columna "Two-stage (estimado)" son estimaciones fundadas en mediciones ya
hechas sobre partes del mismo pipeline (no son una medición del diseño propuesto en sí,
porque no está implementado) — el próximo paso natural después de aprobar este diseño sería
un spike de medición igual de riguroso que el de `relationJoins`, con el mismo protocolo de
40 casos y harness de correctitud.

## 7. Resumen del flujo propuesto

```
SQL candidate selection (ya aprobado, Alternativa 2)
        ↓ ~1.2s, ids
Etapa 1 — SELECT liviano (Promo + PromoRequirement, sin relaciones)
        ↓ columnas escalares, miles de filas pero payload chico
matchesProfile() + userBestDiscount (sin cambios de lógica)
        ↓
rankForHome(): scoring + diversidad + razones (sin cambios de lógica)
        ↓
Top 3 (ids, en el orden final decidido por rankForHome)
        ↓
Etapa 2 — hidratación completa SOLO de esos 3 ids
        (category, commerce, requirements→bank/wallet/cardNetwork)
        ↓
Reordenar el resultado según top3Ids (findMany no preserva orden del IN)
        ↓
Respuesta HTTP (mismo shape que hoy)
```

No se propone tocar `matchesProfile()`, las reglas del Decision Engine, el schema de
Prisma, índices, cache ni la UI del Recommendation Block — el cambio es exclusivamente en
`getPromos.ts`/`recommended/route.ts`: qué se selecciona y en qué momento se hidrata.
