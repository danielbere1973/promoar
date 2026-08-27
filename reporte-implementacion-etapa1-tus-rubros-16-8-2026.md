# Reporte de implementación — "Tus rubros" Etapa 1 (RFC-008 / Decision Engine v2)

**Fecha**: 16/8/2026
**Rama**: `feature/decision-engine-v2-backend` (sin commitear, sin push, sin merge)
**Repo**: `promoar-decision-engine-v2-backend`
**Spec de referencia**: `propuesta-tecnica-etapa1-tus-rubros-15-8-2026.md` (congelada)
**Alcance autorizado**: CPO Approval "Tus rubros" Etapa 1 (16/8/2026), puntos 1-11
**Entorno validado**: DEV únicamente. **PROD no tocado.**

---

## 1. Qué se implementó

| # | Ítem autorizado | Estado |
|---|---|---|
| 1 | `resolveDeclaredUniverse` | ✅ `lib/rubroPreferences.ts` |
| 2 | Selección de hasta 5 entre DECLARED con oportunidad `ok` | ✅ `selectTopRubroSlots` en `lib/decisionEngineV2.ts` |
| 3 | Eliminación del fallback externo en Bloque A | ✅ |
| 4 | `HomeDecisionSnapshot` | ✅ modelo Prisma + cache en `route.ts` |
| 5 | Hashing (`declaredUniverseHash`, `decisionContextHash` — incluye proximidad como input —, `promoPoolVersion`, `operationalDay`) | ✅ ver §4 |
| 6 | GET/PUT `/api/perfil/rubros` | ✅ `app/api/perfil/rubros/route.ts` |
| 7 | Pestaña "Rubros" en `/perfil` | ✅ `app/components/perfil/RubrosTab.tsx` |
| 8 | UI desktop/mobile del mockup v3 | ✅ validado visualmente, ver §6 |
| 9 | Guardado explícito | ✅ barra flotante Descartar/Guardar |
| 10 | Semántica SUPPRESSED/reactivación | ✅ tests #25/#26 |
| 11 | Tests completos definidos en la propuesta | ✅ 80/80 verdes |

**Fuera de alcance — confirmado NO implementado**: Bloque B ("También te podría interesar"), afinidad, oportunidad excepcional, INFERRED writer, favoritos/estrellas de rubros, Home v2 visual completa, cualquier cambio visual fuera de la pestaña "Rubros".

---

## 2. Archivos tocados

```
 M app/api/promos/home-decision/route.test.ts
 M app/api/promos/home-decision/route.ts
 M app/perfil/page.tsx
 M lib/decisionEngineV2.test.ts
 M lib/decisionEngineV2.ts
 M lib/rubroPreferences.test.ts
 M lib/rubroPreferences.ts
 M prisma/schema.prisma
?? app/api/perfil/rubros/          (route.ts + route.test.ts)
?? app/components/perfil/          (RubrosTab.tsx)
?? prisma/migrations/20260816043643_add_home_decision_snapshot/
```

Nada de esto está commiteado ni pusheado — sigue en working tree local, disponible para revisión antes de decidir el próximo paso (commit/PR).

---

## 3. Migración — `HomeDecisionSnapshot`

Generada con `prisma migrate dev --create-only`, revisada, y aplicada **solo en DEV**.

