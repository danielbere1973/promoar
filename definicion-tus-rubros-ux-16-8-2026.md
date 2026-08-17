# "Tus rubros" — Definición funcional, UX y propuesta visual (v3)

**Fecha**: 16/8/2026
**Estado**: v3 — reemplaza el modelo "DECLARED + fill hasta N" por una separación conceptual de dos bloques. Todavía NO autorizado para implementación.
**Alcance de esta etapa**: definición de producto y arquitectura conceptual. Sin código, sin DB, sin PROD/DEV, sin mockup.

**Qué cambió respecto a v2** (CPO Direction "Tus Rubros v3 / Separación entre intereses y descubrimiento", 16/8/2026):

La discusión B1/B2/B3 sobre prioridad entre declarados queda **suspendida** — no descartada por ser mala idea, sino porque resolvía el problema equivocado. El problema real no era "cómo ordenar más de 5 declarados", era que el modelo mismo mezclaba dos cosas que el usuario nunca pidió mezclar: sus intereses reales, y el relleno necesario para llenar una grilla.

Este documento reemplaza por completo las secciones 3.2 (prioridad B1/B2/B3), el fill automático de defaults dentro de "Tus rubros", y la recomendación de elegir "entre 3 y 5". Mantiene sin cambios la reconciliación DECLARED/INFERRED/SUPPRESSED de v2 (§8) y el flujo de guardado explícito de v2 (§6).

---

## 1. Principio central

La selección del usuario en "Tus rubros" significa exactamente una cosa:

> **"Estos rubros me interesan."**

No significa "estos son los que quiero ver primero y después rellenen con lo que sea", no significa "estos son mis únicos intereses posibles", y no significa "todo lo que no marqué no me interesa".

**La ausencia de selección de un rubro es una señal desconocida, no una señal negativa.**

`DECLARED` tiene máxima autoridad positiva. Pero `NOT DECLARED != NOT INTERESTED`. Si el usuario no seleccionó Combustible, no sabemos si no le interesa, no tiene auto, usa el auto de otra persona, no pensó en seleccionarlo, o si una oportunidad excepcional igual podría interesarle. Una señal negativa real solo puede surgir de una acción distinta y explícitamente definida (§8) — nunca se infiere de una omisión.

Esta es la razón de fondo por la que "rellenar con defaults hasta completar 5 slots" (el comportamiento de `selectRubrosForHome` hoy) es un error conceptual y no solo un detalle de implementación: convierte silenciosamente contenido no pedido en contenido presentado como si fuera parte de los intereses del usuario, sin decírselo.

---

## 2. Dos bloques, separados conceptual y visualmente

### Bloque A — "Tus rubros"

Contenido derivado **exclusivamente** de intereses declarados (`DECLARED`/`ACTIVE`). Trabaja prioritariamente sobre esos rubros. **No se completa automáticamente con defaults para llegar a una cantidad fija de slots** — la cantidad de slots visibles es una capacidad de la UI, no una obligación editorial de llenarlos.

Si el usuario declaró 2 rubros y ambos tienen oportunidad calificable, el bloque muestra 2. No 5.

### Bloque B — "También te podría interesar"

Espacio de descubrimiento/recomendación, separado y rotulado como tal. Acá sí pueden aparecer rubros que el usuario no declaró — pero cada uno debe entrar por una razón justificable (§4), nunca como relleno silencioso disfrazado de personalización.

### Por qué la separación importa (y no es solo estética)

Mezclar ambos bloques es exactamente lo que hacía el modelo anterior: un usuario que declaró 2 rubros veía una grilla de 5 sin ninguna marca de que 3 de esos 5 no tenían nada que ver con lo que él pidió. Separarlos hace observable la diferencia entre "esto es lo que vos elegiste" y "esto es lo que nosotros creemos que te puede servir" — condición necesaria para que la declaración del usuario siga significando algo con el tiempo.

---

## 3. Bloque A — "Tus rubros": especificación

