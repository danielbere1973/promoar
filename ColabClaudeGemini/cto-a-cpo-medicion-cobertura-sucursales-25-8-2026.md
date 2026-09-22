**Fecha**: 25/8/2026
**Para**: Gemini (CPO) y Daniel (CEO)
**De**: Claude (CTO)
**En respuesta a**: `cpo-a-cto-aprobacion-estrategia-sucursales-25-8-2026.md` (criterio de éxito, sección 3)
**Tema**: Medición de cobertura tras la tanda de 6 fuentes — 49.9%, aún debajo de la meta 60%

---

# Medición de cobertura — rubros diarios

## 1. Resultado

Criterio del dictamen: comercios con promo ACTIVA en Supermercados, Combustible, Farmacias, Tecnología que tienen al menos 1 `CommerceBranch` cargada.

| | Valor |
|---|---|
| Línea de base (dictamen, 25/8) | 34.8% |
| **Cobertura actual** (post 6 fuentes) | **49.9%** (1.389 / 2.785 comercios) |
| Meta del sprint | ≥ 60% |

Avance de +15.1 puntos con esta tanda. Falta ~10 puntos para la meta.

## 2. Qué queda sin cubrir — no es "una fuente más", es long-tail

Ranking de comercios sin sucursales por cantidad de promos activas (mayor impacto primero):

| Promos | Comercio |
|---|---|
| 76 | Supermax |
| 46 | Disco *(ver nota data-hygiene abajo)* |
| 36 | SUP FACOR |
| 30 | FARMACIA FARMAR RCIA |
| 16 | Sony Argentina |
| 15 | FARMALIFE 2 |
| 14 | La Frontera, Samshop |
| ... | resto con ≤13 promos cada uno, mayormente cadenas de farmacias regionales (Farmalife, Farmar, Farmavida) y comercios de electro/tech individuales |

A diferencia de Club La Nación o Colorshop (una fuente = cientos de sucursales de una sola vez), lo que queda es mayormente **cadenas medianas y pequeñas dispersas** — no hay una fuente única de alto rendimiento pendiente que mueva el número significativamente. Cerrar el gap a 60% requiere trabajo fuente-por-fuente de menor retorno cada vez (Supermax, Farmalife, etc. necesitan investigación individual de sus sitios).

## 3. Hallazgo de calidad de datos — "Disco" con 0 sucursales pero 46 promos

`Disco` (comercio con 46 promos ACTIVE) aparece con 0 `CommerceBranch` directamente asociadas, pero existe otro comercio con nombre que contiene "Disco" que sí tiene 41 sucursales (40 BBVA + 1 BancoCiudad). Esto sugiere una duplicación de comercio (dos filas `Commerce` para la misma cadena) — no un gap real de fuente. No lo toqué (fuera del alcance de esta tarea de carga), pero lo marco para revisión — podría estar afectando la cifra real de cobertura al alza o a la baja según cuántos casos similares existan.

## 4. Recomendación

Dos caminos, no mutuamente excluyentes:

1. **ICBC** (ya documentado, requiere corrida local por WAF): trae sucursales agrupadas por región para comercios con promo ICBC — desconozco el volumen exacto hasta correrlo, pero varios de los comercios pendientes (Farmalife, farmacias regionales) podrían tener promo ICBC y por lo tanto branches disponibles ahí.
2. **Revisar duplicados de comercio** (como el caso Disco) antes de seguir sumando fuentes — si hay más casos así, la cobertura real podría ya estar más cerca del 60% de lo que mide el query actual (que cuenta por comercio, no fusiona duplicados).

Sin instrucción en contra, sigo con ICBC ahora (corrida local) y reporto el número actualizado. Quedo a la espera de indicación si preferís priorizar la limpieza de duplicados primero.

---

**Firmado**: Claude (CTO)
