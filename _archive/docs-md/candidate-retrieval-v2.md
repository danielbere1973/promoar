# Candidate Retrieval v2 — documento de arquitectura

Responde a "CPO Decision — Cierre del spike Two-Stage Hydration". Pregunta única a
responder: **¿cómo dejar de construir un pool de miles de promociones, en vez de seguir
optimizando cuánto tarda hidratarlo?**

No es un documento de optimización. No propone código todavía — evalúa alternativas de
diseño y recomienda una para validar con un spike nuevo, acotado.

## 1. Por qué el pool es grande hoy (con evidencia del código actual)

La query de candidatas (`getCandidatePromosForProfile()`, `lib/getPromos.ts:238-284`) ya
filtra en SQL: estado ACTIVE, vigencia, día, provincia, y un match **permisivo** de
banco/wallet contra el perfil. El comentario de diseño en el propio archivo (líneas
201-235, de DR-004) explica por qué es permisivo a propósito:

> "El filtro por banco/wallet es deliberadamente una SOBRE-aproximación: acepta falsos
> positivos (...) pero NUNCA produce falsos negativos."

El motivo: el matching real (`matchesProfile()`, líneas 843-941) depende de una
combinación de campos por requirement — `cardNetworkId`, `cardType`, `segmentId`,
`cardSegmentId`, `cardTier`, `accountType` (JUBILADO/ANSES/HABERES) — evaluados contra
**cada card del usuario**, con reglas especiales (Cuenta DNI implica Banco Provincia;
banco+wallet pueden estar en dos cards separadas de la misma persona). DR-004 decidió
explícitamente no replicar esa lógica en un `WHERE` SQL.

Resultado medido en el spike (usuario de prueba, perfil real): el `WHERE` permisivo deja
**2.303 filas**; `matchesProfile()` en TypeScript las reduce a **363**. El 84% de lo que se
hidrata se descarta después de traído. Esa es la fuente del costo que midió la Parte B —
no la hidratación en sí, sino hidratar 6.3x más de lo que hace falta.

Esto **no es un bug** — es el trade-off que DR-004 aceptó a cambio de no arriesgar falsos
negativos con un WHERE incompleto. El spike de Two-Stage Hydration atacó el síntoma
(cuánto cuesta hidratar el pool) sin tocar la causa (el pool es 6x más grande de lo
necesario). Candidate Retrieval v2 tiene que atacar la causa.

## 2. El problema no es solo de I/O — es de dónde vive la lógica de matching

`matchesProfile()` es lógica de negocio combinatoria: para cada promo, para cada
requirement de esa promo, contra cada card del usuario. SQL puede expresar comparaciones
de igualdad simples (`bankId = ANY(...)`), pero las reglas 2 y 3 (líneas 863-940) tienen
casos condicionales anidados (si hay `cardSegmentId` no revisar `cardTier`; si el
requirement es banco+wallet, deben aparecer en cards distintas del mismo usuario; el caso
especial Cuenta DNI). Portar esto a SQL 1:1 es frágil — cualquier regla nueva de negocio
requeriría mantener dos implementaciones sincronizadas (TS y SQL), con el riesgo real de
que diverjan silenciosamente (ya pasó dos veces en el spike: tier-dedup y el sort
secundario ausentes en el path liviano).

Esto descarta de entrada la opción "portar matchesProfile() completo a SQL" como la
primera alternativa a explorar — no por imposible, sino porque el costo de mantenimiento
y el riesgo de divergencia son altos, y ya tenemos evidencia de que ese tipo de divergencia
nos costó dos bugs reales esta misma spike.

## 3. Alternativas

### Alternativa A — Precomputar el matching, no recalcularlo en cada request

En vez de preguntar "¿qué promos matchean este perfil?" en cada request, mantener una
tabla de unión `UserPromoMatch (userId, promoId)` (o `CardProfileHash → promoIds`,
para no depender de usuarios registrados) que se recalcula cuando cambia lo que puede
invalidarla: el perfil financiero del usuario, o el conjunto de promos activas.

- El cálculo de matching se hace **una vez** por cambio de perfil o por scraper run, no
  una vez por request de recomendaciones.
- El request de recomendaciones pasa a ser `SELECT promoId FROM user_promo_match WHERE
  userId = ? ORDER BY ...` — sin `EXISTS`/loop combinatorio, sin pool de miles.
- Costo: invalidación. Cambios de perfil son poco frecuentes (evento de usuario). Cambios
  de promos activas son más frecuentes (cada scraper run, varias veces por semana) —
  requeriría recalcular el match contra todos los perfiles activos, o versionar el cálculo
  para hacerlo lazy (calcular al primer request post-cambio, cachear después).