| | |
|---|---|
| **Fuente de candidatos** | Únicamente rubros con fila `UserRubroPreference` `source=DECLARED`, `status=ACTIVE`, y `HomeRubro.active=true` |
| **Autoridad de la señal** | Máxima — es la única señal positiva explícita que existe hoy en el sistema |
| **Criterio de entrada** | Ser declarado + estar activo globalmente + tener al menos una oportunidad calificable (mismo umbral de calidad que ya aplica el Decision Engine hoy — no se baja el estándar para "completar" nada) |
| **Máximo de elementos** | `HOME_RUBRO_COUNT` (5) — sigue siendo un techo de capacidad de UI, no un objetivo a alcanzar |
| **Si no hay suficientes oportunidades** | El bloque muestra menos de 5, o incluso 0, sin generar contenido de reemplazo. La ausencia de oportunidad no hace desaparecer la preferencia declarada — el rubro sigue en "Tus rubros" (perfil), solo no ocupa un slot ese día |
| **Relación con Decision Engine** | El Decision Engine evalúa oportunidades **solo dentro del universo declarado** para este bloque — no decide membresía (eso ya lo resuelve la preferencia), decide qué declarados tienen algo bueno para mostrar hoy y con qué candidato |

### Comportamiento por cantidad de declarados

| Declarados | Comportamiento del Bloque A |
|---|---|
| **0** | Vacío. El usuario no declaró nada — no hay "Tus rubros" que mostrar. Bloque A puede ocultarse por completo o mostrar un estado vacío con CTA a declarar (ver §7). Todo el peso recae en el Bloque B en modo cold-start (default de alta aplicabilidad). |
| **2** | Hasta 2 slots, nunca más — aunque la UI tenga capacidad para 5. Si ambos tienen oportunidad calificable, se muestran los 2. Si solo uno la tiene, se muestra 1. |
| **5** | Hasta 5 slots. Sin ambigüedad de prioridad — los 5 caben exactamente en la capacidad de la UI. |
| **8** | Los 8 conservan exactamente la misma autoridad `DECLARED` entre sí — no hay jerarquía. El Decision Engine evalúa oportunidades dentro de los 8 y selecciona hasta 5 que tengan las mejores oportunidades calificables ese día. **No se eligen los primeros 5 por orden de `RUBRO_CATALOG`** (eso es exactamente el defecto que tenía la Opción A de la propuesta B1/B2/B3 en v2, ahora descartada). Los 3 restantes no desaparecen del perfil — solo no ocupan slot hoy, mismo mecanismo que el caso de 5 sin oportunidad. |
| **10** | Mismo comportamiento que 8, con el universo completo del catálogo declarado. |

### Estabilidad — problema identificado, sin resolver todavía

Con 8-10 declarados y solo 5 slots, el ranking por calidad de oportunidad puede producir cambios de qué 5 aparecen de un día a otro por diferencias mínimas de score — un usuario podría ver Tecnología hoy y no mañana por una diferencia irrelevante entre dos promos casi idénticas. Esto necesita un contrato de estabilidad (ej. histéresis, ventana de score mínima para desplazar a un rubro que ya estaba mostrado, cooldown). **No se define el mecanismo en este documento** — se deja registrado como problema abierto (§9) para resolver antes de implementar, no durante.

---

## 4. Bloque B — "También te podría interesar": especificación

Dos niveles de entrada, evaluados en orden. No se implementa ninguno de los dos todavía — esta sección define el contrato, no el código.

### Nivel 1 — Afinidad con intereses declarados

Si el usuario declaró un rubro, otros rubros/categorías con afinidad **explícitamente definida** respecto a ese declarado pueden entrar al Bloque B. Ejemplo ilustrativo (no una relación ya decidida): declarar Gastronomía podría justificar mostrar Heladerías o Cafeterías si existe una relación de afinidad formalmente definida entre esas categorías — no se hardcodea la relación a partir de este ejemplo (§10).

Esto es **expansión por afinidad**, conceptualmente distinta de un default: el motivo de entrada es "se parece a algo que declaraste", no "es genérico y aplicable a cualquiera".

### Nivel 2 — Descubrimiento por oportunidad excepcional

Un rubro sin afinidad directa con lo declarado puede aparecer si la oportunidad tiene un valor suficientemente extraordinario. Ejemplo ilustrativo: un usuario que declaró Tecnología + Gastronomía + Indumentaria (sin Supermercados) normalmente no vería nada de Supermercados — pero una oportunidad como "Coto — 30% con Visa Débito" podría justificar aparecer en el Bloque B igual, porque el sistema no debe asumir comportamiento humano únicamente a partir de los rubros seleccionados (no sabemos si compra para su casa, si se lo recomienda a otra persona, etc.).

### Especificación

