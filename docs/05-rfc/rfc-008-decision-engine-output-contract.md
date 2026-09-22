# RFC-008 — Contrato de salida del Decision Engine (Home por rubros)

**Estado**: Propuesta, pendiente de aprobación CPO
**Fecha**: 11/8/2026 — revisado 12/8/2026 (CPO Review "Design Lab aprobado / pasar a Decision Engine")
**Autor**: CTO (Claude), a pedido de CPO Direction "Inicio de Implementación"
**Alcance**: SOLO el contrato de tipos. No incluye algoritmo, no toca `lib/decisionEngine.ts`, no toca Home/onboarding.
**Deriva de**: [`definicion-producto-home.md`](./definicion-producto-home.md) (v3, aprobada), [RFC-007](./rfc-007-recommendation-model-v2-diseno-tecnico.md) (aprobado para spike)

**Nota de consolidación (12/8/2026)**: este RFC sigue siendo el único documento que gobierna el
contrato de salida del Decision Engine. La revisión del 12/8 (post Design Lab de Recommendation
Card) se incorpora acá mismo — tipos `Facts` estructurados (§2.9, §3) y ajustes en `DecisionCandidate`
— en vez de abrir un RFC-009. No hay una segunda versión del contrato en paralelo.

**Nota de corrección (12/8/2026, CPO Review "RFC-008")**: dos ajustes antes de aprobación. (1) §2.2
reforzada para dejar explícito que `principal` no existe en la rama `'empty'` de `RubroSlot` — ya era
así en el tipo, se corrigió solo la claridad de la prosa. (2) §2.9 corregida: no existe "una plantilla
por rubro", sino una familia de estrategias de copy indexadas por rubro × tipo de beneficio × reason
dominante — el tipo `Facts` no cambió, ya soportaba esto vía `benefit.kind` discriminado.

---

## 0. Qué pide este RFC que se apruebe

Únicamente los tipos de la sección 3 (`HomeDecisionPayload` y su árbol). Nada de esto se implementa
todavía. Una vez aprobado, el siguiente paso es adaptar `rankForHome()` (o su sucesor) para que
**produzca** este shape — ese es un RFC/PR aparte, sujeto a DR-001.

---

## 1. Por qué el contrato actual no alcanza

`rankForHome()` hoy devuelve `RankedRecommendation[]` — una lista plana de máximo 3 promos, sin
agrupación, sin noción de rubro, sin estado vacío explícito, sin campo de confianza. Es el shape
correcto para "Top 3 recomendados" pero no para "colección de rubros prioritarios", que es lo que
`definicion-producto-home.md` §2 define como contrato visual de la Home:

- Un rubro puede tener 0, 1, 2 o N oportunidades — nunca se rellena para completar un cupo.
- Un rubro sin oportunidad que supere el umbral de confianza debe renderizar un estado vacío
  explícito (§2.3) — hoy eso se modela por *ausencia* (no aparece en el array), lo cual la Home no
  puede distinguir de "no se calculó" o "hubo un error".
- No existe hoy el concepto de "confianza" — solo `score` (ranking numérico) y `reasons` (texto).
  Confianza y score son cosas distintas: score ordena *dentro* de un conjunto ya filtrado;
  confianza decide *si* una oportunidad es lo bastante buena para mostrarse sola en su rubro.

## 2. Decisiones de diseño (y su porqué)

**2.1 — `confidence` es un factor propio, no un alias de `score`.**
`score` sigue siendo el valor de ranking ponderado (ahorro/afinidad/cercanía/online/favoritos, según
RFC-007). `confidence` es una medida de "qué tan seguro está el motor de que esto vale la pena
mostrar como *la* decisión destacada de este rubro" — depende de cosas que no son parte del ranking:
volumen de evidencia de afinidad (Declarada > Inferida-con-evidencia > Default, ver RFC-007 §1-2),
completitud del perfil, y si hubo empate/dispersión baja entre candidatos del rubro. Dos oportunidades
pueden tener `score` similar y `confidence` muy distinta (una viene de afinidad declarada por el
usuario, la otra de un default genérico de categoría).

Se modela como número 0-1 en vez de enum para no perder información al persistir/auditar, pero se
provee `confidenceTier` derivado (`alta | media | baja`) porque es lo que la Home realmente necesita
para decidir *cómo* renderizar (destacado vs. tenue vs. no mostrar) — la UI no debería tener que
inventar sus propios cortes de umbral a partir del float.