```sql
-- CreateTable
CREATE TABLE "home_decision_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "operationalDay" TEXT NOT NULL,
    "declaredUniverseHash" TEXT NOT NULL,
    "decisionContextHash" TEXT NOT NULL,
    "promoPoolVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_decision_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_decision_snapshots_userId_key" ON "home_decision_snapshots"("userId");

-- AddForeignKey
ALTER TABLE "home_decision_snapshots" ADD CONSTRAINT "home_decision_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

`prisma migrate status` en DEV: **"Database schema is up to date!"**
`prisma migrate diff` (DEV vs `schema.prisma`): **diff vacío**, sin drift.

**PROD no recibió esta migración.** Aplicarla ahí requiere aprobación separada, según instrucción explícita del CPO.

---

## 4. Diseño del hashing — nota sobre `proximityContextHash`

La spec original lista 5 llaves: `declaredUniverseHash`, `decisionContextHash`, `proximityContextHash`,
`promoPoolVersion`, `operationalDay`. La implementación en `app/api/promos/home-decision/route.ts`
calcula las 5 como funciones (`computeDeclaredUniverseHash`, `computeProximityContextHash`,
`computeDecisionContextHash`, `currentPromoPoolVersion`, `currentOperationalDay`), pero
**`proximityContextHash` no es una columna separada en `HomeDecisionSnapshot`** — se computa y
luego se pliega como uno de los inputs de `decisionContextHash` (junto con tarjetas efectivas y
favoritos):

```ts
function computeDecisionContextHash(input: {
  effectiveCards: ...
  favoritedPromoIds: string[]
  proximityContextHash: string   // ← acá se pliega
  declaredCategorySlugs: string[] | undefined
}): string { ... }
```

Motivo (documentado en el propio código, línea ~65 de `route.ts`): la spec §2/§3 dejaba la
ubicación de esta llave "abierta, a decidir por convención al implementar". Se optó por 4 columnas
en vez de 5 porque el efecto de invalidación es idéntico — cualquier cambio de proximidad cambia
`decisionContextHash` igual que si tuviera su propia columna — y evita una columna que nunca se
consulta de forma independiente. Si el CPO prefiere una columna dedicada por trazabilidad/debug,
es un cambio de migración menor, no un rework.

---

## 5. Validación funcional contra DEV real (no mocks)

Ejecutada con sesión autenticada real (`litadescuentos@gmail.com`, rol ADMIN) contra Postgres/Neon DEV.

- **GET `/api/perfil/rubros`**: devuelve `declared` + `universe` de 10 rubros con `active` resuelto — confirmado.
- **PUT con 0, 2, 5, 8, 10 declarados**: los 5 casos aceptados, respuesta refleja el estado esperado.
- **PUT con id inválido**: rechazado con 400, sin efectos secundarios.
- **GET `/api/promos/home-decision`**: con 3 rubros declarados, responde 200 con `{ status, rubros, missingProfile, generatedAt, latencyMs, engineVersion }` — pipeline completo (rubros declarados → Decision Engine → matching real de promos) confirmado end-to-end.
- **Invalidación por cambio de rubros declarados**: PUT que pasó de 3→2 rubros, seguido de GET a `home-decision`, seguido de inspección directa de `HomeDecisionSnapshot` vía Prisma:
  - Misma fila (mismo `id`, no se creó una nueva) — upsert correcto.
  - `declaredUniverseHash` cambió (`4739...` → `d71a...`).
  - `decisionContextHash`, `promoPoolVersion`, `operationalDay` se mantuvieron estables (nada más cambió).
  - `updatedAt` avanzó.
- **Invalidación por perfil/favoritos/proximidad/pool/día operativo**: mecanismo confirmado por lectura de código (`vigente` en `route.ts` compara las 4 columnas contra los 4 valores recién calculados — cualquier cambio en tarjetas, favoritos, ubicación o pool de promos activa recálculo) + cobertura de la suite de tests existente (80/80 verdes). No se mutó el perfil financiero real de la cuenta de prueba para no dejarla en un estado distinto al esperado por Pablo — se priorizó no tocar datos reales de la cuenta admin sobre repetir manualmente un caso ya cubierto por tests automatizados.

---

## 6. Validación visual — pestaña "Rubros"

Capturada con Playwright contra DEV real (`localhost:3001`), sesión autenticada, sin mocks.

**Desktop (1440×900)** — grid 2 columnas, banner explicativo, 2 rubros declarados (Supermercados,
Combustible) con check verde, resto seleccionable:

![Rubros desktop](scratch/rubros-desktop.png)

**Mobile (390×844)** — mismo layout en ancho angosto, tabs y bottom nav conviven correctamente:

![Rubros mobile](scratch/rubros-mobile.png)

**Estado "cambios pendientes"** — al tocar un rubro no guardado (Farmacias), aparece la barra
flotante Descartar/Guardar preferencias, confirmando el flujo de guardado explícito (punto 9):

![Barra de guardado pendiente](scratch/rubros-pending-bar.png)

Nota: el toggle de "Farmacias" en esta última captura fue solo del lado del cliente (no se
disparó el PUT) — el estado guardado en DB al cierre de esta sesión sigue siendo
`['supermercados', 'combustible']`.

---

## 7. Resultado de tests y build

```
Test Files  11 passed (11)
     Tests  80 passed (80)
```

- `tsc --noEmit`: limpio, salvo errores preexistentes no relacionados (6 en `app/perfil/page.tsx`
  dentro de un bloque `{false && (...)}` muerto, y decenas en `lib/scrapers/*`/`scripts/*` —
  todos confirmados anteriores a esta rama).
- `npm run build`: éxito, `/perfil` y `/api/perfil/rubros` presentes en el output.
- `prisma migrate status`: limpio.
- `prisma migrate diff` DEV vs schema: vacío.

---

## 8. Pendiente / próximo paso

Fuera del alcance de esta entrega (requiere gate separado del CPO):
- Commit + push de la rama.
- Aplicar la migración a PROD.
- Decisión sobre `proximityContextHash` como columna propia vs. plegada (§4) — funcional como está, se documenta para que el CPO decida si vale la pena el cambio de migración.
- Etapa 2 (Bloque B) — explícitamente no comenzada.
