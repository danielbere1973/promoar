# Propuesta técnica — Etapa 1 "Tus rubros"
15/8/2026 — respuesta al deliverable de 7 puntos pedido en CPO Approval "Tus rubros" v3.
**Actualizado 16/8/2026 (primera ronda)** tras CPO Review con 3 correcciones obligatorias:
(1) Bloque A no muestra slots `empty`, (2) elimina `SCORE_TIE_EPSILON`, (3) cierra la decisión
de almacenamiento del snapshot.
**Actualizado 16/8/2026 (segunda ronda)** — arquitectura funcional aprobada; 3 correcciones
más antes de implementar: (1) `RecommendationSnapshot` no se reutiliza reinterpretando
semántica — se decide un modelo nuevo, `HomeDecisionSnapshot`; (2) se elimina la contradicción
"no recalcular en el día" vs. "invalidar por pool" — la selección es estable mientras no
cambian sus 3 inputs relevantes, cualquiera puede invalidar y recalcular el mismo día; (3)
`declaredUniverseVersion = MAX(updatedAt)` se reemplaza por `declaredUniverseHash`, un hash
determinístico del conjunto declarado completo. Ver punto 2 y deltas en puntos 3, 5 y 6.
**Actualizado 16/8/2026 (tercera ronda, bloqueante)** — el CPO señaló que los 3 inputs de la
segunda ronda no cubrían todo lo que `buildHomeDecisionPayload` usa realmente: se auditó el
código (`scorePromo`, `buildHomeDecisionPayload`, `getPromos.ts`, `nearbyBranches.ts`) y se
encontró que perfil financiero, favoritos y ubicación sí modifican el resultado sin tener
representación en la llave de vigencia anterior. Se agrega un cuarto input,
`decisionContextHash`, que consolida esos 3 más `PersonaPreferences` (hoy inerte mientras no
haya onboarding real). La precisión de ubicación reutiliza el redondeo a 0.1km que
`scoreCercania` ya usa hoy — sin tolerancia nueva inventada. Ver inventario, definición del
hash y precisión de ubicación en el punto 2; deltas en puntos 5 y 6 (tests 14-20 nuevos).

Alcance: **solo** los 7 puntos pedidos. No incluye código. No toca PROD ni DB. No implementa
Bloque B. Todavía no autorizado para implementación — pendiente nueva aprobación del CPO
sobre esta versión corregida.

---

## 1. Decision Engine — seleccionar hasta 5 entre TODOS los DECLARED

### Qué cambia y qué no

`lib/rubroPreferences.ts::getDeclaredActivePreferences` y `getActiveHomeRubroIds` **no
cambian** — siguen siendo las únicas queries de universo (rubros declarados activos +
catálogo habilitado), sin I/O de promos, tal como están hoy.

`selectRubrosForHome` (mismo archivo) queda **obsoleta como diseño** — hoy resuelve
"declared first in catalog order + fill with catalog to reach N", que es exactamente el
problema que v3 descartó (auto-fill, catálogo como prioridad). Se reemplaza por dos piezas
nuevas con responsabilidades separadas:

**a) `resolveDeclaredUniverse()`** (nueva, en `rubroPreferences.ts`, sigue sin I/O de promos)

Pura función que reemplaza a `selectRubrosForHome`: recibe `declared: DeclaredPreference[]`
y `activeRubroIds: Set<string>`, devuelve `RubroConfig[]` — el universo completo de rubros
declarados y activos, **sin cortar en N y sin fill**. Reemplaza la responsabilidad de
"quién es candidato", no la de "quién gana slot".

```ts
export function resolveDeclaredUniverse(
  declared: DeclaredPreference[],
  activeRubroIds: Set<string>,
  catalog: RubroConfig[] = RUBRO_CATALOG
): RubroConfig[] {
  const declaredIds = new Set(declared.map(d => d.rubroId))
  return catalog.filter(r => activeRubroIds.has(r.id) && declaredIds.has(r.id))
}
```

**b) Selección por oportunidad — nueva responsabilidad en `decisionEngineV2.ts`**

Hoy `buildHomeDecisionPayload` recibe `rubroSelection: RubroSelection[]` ya resuelto por el
caller (route.ts) y arma un slot por cada elemento, 1 a 1, en el orden dado. Esto es lo que
hoy encarna implícitamente "catálogo = prioridad": el array que llega ya viene ordenado y
recortado a N por `selectRubrosForHome`.

Etapa 1 invierte el orden de las operaciones: el motor recibe el **universo completo** de
declarados (hasta 10, no hasta 5) más el `DecisionContext`/promos, **puntúa una oportunidad
por cada rubro declarado** usando el mismo `scorePromo`/`buildRubroSlot` que ya existe hoy
(sin cambios en el cálculo de score — `scoreAhorro`, `scoreAfinidad`, `scoreCercania`,
`scoreOnline`, `scoreFavoritos`, pesos `WEIGHTS`), y **después** elige cuáles hasta 5 ocupan
slot, ordenando por el `score` de la oportunidad ya calculada.

```ts
// Nueva función en decisionEngineV2.ts. Reemplaza el rol de "rubroSelection ya recortado"
// que hoy cumple selectRubrosForHome + el caller.
//
// CORRECCIÓN CPO Review 16/8/2026: Bloque A no muestra slots 'empty'. Un declarado sin
// oportunidad calificable hoy simplemente no genera fila en `rubros` — no hay relleno,
// no hay intento de completar hasta n. rubros.length puede ser 0..HOME_RUBRO_COUNT.
function selectTopRubroSlots(
  declaredUniverse: RubroConfig[],
  promosByCategorySlug: Map<string, any[]>,
  ctx: DecisionContext,
  prefs: PersonaPreferences | undefined,
  now: Date,
  n: number = HOME_RUBRO_COUNT
): RubroSlot[] {
  // 1. Construye un slot candidato por cada rubro declarado (mismo buildRubroSlot de hoy).
  const built = declaredUniverse.map(rubro => {
    const promos = rubro.categorySlugs.flatMap(slug => promosByCategorySlug.get(slug) ?? [])
    return { rubro, slot: buildRubroSlot(rubro, promos, ctx, prefs, now) }
  })

  // 2. Conserva ÚNICAMENTE los que tienen oportunidad real (status 'ok'). Los 'empty' se
  //    descartan acá — no viajan a Home. (`RubroSlot` con status 'empty' sigue existiendo
  //    en el contrato para otros usos — debug, futuros flujos — pero Bloque A no los usa.)
  const ok = built.filter(b => b.slot.status === 'ok') as { rubro: RubroConfig; slot: Extract<RubroSlot, {status:'ok'}> }[]

  // 3. Ordena por score de la oportunidad principal, descendente. Score mayor gana siempre.
  //    Desempate por RUBRO_CATALOG solo ante empate EXACTO (===), nunca por tolerancia.
  const catalogIndex = new Map(RUBRO_CATALOG.map((r, i) => [r.id, i]))
  ok.sort((a, b) => {
    if (b.slot.principal.score !== a.slot.principal.score) {
      return b.slot.principal.score - a.slot.principal.score
    }
    return (catalogIndex.get(a.rubro.id) ?? 0) - (catalogIndex.get(b.rubro.id) ?? 0)
  })

  // 4. Toma hasta n. Sin relleno: si hay menos de n con oportunidad 'ok', rubros sale corto.
  return ok.slice(0, n).map(c => c.slot)
}
```