| | |
|---|---|
| **Fuente de candidatos** | (a) Rubros/categorías con afinidad definida respecto a declarados (Nivel 1); (b) rubros sin afinidad pero con oportunidad excepcional, umbral más alto que el estándar (Nivel 2) |
| **Autoridad de la señal** | Ninguna autoridad de membresía propia — cada candidato entra por una razón puntual y verificable, no por pertenecer a un conjunto declarado |
| **Criterio de entrada** | Nivel 1: afinidad explícita + oportunidad calificable estándar. Nivel 2: sin afinidad + oportunidad excepcional (umbral a definir, mayor que el estándar) |
| **Máximo de elementos** | A definir — no se fija en este documento. Debe ser lo bastante chico para no diluir el mensaje "esto es distinto de lo que elegiste" |
| **Si no hay suficientes oportunidades** | El bloque se achica o desaparece — mismo principio que el Bloque A, no se rellena para completar una cantidad fija |
| **Relación con Decision Engine** | El Decision Engine necesita una fuente de candidatos previa al ranking (afinidad Nivel 1, o el universo completo para evaluar excepcionalidad en Nivel 2) — hoy no existe ese candidate-building fuera del universo declarado; es trabajo nuevo, no una extensión trivial de lo que ya existe |

### Comportamiento por cantidad de declarados

| Declarados | Comportamiento del Bloque B |
|---|---|
| **0** | Es el único bloque con contenido. Actúa en modo cold-start puro: "todavía no sé qué te interesa, te muestro oportunidades de alta aplicabilidad general" — este es exactamente el rol que hoy cumple el fill por defecto, mudado de lugar (§5) |
| **2** | Puede tener afinidad Nivel 1 derivada de esos 2 declarados, más candidatos de Nivel 2. Convive con un Bloque A chico (2 slots) sin competir por espacio — son secciones distintas |
| **5** | Igual que 2, con más superficie de afinidad Nivel 1 posible (más declarados = más rubros con los que calcular afinidad) |
| **8** | Bloque A ya usa los 5 slots con los mejores de los 8 declarados. Bloque B puede mostrar afinidad de los declarados que no entraron hoy al Bloque A, más descubrimiento — a definir si tiene sentido priorizar afinidad de los "declarados no mostrados hoy" sobre afinidad genérica |
| **10** | Con el catálogo completo declarado, el espacio de Nivel 2 (sin afinidad) se angosta naturalmente — casi cualquier rubro tiene algún grado de afinidad con algo del universo completo declarado. No es un problema a resolver ahora, es una consecuencia esperable |

---

## 5. Defaults — cambia su función, no su existencia

Los defaults mantienen valor, pero cambian de rol: pasan de ser el mecanismo de relleno de "Tus rubros" a ser la estrategia de **cold start** del Bloque B cuando hay 0 declarados.

> "Todavía no sé qué te interesa, por lo tanto te muestro oportunidades de alta aplicabilidad general."

Con 1+ declarados, los defaults **no se usan automáticamente** para completar el Bloque A. Pueden eventualmente participar del Bloque B si cumplen las reglas de afinidad/descubrimiento que se definan (§4) — pero entran por esas reglas, no por ser default.

---

## 6. Guardado — sin cambios respecto a v2

Se mantiene el flujo de guardado explícito aprobado en v2, sin modificaciones:

1. Usuario entra a "Tus rubros".
2. Selecciona/deselecciona libremente — cambios pendientes, sin requests todavía.
3. CTA visible mientras haya cambios pendientes: **"Guardar preferencias"**.
4. Al guardar: un solo request con el diff completo, persistencia, feedback breve de éxito.
5. Confirmación simple si intenta salir con cambios sin guardar.
6. Botón "Descartar cambios" disponible mientras haya pendientes.

**Se elimina la recomendación "elegí entre 3 y 5"** (v2 §3.1 microcopy) — si "Tus rubros" representa intereses reales, no corresponde adaptar la cantidad de intereses del usuario a la capacidad visual de la Home. Selección libre entre 0 y el universo activo completo (hoy 10), sin sugerencia de rango.

Copy actualizado para el caso de más de 5 declarados (reemplaza tanto el "rotando según el día" de v1 como el copy de v2 que todavía hablaba de "priorizar tus intereses... hasta 5" sin la separación de bloques):

