# Spike — Validación de calidad: Recommendation Model v2 vs v1

**Estado**: Evidencia recolectada, pendiente de revisión CPO.
**Fecha**: 10/8/2026
**Alcance**: `feature/nueva-home`, dev-promoar (`ep-cool-lake-ammkwaug`). No toca producción, no toca `lib/decisionEngine.ts`.
**Referencia**: RFC-007 v3 "Aprobado para spike" (cerrado). CPO Direction 10/8/2026 amplió el spike original (§12 de RFC-007) para exigir evidencia de *calidad*, no solo de cambio de score.

---

## 0. Qué se pidió y qué se entrega

La CPO Direction pidió específicamente:

1. Comparación v1 vs v2 sobre **perfiles reales**.
2. Comparación sobre un conjunto pequeño de **perfiles sintéticos representativos** (familia, estudiante, viajero, mascota, auto).
3. **Reporte legible para producto**, no solo tablas técnicas.
4. Por perfil: Top 3 v1, Top 3 v2, qué cambió, por qué cambió, evaluación de si es mejora.
5. Métricas: categorías que suben/bajan, diversidad del Top 3, casos "cotidiano vence a flashy de baja utilidad".

Este documento cubre los 5 puntos. El detalle perfil-por-perfil completo (con scores) está en
`scripts/spike-recommendation-v2/REPORTE.md` (generado automáticamente); acá va la lectura de producto.

## 1. Cómo se armó el spike

- **v1**: se llamó a `rankForHome()` de `lib/decisionEngine.ts` **sin modificar el archivo**.
- **v2**: función standalone en `scripts/spike-recommendation-v2/decisionEngineV2.ts` — mismo motor de v1
  (gates de vigencia, factores ahorro/cercanía/online/favoritos, diversidad, top-3) + el factor nuevo
  `scoreAfinidad` (RFC-007 §5.1, Dimensión A de necesidad) con los pesos-hipótesis de RFC-007 §4
  (`ahorro 0.35, afinidad 0.30, cercania 0.18, online 0.11, favoritos 0.06`).
- El pool de candidatas para ambos motores se obtuvo con `getPromosData()` **sin tocar**, exactamente
  como lo hace `/api/promos/recommended` hoy en producción — mismo gate financiero y de cobertura.
- **Perfiles reales**: 3 cuentas de dev-promoar con carteras de tamaño chico/mediano (se descartó usar
  cuentas de `admin@`/testing con decenas de bancos por no ser representativas de un usuario típico).
- **Perfiles sintéticos**: 6 personas armadas con el mecanismo `guest_profile` (mismo que usa la app para
  usuarios sin cuenta) — banco(s) + wallet(s) elegidos para representar los casos que pidió la CPO
  (familia, estudiante, viajero, dueño de mascota, dueño de auto, cartera amplia).
- El factor `scoreAfinidad` **no tiene onboarding real disponible hoy** (RFC-006 no está implementado en UI)
  — para las 6 personas sintéticas, todas corrieron con Default de necesidad (Dimensión A) únicamente,
  salvo "Dueño de mascota", a quien se le inyectó a mano una categoría Declarada (`petshops`) para probar
  ese camino también.

## 2. Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Perfiles evaluados | 9 (3 reales + 6 sintéticos) |
| Perfiles con cambio en el Top 3 | 8 / 9 |
| Casos "cotidiano supera a flashy de baja utilidad" | 17 |
| Perfiles donde bajó la diversidad de categorías del Top 3 | 3 / 9 |
| Perfiles donde la diversidad se mantuvo igual | 6 / 9 |
| Perfiles donde subió la diversidad | 0 / 9 |