**Corrección CPO Review 16/8/2026 — sin `SCORE_TIE_EPSILON`.** La versión anterior de este
documento introducía una tolerancia (`0.02`) para tratar scores "cercanos" como empate. El
CPO la rechazó: eso es una regla de ranking nueva (decide qué cuenta como "igual" para
favorecer catálogo por sobre score real), no una garantía de estabilidad. Corregido: el
comparador de `sort` usa `!==` (igualdad exacta de punto flotante del `number` ya calculado
por `scorePromo`), sin ningún margen. Si en la práctica aparece un caso real de dos scores
que deberían tratarse como iguales por precisión de cálculo (no por cercanía de negocio), eso
se demuestra con el caso concreto antes de introducir cualquier normalización — no se
anticipa acá.

### Qué pasa con el fallback de catálogo completo que existe hoy

`pickFallbackRubro` (líneas 345-362 de `decisionEngineV2.ts` actual) hoy sustituye un
declarado sin oportunidad por CUALQUIER rubro del catálogo completo (declarado o no) que sí
tenga oportunidad. Esto **contradice v3 §1** (Bloque A es exclusivamente declarado) tal como
está escrito hoy — sustituir por un rubro NO declarado significa que el usuario ve en "Tus
rubros" algo que no eligió.

Esto no estaba entre los 7 puntos a resolver, pero es una inconsistencia real entre código
actual y v3 que el Decision Engine debe resolver para que el punto 1 tenga sentido. Se
propone: **`pickFallbackRubro` deja de correr para Bloque A**. Un declarado sin oportunidad
hoy simplemente no ocupa slot — el array `rubros` sale con menos de 5 elementos (v3 lo
permite explícitamente: "puede haber menos de 5 resultados").

**Corrección CPO Review 16/8/2026**: la versión anterior de este documento proponía un paso 4
que rellenaba `rubros` con slots `'empty'` de declarados que no llegaron a `'ok'`, para "no
dejar huecos". El CPO cerró que eso tampoco corresponde — Bloque A muestra únicamente
oportunidades calificables (`status='ok'`), nunca slots vacíos, ni siquiera de rubros
declarados. Ese paso 4 fue eliminado de `selectTopRubroSlots` (ver versión corregida arriba).
Los 5 declarados sin oportunidad del ejemplo del CPO ("declaró 8, hoy 3 tienen oportunidad")
simplemente no generan ninguna fila — `rubros.length = 3`, y esos otros 5 siguen existiendo
como preferencia en `UserRubroPreference`, visibles en la pestaña "Rubros" de Perfil, pero
invisibles en Home hasta que tengan una oportunidad calificable algún día.

Si en el futuro se quiere "rellenar con algo de fuera de declarados cuando faltan slots",
eso es exactamente la definición de Bloque B — no se implementa en Etapa 1.

`RubroSlot` con `status='empty'` sigue existiendo como variante del tipo unión en
`homeDecisionContract.ts` (sin cambios ahí, ver punto 4) — queda disponible para otros
contextos (debug, futuros flujos que sí necesiten explicar "por qué no hay oportunidad"),
simplemente Bloque A de Etapa 1 no lo produce nunca.

### Contrato de la nueva función pública

```ts
export function buildHomeDecisionPayload(
  promos: any[],
  ctx: DecisionContext,
  prefs: PersonaPreferences | undefined,
  opts: BuildHomeDecisionOptions,
  declaredUniverse: RubroConfig[]   // ← reemplaza rubroSelection: RubroSelection[]
): HomeDecisionPayload
```

`RubroSelection` (interface con `isDeclared: boolean`) deja de tener sentido — en Etapa 1
**todo** lo que entra a `buildHomeDecisionPayload` es declarado por definición (ya no hay
mezcla declared/fill). El campo `isDeclared` se elimina junto con el tipo.

---

## 2. Estabilidad diaria — propuesta técnica mínima

**Actualizado 16/8/2026 — segunda ronda de correcciones CPO.** El CPO cerró tres puntos sobre
esta sección: (1) la contradicción "no recalcular en el día" vs. "invalidar por pool" queda
resuelta con la semántica correcta abajo; (2) `RecommendationSnapshot` no se reutiliza por
default — se evalúa explícitamente y se decide crear un modelo propio; (3)
`declaredUniverseVersion` deja de ser `MAX(updatedAt)` y pasa a ser un hash determinístico del
conjunto declarado completo.

**Actualizado 16/8/2026 — tercera ronda (bloqueante, corrección final).** El CPO señaló que
los 3 inputs de la segunda ronda (`operationalDay`, `declaredUniverseHash`, `promoPoolVersion`)
no cubren todo lo que `buildHomeDecisionPayload` efectivamente usa para calcular score,
elegibilidad y Facts — en particular perfil financiero, ubicación y favoritos. Se auditó el
código real (`lib/decisionEngineV2.ts`, `app/api/promos/home-decision/route.ts`,
`lib/getPromos.ts`, `lib/nearbyBranches.ts`) para enumerar el inventario exacto en vez de
asumirlo. Resultado y decisión final más abajo — reemplaza la lista de 3 inputs de la ronda
anterior por 4: `operationalDay`, `declaredUniverseHash`, **`decisionContextHash`** (nuevo,
consolida todo lo que antes faltaba) y `promoPoolVersion`.

### Inventario real de inputs — auditado contra el código, no asumido

Se recorrió la cadena completa que produce el `HomeDecisionPayload`: `route.ts` → 
`getPromosData` (arma cada `promo` con `userBestDiscount`/`isSaved`) → `buildHomeDecisionPayload`
→ `scorePromo`/`buildFacts` en `decisionEngineV2.ts`. Todo lo que puede cambiar el score, la
elegibilidad (gate `passesVigencia`, gate `CONFIDENCE_THRESHOLD_OK`) o los `Facts` de un
candidato, por usuario, es:

| Input | Dónde entra | Cómo llega hoy |
| --- | --- | --- |
| **Perfil financiero** (`effectiveCards`, `walletVirtualCards`, segmentos) | `getPromos.ts:653-891` calcula `userBestDiscount` por promo vía `matchesProfile()` contra `financialProfile.{banks,wallets,cards}` — **entra al motor ya resuelto**, como campo `promo.userBestDiscount` que alimenta `scoreAhorro` y `buildBenefitFact`/`buildCapFact`/`buildPaymentMethodFact` en Facts | Requiere query a `User.financialProfile` (o `guest_profile` en query param) |
| **Favoritos** (`isSaved`) | `getPromos.ts:655,895` — `finalSavedSet` desde `User.savedPromos`, expuesto como `promo.isSaved`, consumido por `scoreFavoritos` | Requiere query a `User.savedPromos` |
| **Ubicación** (`hasLocation`, `nearbyByCommerceId`) | `route.ts:103-105` — `getHasLocationNearby(lat, lng)` llama `getNearbyBranchesByCommerce`, resultado va a `ctx: DecisionContext`, consumido por `scoreCercania` | `lat`/`lng` vienen de query params del request, no de un valor persistido por usuario |
| **`PersonaPreferences.declaredCategorySlugs`** | `scoreAfinidad` en `decisionEngineV2.ts:104-110` — si están presentes, dan afinidad=1 (`source: 'declarada'`) en vez del default por categoría | **Hoy es siempre `undefined`**: `route.ts:125` llama `buildHomeDecisionPayload(promos, ctx, undefined, ...)` — no hay onboarding real todavía (RFC-006 fuera de alcance de Etapa 1, confirmado en comentario de `decisionEngineV2.ts:1-5`) |
| **`declaredUniverse` (rubros DECLARED activos)** | Determina qué categorías se evalúan siquiera (punto 1 de esta propuesta) | Ya cubierto por `declaredUniverseHash` (ronda anterior) |
| **`todayBit`** | Gate `passesVigencia` — filtra candidatas por día de la semana | Ya cubierto por `operationalDay` |
| **Pool de promos** (estado/vigencia/discount de cada promo) | Universo de candidatas antes de scorear | Ya cubierto por `promoPoolVersion` |

**No participan del cálculo** (revisado y descartado explícitamente, para que quede
documentado que no se omitieron por descuido): `province` (solo se usa para el filtro
geográfico general de `getPromosData`, no para `scoreCercania`, que usa `lat`/`lng` reales);
`isAdmin`/`role` (solo afecta si se fuerza `userBestDiscount`, no cambia el resultado para un
usuario no-admin); `guest_profile` (mismo shape que perfil financiero real, mismo tratamiento
— ver más abajo).

**Conclusión de la auditoría**: el CPO tenía razón — perfil financiero, favoritos y ubicación
sí modifican el resultado y no estaban en la lista de invalidación de la ronda anterior.
`PersonaPreferences` hoy no aporta nada porque siempre es `undefined` en producción, pero se
incluye en el hash de todos modos para no dejar una trampa quieta: el día que exista
onboarding real (RFC-006), este mecanismo ya lo cubre sin tocar el snapshot de nuevo.

### Contrato correcto (reemplaza la formulación anterior)

Formulación previa incorrecta: "recalcular solo cuando cambia el día operativo... **o el pool
de promos se invalida**" convivía en el mismo documento con "no recalcular dentro de la misma
ventana operativa diaria, punto" — dos reglas que se contradicen apenas el pool cambia a media
tarde.

**Decisión CPO, ahora el contrato único**: la selección permanece estable **mientras no
cambien sus inputs relevantes**. Los inputs relevantes son exactamente 4 (revisado en la
tercera ronda — antes eran 3, ver auditoría arriba), y cualquiera puede invalidar y disparar
recálculo en cualquier momento del día, no solo al cruzar medianoche:

1. **Día operativo** (`operationalDay`, criterio de `todayDayBit()`).
2. **Universo declarado** (`declaredUniverseHash`).
3. **Contexto de decisión propio del usuario** (`decisionContextHash` — consolida perfil
   financiero, favoritos, contexto de cercanía por comercio (`proximityContextHash`, definido
   a partir del `nearbyByCommerceId` real que consume el motor — corrección CPO 16/8/2026,
   cuarta ronda) y `PersonaPreferences`; ver definición completa e inventario auditado más
   abajo).
4. **Cambio material o invalidez del pool de promos** (`promoPoolVersion`).

No hay ventana temporal fija ("una vez por día") como regla independiente — el día operativo
es uno de los cuatro inputs, no un lock que se abre a medianoche. Si el pool cambia a las
15:30, o el usuario cambia de ubicación, o marca un favorito, la próxima request recalcula en
ese momento, no espera al día siguiente. Esto es justamente lo que evita la ambigüedad
anterior: "estable" significa "mismo resultado si nada relevante cambió", no "recalculado como
máximo una vez por día".

**Sin epsilon, hysteresis ni thresholds nuevos** (sin cambios respecto a las rondas
anteriores): no se compara "score nuevo vs. score viejo ± X%" para decidir si vale la pena
mostrar el cambio — si un input relevante cambió, se recalcula y se muestra el resultado
nuevo tal cual, sin amortiguarlo. La discretización de ubicación (más abajo) no es una
excepción a esta regla: es la misma precisión que el motor de scoring ya usa hoy, no una
tolerancia nueva inventada para el hash.

### Almacenamiento — decisión revisada: modelo propio, no reutilización silenciosa de `RecommendationSnapshot`

**Corrección CPO 16/8/2026**: la versión anterior de este documento reutilizaba
`RecommendationSnapshot` reinterpretando `profileHash` y `catalogVersion` con significados
distintos a los que su nombre sugiere, apoyándose en que hoy no tiene consumidores vivos
(confirmado por grep — ver nota más abajo, ese hallazgo sigue siendo válido). El CPO señaló
que "no tiene consumidores hoy" no es motivo suficiente para reutilizar con semántica
reinterpretada: el modelo existente representa el diseño de un producto distinto (v1,
"recomendaciones" genéricas), no "selección de rubros para Bloque A de Home v2". Nombrar
`profileHash` como si fuera `(perfil financiero, declaredUniverseVersion)` cuando el campo se
llama así por una razón de v1 es exactamente la clase de deuda semántica silenciosa que el CPO
pidió evitar, con o sin colisión real de datos.

**Evaluación explícita de las dos opciones:**

- **Opción A — Convertir/documentar `RecommendationSnapshot` como snapshot genérico.**
  Requeriría renombrar sus campos a algo neutral (`inputsHash` en vez de `profileHash`, por
  ejemplo) y documentar en el modelo que es un snapshot genérico de "última decisión calculada
  por usuario", reutilizable por cualquier motor de decisión futuro (v1 si volviera, v2, un
  v3). Ventaja: cero tablas nuevas. Desventaja: el modelo pasa a cargar la responsabilidad de
  "significar lo correcto para cualquier consumidor futuro", lo cual es una promesa más grande
  de la que Etapa 1 necesita hacer hoy — y renombrar campos de un modelo con `@@map` en
  producción es un cambio de superficie más amplio que crear uno nuevo.
- **Opción B — Modelo propio `HomeDecisionSnapshot`.** Mismo shape estructural
  (persistente, un registro por usuario, Json de payload + campos de versión), pero con
  nombres que dicen exactamente lo que son para Home Decision v2, sin heredar ni reinterpretar
  semántica de v1.

**Decisión: Opción B.** Prioriza claridad semántica sobre evitar una migración, tal como pidió
el CPO. Es una migración nueva, pero pequeña y mecánica — no hay lógica de negocio en el
modelo, solo columnas:

```prisma
// Nuevo modelo — snapshot persistente de la selección de Bloque A por usuario.
// Nombres explícitos para Home Decision v2, sin reinterpretar campos de
// RecommendationSnapshot (v1, sin consumidores vivos hoy, no tocado).
//
// Actualizado 16/8/2026 (tercera ronda CPO): declaredUniverseHash por sí solo
// no identifica el estado del usuario — ver auditoría de inputs arriba. Se
// agrega decisionContextHash, que consolida todo lo que NO es pool ni día
// operativo (perfil financiero, ubicación, favoritos, PersonaPreferences).
// declaredUniverseHash se mantiene como campo aparte (no se pliega dentro de
// decisionContextHash) por observabilidad: permite diagnosticar en logs/DB
// si una invalidación vino de un cambio de rubros declarados específicamente,
// sin decodificar el hash combinado. No es, por sí solo, la vigencia — la
// vigencia exige los 4 campos de versión coincidentes.
model HomeDecisionSnapshot {
  id                     String   @id @default(cuid())
  userId                 String   @unique
  payload                Json     // HomeDecisionPayload completo
  operationalDay         String   // fecha calendario Argentina, mismo criterio que todayDayBit()
  declaredUniverseHash   String   // hash determinístico del conjunto de rubros DECLARED/ACTIVE — observabilidad
  decisionContextHash    String   // hash determinístico de perfil financiero + favoritos + contexto de cercanía por comercio (proximityContextHash) + PersonaPreferences — ver definición abajo
  promoPoolVersion       String   // versión del pool de promos relevante al universo declarado
  generatedAt            DateTime @default(now())
  updatedAt              DateTime @updatedAt
  user                   User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("home_decision_snapshots")
}
```

Los 4 campos de versión (`operationalDay`, `declaredUniverseHash`, `decisionContextHash`,
`promoPoolVersion`) corresponden 1 a 1 a los 4 inputs relevantes de la sección anterior — no
hay campo que combine dos conceptos bajo un nombre heredado, y ninguno queda fuera de la
llave de vigencia (a diferencia de la ronda anterior, donde perfil/ubicación/favoritos
afectaban el resultado sin tener representación en el modelo).

**Regla de invalidación** (misma estructura que antes, ahora contra las 4 llaves):

```
GET /api/promos/home-decision:
  snapshot = HomeDecisionSnapshot.findUnique({ userId })
  vigente = snapshot
    && snapshot.operationalDay === currentOperationalDay()
    && snapshot.declaredUniverseHash === currentDeclaredUniverseHash(userId)
    && snapshot.decisionContextHash === currentDecisionContextHash(userId, lat, lng)
    && snapshot.promoPoolVersion === currentPromoPoolVersion()
  if (vigente) return snapshot.payload as HomeDecisionPayload
  payload = buildHomeDecisionPayload(...)
  upsert HomeDecisionSnapshot { payload, operationalDay, declaredUniverseHash, decisionContextHash, promoPoolVersion }
  return payload
```

Persistente entre invocaciones serverless (Postgres, no memoria de proceso) — resuelve el
problema real de Vercel señalado por el CPO. `@@unique([userId])` garantiza una sola fila por
usuario, upsert atómico. Al ser un modelo nuevo sin consumidores previos, no hay ninguna
ambigüedad de colisión que evaluar (a diferencia de la opción descartada de reutilizar
`RecommendationSnapshot`).

`RecommendationSnapshot` (v1) queda intacto, sin tocar — se confirma por grep que sigue sin
consumidores vivos en el repo (`/api/promos/recommended` no existe como ruta, solo dos
comments históricos en `route.ts`), pero esta vez esa ausencia de uso no se interpreta como
autorización para reutilizarlo.

### `declaredUniverseHash` — reemplaza `declaredUniverseVersion = MAX(updatedAt)`

**Corrección CPO 16/8/2026**: `MAX(updatedAt)` de las filas DECLARED/ACTIVE no identifica el
conjunto, solo el momento del cambio más reciente. Dos conjuntos distintos de rubros
declarados pueden compartir el mismo `MAX(updatedAt)` si la última operación fue, por
ejemplo, una reactivación que no cambió el resto de las filas — o, más importante, si el
usuario declara A y B en momentos distintos y después vuelve a un estado que ya había tenido
antes, `MAX(updatedAt)` sigue avanzando aunque el *contenido* del conjunto sea el que ya se
había visto, perdiendo la propiedad de "same set → same hash" que un identificador de
conjunto debería tener.

**Reemplazo — hash determinístico del conjunto completo, no solo su timestamp máximo:**

```ts
function computeDeclaredUniverseHash(rows: UserRubroPreference[]): string {
  // rows = filas DECLARED/ACTIVE del usuario (mismo query que hoy alimenta
  // getDeclaredActivePreferences, sin cambios ahí).
  const canonical = rows
    .map(r => `${r.rubroId}:${r.updatedAt.toISOString()}`)
    .sort() // orden determinístico por rubroId, independiente del orden de la query
    .join('|')
  return sha256(canonical) // o crypto.createHash('sha256'), sin dependencia nueva
}
```

Incluye **IDs activos ordenados + su `updatedAt` individual**, no un único máximo global:
- Si el conjunto de IDs cambia (agregar/quitar/reactivar un rubro) → el string canónico
  cambia → el hash cambia. Cubre el mismo caso que `MAX(updatedAt)` cubría.
- Si el conjunto de IDs es idéntico pero alguna fila individual fue tocada sin cambiar el
  resultado final (ej. un `UPDATE` que no modifica campos visibles) — caso borde, no
  bloqueante para Etapa 1, mencionado por completitud — el hash cambiaría igual porque
  incluye `updatedAt` por fila; se acepta como comportamiento conservador (invalida de más,
  nunca de menos), preferible a la alternativa de ignorar `updatedAt` por fila y arriesgar
  no detectar un cambio real.
- El orden alfabético por `rubroId` antes de unir el string garantiza que el mismo conjunto
  lógico produce el mismo hash sin importar el orden en que Prisma devuelva las filas.

No requiere columna nueva en `UserRubroPreference` — se calcula en el momento a partir de
las filas ya leídas por `getDeclaredActivePreferences` (mismo query, sin I/O adicional).

### `decisionContextHash` — corrección CPO 16/8/2026 (tercera ronda, bloqueante)

**Por qué hacía falta.** `declaredUniverseHash` + `operationalDay` + `promoPoolVersion`
identifican "mismo usuario, mismo día, mismo universo declarado, mismo pool" — pero
`buildHomeDecisionPayload` recibe más inputs que esos tres, y ninguno de ellos tenía
representación en la llave de vigencia. Auditado el código real (`scorePromo` y
`buildHomeDecisionPayload` en `lib/decisionEngineV2.ts`, más `lib/getPromos.ts` y
`lib/nearbyBranches.ts`), la lista exacta de inputs que sí modifican score/elegibilidad/Facts
y que no son ni pool ni día es:

1. **Perfil financiero relevante para matching** (`promo.userBestDiscount`, calculado en
   `getPromos.ts` desde `financialProfile.{banks,wallets,cards}` + segmentos, vía
   `matchesProfile`) — alimenta `scoreAhorro` y los Facts de beneficio/tope/medio de pago.
2. **Contexto de cercanía usado por el motor** (`ctx.hasLocation`,
   `ctx.nearbyByCommerceId[commerceId].minDistKm`) — alimenta `scoreCercania`. Ver definición
   propia abajo — **corrección CPO 16/8/2026 (cuarta ronda)**: no existe hoy en el código
   ningún "bucket geográfico"; lo único que el motor consume es `nearbyByCommerceId` tal como
   lo devuelve `getNearbyBranchesByCommerce`, un mapa por comercio, no una ubicación única.
3. **Favoritos** (`promo.isSaved`, desde `User.savedPromos`) — alimenta `scoreFavoritos`
   directamente (peso 0.06 en `WEIGHTS`).
4. **`PersonaPreferences.declaredCategorySlugs`** — alimenta `scoreAfinidad`. Hoy siempre
   `undefined` en producción (`route.ts` llama `buildHomeDecisionPayload(promos, ctx, undefined, ...)`,
   sin onboarding real que lo alimente — RFC-006 fuera de alcance de Etapa 1). Se incluye en
   el hash igual: es más barato incluir un input hoy inerte que dejar un punto ciego para el
   día en que RFC-006 lo conecte y nadie recuerde tocar el snapshot.

Lo que **no** entra en `decisionContextHash` porque es intrínseco a la promo/pool, no al
usuario/contexto — ya cubierto por `promoPoolVersion`: `promo.category?.slug`,
`promo.salesChannel`, estado/vigencia de cada promo.

```ts
function computeDecisionContextHash(input: {
  effectiveCards: { bankId?: string; walletId?: string; cardNetworkId?: string; cardSegmentId?: string }[] | null
  favoritedPromoIds: string[]
  proximityContextHash: string // ver definición propia abajo — representación determinística de nearbyByCommerceId, o el valor fijo de "sin contexto de cercanía"
  declaredCategorySlugs: string[] | undefined // PersonaPreferences, hoy siempre []
}): string {
  const canonical = JSON.stringify({
    cards: [...(input.effectiveCards ?? [])]
      .map(c => `${c.bankId ?? ''}:${c.walletId ?? ''}:${c.cardNetworkId ?? ''}:${c.cardSegmentId ?? ''}`)
      .sort(),
    favorites: [...input.favoritedPromoIds].sort(),
    proximity: input.proximityContextHash,
    afinidad: [...(input.declaredCategorySlugs ?? [])].sort(),
  })
  return sha256(canonical)
}
```

Determinístico por construcción: cada colección se ordena antes de serializar, igual que
`computeDeclaredUniverseHash`, para que el resultado no dependa del orden de lectura de
Prisma.

**No se incluye `guest_profile`** en esta función porque `HomeDecisionSnapshot` requiere
`userId` (sesión real) — un guest no tiene fila de snapshot que invalidar, el path de guest ya
recalcula siempre en `getPromosData` sin pasar por este mecanismo. Esto no es una laguna
nueva: es el mismo alcance que ya tenía el snapshot en la ronda anterior (solo usuarios
autenticados).

#### Contexto de cercanía (`proximityContextHash`) — corrección CPO 16/8/2026 (cuarta ronda)

**Corrección recibida**: la versión anterior de este documento hablaba de "bucket de 100m" y
de "posiciones GPS en el mismo bucket", tratando `minDistKm` como si fuera una ubicación única
discretizada. Eso no es correcto: `minDistKm` es un valor **por comercio**, dentro del objeto
`nearbyByCommerceId` — no existe en el código ninguna discretización de `lat`/`lng` en sí
misma. La corrección: no inventar esa abstracción. En vez de eso, hashear directamente el
shape real que el motor consume.

**Shape real auditado** (`lib/nearbyBranches.ts`, tipo `NearbyByCommerce` devuelto por
`getNearbyBranchesByCommerce`, consumido como `ctx.nearbyByCommerceId` en `DecisionContext`):

```ts
type NearbyMap = Record<string, { count: number; minDistKm: number }>
```

De estos dos campos por comercio, **solo `minDistKm` participa del scoring** — `scoreCercania`
lee `nearby.minDistKm`, no lee `count`:

```ts
function scoreCercania(promo: any, ctx: DecisionContext): number {
  if (!ctx.hasLocation) return 0
  const nearby = ctx.nearbyByCommerceId[promo.commerceId]
  if (!nearby) return 0
  return Math.max(0, Math.min(1, 1 - nearby.minDistKm / 5))
}
```

`count` no se audita como input porque no es leído por ninguna función de scoring — queda
fuera del hash por el mismo criterio que excluye `promo.category?.slug`/`salesChannel` (no
participan de este objeto, participan de otro). `minDistKm` ya viene redondeado a 1 decimal
por `nearbyBranches.ts` (`Math.round(distanceKm * 10) / 10`) antes de llegar acá — ese
redondeo es preexistente al motor, no algo agregado para este hash; simplemente significa que
el valor que se hashea es el mismo que efectivamente compara `scoreCercania`, sin redondeo
adicional propio del hash.

```ts
function computeProximityContextHash(nearbyByCommerceId: NearbyMap): string {
  const entries = Object.entries(nearbyByCommerceId)
  if (entries.length === 0) return 'no-proximity-context' // valor fijo, no null — evita ambigüedad de tipo en el hash combinado
  const canonical = entries
    .map(([commerceId, v]) => `${commerceId}:${v.minDistKm}`)
    .sort() // por commerceId, determinístico sin importar el orden de iteración del objeto
    .join('|')
  return sha256(canonical)
}
```

**Qué invalida y qué no, exactamente**: dos requests cuyo `nearbyByCommerceId` resultante es
idéntico campo a campo (mismo conjunto de comercios, mismo `minDistKm` redondeado para cada
uno) producen el mismo `proximityContextHash`, sin importar qué coordenadas GPS crudas
originaron ese resultado — no se afirma nada sobre "cercanía entre dos puntos", solo se
compara el objeto que el motor ya calculó. Si `getNearbyBranchesByCommerce` devuelve un
`nearbyByCommerceId` distinto (cambia el conjunto de comercios dentro del radio, o cambia el
`minDistKm` redondeado de al menos uno) → el hash cambia → invalida. Esto es exactamente
"invalida cuando y solo cuando `scoreCercania` habría cambiado", sin agregar ninguna noción de
proximidad geográfica que no exista ya en el motor.

Sin ubicación (`hasLocation=false`, `nearbyByCommerceId={}`) → `proximityContextHash =
'no-proximity-context'`, estable entre requests mientras el usuario siga sin compartir
ubicación. En el momento en que la comparte por primera vez y `nearbyByCommerceId` deja de
estar vacío, el hash pasa a depender del contenido real → cambia → invalida.