> *"Elegiste tus rubros de interés. En 'Tus rubros' te mostramos hasta 5 por vez, priorizando los que tengan la mejor oportunidad hoy — el resto sigue guardado y puede aparecer otro día. Fuera de tus rubros, 'También te podría interesar' te muestra otras oportunidades que podrían servirte."*

Sin mención de threshold, scoring, ni mecanismos internos — comunica exactamente el mecanismo real (autoridad completa entre declarados + capacidad de UI limitada + bloque de descubrimiento separado), sin inventar un concepto de rotación que no existe.

---

## 7. Estado sin preferencias declaradas

Sin cambios de fondo respecto a v2, ajustado a la separación de bloques:

> *"Todavía no elegiste rubros. Mientras tanto, en 'También te podría interesar' te mostramos una selección general — elegí tus intereses cuando quieras y vamos a priorizarlos en 'Tus rubros'."*

---

## 8. `DECLARED` / `INFERRED` / `SUPPRESSED` — se mantiene la reconciliación de v2

CPO pidió mantener la reconciliación aprobada en v2 salvo contradicción concreta con esta nueva arquitectura. **No se encontró contradicción** — se reporta acá en vez de corregir silenciosamente, tal como se pidió:

La reconciliación de v2 opera exclusivamente sobre la fila `DECLARED` de `UserRubroPreference` (declarar = insert, quitar = `SUPPRESSED`+`suppressedAt`, redeclarar = reactivar la misma fila). Nada de eso depende de si "Tus rubros" rellena con defaults o no — la separación de bloques cambia **qué se muestra en la Home**, no **cómo se administra la preferencia declarada**. La traza de 4 pasos de v2 (declarar Tecnología → señal inferida coexiste → suprimir → redeclarar) sigue siendo válida sin modificación.

Lo único que cambia de contexto: la protección contra reinferencia inmediata (v2 §4.1 Paso 3) ahora es más claramente relevante para el Bloque B — es exactamente el tipo de regla que impediría que un rubro recién suprimido por el usuario reaparezca al toque como sugerencia de "También te podría interesar" bajo la excusa de afinidad o descubrimiento. Se deja anotado como criterio a aplicar cuando se diseñe el candidate-building del Bloque B (§4), no como cambio a la reconciliación en sí.

---

## 9. Consecuencia sobre `selectRubrosForHome` y arquitectura propuesta

### Qué queda obsoleto

`selectRubrosForHome()` tal como existe hoy (`lib/rubroPreferences.ts:49-77`) implementa exactamente el modelo que se descarta: declaradas primero + fill con catálogo activo hasta completar `HOME_RUBRO_COUNT`. La función entera queda **obsoleta como diseño** — no porque el código esté mal escrito, sino porque resuelve el problema equivocado (un solo bloque, siempre lleno).

### Qué es reutilizable sin cambios

- `getDeclaredActivePreferences(userId)` — lectura pura de filas `DECLARED`/`ACTIVE`, sigue siendo exactamente la fuente de candidatos del Bloque A.
- `getActiveHomeRubroIds()` — sigue siendo la autoridad de habilitación global, aplica a ambos bloques.
- `RUBRO_CATALOG` / `RubroConfig` (`lib/rubroCatalog.ts`) — universo visual y `categorySlugs` por rubro, necesario para ambos bloques y además candidato natural para representar afinidad Nivel 1 en el futuro (`categorySlugs` ya conecta rubro↔categorías reales, ver §10).
- `HOME_RUBRO_COUNT` — se mantiene como techo de capacidad del Bloque A (no cambia de valor, cambia de interpretación: de "objetivo a llenar" a "máximo a no exceder").
- El contrato `HomeDecisionPayload`/`RubroSlot` (`lib/homeDecisionContract.ts`) — ya es genérico (array de `RubroSlot`, cada uno con `status: 'ok' | 'empty'` y su propio `reason`), no asume "siempre 5 llenos". No requiere cambio de forma para soportar un segundo array de slots — ver más abajo.
- La reconciliación `DECLARED`/`INFERRED`/`SUPPRESSED` completa (§8).
- El flujo de guardado explícito (§6).

### Qué es reutilizable con modificación