**2.2 — Estado vacío es un variante de unión, no un array vacío, no un `null`.**
`RubroSlot` es `{ status: 'ok', principal: DecisionCandidate, ... } | { status: 'empty', reason: ... }`.
El punto no es solo que exista una rama `'empty'` — es que en esa rama **el campo `principal` no
existe en el tipo**, no que exista y valga `null`. TypeScript no deja leer `slot.principal` sin
antes discriminar por `status`; no hay forma de que la Home renderice un vacío accidental (bug,
`undefined` que se coló) confundiéndolo con el vacío real e intencional del motor. Son estados
distintos y la UI debe poder distinguirlos por construcción, no por convención (loading/error vs.
"sin oportunidad destacada hoy", que es *contenido válido* y forma parte del diseño aprobado en
§2.3) — nunca inferir el vacío desde `null`, array vacío o ausencia no tipada.

**2.3 — Posiciones de rubro fijas, contenido variable.**
`rubros` es un array de longitud fija (`N`, hoy 5 según hipótesis inicial no permanente de
`definicion-producto-home.md` §2) donde cada posición existe siempre, con `status: 'ok' | 'empty'`.
No se omiten rubros sin contenido ni se reordena para "rellenar" — el orden de rubros es una decisión
de producto (prioridad), no una consecuencia del ranking.

**2.4 — Las oportunidades de un rubro son variables y nunca se rellenan.**
Dentro de un rubro `status: 'ok'` siempre hay una `principal` (la destacada) y 0..M `alternativas`
(M abierto, sujeto a lo que decida el algoritmo — cuántas mostrar por rubro es parámetro de
implementación, no de contrato; ver también §2.10 sobre por qué se separan en dos campos en vez de
un array plano). Nunca se agregan alternativas de relleno para llegar a un mínimo.

**2.5 — `reasons` se tipa, no queda como `string[]` libre.**
Hoy `reasons: string[]` son strings ya renderizados en español (ver `buildReasons()` actual). Eso
acopla el motor al idioma/copy de la UI. Se propone que el motor emita razones **estructuradas**
(`{ code, params }`) y que el mapeo a texto viva en la capa de presentación (Home), no en el motor —
más limpio y desacoplado, y permite auditar "por qué se mostró esto" sin parsear strings. Se incluye
también `reasonsText: string[]` como campo de transición/compatibilidad opcional, para no romper el
consumo actual de golpe (puede eliminarse cuando la Home migre a los códigos).

**2.6 — Metadata de generación vive en el nivel raíz, no por rubro.**
`generatedAt`, `profileCompleteness`, `snapshotStale`, etc. son propiedades de la respuesta completa,
no de cada rubro — ya existen conceptualmente hoy (`generatedAt`, `snapshotStale` en
`/api/promos/recommended`) y se preservan.

**2.7 — Se preserva compatibilidad con el Recommendation Snapshot.**
El snapshot persiste hoy un universo de Top-20 candidatos *sin* rubro asignado (`SNAPSHOT_CANDIDATE_COUNT
= 20`, ver `lib/recommendationSnapshot.ts`). Este contrato no exige cambiar eso: el snapshot puede
seguir siendo "candidatos crudos" y la asignación a rubros + corte de confianza puede seguir pasando
en el paso de resolución (hoy `resolveTop3FromCandidates`, mañana su sucesor). Por eso el contrato
define también `DecisionCandidate` (una oportunidad *antes* de agruparse en rubro) como tipo
reutilizable — es compatible con lo que el snapshot ya guarda, solo le agrega `confidence` y
`reasons` estructuradas.

**2.8 — Dimensión de aplicabilidad/recurrencia (RFC-007 §8.5): campo reservado, no inventado.**
Se agrega `recurrence?: RecurrenceTag | null` en la oportunidad, opcional y nullable, sin lógica
detrás todavía — documentado como "reservado para RFC-007 §8.5, no completar sin fuente de datos
real". Evita un segundo RFC de contrato solo para agregar un campo cuando haya datos.