### Triggers — resumen actualizado (reemplaza el diagnóstico "3 de 4" y luego "4 inputs" anterior)

- **Día operativo**: input 1, ver contrato correcto arriba.
- **Universo declarado**: input 2 — `declaredUniverseHash`. Cualquier cambio real del
  conjunto de rubros DECLARED/ACTIVE cambia el hash, invalida el snapshot, se recalcula en
  la próxima request, sin esperar al día siguiente.
- **Contexto de decisión del usuario**: input 3 — `decisionContextHash`. Cambia si cambia el
  perfil financiero relevante, si el usuario marca/desmarca un favorito, o si cambia el
  `proximityContextHash` (el `nearbyByCommerceId` real que consume `scoreCercania` — ver
  definición y corrección de la cuarta ronda arriba). Cualquiera de estos invalida de
  inmediato, mismo día.
- **Pool de promos cambia/se invalida materialmente**: input 4 — `promoPoolVersion`. Mismo
  criterio que antes (`SiteConfig` o `MAX(updatedAt)` sobre promos activas de las categorías
  de `RUBRO_CATALOG`, a confirmar granularidad con evidencia real al implementar).

Los 4 inputs son independientes y cualquiera invalida por sí solo — no hay jerarquía ni orden
de prioridad entre ellos, y ninguno compite con "no recalcular en el día": el contrato sigue
siendo "estable mientras no cambien los inputs relevantes", ahora con los 4 inputs
efectivamente representados en el modelo.

---

## 3. Endpoints `/api/perfil/rubros` — GET/PUT definitivos

### `GET /api/perfil/rubros`

Requiere sesión (mismo patrón de auth que `app/api/promos/home-decision/route.ts` — JWT vía
`getAuthToken`, sin fallback a header `x-user-email`).

Response:

```jsonc
{
  "universe": [
    { "id": "supermercados", "label": "Supermercados", "icon": "🛒", "active": true },
    { "id": "viajes-y-turismo", "label": "Viajes y Turismo", "icon": "✈️", "active": false }
    // ...los 10 de RUBRO_CATALOG, con `active` resuelto desde HomeRubro.active
  ],
  "declared": ["tecnologia", "viajes-y-turismo"]
  // ids de UserRubroPreference WHERE source=DECLARED AND status=ACTIVE — mismo criterio
  // que getDeclaredActivePreferences, reutilizada tal cual
}
```

`universe` siempre trae los 10 (activos e inactivos) para que la UI pueda mostrar
deshabilitado un rubro inactivo que el usuario ya tenía declarado (estado "quedó inactivo"
del mockup) — filtrar solo por `active` en el cliente perdería esa distinción.

### `PUT /api/perfil/rubros`

Guardado explícito, diff-based — la UI junta todos los toggles pendientes y manda el
**estado final deseado**, no una lista de operaciones:

```jsonc
// Request body
{ "declared": ["supermercados", "tecnologia", "farmacias"] }
```