- Riesgo: es esencialmente una caché con invalidación no trivial — mismo tipo de problema
  que "no usar cache de recomendaciones para maquillar el resultado" que la CPO pidió
  evitar en la medición. Habría que ser explícitos sobre cuándo se invalida y demostrar
  que no maquilla nada (el resultado sigue siendo 100% consistente con matchesProfile()
  real, solo que precalculado).

### Alternativa B — Reducir el pool con más precisión en SQL, sin replicar todo

No portar `matchesProfile()` completo, pero sí subir a SQL las reglas que **son** simples
comparaciones de igualdad y cubren la mayoría de los falsos positivos: `cardNetworkId`,
`cardType`, `accountType`. Dejar en TypeScript solo lo genuinamente combinacional (bank+
wallet en cards separadas, tier↔segmento, el caso especial Cuenta DNI).

- Reduce el pool sin necesidad de mantener dos copias de la lógica completa — solo de la
  parte estable y simple.
- Requiere medir cuánto realmente reduce (hipótesis, no dato): si la mayoría de los 2.303
  → 363 se explica por red/tipo de tarjeta (probablemente sí, es la causa más común de
  falso positivo — un banco tiene promos Visa y Mastercard, el usuario solo tiene una),
  esto podría llevar el pool real a un rango mucho más chico sin tocar la parte frágil.
- Riesgo bajo de divergencia: las reglas que subirían a SQL son las mismas 3-4 líneas
  simples hoy en TS, no la lógica condicional completa.

### Alternativa C — Invertir el problema: candidatas por comercio visible, no por promo

Hoy el pool nace de "todas las promos activas que podrían aplicarle a este perfil". Una
alternativa distinta: el usuario típicamente ve un feed acotado (Top 3 recomendaciones,
o una grilla paginada) — no necesita el universo completo rankeado de una. Se podría
calcular candidatas **por categoría/comercio de interés visible en pantalla**, no
globalmente, reduciendo el pool al recorte que el usuario realmente puede ver primero, y
calculando el resto de forma perezosa (scroll, "ver más").

- Encaja con el objetivo de UI real (Top 3 + expandir), no requiere rankear miles para
  mostrar 3.
- Riesgo: el ranking actual (`rankForHome()`) compara entre categorías para elegir qué
  destacar — recortar candidatas antes de rankear podría cambiar cuáles ganan el Top 3
  si el recorte no es cuidadoso. Requeriría repensar el orden de las etapas, no solo el
  tamaño del pool.

## 4. Recomendación

Empezar por la **Alternativa B** (reducir precisión de filtro SQL con las reglas simples
y estables: red, tipo de tarjeta, tipo de cuenta) como spike acotado antes de considerar A
o C:

- Es la que menos arriesga divergencia de lógica (no duplica reglas complejas).
- Es medible rápido: correr la query actual + la extendida contra el mismo perfil de
  prueba y comparar cuánto baja el pool antes de tocar nada del pipeline de hidratación.
- Si el pool baja lo suficiente (ej. de 2.303 a algo cercano a 363-500), puede que ni
  siquiera haga falta Two-Stage Hydration — hidratar un pool ya chico con el pipeline
  actual (una sola etapa) podría alcanzar el objetivo de performance sin la complejidad
  de dos etapas.
- Si no baja lo suficiente, es la base para evaluar Alternativa A (precómputo) con mejor
  información de cuánto del problema queda.

No se descarta A ni C — quedan como siguiente paso si B no alcanza el objetivo.

## 5. Qué mediría el spike de validación de B (si se aprueba)

1. Extender `getCandidatePromosForProfile()` con condiciones adicionales por
   `cardNetworkId`/`cardType`/`accountType` del perfil (sin tocar bank/wallet, que ya
   están).
2. Confirmar con los mismos 40 casos de la validación anterior que el pool reducido sigue
   sin producir falsos negativos (ninguna promo que `matchesProfile()` aceptaría queda
   afuera del nuevo WHERE) — mismo estándar de 100% que ya se aplicó.
3. Medir el tamaño del pool resultante contra los mismos perfiles de prueba usados en
   Two-Stage Hydration (incluido el que dio 2.303→363).
4. Si el pool baja lo suficiente, medir latencia HTTP end-to-end del pipeline actual
   (una sola etapa) contra ese pool reducido, mismo protocolo cold+warm ya usado.

No requiere descartar el código de Two-Stage Hydration todavía — si el pool baja pero no
lo suficiente, Two-Stage Hydration sigue siendo una pieza válida para aplicar sobre un
pool ya más chico.
