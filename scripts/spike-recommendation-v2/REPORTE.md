# Spike — Recommendation Model v2 vs v1 (validación de calidad)

Generado: 2026-08-10T05:20:23.584Z — dev-promoar, feature/nueva-home. No afecta producción.

## Resumen ejecutivo

- Perfiles evaluados: 9 (3 reales + 6 sintéticos)
- Perfiles con cambio en el Top 3: 8/9
- Casos "cotidiano supera a flashy de baja utilidad": 17

---

## Real — cartera chica (1 banco)

Pool de candidatas: 1295

**Top 3 v1:**
1. Rappi — 50% de descuento – Rappi (50%, cat: gastronomia, score: 0.65)
2. Pax Assistance — 50% de descuento – Pax Assistance (50%, cat: salud-y-belleza, score: 0.5)
3. COLECTIVOS Y SUBTES NFC — Hasta 100% en Transporte (100%, cat: otros, score: 0.5)

**Top 3 v2:**
1. Transporte — 100% reintegro – Transporte (100%, cat: transporte, score: 0.59)
2. Rappi — 50% de descuento – Rappi (50%, cat: gastronomia, score: 0.535)
3. Transporte — 50% reintegro – Transporte (50%, cat: transporte, score: 0.59)

**Qué cambió:**
- Entra: Transporte (transporte, 100%)
- Entra: Transporte (transporte, 50%)
- Sale: Pax Assistance (salud-y-belleza, 50%)
- Sale: COLECTIVOS Y SUBTES NFC (otros, 100%)

**Por qué cambió:**
- El factor scoreAfinidad favorece categorías de necesidad Alta/Media (RFC-007 §5.1) sobre discrecionales de mayor % nominal.

**Categorías que suben:** transporte
**Categorías que bajan:** salud-y-belleza, otros
**Diversidad Top 3:** v1=3 categorías → v2=2 categorías

**Evaluación:** Parece una mejora: 1 caso(s) donde un gasto cotidiano desplazó a una promo de mayor % pero baja utilidad recurrente; bajó la diversidad de categorías (revisar si es correcto).

---

## Real — cartera mediana (2 bancos + wallets)

Pool de candidatas: 1040

**Top 3 v1:**
1. Rappi — 50% de descuento – Rappi (50%, cat: gastronomia, score: 0.65)
2. Cabify — 100% descuento – Cabify (100%, cat: transporte, score: 0.65)
3. Pax Assistance — 50% de descuento – Pax Assistance (50%, cat: salud-y-belleza, score: 0.5)

**Top 3 v2:**
1. Cabify — 100% descuento – Cabify (100%, cat: transporte, score: 0.7)
2. Rappi — 50% de descuento – Rappi (50%, cat: gastronomia, score: 0.535)
3. Changomas — 30% reintegro – Changomas (30%, cat: supermercados, score: 0.502)

**Qué cambió:**
- Entra: Changomas (supermercados, 30%)
- Sale: Pax Assistance (salud-y-belleza, 50%)

**Por qué cambió:**
- El factor scoreAfinidad favorece categorías de necesidad Alta/Media (RFC-007 §5.1) sobre discrecionales de mayor % nominal.

**Categorías que suben:** supermercados
**Categorías que bajan:** salud-y-belleza
**Diversidad Top 3:** v1=3 categorías → v2=3 categorías

**Evaluación:** Parece una mejora: 1 caso(s) donde un gasto cotidiano desplazó a una promo de mayor % pero baja utilidad recurrente.

---

## Real — cartera mediana (3 bancos, incluye Naranja X)

Pool de candidatas: 1632

**Top 3 v1:**
1. Rappi — 50% de descuento – Rappi (50%, cat: gastronomia, score: 0.65)
2. Cinema La Plata — 50% descuento – Cinema La Plata (50%, cat: entretenimiento, score: 0.5)
3. Comercios que acepten MODO — 40% en Desayunos (40%, cat: otros, score: 0.5)

**Top 3 v2:**
1. Rappi — 50% de descuento – Rappi (50%, cat: gastronomia, score: 0.535)
2. Pax Assistance — 50% de descuento – Pax Assistance (50%, cat: salud-y-belleza, score: 0.5)
3. RES — 30% en RES (30%, cat: supermercados, score: 0.489)

**Qué cambió:**
- Entra: Pax Assistance (salud-y-belleza, 50%)
- Entra: RES (supermercados, 30%)
- Sale: Cinema La Plata (entretenimiento, 50%)
- Sale: Comercios que acepten MODO (otros, 40%)