- `selectRubrosForHome` se divide conceptualmente en dos responsabilidades que hoy están fusionadas en una función: **(1) resolver el universo declarado** (ya lo hace `getDeclaredActivePreferences` + `getActiveHomeRubroIds`, sin cambios) y **(2) seleccionar hasta N candidatos calificables dentro de ese universo** — esta segunda responsabilidad hoy no existe como tal (hoy es solo "primero declaradas en orden de catálogo, después fill"); pasa a ser trabajo del Decision Engine, no de `rubroPreferences.ts`, porque requiere evaluar calidad de oportunidad (dato que `rubroPreferences.ts` no tiene — es explícitamente "sin I/O de promos", ver cabecera del archivo).
- `RubroSlotEmptyReason` (`homeDecisionContract.ts:92-96`) — hoy tiene `'sin_candidatos' | 'bajo_confianza' | 'perfil_incompleto'`. Sigue sirviendo para el Bloque A tal cual. Puede necesitar un valor adicional si el Bloque B quiere distinguir "sin candidatos de afinidad" de "sin candidatos de descubrimiento" — a definir cuando se diseñe el Bloque B en detalle, no ahora.

### Qué es trabajo nuevo (no existe hoy, ni reutilizable ni modificable porque no hay antecedente)

- Candidate-building del Bloque B completo: ni la fuente de afinidad Nivel 1, ni el umbral de excepcionalidad Nivel 2, ni la función que los combine, existen en el código actual.
- El contrato de estabilidad para el caso de 8-10 declarados con solo 5 slots (§3, "Estabilidad").
- La definición formal de afinidad (§10) — sin esto, el Bloque B Nivel 1 no tiene fuente de candidatos.

### Arquitectura conceptual propuesta (sin implementar)

1. `rubroPreferences.ts` resuelve el universo `DECLARED` (ya existe, sin cambios).
2. El Decision Engine evalúa oportunidades **dentro de ese universo** y selecciona hasta `HOME_RUBRO_COUNT` rubros/oportunidades calificables → esto llena `rubros` del payload para el Bloque A.
3. Un proceso separado (nuevo) construye candidatos para el Bloque B a partir de afinidad + descubrimiento excepcional, evaluado por el mismo Decision Engine (mismo concepto de "candidato calificable", distinta fuente).
4. Ambos bloques permanecen semánticamente diferenciados en el payload — la forma más simple, dado que `HomeDecisionPayload.rubros: RubroSlot[]` ya es un array de slots sin asumir tamaño fijo, es agregar un segundo array (ej. `rubros: RubroSlot[]` para Bloque A, `descubrimiento: RubroSlot[]` para Bloque B) en vez de mezclar ambos en un solo array con un flag por elemento — mantiene la separación visible también a nivel de contrato, no solo de UI. **No se implementa este cambio de contrato en esta etapa** — se deja como dirección propuesta.

---

## 10. Afinidad — no se inventa todavía

No se hardcodea ninguna relación (ej. `gastronomia → heladerias`) a partir de los ejemplos usados en este documento — son ilustrativos, no una decisión de producto.

Antes de definir el mecanismo de afinidad, hace falta revisar:

- El catálogo real de rubros y sus `categorySlugs` (`lib/rubroCatalog.ts`) — ya existe un mapeo rubro→categorías reales de la DB, posible base para afinidad rubro→categoría.
- Las categorías/slugs reales disponibles (21 categorías activas en DB, ver comentario en `rubroCatalog.ts:10-12`).
- Señales existentes en el Decision Engine (`lib/decisionEngineV2.ts`) — hay que confirmar si ya existe alguna noción de proximidad entre categorías/rubros antes de asumir que hace falta construirla de cero.
- RFC-006/007/008 y el modelo de inferencia ya aprobado — para no crear un segundo recomendador paralelo si la inferencia (`INFERRED`, hoy sin escritor) ya estaba pensada para cubrir parte de este rol.

La pregunta de si la afinidad debe representarse rubro→rubro, rubro→categoría, categoría→categoría, por scoring, o de otra forma, **queda abierta** — no se resuelve en este documento.

---

## Resumen — comparación con el modelo anterior