El servidor calcula el diff contra el estado actual y aplica las 3 operaciones de
reconciliación ya definidas en v2/v3 §8 (sin cambios de semántica, ya confirmado "sin
contradicción"):

- **En `declared` pero sin fila DECLARED existente** → `INSERT UserRubroPreference
  {source: DECLARED, status: ACTIVE}`.
- **En `declared` con fila DECLARED existente pero `status=SUPPRESSED`** → `UPDATE status =
  ACTIVE, suppressedAt = null` (reactivación, misma fila — nunca insert nuevo).
- **Fuera de `declared` con fila DECLARED existente `status=ACTIVE`** → `UPDATE status =
  SUPPRESSED, suppressedAt = now()` (nunca DELETE, nunca toca la fila INFERRED del mismo
  rubro si existiera).

Validaciones server-side:
- Todo id en `declared` debe existir en `RUBRO_CATALOG` (400 si no).
- No se valida mínimo ni máximo — v3 aprueba selección libre 0-10, sin recomendación 3-5.
- Un rubro con `HomeRubro.active=false` puede permanecer en `declared` si ya estaba (para no
  perder el estado "declarado pero temporalmente inactivo" del mockup), pero no puede
  **agregarse** de nuevo si no estaba — mismo criterio que el helper ya usado (`disabled`
  pero seleccionable-para-quitar en el mockup).

Response: mismo shape que el GET, reflejando el estado post-escritura (permite a la UI
confirmar sin hacer un segundo GET).

```jsonc
{ "universe": [ /* igual que GET */ ], "declared": ["supermercados", "tecnologia", "farmacias"] }
```

Este PUT es también el único punto que debe invalidar el `declaredUniverseHash` del punto 2
(corrección CPO 16/8/2026: ya no es un timestamp único, sino un hash sobre el conjunto
completo — ver punto 2). Como el hash se calcula en el momento a partir de las filas
`UserRubroPreference` vigentes (mismo query que ya usa `getDeclaredActivePreferences`), basta
con que el PUT persista sus cambios normalmente (`@updatedAt` de Prisma ya actualiza el
timestamp por fila) — no requiere lógica extra ni un campo de versión propio en el modelo.

---

## 4. Cambios necesarios en `HomeDecisionPayload` para Etapa 1

**Ninguno en la forma del tipo.** `descubrimiento` (Bloque B) queda fuera, confirmado no
requerido para Etapa 1 por el propio CPO.

Cambios de comportamiento dentro del contrato existente, sin tocar `homeDecisionContract.ts`:

- **`rubros: RubroSlot[]` puede volver con longitud entre 0 y `HOME_RUBRO_COUNT`** — el tipo
  ya es un array, ya soporta esto sin cambios. Antes, con fallback de catálogo completo,
  prácticamente siempre volvían 5. Ahora puede volver menos si hay pocos declarados con
  oportunidad real. Esto es una consecuencia de datos, no un cambio de tipo.
- **Caso 0 declarados**: por el punto 5 de CPO Approval ("ocultar el bloque A por completo"),
  el valor correcto es `rubros: []` con el `status` existente reutilizado —
  **no se agrega un status nuevo**. Se reutiliza `'ok'` con array vacío como señal de "no hay
  Bloque A que mostrar, no es un error ni un estado de carga". El cliente (Home) ya debe
  poder manejar "array vacío → ocultar sección" sin que el contrato le diga explícitamente
  "ocultar" — es una decisión de presentación, no de datos (mismo principio que ya aplica a
  `reasonsText` vs `Reason[]`, RFC-008 §2.5: la capa de presentación decide cómo mostrar,
  el motor solo entrega datos). El CTA "Elegí tus rubros →" es contenido estático de la UI de
  Home, no algo que el payload necesite describir.

  Se descarta agregar un campo como `hideBlock: boolean` porque sería redundante con
  `rubros.length === 0` y le da al contrato una responsabilidad de presentación que RFC-008
  ya excluyó explícitamente.

- **`missingProfile`**: sin cambios — sigue señalando falta de perfil financiero, no falta de
  rubros declarados. "0 declarados" no es lo mismo que "perfil incompleto": un usuario puede
  tener perfil financiero completo y 0 rubros declarados.

En síntesis: item 4 se resuelve con **cero cambios de tipo**, solo con la función que llena
`rubros` (punto 1) pudiendo devolver un array más corto o vacío, cosa que el contrato ya
soporta.

---

## 5. Lista de archivos a modificar

**Modificados:**
- `lib/rubroPreferences.ts` — reemplaza `selectRubrosForHome` por `resolveDeclaredUniverse`;
  elimina el tipo `RubroSelection` (o lo deja como alias temporal si algún test viejo lo
  importa — a confirmar al implementar).
- `lib/decisionEngineV2.ts` — nueva función `selectTopRubroSlots` (sin relleno de `empty`, sin
  epsilon — ver punto 1 corregido); `buildHomeDecisionPayload` cambia su último parámetro de
  `RubroSelection[]` a `RubroConfig[]` (declared universe); elimina `pickFallbackRubro` del
  path de Bloque A (o lo deja sin uso, marcado explícitamente como código muerto reservado
  para si Bloque B lo necesita — a decidir al implementar).
- `app/api/promos/home-decision/route.ts` — reemplaza la llamada a `selectRubrosForHome` por
  `resolveDeclaredUniverse`; pasa el universo (no una selección ya recortada) a
  `buildHomeDecisionPayload`; agrega lectura/escritura de `HomeDecisionSnapshot` (punto 2
  corregido — modelo nuevo, no `RecommendationSnapshot`) antes/después de invocar el motor;
  agrega las funciones `computeDeclaredUniverseHash`, `computeDecisionContextHash` y
  `computeProximityContextHash` (tercera y cuarta ronda CPO — o las importa de
  `lib/rubroPreferences.ts`/`lib/decisionEngineV2.ts`, a decidir por convención del archivo al
  implementar); agrega el cálculo de `proximityContextHash` a partir del `nearbyByCommerceId`
  ya obtenido de `getNearbyBranchesByCommerce` (sin request adicional — mismo dato que ya se
  pide para `ctx`).
- `app/perfil/page.tsx` — agrega `'rubros'` a la unión de `activeTab`, agrega el botón de tab,
  agrega el panel (nuevo, ver punto 7 / mockup).

**Nuevos:**
- `app/api/perfil/rubros/route.ts` — GET + PUT según punto 3. El PUT no necesita invalidar nada
  explícitamente — el próximo cálculo de `declaredUniverseHash` ya refleja el estado
  persistido (ver punto 2 corregido).
- `app/components/perfil/RubrosTab.tsx` (o inline en `page.tsx`, a decidir por convención del
  archivo — hoy `page.tsx` parece concentrar todos los tabs inline, ver líneas 526+) — UI del
  mockup, grid de 10 rubros, guardado explícito.

**Migración nueva (corrección CPO 16/8/2026 — reemplaza la decisión "sin migración" de la
versión anterior; campo `decisionContextHash` agregado en la tercera ronda):**
- `prisma/schema.prisma` — agrega el modelo `HomeDecisionSnapshot` (ver punto 2: `id, userId
  @unique, payload Json, operationalDay, declaredUniverseHash, decisionContextHash,
  promoPoolVersion, generatedAt, updatedAt`, `@@map("home_decision_snapshots")`). Migración
  mecánica (`prisma migrate dev` / `db push`, sin lógica de negocio en el modelo) — **no se
  ejecuta en esta entrega**, queda descrita para implementación futura, sin tocar DEV/PROD
  todavía.

**No tocados** (confirmados reusables sin cambio):
- `lib/rubroCatalog.ts`
- `lib/homeDecisionContract.ts`
- `HomeRubro`, `UserRubroPreference` (schema existente, sin cambios de forma — solo se leen
  con más frecuencia para calcular el hash).
- `RecommendationSnapshot` (v1) — permanece intacto y sin consumidor vivo hoy (confirmado por
  grep), pero **ya no se reutiliza** para Home Decision v2 — ver decisión revisada en punto 2.

---

## 6. Tests de aceptación

Todos corren contra el motor puro (`decisionEngineV2.ts`) o el endpoint con mocks — mismo
patrón que `route.test.ts` ya existente (mocks de Prisma/getPromos, sin DB real). Ninguno
requiere PROD/DEV.

**Selección entre declarados (punto 1):**
1. Usuario con 2 declarados, ambos con oportunidad 'ok' → `rubros` trae exactamente esos 2,
   en orden de score descendente (no en orden de catálogo, salvo empate).
2. Usuario con 8 declarados, 3 con oportunidad 'ok' y 5 sin oportunidad (`status='empty'`
   internamente) → `rubros.length = 3`, los 5 sin oportunidad no aparecen bajo ninguna forma
   (ni como 'ok' ni como 'empty') en la respuesta.
3. Usuario con 2 declarados, uno 'ok' y uno sin oportunidad (`sin_candidatos`) → `rubros`
   contiene **solo** el 'ok'; el declarado sin oportunidad no genera fila. Verifica también
   que nunca se sustituye por un rubro no declarado del catálogo (`pickFallbackRubro` no
   corre para Bloque A).
4. Empate exacto de score entre dos declarados (`slot.principal.score` idéntico, `===`) → el
   desempate respeta el orden de `RUBRO_CATALOG`, verificable invirtiendo el orden de input y
   confirmando que el output no cambia. Caso de score *cercano pero no idéntico* (ej.
   diferencia de 0.001) → el de mayor score gana sin excepción, sin tratarse como empate.
5. Usuario con 0 declarados → `rubros: []`, `status` no es `'all_empty'` ni `'incomplete_profile'`
   si el resto del perfil está completo (para no confundir "sin rubros" con "sin datos").
6. Catálogo con un rubro `active=false` que el usuario tiene declarado → no participa en la
   selección (no genera fila en `rubros`), consistente con que ya no es parte del universo
   activo.

**Estabilidad diaria (punto 2 — actualizados 16/8/2026 contra `HomeDecisionSnapshot` y la
semántica corregida "estable mientras no cambian los inputs, invalidable el mismo día"):**
7. Dos llamadas a `buildHomeDecisionPayload` en el mismo `now()`/mismo pool de promos
   producen exactamente el mismo `rubros` (mismo orden, mismos ids) — determinismo puro del
   motor, sin necesidad de mockear el snapshot.
8. Dos requests HTTP al endpoint en el mismo `operationalDay`, sin cambios en preferencias ni
   en el pool → la segunda respuesta se sirve desde `HomeDecisionSnapshot.payload` (verificable
   mockeando `buildHomeDecisionPayload` y confirmando que se invoca una sola vez entre ambos
   requests).
9. Cambiar `declared` vía PUT entre dos requests **dentro del mismo `operationalDay`** → el
   `declaredUniverseHash` calculado cambia (conjunto de IDs distinto), el snapshot se
   considera no vigente, la siguiente respuesta recalcula **inmediatamente, sin esperar al
   día siguiente**, y sobreescribe la fila existente (mismo `userId`, no crea una segunda).
   Este test reemplaza la ambigüedad de la versión anterior — confirma explícitamente que la
   invalidación mid-day es el comportamiento esperado, no un bug.
10. Avanzar el reloj mockeado a un nuevo `operationalDay` sin tocar nada más → el campo
    `operationalDay` calculado cambia, el snapshot se considera no vigente aunque preferencias
    y pool no cambiaron.
11. Con snapshot vigente pero payload previo con `rubros` de un usuario, request de un
    **segundo** usuario en el mismo instante → cada uno lee/escribe su propia fila
    (`userId` único), nunca se mezclan ni se pisan entre sí.
12. `computeDeclaredUniverseHash`: mismo conjunto de rubros declarados en distinto orden de
    lectura de la DB → mismo hash (verifica el `sort()` determinístico antes de hashear).
    Agregar o quitar un rubro declarado → hash distinto. Reactivar un `SUPPRESSED` a `ACTIVE`
    sin cambiar el resto del conjunto → hash distinto (cambia el `updatedAt` de esa fila).
13. Cambio material del pool de promos (ej. una promo del rubro declarado top-1 pasa a
    `EXPIRED`) entre dos requests del mismo `operationalDay`, sin cambios de preferencias →
    `promoPoolVersion` calculado cambia, snapshot no vigente, recalcula en el mismo día.
    Confirma el cuarto input de invalidación de la lista corregida del punto 2.

**`decisionContextHash` — tests nuevos (tercera ronda CPO, 16/8/2026):**
14. `computeDecisionContextHash`: mismas cards/favoritos/ubicación en distinto orden de
    lectura → mismo hash (verifica el `sort()` en cada colección antes de serializar).
15. Usuario cambia su perfil financiero (agrega una tarjeta) entre dos requests del mismo
    `operationalDay`, sin tocar `declared` ni ubicación → `decisionContextHash` cambia,
    snapshot no vigente, recalcula de inmediato — confirma que un cambio de perfil a mitad
    del día ya no queda invisible para el snapshot (el gap que motivó esta ronda).
16. Usuario marca un favorito nuevo entre dos requests del mismo `operationalDay` → 
    `decisionContextHash` cambia (cambia el conjunto `favoritedPromoIds`), snapshot no
    vigente, recalcula. Desmarcar un favorito produce el mismo efecto (hash vuelve a un
    valor distinto al anterior, no necesariamente al original si hubo otros cambios).
17. **Mismo `nearbyByCommerceId`, distinto origen** — dos requests cuyas coordenadas
    `lat`/`lng` de origen difieren (jitter normal de GPS) pero para las que
    `getNearbyBranchesByCommerce` devuelve el mismo `nearbyByCommerceId` (mismos comercios,
    mismo `minDistKm` por comercio) → mismo `proximityContextHash`, mismo
    `decisionContextHash`, snapshot sigue vigente. Confirma que lo que se compara es el mapa
    que ya calculó el motor, no las coordenadas crudas.
18. **Cambia un `minDistKm` que consume `scoreCercania`** — dos requests donde
    `nearbyByCommerceId` difiere en el `minDistKm` de al menos un comercio (o cambia el
    conjunto de comercios dentro del radio) → `proximityContextHash` distinto,
    `decisionContextHash` cambia, snapshot no vigente, recalcula en el mismo día — resuelve
    explícitamente el escenario A→B planteado por el CPO.
19. **Sin ubicación → representación determinística** — `hasLocation=false` /
    `nearbyByCommerceId={}` → `proximityContextHash = 'no-proximity-context'` (valor fijo, no
    `null`), participa del `decisionContextHash` de forma estable mientras no haya ubicación.
20. **Transición sin ubicación → contexto de cercanía real** — primera request sin ubicación
    (`proximityContextHash = 'no-proximity-context'`), segunda request del mismo día con
    ubicación real (`nearbyByCommerceId` no vacío) → `proximityContextHash` cambia,
    `decisionContextHash` cambia, snapshot no vigente, recalcula — el cambio de "sin
    ubicación" a "con ubicación" es en sí mismo una invalidación válida, no un caso especial.
21. `PersonaPreferences.declaredCategorySlugs` vacío/`undefined` en ambas requests (estado
    real de producción hoy, sin onboarding) → no contribuye ninguna variación al hash entre
    requests idénticas en todo lo demás — confirma que incluir este campo en el hash no
    introduce falsos positivos de invalidación mientras el input siga inerte.

**Endpoint `/api/perfil/rubros` (punto 3):**
22. GET sin sesión → 401 (mismo patrón de seguridad que `home-decision/route.test.ts` — sin
    fallback a header spoofeado).
23. GET con sesión, usuario sin ninguna preferencia declarada → `declared: []`, `universe`
    trae los 10 con `active` resuelto desde DB.
24. PUT agregando un rubro nuevo a `declared` → se crea una fila DECLARED/ACTIVE nueva;
    response refleja el estado actualizado.
25. PUT quitando un rubro previamente declarado → la fila existente pasa a
    `status=SUPPRESSED, suppressedAt` seteado — nunca se borra la fila (verificable
    consultando directo, no solo via GET).
26. PUT re-agregando un rubro que estaba `SUPPRESSED` → reactiva la **misma fila** (mismo
    `id`), no crea una segunda — verifica que no se duplica por `@@unique([userId, rubroId,
    source])`.
27. PUT con un id de rubro fuera de `RUBRO_CATALOG` → 400, sin efectos secundarios.
28. PUT con un rubro `active=false` que el usuario NO tenía declarado antes → 400 (no se
    puede agregar un rubro inactivo de cero), pero un PUT que mantiene un rubro inactivo ya
    declarado sin tocarlo no falla.
29. Caso de seguridad (mismo patrón que `route.test.ts` existente): request con header
    `x-user-email` spoofeado a otro usuario, sin sesión real → ignorado, 401, nunca se lee ni
    escribe el `UserRubroPreference` de un tercero.

---

## 7. Mockup actualizado

Publicado como artifact: **"Tus rubros — Mockup v3"** — sin estrellas, sin recomendación
"elegí entre 3 y 5", sin copy de "rotación" para >5 declarados (reemplazado por lenguaje de
igual autoridad entre declarados), guardado explícito con botón "Guardar cambios" +
indicador "cambios sin guardar", y nuevo estado de referencia mostrando cómo la Home oculta
el Bloque A completo con 0 declarados (CTA "Elegí tus rubros →") en vez de 5 casilleros
vacíos.

Archivo fuente: `tus-rubros-mockup.html` (scratchpad de la sesión). Estados cubiertos:
2 declarados sin cambios pendientes, 8 declarados (todos con igual autoridad), 0 declarados,
1 declarado inactivo, versión mobile 2 columnas, y una vista de referencia de la Home con el
Bloque A oculto + CTA.