**2.9 — El título narrativo no es un string del motor: es `Facts` + plantilla de presentación.**
Agregado 12/8/2026 a pedido de CPO Review. El Design Lab de Recommendation Card usó frases como
"Te conviene hacer la compra semanal en Carrefour" o "Esta semana cargá combustible en YPF con
Mercado Pago" — pero esas frases fueron escritas a mano como fixture, precisamente para señalar el
problema: si el motor devolviera ese string, `lib/decisionEngine.ts` terminaría lleno de literales
por comercio (`if (commerce === 'Carrefour') return 'hacé la compra semanal en Carrefour'`), lo cual
es exactamente el acoplamiento que RFC-008 §2.5 ya prohíbe para `reasons`. La misma regla aplica acá.

La solución no es una plantilla única con find-and-replace de nombre de comercio (eso da frases
genéricas e idénticas entre rubros, que es lo que el CPO específicamente pidió evitar: "no quiero un
template único reemplazando nombres"). La solución es que el motor emita **hechos semánticos**
(`Facts`, tipo definido en §3) — de qué tipo es el beneficio, qué acción define al rubro, qué medio de pago,
qué vigencia — y que la capa de presentación (Home) redacte a partir de esos hechos.

**Corrección 12/8/2026 (CPO Review "RFC-008", punto 2)**: la versión anterior de este párrafo decía
"una plantilla de redacción por rubro" — eso es incorrecto y quedó corregido acá. **No hay una
plantilla por `RubroId`.** Un mismo rubro admite beneficios de naturaleza distinta (reintegro,
descuento, cuotas, monto fijo, 2x1 — ver `BenefitFact` en §3) y razones dominantes distintas (ver
`ReasonCode`), y cada combinación pide una narrativa propia: "Supermercados + reintegro" no se
redacta igual que "Supermercados + cuotas sin interés", aunque el rubro sea el mismo.

Lo que la Home selecciona es una **estrategia de copy**, elegida por la combinación de:
- `rubro` (`Facts.rubroId`)
- tipo de beneficio (`Facts.benefit.kind`)
- reason dominante (`Reason[0].code`, o el criterio que la Home defina para elegir cuál razón lidera)
- contexto adicional si aplica (ej. `Facts.validity.expiresSoon`)

Ejemplos (mismo rubro, distinta estrategia según el beneficio):
- Supermercados + `reintegro` → "Esta semana te conviene hacer la compra en Carrefour..."
- Supermercados + `cuotas_sin_interes` → "Si tenías pensado hacer una compra grande..."
- Combustible + `pct_off` → "Si vas a cargar combustible..."
- Indumentaria + `cuotas_sin_interes` → "Si estabas pensando renovar ropa..."

Esto no cambia el tipo `Facts` ni el resto del contrato — ya era una unión discriminada por
`benefit.kind` independiente de `rubroId`, así que la combinación rubro×beneficio×reason ya es
derivable de los datos que el motor entrega. El cambio es puramente de cómo se describe la capa de
presentación en este documento: no es "N plantillas, una por rubro" sino "una familia de estrategias
de copy, indexada por combinación de hechos" — cuántas estrategias existan, cómo se seleccionan y
cómo se versionan es implementación de la Home (fuera de alcance de este RFC, igual que ya establece
§4 para el mapeo `ReasonCode → texto`).

Esto sigue siendo una extensión directa de la misma separación que §2.5 ya aplicó a `reasons` (código
estructurado → texto en la capa de presentación), llevada también al título. `Facts` es el
denominador común de datos que cualquier estrategia de copy razonable va a necesitar — no es "un dato
por frase de ejemplo", es el conjunto mínimo para que la capa de presentación tenga con qué trabajar.

**2.10 — Principal y alternativas no son la misma forma de dato.**
Agregado 12/8/2026. La versión anterior de este RFC modelaba `oportunidades: DecisionCandidate[]`
como array plano dentro de un rubro `ok` — pero el Home Design Lab (`RecommendationCardDesktop`/
`RecommendationCardMobile`) nunca trató "la destacada" y "las secundarias" como intercambiables:
la destacada lleva título narrativo completo, razones, chips de medio de pago; las secundarias son
una fila compacta (logo + nombre + %) sin razonamiento propio, porque mostrar el "por qué" de cada
alternativa saturaría la tarjeta (ver Variante 8, lógica de alternativas compactas).

Un array plano obligaría a la Home a asumir por convención que `oportunidades[0]` es la destacada
— frágil e implícito. Se separa en `principal: DecisionCandidate` (siempre presente en un slot `ok`)
y `alternativas: DecisionCandidate[]` (0..M, puede no haber). Ambas siguen usando el mismo tipo
`DecisionCandidate` — la asimetría es de *posición/rol dentro del rubro*, no de shape de dato; cómo
resumir una `DecisionCandidate` para la fila compacta de alternativa es decisión de presentación
(qué subconjunto de `facts`/`reasons` mostrar), no algo que el contrato deba prescribir.

## 3. El contrato propuesto

```typescript
// lib/homeDecisionContract.ts
// Contrato de salida del Decision Engine para la Home basada en rubros.
// Puramente de datos — sin React, sin lógica de presentación.
// Ver RFC-008 para el razonamiento de cada decisión de diseño.

// ── Identidad de rubro ──────────────────────────────────────────────
// Catálogo fijo y curado a mano (producto), no derivado de Category de DB 1:1.
// Un rubro puede agrupar una o más categorías reales (ver definicion-producto-home.md §2).
export type RubroId = string // ej. 'supermercados', 'combustible', 'gastronomia'

export interface RubroDisplayInfo {
  id: RubroId
  label: string          // "Supermercados" — texto listo para mostrar
  icon?: string | null    // slug/nombre de ícono, si el rubro tiene uno curado
  categoryIds: string[]  // Category.id reales que este rubro agrupa (auditoría/debug)
}

// ── Confianza ────────────────────────────────────────────────────────
export type ConfidenceTier = 'alta' | 'media' | 'baja'

export interface Confidence {
  value: number            // 0..1
  tier: ConfidenceTier      // corte curado, ver RFC-008 §2.1 — la Home usa esto, no `value` directo
  // Fuente dominante que determinó la confianza — trazabilidad, no para renderizar directo.
  source: 'declarada' | 'inferida' | 'default'
}

// ── Razones ──────────────────────────────────────────────────────────
// Código estable + params para interpolar. El mapeo a texto en español vive en la Home.
export type ReasonCode =
  | 'mayor_ahorro'
  | 'cercania'
  | 'afinidad_declarada'
  | 'afinidad_inferida'
  | 'favorito'
  | 'disponible_online'
  | 'valido_hoy'
  | 'vence_pronto'            // agregado 12/8/2026 a pedido de CPO Review — Recommendation Card §3
  | 'oportunidad_infrecuente' // idem — "es una oportunidad poco frecuente"
  | 'maximiza_ahorro_mensual' // idem
  | 'coincide_gasto_habitual' // idem — distinto de afinidad_inferida: este es patrón de gasto, no de categoría
  // extender según necesidad del algoritmo — este union vive junto al motor, no en la Home

export interface Reason {
  code: ReasonCode
  params?: Record<string, string | number>
}

// Reservado por RFC-007 §8.5 — no completar sin fuente de datos real (ver RFC-008 §2.8).
export type RecurrenceTag =
  | 'recurrente'
  | 'periodica'
  | 'ocasional'
  | 'contexto_especifico'
  | 'unico_uso'

// ── Hechos semánticos (RFC-008 §2.9) ─────────────────────────────────
// El motor emite ESTO, nunca una frase. La capa de presentación (Home) tiene
// una familia de estrategias de copy (elegidas por rubro × tipo de beneficio × reason
// dominante, ver RFC-008 §2.9) que combinan estos hechos en lenguaje natural.
// Ningún campo acá es "texto listo para mostrar" — son datos que esas estrategias necesitan.

// Tipo de beneficio — discriminado porque cada tipo se redacta y se muestra distinto
// (no todo es "%"): reintegro/descuento directo, cuotas sin interés, monto fijo, 2x1.
export type BenefitFact =
  | { kind: 'pct_off'; pct: number }
  | { kind: 'reintegro'; pct: number }
  | { kind: 'cuotas_sin_interes'; cuotas: number }
  | { kind: 'monto_fijo'; monto: number }
  | { kind: 'nxm'; n: number; m: number } // ej. 2x1 → n=2, m=1

export interface CapFact {
  amount: number | null   // null = sin tope numérico conocido
  unlimited: boolean       // capUnlimited real (ver nota Galicia topeReintegro=0 en CLAUDE.md)
  period?: string | null   // 'mensual' | 'por_compra' | etc., si el dato existe
}

export interface PaymentMethodFact {
  bankOrWalletName: string  // "Banco Galicia", "Mercado Pago" — nombre de entidad, no logo/asset
  network?: string | null    // "Visa", "Mastercard"
  segment?: string | null    // "Crédito", "Débito", o segmento de tarjeta si aplica
}

export interface ValidityFact {
  validDaysLabel: string | null  // "Martes y miércoles", "Todos los días" — ya resuelto desde el bitmask, no el bitmask crudo
  expiresAt: string | null       // ISO, si la promo tiene vencimiento conocido
  expiresSoon: boolean            // derivado — la Home no debería tener que calcular umbrales de "pronto"
}

// Rubro + tipo de beneficio son, juntos, lo que la Home usa para elegir la estrategia de copy
// (CÓMO redactar la acción: "hacé la compra", "cargá combustible", "en X tenés Y"), no el nombre
// del comercio. La estrategia vive en la Home — no es una por rubro ni una por comercio, es una
// por combinación de hechos (ver RFC-008 §2.9).
export interface Facts {
  rubroId: RubroId
  commerceName: string
  benefit: BenefitFact
  cap: CapFact | null
  paymentMethod: PaymentMethodFact
  validity: ValidityFact
}

// ── La unidad de valor: decisión de ahorro ──────────────────────────
// = una promoción + el razonamiento causal que justifica mostrarla a este usuario.
// (definicion-producto-home.md §1)
export interface DecisionCandidate {
  promo: unknown            // shape de Promo tal como lo devuelve getPromosData — no se retipa acá
  facts: Facts               // hechos semánticos — de acá sale el título narrativo, ver RFC-008 §2.9
  score: number             // 0..1, valor de ranking (ver RFC-008 §2.1)
  confidence: Confidence
  reasons: Reason[]
  reasonsText?: string[]     // compat/transición — ver RFC-008 §2.5, eliminar cuando Home migre
  recurrence?: RecurrenceTag | null // reservado, ver RFC-008 §2.8
}

// ── Rubro: contenedor visual de posición fija, contenido variable ──
export type RubroSlotEmptyReason =
  | 'sin_candidatos'         // no hay promos del rubro que matcheen perfil
  | 'bajo_confianza'         // hay candidatos pero ninguno supera el umbral de confianza
  | 'perfil_incompleto'      // falta info de perfil necesaria para evaluar este rubro

export type RubroSlot =
  | {
      status: 'ok'
      rubro: RubroDisplayInfo
      principal: DecisionCandidate           // la oportunidad destacada del rubro — siempre hay una
      alternativas: DecisionCandidate[]      // 0..M, secundarias del mismo rubro — ver RFC-008 §2.4/§2.10
    }
  | {
      status: 'empty'
      rubro: RubroDisplayInfo
      reason: RubroSlotEmptyReason
    }

// ── Payload raíz ─────────────────────────────────────────────────────
export type HomeDecisionStatus =
  | 'ok'                 // al menos un rubro con status 'ok'
  | 'all_empty'          // todos los rubros evaluados, ninguno tiene oportunidades (distinto de 'empty' de un rubro individual)
  | 'incomplete_profile' // no hay suficiente perfil para evaluar nada
  | 'no_location'        // perfil ok, pero falta ubicación (afecta factor cercanía, no bloquea el resto)

export interface HomeDecisionPayload {
  status: HomeDecisionStatus
  rubros: RubroSlot[]        // longitud fija N (hoy 5, ver definicion-producto-home.md §2 — no permanente)
  missingProfile: string[] | null // ej. ['cards'], ['location'] — igual semántica que hoy

  // Metadata de generación / auditoría — nivel raíz, no por rubro (RFC-008 §2.6)
  generatedAt: string        // ISO
  latencyMs: number
  snapshotStale?: boolean    // si vino de Recommendation Snapshot desactualizado
  engineVersion: string      // ej. 'v1', 'v2-afinidad' — para auditar qué algoritmo generó esto
}
```

## 4. Qué NO define este RFC (a propósito)

- Cuántos rubros hay realmente y cuáles son (`N`, el catálogo de `RubroId`) — eso es contenido
  curado de producto, se define al implementar, no es parte del contrato de tipos.
- Cuántas oportunidades por rubro (`M`) — parámetro del algoritmo.
- El corte numérico de `ConfidenceTier` (qué `value` es "alta" vs "media") — parámetro del
  algoritmo, sujeto a calibración (ver spike RFC-007, pesos no finales).
- Cómo se calcula `confidence.value` — eso es DR-001, algoritmo, próximo paso.
- El mapeo `ReasonCode → texto en español` — vive en la Home cuando se implemente, no en este RFC.
- Compatibilidad de deprecación de `/api/promos/recommended` actual — a decidir si se versiona
  (`/api/home/decisions`) o se muta el endpoint existente, cuando se implemente.
- Las estrategias de copy en sí (cuántas hay, cómo se indexan por rubro×beneficio×reason, el texto
  exacto de cada una) — es curación de copy/producto, vive en la Home cuando se implemente, no en
  este RFC (mismo tratamiento que ya recibe `ReasonCode → texto`, ver punto anterior). Este RFC solo
  garantiza que `Facts` (§2.9, §3) tenga los datos que esas estrategias van a necesitar.
- Cómo se resume una `DecisionCandidate` de `alternativas` para la fila compacta (qué subconjunto de
  `facts` mostrar, si se omiten `reasons`) — decisión de presentación (§2.10), no de contrato.
- Cuántas `alternativas` calcula el algoritmo por rubro (0, 1, 2, N) — parámetro de implementación,
  igual que M en §2.4.

## 5. Riesgo / tradeoff a marcar antes de aprobar

- **`reasonsText` de transición** agrega superficie doble (códigos + texto) durante la migración.
  Alternativa más limpia: cortar de una vez y forzar a la Home a mapear códigos desde el día 1. Lo
  dejé como opcional-eliminable porque no sé si hay otros consumidores del `reasons: string[]` actual
  fuera de la Home (ej. notificaciones push, newsletter) que se romperían sin aviso — si no los hay,
  recomiendo sacar `reasonsText` del contrato final y migrar todo de una.
- **`rubros` de longitud fija con slots `empty`** es más verboso que "array de los que tienen
  contenido" — la ganancia es que la Home nunca tiene que adivinar si falta un rubro por error o por
  diseño. Si en algún momento `N` se vuelve dinámico por usuario (personalización de qué rubros
  importan), este contrato sigue sirviendo igual (solo cambia qué llena `rubros`).
- **`promo: unknown`** es deliberado — no quise retipar el shape de Promo acá (vive en Prisma/
  `getPromosData`) para no duplicar una definición que ya existe y cambia con el schema. Si se
  prefiere un tipo más fuerte, hay que decidir si el contrato importa el tipo de Prisma directamente
  (acopla el contrato a Prisma) o define su propio DTO reducido (más trabajo, más estable).
- **`facts` duplica parcialmente información que ya está en `promo`** (ej. `cap`, días válidos,
  medio de pago ya existen como columnas de `Promo`/`Requirement`). Es duplicación deliberada, no
  descuido: `promo: unknown` no le da nada a la Home sin volver a interpretar reglas de negocio
  (bitmask de días, qué requirement corresponde al perfil del usuario, cómo resolver `capUnlimited`),
  que es exactamente lo que el CPO pidió evitar ("metadata necesaria para renderizar sin que la UI
  tenga que volver a interpretar reglas de negocio"). El costo es que el motor tiene que mantener
  `facts` sincronizado con la promo real al construir cada `DecisionCandidate` — riesgo de
  desincronización si se arma a mano en vez de derivarlo siempre de la misma promo fuente.
- **`principal`/`alternativas` como campos separados (§2.10)** es más rígido que un array plano
  ordenado por score — si en el futuro la Home quisiera mostrar "las 3 mejores sin distinguir cuál es
  la destacada" (layout distinto), este contrato no lo permite sin versionar. Se aceptó el tradeoff
  porque hoy no existe ese layout (Design Lab cerrado con la asimetría principal/secundarias) y el
  contrato debe describir lo que la UI aprobada realmente necesita, no dejar la puerta abierta a
  layouts hipotéticos.

---

**Siguiente paso, si se aprueba**: RFC/PR aparte (sujeto a DR-001) para adaptar el pipeline
(`rankForHome` → agrupación por rubro + cálculo de confianza) a producir este shape. No arranca
hasta aprobación explícita de este contrato.
