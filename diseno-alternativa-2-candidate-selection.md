# Diseño — Alternativa 2 (candidate selection con conocimiento de perfil)

**Estado**: propuesta, pendiente de revisión CPO antes de implementar.
**Contexto**: DR-004 descarta Alternativa 1 (LIMIT ordenado por descuento global, ciego al
perfil) tras validación con evidencia — 40/40 casos con pérdida de promos, 24/40 con Top 3
alterado. Autoriza diseñar Alternativa 2 bajo una premisa estricta: SQL responde una
pregunta permisiva ("¿podría llegar a aplicar?"), no la pregunta definitiva de
`matchesProfile()`.

---

## 1. La pregunta que responde SQL vs. la que responde TypeScript

**SQL responde** (antes del LIMIT): ¿esta promo tiene *algún* requirement cuyo `bankId` o
`walletId` es null (sin restricción de entidad) o coincide con alguno de los bancos/wallets
del perfil del usuario?

**TypeScript sigue respondiendo** (después, sobre el conjunto ya acotado, sin cambios):
todo lo que `matchesProfile()` ya resuelve hoy — red de tarjeta, tipo de tarjeta, segmento,
tier, tipo de cuenta (jubilado/haberes), la regla especial banco+wallet verificados por
separado en cards distintas, el caso Cuenta DNI, etc.

SQL nunca decide "esta promo aplica". SQL decide "esta promo no puede aplicar bajo ninguna
circunstancia según la única señal que sí sabe leer barato: bancoId/walletId" — y descarta
solo esas.

## 2. Por qué esto no puede producir falsos negativos

`matchesProfile()` tiene tres reglas, y las tres son **más estrictas** que el filtro SQL
propuesto en el eje banco/wallet — nunca más permisivas:

- **REGLA 1** (sin restricción de banco ni wallet ni red ni tipo ni cuenta) → aplica a
  todos. El filtro SQL también deja pasar esas: `bankId IS NULL AND walletId IS NULL`.
- **REGLA 2** (banco + wallet, verificados en cards separadas) → para que
  `matchesProfile` devuelva `true`, el usuario **debe** tener ese `bankId` en alguna card
  y ese `walletId` en alguna card. Si el filtro SQL deja pasar la promo por
  `req.bankId IN (bancos del usuario) OR req.walletId IN (wallets del usuario)` (con OR,
  no AND), es estrictamente más permisivo que la regla real (que exige ambos) — nunca
  descarta algo que la regla real hubiese aceptado.
- **REGLA 3** (solo banco, o solo wallet, con matching adicional de red/tipo/segmento/tier/
  cuenta en la misma card) → `matchesProfile` exige `card.bankId === req.bankId` (o
  `card.walletId === req.walletId`) **más** todas las restricciones adicionales. El filtro
  SQL solo replica la primera condición (bankId/walletId pertenece al perfil) e ignora las
  adicionales — de nuevo, estrictamente más permisivo.

En los tres casos, el filtro SQL es una condición **necesaria pero no suficiente** de
`matchesProfile()`. Nunca puede ser el filtro SQL `false` cuando `matchesProfile()` es
`true`, porque toda rama de `matchesProfile()` que devuelve `true` ya implica que el
`bankId`/`walletId` del requirement (cuando existe) está en el perfil del usuario. Eso es,
por definición, lo único que garantiza cero falsos negativos: el filtro SQL es una
sobre-aproximación (superset) del resultado final, nunca un subconjunto.

Lo que el filtro SQL **no** intenta resolver —y no debe intentar— es reducir el conjunto
por red/tipo/segmento/tier/cuenta. Si lo hiciera, dejaría de ser una sobre-aproximación
garantizada y pasaría a duplicar reglas de negocio en dos lugares (el riesgo que el CPO
pidió evitar explícitamente).

## 3. Diseño concreto

### 3.1 Query

Reemplaza el `ORDER BY` ciego de la Alternativa 1 por un `WHERE` adicional con conocimiento
del perfil, manteniendo el resto del filtro grueso (estado/vigencia/día/provincia) igual:

```sql
SELECT p.id FROM "promos" p
WHERE p.status = 'ACTIVE'
  AND p."validFrom" <= now()
  AND (p."validUntil" IS NULL OR p."validUntil" >= date_trunc('day', now()))
  AND ($dayBit::int IS NULL OR (p."validDays" & $dayBit::int) != 0)
  AND (
    $province::text IS NULL
    OR p."geographicScope" != 'PROVINCES'
    OR cardinality(p.provinces) = 0
    OR p.provinces && ARRAY[$province::text, 'Todas', 'TODAS']
  )
  AND EXISTS (
    SELECT 1 FROM "promo_requirements" r
    WHERE r."promoId" = p.id
      AND (
        -- REGLA 1: sin restricción de entidad → pasa siempre
        (r."bankId" IS NULL AND r."walletId" IS NULL)
        -- REGLA 2/3: coincide con algún banco o alguna wallet del perfil
        OR r."bankId" = ANY($userBankIds::text[])
        OR r."walletId" = ANY($userWalletIds::text[])
      )
  )
ORDER BY "isCSIOnly" ASC, "maxDiscountPct" DESC NULLS LAST, id ASC
LIMIT $CANDIDATE_LIMIT
```

