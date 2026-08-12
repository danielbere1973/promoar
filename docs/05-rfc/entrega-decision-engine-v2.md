# Entrega — Decision Engine v2 (RFC-008 / DR-001)

**Rama**: `feature/decision-engine-contract` (desde `feature/nueva-home` limpia, commit base `625eee4`)
**Commit**: `d760fea` — "feat: Decision Engine v2 — implementación RFC-008 (HomeDecisionPayload)"
**Fecha**: 11-12/8/2026

Implementación de RFC-008 (contrato de salida) + RFC-007 §1-§6 (scoreAfinidad,
modo default puro) sobre la base validada por el spike y por
`definicion-producto-home.md` v3. No toca Home real, copy final, onboarding
RFC-006 ni producción — según alcance pedido.

---

## 1. Diff completo

4 archivos nuevos, 0 archivos existentes modificados (implementación
puramente aditiva — `lib/decisionEngine.ts` v1 queda intacto y congelado):

| Archivo | Líneas | Qué es |
|---|---|---|
| `lib/homeDecisionContract.ts` | 115 | Tipos RFC-008 §3, transcriptos literalmente del RFC aprobado |
| `lib/rubroCatalog.ts` | 63 | Catálogo de 5 rubros, grounded en los 21 slugs reales de `Category` (verificado contra dev-promoar el 11/8) |
| `lib/decisionEngineV2.ts` | 407 | Motor: scoreAfinidad, Facts, Reasons, confidence, agrupación por rubro, `buildHomeDecisionPayload()` |
| `lib/decisionEngineV2.test.ts` | 171 | 10 casos de prueba (vitest), todos verdes |

Diff completo disponible con `git show d760fea` en la rama. No se listan
inline acá por longitud — los 4 archivos están completos y son nuevos, así
que el diff es idéntico al contenido final de cada archivo.

Puntos de diseño relevantes que el diff no deja obvios a simple lectura:

- **`scorePromo` reutiliza literalmente la lógica de los 4 factores de v1**
  (`scoreAhorro`, `scoreCercania`, `scoreOnline`, `scoreFavoritos`) — cero
  reescritura de esa parte, solo se sumó `scoreAfinidad` como 5to factor y se
  redistribuyeron los pesos según RFC-007 §4.
- **`confidence.value` es el mismo `score` ponderado**, no un cálculo
  separado — la justificación está en el comentario del código: un score que
  ya combina ahorro real + relevancia + contexto es exactamente lo que hace
  falta para decidir si algo "alcanza para destacarse solo". El corte de
  tiers (`alta ≥0.6`, `media ≥0.35`, `baja <0.35`) es hipótesis de spike, no
  calibración final — mismo status que los pesos de RFC-007 §4.
- **El umbral de "empty por bajo_confianza" es el mismo 0.35** que separa
  `media` de `baja` — una promo que no alcanza ni `media` no se muestra como
  destacada de un rubro. Esto es una decisión de implementación que no
  estaba fijada por RFC-008 (§4 dice explícitamente que los cortes de tier no
  son parte del contrato) — queda documentada acá para que la CPO pueda
  ajustarla con evidencia real sin tocar el resto del motor.

---

## 2. Ejemplos reales de output

Generado corriendo `buildHomeDecisionPayload()` contra 4 promos sintéticas
(Coto 30% sin tope, Día 15% con tope, YPF combustible descuento bajo, Zara
cuotas sin interés online) con ubicación activa y perfil completo.

```json
{
  "status": "ok",
  "rubros": [
    {
      "status": "ok",
      "rubro": { "id": "supermercados", "label": "Supermercados", "icon": "🛒", "categoryIds": [], "categorySlugs": ["supermercados"] },
      "principal": {
        "facts": {
          "rubroId": "supermercados",
          "commerceName": "Coto",
          "benefit": { "kind": "reintegro", "pct": 30 },
          "cap": { "amount": null, "unlimited": true, "period": null },
          "paymentMethod": { "bankOrWalletName": "Banco Galicia", "network": "Visa", "segment": null },
          "validity": { "validDaysLabel": "todos los días", "expiresAt": null, "expiresSoon": false }
        },
        "score": 0.6717,
        "confidence": { "value": 0.6717, "tier": "alta", "source": "default" },
        "reasons": [
          { "code": "mayor_ahorro" },
          { "code": "coincide_gasto_habitual" },
          { "code": "cercania", "params": { "metros": 300 } }
        ],
        "reasonsText": ["Es el mayor ahorro para tus tarjetas", "Es un gasto habitual para vos", "Está a 300 metros tuyo"]
      },
      "alternativas": [
        {
          "facts": { "commerceName": "Día", "benefit": { "kind": "reintegro", "pct": 15 }, "cap": { "amount": 3000, "unlimited": false, "period": "MONTHLY" }, "paymentMethod": { "bankOrWalletName": "Banco Macro" } },
          "score": 0.345,
          "confidence": { "value": 0.345, "tier": "baja", "source": "default" }
        }
      ]
    },
    { "status": "empty", "rubro": { "id": "combustible", "label": "Combustible" }, "reason": "bajo_confianza" },
    { "status": "empty", "rubro": { "id": "farmacias", "label": "Farmacias" }, "reason": "sin_candidatos" },
    { "status": "empty", "rubro": { "id": "gastronomia", "label": "Gastronomía" }, "reason": "sin_candidatos" },
    { "status": "empty", "rubro": { "id": "indumentaria", "label": "Indumentaria" }, "reason": "bajo_confianza" }
  ],
  "missingProfile": null,
  "generatedAt": "2026-08-12T01:21:03.867Z",
  "latencyMs": 2,
  "engineVersion": "decision-engine-v2.0.0"
}
```