**Por qué cambió:**
- El factor scoreAfinidad favorece categorías de necesidad Alta/Media (RFC-007 §5.1) sobre discrecionales de mayor % nominal.

**Categorías que suben:** salud-y-belleza, supermercados
**Categorías que bajan:** entretenimiento, otros
**Diversidad Top 3:** v1=3 categorías → v2=3 categorías

**Evaluación:** Parece una mejora: 2 caso(s) donde un gasto cotidiano desplazó a una promo de mayor % pero baja utilidad recurrente.

---

## Sintético — Familia con supermercado
_Banco tradicional + wallet, sin onboarding declarado. Caso base: ¿sube el súper cotidiano?_

Pool de candidatas: 118

**Top 3 v1:**
1. Comercios que acepten MODO — 40% en Desayunos (40%, cat: otros, score: 0.5)
2. RES — 30% en RES (30%, cat: supermercados, score: 0.356)
3. Comercios vecinos — 30% en comercios vecinos (30%, cat: otros, score: 0.375)

**Top 3 v2:**
1. RES — 30% en RES (30%, cat: supermercados, score: 0.489)
2. Comercios que acepten MODO — 40% en Desayunos (40%, cat: otros, score: 0.425)
3. The Food Market — 25% en The Food Market (25%, cat: supermercados, score: 0.459)

**Qué cambió:**
- Entra: The Food Market (supermercados, 25%)
- Sale: Comercios vecinos (otros, 30%)

**Por qué cambió:**
- El factor scoreAfinidad favorece categorías de necesidad Alta/Media (RFC-007 §5.1) sobre discrecionales de mayor % nominal.

**Categorías que suben:** —
**Categorías que bajan:** —
**Diversidad Top 3:** v1=2 categorías → v2=2 categorías

**Evaluación:** Parece una mejora: 1 caso(s) donde un gasto cotidiano desplazó a una promo de mayor % pero baja utilidad recurrente.

---

## Sintético — Estudiante
_Wallet-only (sin tarjeta de banco tradicional), perfil típico de usuario joven._

Pool de candidatas: 1

**Top 3 v1:**

**Top 3 v2:**

**Qué cambió:**
- Sin cambios.

**Por qué cambió:**
- N/A — el orden de afinidad no alteró el resultado de v1 para este perfil.

**Categorías que suben:** —
**Categorías que bajan:** —
**Diversidad Top 3:** v1=0 categorías → v2=0 categorías

**Evaluación:** Sin cambios en el Top 3 — v2 coincide con v1 para este perfil.

---

## Sintético — Viajero (caso Cabify/Ezeiza, RFC-007 §8.5)
_Perfil con tarjeta premium, para ver si una promo puntual de Viajes/Transporte compite bien contra necesidad cotidiana._

Pool de candidatas: 157

**Top 3 v1:**
1. Patio Bullrich — 30% en Francesca (30%, cat: indumentaria, score: 0.375)
2. La Banderita — 30% en Banderita (30%, cat: gastronomia, score: 0.375)
3. Comercios vecinos — 30% en comercios vecinos (30%, cat: otros, score: 0.375)

**Top 3 v2:**
1. RES — 30% en RES (30%, cat: supermercados, score: 0.489)
2. Subte y Colectivos — 20% en transporte (20%, cat: transporte, score: 0.415)
3. The Food Market — 25% en The Food Market (25%, cat: supermercados, score: 0.459)

**Qué cambió:**
- Entra: RES (supermercados, 30%)
- Entra: Subte y Colectivos (transporte, 20%)
- Entra: The Food Market (supermercados, 25%)
- Sale: Patio Bullrich (indumentaria, 30%)
- Sale: La Banderita (gastronomia, 30%)
- Sale: Comercios vecinos (otros, 30%)

**Por qué cambió:**
- El factor scoreAfinidad favorece categorías de necesidad Alta/Media (RFC-007 §5.1) sobre discrecionales de mayor % nominal.

**Categorías que suben:** supermercados, transporte
**Categorías que bajan:** indumentaria, gastronomia, otros
**Diversidad Top 3:** v1=3 categorías → v2=2 categorías

**Evaluación:** Parece una mejora: 6 caso(s) donde un gasto cotidiano desplazó a una promo de mayor % pero baja utilidad recurrente; bajó la diversidad de categorías (revisar si es correcto).