Notas:
- `$userBankIds` / `$userWalletIds`: arrays de IDs distintos de banco/wallet presentes en
  `userCards` (incluye las virtuales de `walletVirtualCards`) — mismos datos que ya se
  cargan hoy para `matchesProfile`, no hay query nueva.
- El `EXISTS` reemplaza el filtro de "promos sin requirements" implícitamente: una promo sin
  ningún requirement no matchea el `EXISTS` y queda afuera — correcto, porque
  `matchesProfile` ya las descarta (`if (!promo.requirements.length) return false`, línea
  858 de `getPromos.ts`). Consistente con el comportamiento actual, no lo cambia.
- El `ORDER BY` se mantiene: ya no importa tanto qué tan "sesgado" esté, porque el `WHERE`
  garantiza que **todo** lo que sobrevive es potencialmente válido para este usuario
  específico — el LIMIT ahora recorta dentro de un conjunto ya relevante, no arbitrario.
- Las promos guardadas (`savedSet`) siguen tratándose aparte, igual que hoy: se agregan
  después de la query de candidatas si no vinieran incluidas (ver §3.3).

### 3.2 Qué NO cambia

- `matchesProfile()` en TypeScript: **cero cambios de lógica**. Sigue siendo la única fuente
  de verdad para la decisión final. Corre exactamente igual que hoy, sobre el conjunto ya
  acotado por SQL.
- El resto del filtro grueso (estado, vigencia, día, provincia): sin cambios, ya validado en
  Alternativa 1.
- El Decision Engine (`rankForHome`): sin cambios, sigue operando sobre la salida de
  `matchesProfile`.

### 3.3 Caso borde — promos guardadas (favoritos)

Hoy `matchesProfile` tiene un bypass: `if (savedSet.has(promo.id)) return true` — una promo
guardada por el usuario se muestra aunque ya no matchee su perfil (p. ej. cambió de banco).
El filtro SQL grueso no conoce `savedSet` y podría excluir una promo guardada que ya no
matchea ningún banco/wallet del perfil actual.

Fix: agregar `OR p.id = ANY($savedPromoIds::text[])` como condición adicional del `WHERE`
externo (no del `EXISTS`), igual de permisivo que las demás — mantiene la propiedad de
sobre-aproximación sin tocar la regla de negocio real (que sigue viviendo en el `if
(savedSet.has(...))` de TypeScript).

### 3.4 Caso borde — usuario sin bancos ni wallets

Si `userBankIds` y `userWalletIds` son ambos arrays vacíos, `ANY($vacío)` es `false` para
toda fila, así que el `EXISTS` solo deja pasar la REGLA 1 (requirements sin restricción de
entidad). Es el comportamiento correcto: sin perfil cargado, `matchesProfile` tampoco puede
aceptar REGLA 2/3 (no hay ninguna card para matchear).

## 4. Por qué esto no es "SQL replicando matchesProfile()"

La lista de condiciones que el filtro SQL evalúa es deliberadamente angosta: **solo**
pertenencia de `bankId`/`walletId` a dos arrays. No conoce:

- `cardNetworkId`, `cardType`, `cardSegmentId`, `segmentId`, `cardTier`
- `accountType` (jubilado/haberes)
- la regla especial de Cuenta DNI + Banco Provincia
- la separación banco-en-una-card / wallet-en-otra-card de REGLA 2

Todo eso sigue siendo responsabilidad exclusiva de `matchesProfile()`. El filtro SQL no
tiene ninguna rama condicional que dependa de esas columnas — estructuralmente no puede
"convertirse en el nuevo Decision Engine" porque no tiene acceso a esa información en primer
lugar; el `SELECT` de la query de candidatos no las trae.

## 5. Validación previa a implementar (mismo rigor que Alternativa 1)

Antes de dar por buena la implementación, repetir el harness de 40 casos (5 usuarios reales
× 4 provincias × 2 vistas) comparando contra el path viejo sin límite, midiendo:

- `candidateRows`, `candidateHitLimit` (si sigue llegando al LIMIT, con cuánta frecuencia —
  ahora debería ser raro o nulo, porque el `WHERE` ya filtra por relevancia real).
- IDs perdidos (`missing`) — debe ser 0 en el 100% de los casos, no una mejora parcial.
- Igualdad de Top 3 en el 100% de los casos.
- Latencia de la query de candidatos (el `EXISTS` con `ANY(array)` agrega costo vs. la
  Alternativa 1 — medir si sigue por debajo del objetivo de <3s / <2s).

Si algún caso sigue perdiendo promos, es señal de un cuarto eje de restricción no
contemplado (a revisar contra el schema real de `PromoRequirement`, no asumido) — no se
declara terminado hasta 0 pérdidas confirmadas.

## 6. Resumen de garantías

| Requisito CPO | Cómo se cumple |
|---|---|
| No introduce falsos negativos | El filtro SQL es una condición necesaria (no suficiente) de cada rama de `matchesProfile()` — demostrado por inspección de las 3 reglas, §2 |
| No duplica reglas de negocio | Solo evalúa bankId/walletId con OR; red/tipo/segmento/tier/cuenta/reglas especiales viven únicamente en TypeScript |
| No convierte SQL en el Decision Engine | La query de candidatos no trae ni conoce las columnas que esas reglas necesitan |
| Única fuente de verdad para matching complejo | `matchesProfile()` sin cambios, sigue siendo la decisión final sobre el conjunto acotado |