| | v2 (descartado en este punto) | v3 (vigente) |
|---|---|---|
| Con 2 declarados | Home muestra 5 (2 reales + 3 default, sin distinguir) | "Tus rubros" muestra 2. "También te podría interesar" cubre el resto, marcado como tal |
| Con 8 declarados | Prioridad por orden de catálogo (Opción A) o por favoritos manuales (Opción B3) | Los 8 tienen igual autoridad; el Decision Engine elige hasta 5 por calidad de oportunidad, sin favoritos ni orden de catálogo como criterio |
| Recomendación de cantidad | "Entre 3 y 5" | Ninguna — selección libre 0 a 10 |
| Rol de los defaults | Rellenan "Tus rubros" cuando faltan declarados | Cold-start de "También te podría interesar" con 0 declarados; no rellenan nunca "Tus rubros" |
| Favoritos/estrellas | B3 los proponía para desempate | Descartados — no hay desempate manual, el Decision Engine decide por calidad de oportunidad |

---

## DECISIONES YA CERRADAS

1. "Tus rubros" y "También te podría interesar" son dos bloques conceptual y visualmente separados — no se mezclan en una sola grilla sin distinción.
2. `DECLARED` = "me interesa", nunca "prioridad de relleno". `NOT DECLARED != NOT INTERESTED`.
3. "Tus rubros" nunca se completa automáticamente con defaults para llegar a una cantidad fija. La cantidad de slots visibles es capacidad de UI, no obligación editorial.
4. Con más de `HOME_RUBRO_COUNT` declarados, todos conservan igual autoridad `DECLARED` — no hay prioridad manual (B3 descartado), no hay desempate por orden de catálogo (Opción A descartada como mecanismo de producto, aunque puede sobrevivir como fallback técnico interno si hace falta un criterio determinista de último recurso — a confirmar cuando se diseñe la estabilidad, §3).
5. El Decision Engine decide, dentro del universo declarado, cuáles de esos rubros tienen oportunidad calificable hoy y cuáles de esos ocupan los slots disponibles.
6. Se elimina la recomendación "elegí entre 3 y 5" — selección libre 0 a universo completo, sin sugerencia de rango.
7. Los defaults pasan a ser estrategia de cold-start del Bloque B (0 declarados), no mecanismo de relleno del Bloque A.
8. Se mantiene sin cambios la reconciliación `DECLARED`/`INFERRED`/`SUPPRESSED` de v2 — revisada contra esta arquitectura, sin contradicción encontrada (§8).
9. Se mantiene sin cambios el flujo de guardado explícito de v2 (§6).
10. `selectRubrosForHome` en su forma actual queda obsoleto como diseño — su responsabilidad se divide entre lectura de universo declarado (sin cambios, en `rubroPreferences.ts`) y selección por calidad de oportunidad (nueva responsabilidad del Decision Engine).
11. La afinidad (Bloque B, Nivel 1) no se hardcodea a partir de los ejemplos de este documento — requiere revisión del catálogo y modelo de inferencia real antes de definirse.

## DECISIONES QUE TODAVÍA REQUIEREN CPO

1. **Contrato de estabilidad** (§3) para el caso de 8-10 declarados con solo 5 slots — cómo evitar que cambios mínimos de score muevan rubros dentro y fuera del Bloque A de un día a otro. No se define el mecanismo (histéresis, cooldown, ventana mínima de score) en este documento — requiere decisión de producto antes de implementar.
2. **Máximo de elementos del Bloque B** — no se fija un número en este documento. Requiere definición explícita.
3. **Definición formal de afinidad** (§10) — rubro→rubro, rubro→categoría, categoría→categoría, por scoring o por tabla explícita. Requiere revisar el modelo de inferencia ya aprobado antes de decidir si esto es una extensión de `INFERRED` o un mecanismo nuevo y separado.
4. **Umbral de "oportunidad excepcional"** para el Nivel 2 del Bloque B (descubrimiento sin afinidad) — cuánto más alto que el umbral estándar, y cómo se calibra sin hardcodear un número arbitrario.
5. **Estado con 0 declarados**: ¿el Bloque A se oculta completamente, o se muestra vacío con CTA a declarar? (§3, fila "0")
6. **Cambio de contrato `HomeDecisionPayload`** (§9, arquitectura propuesta) — ¿agregar un segundo array (`descubrimiento: RubroSlot[]`) junto a `rubros: RubroSlot[]`, o alguna otra forma de representar los dos bloques en el payload? Se deja como dirección propuesta, no decidida.
7. ¿El fallback determinista por orden de catálogo (Opción A de v2) sobrevive como mecanismo técnico interno de último recurso dentro del contrato de estabilidad (§3, decisión cerrada #4), o se elimina también como implementación aunque ya no sea la política de producto?