**Lectura**: v2 cambia el resultado en la gran mayoría de los perfiles, y el cambio predominante es
consistente con la hipótesis del RFC — promos de necesidad cotidiana (supermercado, transporte) desplazan
a promos discrecionales de alto % nominal pero baja utilidad recurrente (Rappi, Pax Assistance, "comercios
adheridos" genéricos). Ningún perfil mostró un caso donde el cambio pareciera claramente un *empeoramiento*.
El punto a vigilar es la diversidad: en 3 de 9 perfiles el Top 3 de v2 quedó más concentrado en categorías
de necesidad que el de v1 (ver §5).

## 3. Perfiles reales — lectura de producto

### 3.1 Cartera chica (1 banco)

- **v1** ponía a Rappi (gastronomía, 50%), Pax Assistance (salud-y-belleza, 50%) y una promo de
  Transporte NFC genérica en el Top 3.
- **v2** reemplaza Pax Assistance y la promo genérica de Transporte por dos promos de Transporte con
  banco real vinculado.
- **Evaluación**: mejora razonable — pasa de "asistencia al viajero" (uso esporádico) a transporte diario
  (uso cotidiano real). Efecto secundario: la diversidad del Top 3 bajó de 3 a 2 categorías porque quedaron
  dos promos de Transporte simultáneas. **Esto es un caso concreto donde vale la pena revisar si conviene
  ajustar la penalización de diversidad** (hoy es solo 10%, quizás insuficiente cuando el factor afinidad
  empuja fuerte hacia una sola categoría).

### 3.2 Cartera mediana (2 bancos + wallets)

- **v1**: Rappi, Cabify (100% Transporte), Pax Assistance.
- **v2**: Cabify se mantiene arriba (su afinidad de Transporte + su 100% nominal lo sostienen), pero
  Pax Assistance sale y entra Changomas (supermercados, 30%).
- **Evaluación**: mejora clara. Es el caso más parecido al ejemplo ilustrativo de RFC-007 §10 — el súper
  cotidiano le gana a una promo de salud/asistencia poco frecuente, sin sacrificar a Cabify (que sigue
  siendo relevante porque también cae en categoría de necesidad Alta).

### 3.3 Cartera mediana (3 bancos, incluye Naranja X)

- **v1**: Rappi, Cinema La Plata (entretenimiento), una promo de "Desayunos" mal categorizada como "otros".
- **v2**: Rappi se mantiene, entran Pax Assistance y una promo de supermercado (RES).
- **Evaluación**: mejora parcial. Sale un cine (entretenimiento puro) y entra supermercado, correcto. Pero
  Pax Assistance (salud-y-belleza, Dimensión Media) desplaza a una promo de "otros" — no es un caso tan
  contundente como los anteriores; el cambio es razonable pero no espectacular.

## 4. Perfiles sintéticos — lectura de producto

### 4.1 Familia con supermercado

Pool chico (118 promos). v2 reordena el Top 3 hacia más supermercado (RES sube al puesto 1, entra
The Food Market) y saca una promo genérica de "comercios vecinos" sin categoría real. **Coherente con el
objetivo del RFC**: familias con gasto recurrente en supermercado ahora lo ven priorizado.

### 4.2 Estudiante — **hallazgo, no resultado útil**

Pool de **1 sola promo**. El perfil wallet-only (Mercado Pago + Ualá, sin banco) casi no matchea nada en
la base actual. Esto **no es un resultado del modelo v2** — es una señal de que la cobertura de promos
para perfiles sin banco tradicional es muy baja en dev-promoar hoy. No se puede sacar ninguna conclusión
de calidad de ranking para este perfil hasta que haya más inventario billetera-only. Se reporta como
limitante, no como evidencia a favor o en contra de v2.

### 4.3 Viajero (caso Cabify/Ezeiza, RFC-007 §8.5) — **hallazgo relevante**

Este perfil se armó específicamente para poner a prueba el caso ilustrativo del RFC (una promo puntual de
alto valor en Transporte/Viajes debería poder competir bien pese a ser "discrecional"). Resultado:

- **v1** ni siquiera trae Cabify al Top 3 para este perfil — trae indumentaria, gastronomía y una promo
  genérica.
- **v2** sí mejora hacia necesidad cotidiana (supermercado, transporte de uso diario), pero **tampoco
  reproduce el caso Cabify/Ezeiza** — porque esa promo específica no está en el pool de candidatas de este
  perfil (probablemente por gate financiero: el banco elegido para "Viajero" no matchea el requirement de
  Cabify en la base real).
- **Conclusión importante**: el ejemplo Cabify/Ezeiza de RFC-007 §10 es **ilustrativo/hipotético**, no
  validado contra datos reales. La Dimensión futura de aplicabilidad/recurrencia (§8.5) sigue siendo
  necesaria conceptualmente, pero este spike no pudo generar evidencia empírica a favor o en contra suya
  porque el caso concreto no apareció en el pool real. Se recomienda no tratar §8.5 como validada — sigue
  siendo una hipótesis de diseño, tal como está documentada.

### 4.4 Dueño de mascota (con categoría Declarada)

v2 sube dos promos de supermercado y baja dos genéricas de "otros". La categoría Declarada (`petshops`)
**no aparece en el Top 3 final** en este pool — no había promos de mascotas competitivas en el pool de
candidatas de este perfil sintético. El mecanismo de floor Declarada no se pudo poner a prueba de forma
concluyente por falta de inventario matcheable, mismo tipo de limitante que el caso Estudiante.

### 4.5 Dueño de auto

Cambio menor: entra una promo de supermercado, sale una de transporte duplicada. Mejora leve, sin
sorpresas. No se observó un salto claro hacia Combustible/Automotores porque el pool de este perfil casi
no tenía promos de esas categorías — otra limitante de cobertura, no del modelo.

### 4.6 Cartera amplia (multi-banco)

Mismo patrón que "Familia": sube supermercado, baja una promo genérica sin categoría real. Resultado
consistente y sin sorpresas.

## 5. Métricas agregadas

**Categorías que suben** (across perfiles): supermercados (5 veces), transporte (2), salud-y-belleza (2).
**Categorías que bajan**: otros (5 veces — el patrón más consistente: v2 sistemáticamente saca promos sin
categoría real o mal categorizadas), entretenimiento (1), indumentaria (1), gastronomia (1).

**Diversidad del Top 3**: en 3/9 perfiles bajó (de 3→2 o 2→1 categorías); en 6/9 se mantuvo igual; en
ninguno subió. La penalización de diversidad actual (10%, heredada de v1) no compensa del todo el empuje
del nuevo factor afinidad cuando dos promos de la misma categoría de necesidad Alta son ambas más
atractivas que la mejor opción de otra categoría. **No es necesariamente malo** — si un usuario tiene dos
promos de supermercado muy buenas, mostrar ambas puede ser correcto — pero es un trade-off que la CPO
debería decidir conscientemente, no un efecto colateral no documentado.

**Casos "cotidiano vence a flashy de baja utilidad"**: 17 en total, concentrados en 3 perfiles (Viajero:
6, Dueño de mascota: 4, Cartera chica: 1, Cartera mediana ×2: 1 cada uno, Familia: 1, Dueño de auto: 1,
Cartera amplia: 1). El patrón dominante en estos casos es "sale una promo sin categoría real o de
categoría discrecional poco frecuente, entra supermercado/transporte".

## 6. Limitantes encontradas (no son bugs de v2, son señales sobre los datos)

1. **Perfiles wallet-only tienen pool casi vacío** (caso Estudiante: 1 promo). La cobertura de promos para
   usuarios sin banco tradicional es baja hoy — esto es un problema de datos/scraping, no del modelo de
   ranking, pero limita qué tan representativo puede ser un perfil "estudiante" en este spike.
2. **El ejemplo Cabify/Ezeiza de RFC-007 no se reprodujo con datos reales** — la promo específica no
   apareció en el pool del perfil sintético diseñado para probarla. La Dimensión de aplicabilidad/
   recurrencia (§8.5) sigue sin evidencia empírica, solo argumento conceptual.
3. **Categoría "otros" aparece con frecuencia en el Top 3 de v1** y es sistemáticamente la que más baja en
   v2 — vale la pena revisar aparte si esas promos deberían tener mejor categorización de origen (separado
   de este spike, es un tema de calidad de datos del scraper/categorización).
4. Ninguna de las 9 corridas usó ubicación (`hasLocation=false`) — el factor cercanía quedó en 0 en todos
   los casos, por diseño del spike (no había lat/lng de prueba armados). Esto no afecta la comparación
   v1/v2 en sí (mismo tratamiento en ambos), pero significa que este spike no dice nada sobre cómo
   interactúa afinidad con cercanía en la práctica.

## 7. Conclusión y recomendación

La evidencia recolectada es consistente con la hipótesis de RFC-007: agregar `scoreAfinidad` con Default
por necesidad de categoría **mueve el Top 3 hacia gastos cotidianos sin producir ningún caso evidente de
empeoramiento** en los 7 perfiles que sí tuvieron pool suficiente para evaluar. El patrón más repetido y
más fácil de defender frente a un usuario real es "sale una promo genérica/sin categoría real, entra
supermercado o transporte de uso diario".

Dicho esto, **la evidencia no es exhaustiva**: 2 de 9 perfiles (Estudiante, y parcialmente Mascota) no
generaron pool suficiente para decir nada útil, y el caso específico que motivó §8.5 (Cabify/Ezeiza) no
se pudo probar con datos reales. Tampoco se evaluó el factor cercanía.

**Recomendación**: esto alcanza como evidencia inicial para que la CPO decida si avanzar a integrar
`scoreAfinidad` en `decisionEngine.ts` de forma permanente, pero antes de esa decisión valdría la pena que
la CPO revise puntualmente:
- El trade-off de diversidad en §5 (¿aceptable mostrar 2 promos de la misma categoría si ambas son
  mejores que la alternativa?).
- Si conviene ampliar la cobertura de datos antes de medir perfiles wallet-only o de nicho (mascotas).

Ningún cambio se aplicó a `lib/decisionEngine.ts`. Todo el código de v2 vive en
`scripts/spike-recommendation-v2/` como módulo standalone, sin uso en producción.

## Anexo — Archivos generados por este spike

- `scripts/spike-recommendation-v2/decisionEngineV2.ts` — motor v2 standalone (no se importa desde código
  de producción).
- `scripts/spike-recommendation-v2/run-spike.ts` — script que arma los 9 perfiles, corre v1 y v2, y genera
  el reporte técnico.
- `scripts/spike-recommendation-v2/REPORTE.md` — salida técnica completa (scores por perfil), generada
  automáticamente por `run-spike.ts`.
- `scripts/spike-recommendation-v2/resultados.json` — datos crudos de la corrida, para reprocesar sin
  volver a consultar la base.