---

## Sintético — Dueño de mascota
_Declaró "Mascotas" en onboarding simulado — floor Declarada activo (RFC-006)._

Pool de candidatas: 354

**Top 3 v1:**
1. Comercios vecinos — 30% en comercios vecinos (30%, cat: otros, score: 0.375)
2. RES — 30% en RES (30%, cat: supermercados, score: 0.356)
3. comercios adh — 30% en comercios adh (30%, cat: otros, score: 0.375)

**Top 3 v2:**
1. RES — 30% en RES (30%, cat: supermercados, score: 0.489)
2. The Food Market — 25% en The Food Market (25%, cat: supermercados, score: 0.459)
3. MITRE — 20% reintegro – Mitre (20%, cat: supermercados, score: 0.415)

**Qué cambió:**
- Entra: The Food Market (supermercados, 25%)
- Entra: MITRE (supermercados, 20%)
- Sale: Comercios vecinos (otros, 30%)
- Sale: comercios adh (otros, 30%)

**Por qué cambió:**
- El factor scoreAfinidad favorece categorías de necesidad Alta/Media (RFC-007 §5.1) sobre discrecionales de mayor % nominal.

**Categorías que suben:** —
**Categorías que bajan:** otros
**Diversidad Top 3:** v1=2 categorías → v2=1 categorías

**Evaluación:** Parece una mejora: 4 caso(s) donde un gasto cotidiano desplazó a una promo de mayor % pero baja utilidad recurrente; bajó la diversidad de categorías (revisar si es correcto).

---

## Sintético — Dueño de auto
_Perfil con banco + wallet genérico, sin declarar nada — mide si Combustible/Automotores sube solo por Default de necesidad._

Pool de candidatas: 187

**Top 3 v1:**
1. COLECTIVOS Y SUBTES NFC — Hasta 100% en Transporte (100%, cat: otros, score: 0.5)
2. Subte y Colectivos — Hasta 100% en Transporte (100%, cat: otros, score: 0.5)
3. RES — 30% en RES (30%, cat: supermercados, score: 0.356)

**Top 3 v2:**
1. RES — 30% en RES (30%, cat: supermercados, score: 0.489)
2. COLECTIVOS Y SUBTES NFC — Hasta 100% en Transporte (100%, cat: otros, score: 0.425)
3. The Food Market — 25% en The Food Market (25%, cat: supermercados, score: 0.459)

**Qué cambió:**
- Entra: The Food Market (supermercados, 25%)
- Sale: Subte y Colectivos (otros, 100%)

**Por qué cambió:**
- El factor scoreAfinidad favorece categorías de necesidad Alta/Media (RFC-007 §5.1) sobre discrecionales de mayor % nominal.

**Categorías que suben:** —
**Categorías que bajan:** —
**Diversidad Top 3:** v1=2 categorías → v2=2 categorías

**Evaluación:** Parece una mejora: 1 caso(s) donde un gasto cotidiano desplazó a una promo de mayor % pero baja utilidad recurrente.

---

## Sintético — Cartera amplia (multi-banco)
_Simula un power-user con muchos bancos/wallets, similar al perfil real más grande pero sin declarar nada._

Pool de candidatas: 427

**Top 3 v1:**
1. Comercios que acepten MODO — 40% en Desayunos (40%, cat: otros, score: 0.5)
2. RES — 30% en RES (30%, cat: supermercados, score: 0.356)
3. Comercios vecinos — 30% en comercios vecinos (30%, cat: otros, score: 0.375)

**Top 3 v2:**
1. RES — 30% en RES (30%, cat: supermercados, score: 0.489)
2. Comercios que acepten MODO — 40% en Desayunos (40%, cat: otros, score: 0.425)
3. The Food Market — 25% en The Food Market (25%, cat: supermercados, score: 0.459)

**Qué cambió:**
- Entra: The Food Market (supermercados, 25%)
- Sale: Comercios vecinos (otros, 30%)

**Por qué cambió:**
- El factor scoreAfinidad favorece categorías de necesidad Alta/Media (RFC-007 §5.1) sobre discrecionales de mayor % nominal.

**Categorías que suben:** —
**Categorías que bajan:** —
**Diversidad Top 3:** v1=2 categorías → v2=2 categorías

**Evaluación:** Parece una mejora: 1 caso(s) donde un gasto cotidiano desplazó a una promo de mayor % pero baja utilidad recurrente.