Nota sobre Zara (cuotas sin interés, canal online, categoría discrecional):
cayó en `bajo_confianza`, no en `ok`. Es consistente con la lógica heredada
de v1 (`scoreAhorro` penaliza CSI a un valor fijo bajo, 0.3, independiente
de la cantidad de cuotas) combinada con afinidad baja por ser categoría
discrecional — no es un bug, es el resultado esperado de aplicar los pesos
de RFC-007 §4 con Dimensión A. Si la CPO considera que CSI de 12 cuotas
online debería ranquear mejor, es un ajuste de `scoreAhorro` (fuera de
alcance de esta tarea — v1 está congelado).

Los 10 casos completos (incluyendo `incomplete_profile`, `all_empty`, los 5
tipos de `BenefitFact`, y validación de que `reasons` nunca lleva strings
libres) están en `lib/decisionEngineV2.test.ts` y corren con `npm test --
lib/decisionEngineV2.test.ts`.

---

## 3. Comparación v1 vs v2

| | v1 (`lib/decisionEngine.ts`, congelado) | v2 (`lib/decisionEngineV2.ts`) |
|---|---|---|
| **Output** | `RankedRecommendation[]` — array plano, máx 3 | `HomeDecisionPayload` — `rubros: RubroSlot[]` de longitud fija N=5 |
| **Factores** | 4: ahorro (0.5), cercanía (0.25), online (0.15), favoritos (0.1) | 5: ahorro (0.35), **afinidad (0.30)**, cercanía (0.18), online (0.11), favoritos (0.06) |
| **Agrupación** | Ninguna — diversidad por categoría es una penalización blanda dentro de un único Top-3 global | Por rubro — cada uno de los 5 rubros se evalúa y rankea independientemente |
| **Vacíos** | No existen — si no hay candidatas, el array vuelve vacío sin explicación | Estado explícito `{ status: 'empty', reason }` por rubro, con 3 motivos distinguibles (`sin_candidatos`, `bajo_confianza`, `perfil_incompleto`) |
| **Principal vs resto** | No hay distinción — las 3 posiciones son igual de "destacadas" | `principal` (1) + `alternativas` (0-2) con roles y shapes de consumo distintos (RFC-008 §2.10) |
| **Razones** | `string[]` en español, texto fijo embebido en el motor | `Reason[]` con `{ code, params? }` — desacoplado del idioma/copy; `reasonsText` queda como campo de transición opcional |
| **Confidence** | No existe como concepto — el `score` hace las dos cosas (rankear y decidir si mostrar) | Campo propio `{ value, tier, source }`, distinto del `score` de ranking — decide si el rubro se muestra `ok` o pasa a `empty` |
| **Facts** | No existen — el consumidor debe leer `promo` crudo para saber tipo de descuento, tope, medio de pago | `Facts` estructurado por candidata — toda la interpretación de reglas financieras ya resuelta |
| **Metadata** | Ninguna | `generatedAt`, `latencyMs`, `engineVersion`, `missingProfile`, `status` a nivel payload |

En números concretos, con el mismo conjunto de 4 promos sintéticas:
v1 habría devuelto `[Coto 30%, Día 15%, YPF]` (Top-3 global, sin importar
rubro) — Zara habría competido igual que Coto por una de las 3 posiciones.
v2 agrupa por rubro: Supermercados muestra Coto como principal y Día como
alternativa (ambos en el mismo rubro, sin competir contra Combustible o
Indumentaria por "espacio"), y expone explícitamente que Combustible,
Farmacias, Gastronomía e Indumentaria no tuvieron nada que mostrar ese día
— información que v1 simplemente no podía representar.

---

## 4. Casos de prueba

Los 10 tests en `lib/decisionEngineV2.test.ts` cubren exactamente lo
pedido:

1. **Rubro con principal** (sin alternativas) — Coto solo en Supermercados.
2. **Rubro con alternativas** — 3 candidatas en Supermercados → 1 principal + 2 alternativas (Coto → Día → Vea), verificando que el orden y el cap de `MAX_ALTERNATIVAS=2` se respeta.
3. **Slot vacío por `sin_candidatos`** — rubro sin ninguna promo en el input.
4. **Slot vacío por `sin_candidatos`** (variante) — única promo del rubro no válida el día de hoy (gate de vigencia).
5. **Slot vacío por `bajo_confianza`** — promo con descuento mínimo, sin cercanía, categoría discrecional; score no alcanza el umbral 0.35.
6. **Los 5 tipos de `BenefitFact`** — `reintegro`, `pct_off`, `monto_fijo`, `nxm`, `cuotas_sin_interes`, uno por uno, verificando el mapeo exacto desde `DiscountType`.
7. **`status: 'incomplete_profile'`** — sin perfil, `rubros` vacío, `missingProfile` propagado.
8. **`status: 'all_empty'`** — con perfil pero sin ninguna promo, los 5 rubros en `empty`.
9. **Reasons estructuradas** — verifica que cada `reason` tiene `code: string` y nunca una propiedad `text`, y que `reasonsText` (cuando está) tiene la misma longitud que `reasons`.
10. **N=5 fijo** — el payload siempre devuelve exactamente 5 `RubroSlot`, estén vacíos o no (RFC-008 §2.3: posiciones nunca se omiten).

Correr: `npm test -- lib/decisionEngineV2.test.ts` (10/10 verdes).

---

## 5. Confirmación: la UI no necesita reinterpretar reglas financieras

Cada `DecisionCandidate.facts` trae **ya resuelto**:

- **Qué tipo de beneficio es y su valor** (`benefit`) — la UI nunca necesita
  mirar `discountType`/`discountValue`/`nxmN`/`nxmM` crudos ni saber que
  `CUOTAS_SIN_INTERES` guarda el número de cuotas en `nxmN` en vez de en
  `discountValue`.
- **Si hay tope y cuál** (`cap`) — `unlimited: true` reemplaza tener que
  chequear `capUnlimited || cap == null` como hace el propio motor
  internamente; `amount` ya viene en `null` cuando no aplica.
- **Con qué pagar** (`paymentMethod.bankOrWalletName`) — ya resuelto el caso
  banco vs. wallet vs. "sin requisito específico", sin que la UI tenga que
  saber que un requirement puede tener `bank` o `wallet` pero no ambos con
  igual prioridad.
- **Cuándo vale** (`validity`) — el bitmask de 7 bits de `validDays` ya se
  tradujo a `validDaysLabel` en español ("de lunes a viernes", "los fines de
  semana", etc.), y `expiresSoon` ya aplica el umbral de 3 días — la UI no
  recalcula fechas.

Lo único que la UI recibe sin interpretar es `promo: unknown` — deliberado
(RFC-008 §5): existe solo por si algún día hace falta un link profundo o un
ID, nunca para volver a leer campos de negocio de ahí. Ningún test ni
ningún dato de `Facts` depende de que la UI toque `promo`.

`reasons` tampoco obliga a la UI a interpretar nada financiero — son
códigos (`mayor_ahorro`, `cercania`, etc.) que mapean a copy en la capa de
presentación, sin que la UI necesite saber *por qué* ese código se activó.

**Confirmado**: con los tipos de `homeDecisionContract.ts`, un componente de
Home puede renderizar cualquier `RubroSlot` sin importar Prisma, sin
resolver `capUnlimited`, sin parsear bitmasks de días, y sin decidir qué
`requirement` matchea al usuario — todo eso ya pasó una sola vez, acá.

---

## Qué falta para integrar a la Home real (explícitamente NO hecho en esta etapa)

- Conectar `buildHomeDecisionPayload()` a un endpoint (`/api/promos/recommended`
  o sucesor — RFC-008 §4 deja explícitamente abierto si se versiona o se
  muta in place).
- Estrategia de copy por `rubro × benefit.kind × reason` dominante (RFC-008
  §2.9) — vive en la Home, no en el motor.
- Cómo resumir `alternativas` para la fila compacta (RFC-008 §2.10) — decisión
  de presentación, no de contrato.
- RFC-006 (onboarding) para activar `scoreAfinidad` con fuente `declarada` en
  producción — el motor ya soporta `PersonaPreferences.declaredCategorySlugs`,
  solo falta el flujo que lo alimente.
- Verificar/revocar manualmente el Vercel Protection Bypass token (pendiente
  no bloqueante, señalado en la CPO Direction del 11/8).
