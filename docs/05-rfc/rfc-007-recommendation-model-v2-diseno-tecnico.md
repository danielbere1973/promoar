# RFC-007 — Recommendation Model v2: Diseño Técnico

**Fecha**: 2026-08-10 (v3 — aprobado por CPO Review, pasa a validación experimental)
**Estado**: **Aprobado para spike** — modelo conceptual cerrado, pesos numéricos NO
definitivos, pendiente diseño de spike de validación antes de tocar `decisionEngine.ts`
**Deriva de**: RFC-006 (aprobado, con 2 ajustes) — CPO Review
**Owner**: CTO (este documento) / CPO (aprobación antes de tocar DR-001)
**No tocar todavía**: código, schema, `lib/decisionEngine.ts`. La aprobación de este
documento habilita el diseño del spike (§12) — no la implementación permanente, que
sigue requiriendo su propia revisión de DR-001 después de validar el spike.

**Historial de versiones**:
- **v1**: tier default por volumen de inventario — rechazada por CPO (confundía
  cobertura con necesidad).
- **v2**: reescribe §5 separando Dimensión A (necesidad) de Dimensión B (inventario),
  ajusta §9/§10 con los 4 casos pedidos por CPO.
- **v3 (esta)**: aprobada por CPO con 3 correcciones — (1) fix de redacción en §6
  (el default ya no se basa en catálogo), (2) nueva §8.5 sobre aplicabilidad/
  recurrencia de la promoción individual (dimensión futura, sin implementar), (3)
  rename de copy "Petshops"→"Mascotas" en el onboarding (§9). Pesos de §4 aceptados
  solo como hipótesis de spike, no como definitivos. Agrega §12, diseño del spike de
  validación pedido como próximo paso.

## 0. Principio de producto (incorporado por decisión CPO)

> Una promoción con menor descuento pero alta probabilidad de uso puede ser una
> recomendación mejor que una promoción con un descuento nominal extraordinario que
> probablemente el usuario nunca utilice.

El % de descuento deja de ser sinónimo de relevancia. Todo el diseño de abajo — en
particular §3 y §10 — existe para que este principio sea cierto en la práctica, no
solo en la intención.

## 1. Modelo de pesos: tres fuentes, nunca fusionadas en un número ciego

Ajuste 1 del CPO: el sistema debe poder distinguir, para cada categoría y cada
usuario, de dónde salió el peso que está usando. Se modelan como tres campos
separados, no como un único valor que los promedia por adelantado:

| Fuente | Qué es | Confianza | Quién la genera |
|---|---|---|---|
| **Declarada** | El usuario la eligió en el onboarding | Alta desde el día 1 | Usuario, explícito |
| **Inferida** | Comportamiento observado (aperturas, favoritos, clicks, uso repetido) | Crece con volumen de evidencia, nunca arranca en 0 confianza absoluta | Sistema, a partir de eventos |
| **Default** | Hipótesis del producto para cuando no hay ninguna de las dos anteriores | Fija, igual para todos los usuarios sin señal propia | Producto — explícitamente etiquetada como heurística, no como conocimiento del usuario |

Ninguna de las tres pisa a las otras dos silenciosamente. Un usuario puede tener
preferencia **declarada** en "Supermercados" y preferencia **inferida** alta en
"Gastronomía" (nunca lo declaró, pero abre esas promos seguido) al mismo tiempo — el
modelo de combinación (§2) es el que decide cómo conviven, pero el dato de origen no
se pierde en el camino. Esto es lo que permite, more adelante, auditar o explicar
"por qué me recomendaste esto" sin adivinar de dónde salió el número.

## 2. Cómo se combinan las tres señales

Regla de precedencia, no de promedio ciego:

1. **Si existe declarada para esa categoría → es el piso.** No baja por inferencia
   contraria (ver el principio de "nunca borra agresivamente lo declarado", RFC-006 §6,
   ratificado por el CPO). La inferencia puede sumar por encima de ese piso si el
   comportamiento la refuerza, pero no puede hacerla caer por debajo de lo declarado.
2. **Si no existe declarada, pero existe inferida con confianza suficiente → manda la
   inferida.** "Confianza suficiente" es un umbral de volumen de evidencia (ver §8),
   no un solo evento — un click aislado no debe reemplazar el default.
3. **Si no existe ninguna de las dos → manda el default.** Es el único caso en que se
   usa la heurística de producto en estado puro.

Cuando declarada e inferida coexisten para categorías *distintas* (el caso típico:
declaró 3, el sistema fue infiriendo 2 más con el tiempo), ambas conviven en el mismo
perfil de afinidad — no se trata de "una preferencia por usuario", es un vector de
afinidad por categoría, con muchas entradas posibles a la vez.

## 3. Rango y normalización de `scoreAfinidad`

Mismo rango que el resto de los factores en `decisionEngine.ts` — **0 a 1**, para
entrar sin fricción a la fórmula ponderada existente (`scorePromo`). La categoría de
la promo evaluada busca su afinidad en el vector del usuario (§2); si la categoría no
tiene ninguna señal ni siquiera de default (caso borde, categoría fuera del set
curado), cae a un piso bajo pero no cero — cero equivaldría a un gate encubierto,
prohibido por RFC-006 §7.

No se propone en este documento la fórmula exacta de conversión "peso de afinidad" →
"0 a 1" (ej. si es percentil dentro del vector del usuario, o normalización lineal
directa) — es un detalle de implementación que no cambia ninguna decisión de producto
de este RFC y puede resolverse en el sprint de implementación sin volver a pasar por
CPO, siempre que el resultado quede en rango 0-1 y preserve el orden relativo de
categorías del vector.

## 4. Interacción con ahorro, cercanía, online y favoritos

`scoreAfinidad` entra como quinto factor de `scorePromo`, junto a los 4 actuales.
Redistribución de pesos — manteniendo la proporción relativa entre los 4 existentes,
reservando espacio para el nuevo:

| Factor | Peso actual | Peso propuesto v2 |
|---|---|---|
| Ahorro | 0.50 | 0.35 |
| **Afinidad (nuevo)** | — | **0.30** |
| Cercanía | 0.25 | 0.18 |
| Online | 0.15 | 0.11 |
| Favoritos | 0.10 | 0.06 |

Por qué afinidad entra con el segundo peso más alto, no el más bajo: si entrara con
peso simbólico (ej. 0.05-0.10), el problema real detectado en la validación —Rappi/
Cabify/Glow Up ganando por descuento nominal— apenas se movería. El principio de §0
exige que una categoría relevante con descuento modesto pueda ganarle a una categoría
irrelevante con descuento espectacular; eso solo es matemáticamente posible si
afinidad tiene peso comparable a ahorro, no una fracción menor. 0.30 es punto de
partida para validar con casos reales (§10), no un número final — el sprint de
implementación puede ajustar tras medir con datos reales de producción.

Ahorro sigue siendo el factor de mayor peso individual porque dentro de una misma
categoría relevante, el descuento sigue siendo el desempate correcto (ver §10, caso
supermercado vs. farmacia, ambos relevantes).

**Estado de aprobación (CPO Review)**: estos 5 números se aceptan **solo como
hipótesis de entrada para el spike de §12**, no como pesos definitivos. Los ejemplos de
§10 muestran diferencias de score chicas entre el caso ganador y el segundo lugar
(supermercado ~0.57 vs. Cabify ~0.55) — 4 casos ilustrativos dando el orden esperado no
es evidencia suficiente para cerrar la calibración. La validación real ocurre en el
spike, comparando ranking v1 vs. v2 sobre datos de producción, no ajustando estos 4
ejemplos manualmente.

## 5. Pesos iniciales del Decision Engine — dos dimensiones, no una

**Corrección conceptual (CPO Review, corrige la v1 de este documento)**: la versión
anterior de esta sección derivaba el tier default de una categoría casi exclusivamente
del volumen de inventario en dev-promoar, y eso llevó a un error de diseño: Combustible
(167 promos) y Transporte (61 promos) quedaban en tier "Bajo", con el argumento de que
"el sistema casi nunca tiene algo nuevo para mostrar ahí". El CPO rechazó esto de forma
explícita: **la escasez de inventario en una categoría de necesidad no debe traducirse
en menor prioridad — si algo, hace más valioso mostrar lo poco que existe.**

El error de fondo era tratar "cuánto pesa este rubro en la vida del usuario" y "cuánto
inventario tiene PromoAR en este rubro" como si fueran la misma señal. No lo son. Se
separan en dos dimensiones independientes:

### 5.1 Dimensión A — Prioridad base de necesidad

Qué tan ineludible/recurrente es el gasto en ese rubro para un usuario promedio,
**independiente de cuánto catálogo tenga PromoAR**. Es la señal que alimenta el tier
default cuando no hay declarada ni inferida (§2, paso 3).

| Necesidad | Categorías | Razón |
|---|---|---|
| **Alta** | Supermercados, Combustible, Transporte (subte/colectivo — no taxi/Cabify/Uber), Farmacias, Petshops | Gasto recurrente, difícil de evitar o postergar. Si el usuario tiene auto, carga combustible aunque haya 2 promos o 200. Si tiene mascota, la alimenta todos los meses. |
| **Media** | Salud y Belleza, Hogar, Automotores (mantenimiento) | Recurrente pero con más margen de postergar o elegir no gastar. |
| **Discrecional** | Indumentaria, Gastronomía (salidas), Tecnología, Viajes y Turismo, Entretenimiento, Deportes, Jugueterías | Se puede vivir sin, o el gasto es esporádico/planeado, no cotidiano. |

Esta clasificación es una hipótesis de producto inicial — igual que el default lo era
en RFC-006 — sujeta a revisión y a que la preferencia declarada/inferida la pise por
usuario. No se fijan números todavía, solo el orden relativo Alta > Media >
Discrecional, tal como pidió el CPO.

### 5.2 Dimensión B — Disponibilidad / cobertura de inventario

El dato ya relevado de dev-promoar (24.443 promos activas). Se conserva porque es útil,
pero se le acota el uso explícitamente:

| Categoría | Promos activas | Comercios distintos |
|---|---|---|
| Indumentaria | 6.061 | 2.703 |
| Gastronomía | 2.816 | 1.641 |
| Farmacias | 2.505 | 1.332 |
| Hogar | 2.376 | 1.575 |
| Supermercados | 2.262 | 1.053 |
| Salud y Belleza | 1.210 | 640 |
| Viajes y Turismo | 810 | 499 |
| Automotores | 583 | 410 |
| Tecnología | 573 | 273 |
| Entretenimiento | 538 | 418 |
| Deportes | 247 | 177 |
| Petshops | 195 | 114 |
| Combustible | 167 | 69 |
| Transporte | 61 | 22 |

**Uso permitido de esta tabla**: detectar gaps de sourcing (Combustible y Transporte
son objetivamente los rubros con menos scraping/cobertura — señal para priorizar
scrapers nuevos ahí, no para el ranking), medir cobertura por categoría en dashboards
internos, y — a nivel implementación, no de producto — evitar mostrarle al usuario un
"onboarding" que promete una categoría donde hoy no hay casi nada cargado (ver §9).

**Uso explícitamente prohibido**: no entra en el cálculo de `scoreAfinidad` ni del tier
default de §5.1. Un usuario con preferencia default o declarada en Combustible **no**
ve su score de afinidad reducido porque haya solo 167 promos activas en esa categoría —
eso sería, otra vez, confundir cobertura con interés. Si el sistema tiene poco para
mostrarle en Combustible, la solución de producto es conseguir más promos de
Combustible (oportunidad de sourcing, fuera de alcance de este RFC), no bajarle
artificialmente la prioridad a la categoría.

### 5.3 Cómo se combina con el resto del modelo de pesos

El tier default (§5.1) es exactamente el "Default" de la tabla de tres fuentes en §1 —
mismo lugar en la jerarquía de precedencia de §2, mismo estatus de "heurística de
producto, no preferencia real del usuario". Declarada e inferida lo pisan igual que
antes, sin cambios respecto a §1-§2. Lo único que cambió es **de qué está hecho** el
default: antes, inventario; ahora, necesidad.

Tiers cualitativos ("Alta"/"Media"/"Discrecional"), no pesos numéricos exactos — sigue
siendo intencional, para no fijar prematuramente. La conversión tier → número concreto
(§3) es implementación.

## 6. Tratamiento del usuario nuevo (sin declarada, sin inferida)

Usa el default puro (§5.1), tal como diseñó RFC-006 §5. Sin cambios respecto a lo ya
aprobado — se ratifica acá porque ahora el default está basado en una hipótesis de
producto sobre **necesidad del gasto** (Dimensión A, §5.1), no en volumen de catálogo
ni en la heurística de layout original. El catálogo (Dimensión B, §5.2) queda fuera de
este cálculo por completo — solo alimenta sourcing/cobertura, nunca el default.

## 7. Tratamiento del usuario que saltea el onboarding

Idéntico al usuario nuevo en el momento en que lo saltea — usa default. La diferencia
es que este usuario sigue generando eventos de comportamiento normalmente (nadie deja
de ver/abrir/favoritar promos por no haber completado el onboarding), así que con el
tiempo puede acumular preferencia **inferida** igual que cualquier otro usuario, sin
haber declarado nada nunca. El onboarding saltado no es un estado permanente — es
simplemente "sin declarada", y el sistema sigue aprendiendo por el otro canal.

Puede ofrecérsele de nuevo el onboarding más adelante (ej. tras cierto volumen de uso)
sin que sea bloqueante — pero esa reoferta es decisión de UX, fuera de alcance de este
documento.

## 8. Mecanismo conceptual de aprendizaje/decaimiento

Continuación directa de los dos principios ya aprobados en RFC-006 §6, con el detalle
de umbral que faltaba:

- **Declarada**: no decae por ausencia de actividad (RFC-006 §6, ratificado). Solo
  cambia si el usuario la edita explícitamente.
- **Inferida**: se acumula por evento (apertura, favorito, click, uso), con una
  ventana de tiempo que da más peso a actividad reciente que a actividad vieja
  (decaimiento gradual, no un corte duro). Necesita un **umbral mínimo de evidencia**
  antes de poder superar al default para esa categoría — un evento aislado no debe
  mover el ranking; un patrón sostenido sí. El umbral exacto (cuántos eventos, en qué
  ventana) es parámetro de implementación a calibrar con datos reales de uso una vez
  que el sistema esté corriendo — no se fija en este documento.
- Los tres tipos de evento (apertura, favorito, uso confirmado) no valen lo mismo:
  favoritar o confirmar uso son señales más fuertes de interés real que abrir un
  detalle (que puede ser curiosidad o resultado de un scroll). La ponderación relativa
  entre tipos de evento es también parámetro de implementación.

## 8.5. Dimensión futura — aplicabilidad / recurrencia de la promoción (no implementar todavía)

**Agregada por CPO Review tras revisar el ejemplo Cabify/Ezeiza.** La categoría por sí
sola no captura toda la señal de relevancia. "100% de descuento en un traslado único
hacia/desde Ezeiza" no es una mala promoción — es una oportunidad de uso excepcional,
altamente contextual, dirigida a un subconjunto chico de usuarios (los que están
viajando ese día), potencialmente excelente si aplica y poco relevante como
recomendación general el resto del tiempo. El modelo **no debe concluir** "Transporte
privado/Viajes = discrecional = score bajo siempre" — eso sería la misma clase de
simplificación que el error de §5 v1, aplicada ahora a la promoción individual en vez
de a la categoría.

La categoría (§5.1) resuelve una parte del problema: cuánto pesa el *rubro* en general.
Las **condiciones específicas de la promoción** — si es recurrente o de uso único, si
depende de un contexto puntual (un viaje, una fecha, un evento) — pueden modificar
radicalmente su utilidad real para un usuario dado, y hoy el modelo no las distingue.

**Taxonomía conceptual propuesta** (para diferenciar, no para puntuar todavía):
recurrente, periódica, ocasional, de contexto específico, de único uso.

**Explícitamente fuera de alcance de este RFC**:
- No se asume que este dato existe hoy estructurado en la base.
- Antes de incorporarlo al ranking, debe verificarse qué información real entregan los
  scrapers y `sourceText` de cada promo — puede que la recurrencia sea inferible de
  campos existentes (`validDays`, `validFrom`/`validUntil`, texto libre) o puede que no
  esté disponible en absoluto para la mayoría de las promos.
- **No inferir ni inventar recurrencia cuando la fuente no la informa.** Si no hay
  señal confiable, la promoción no debe penalizarse ni premiarse por esta dimensión —
  se comporta igual que si la dimensión no existiera, hasta que haya evidencia de que
  se puede extraer con datos reales.

Esta sección queda registrada como dimensión pendiente de investigación, no como
diseño técnico — la investigación de qué dato real hay disponible es un prerequisito
antes de poder proponer cómo se integraría a `scorePromo`.

## 9. Categorías propuestas para el onboarding corto — necesidad primero, inventario como corrección menor

RFC-006 §3.3 dejaba el corte pendiente. Corregido tras §5: el criterio primario ya no
es volumen de inventario (Dimensión B) — es prioridad de necesidad (Dimensión A), para
que el onboarding le pregunte al usuario por lo que más pesa en su día a día, no por lo
que casualmente tiene más filas en la base. El inventario solo se usa como corrección
menor: si una categoría de necesidad alta tuviera cobertura tan baja que ofrecerla
resultara en "declaraste esto y no te mostramos nada", eso es una señal para el roadmap
de sourcing (§5.2), no una razón para sacarla del onboarding — declarar Combustible
sigue siendo información valiosa aunque hoy haya poco para mostrar, porque ese piso de
"declarada" (§2) queda guardado para cuando el catálogo mejore.

**Onboarding corto (8, necesidad alta y media primero) — aprobado por CPO como
propuesta inicial:**
Supermercados, Combustible, Transporte, Farmacias, Mascotas, Gastronomía, Hogar,
Indumentaria.

**"Más categorías" (resto, discrecionales):**
Salud y Belleza, Tecnología, Viajes y Turismo, Entretenimiento, Automotores, Deportes,
Jugueterías, Librerías, Heladerías, Otras categorías.

**Nota de lenguaje (CPO Review)**: el rubro interno sigue siendo `Petshops` (slug,
modelo de datos, matching de categoría) — pero el label visible en el onboarding debe
decir **"Mascotas"**, más reconocible para un usuario que no necesariamente asocia
"Petshop" con "productos y comida para mi mascota". Es un cambio de copy en la capa de
UI, no de datos.

Cambio respecto a la v1 de este RFC: antes el corte favorecía a Indumentaria/
Gastronomía/Farmacias por tener más promos cargadas; ahora favorece a Supermercados/
Combustible/Transporte/Farmacias/Mascotas por ser gasto cotidiano ineludible, que es lo
que el onboarding necesita capturar primero.

## 10. Ejemplos comparativos — validando el principio de §0 con el modelo corregido

Mismo caso base que la validación real (perfil financiero amplio, sin preferencias
declaradas → corre en modo default puro, Dimensión A de §5.1), con los pesos de §4
(afinidad 0.30, ahorro 0.35, cercanía 0.18, online 0.11), escala 0-1 por factor. Los
4 casos son los que pidió el CPO — incluyen a propósito una promo discrecional con
descuento alto (indumentaria) para mostrar que necesidad alta no es un gate contra ella,
solo una ventaja de partida:

| Caso | Categoría | Necesidad (Dimensión A) | Afinidad (default) | Ahorro (score) | Otros factores | Score aprox. |
|---|---|---|---|---|---|---|
| **1. Cabify 100% a Ezeiza** | Viajes/Movilidad discrecional | Discrecional | Baja (~0.30) | Alto (~1.0 — 100% es tope de escala) | Cercanía 0 (Ezeiza, no vive ahí); Online 1 | 0.30·0.30 + 0.35·1.0 + 0.18·0 + 0.11·1 ≈ **0.55** |
| **2. Supermercado, 20% recurrente** | Supermercados | Alta | Alta (~0.85) | Medio (~0.5 — 20% de 40% máx de escala) | Cercanía alta, sucursal cerca (~0.8); Online 0 | 0.30·0.85 + 0.35·0.5 + 0.18·0.8 + 0.11·0 ≈ **0.573** |
| **3. Combustible, promo menos espectacular pero aplicable (12%, estación cercana)** | Combustible | Alta | Alta (~0.85) | Bajo-medio (~0.3) | Cercanía alta (~0.85); Online 0 | 0.30·0.85 + 0.35·0.3 + 0.18·0.85 + 0.11·0 ≈ **0.51** |
| **4. Indumentaria, gran porcentaje (50%, sin cercanía declarada)** | Indumentaria | Discrecional | Baja (~0.30) | Muy alto (~0.7 — 50% es descuento grande) | Cercanía 0 (no hay sucursal cerca conocida); Online 1 | 0.30·0.30 + 0.35·0.7 + 0.18·0 + 0.11·1 ≈ **0.44** |

**Lectura, caso por caso:**

- **2 le gana a 1**: el supermercado cotidiano (~0.57) supera al Cabify de descuento
  nominal máximo (~0.55) — el resultado central que pedía el principio de §0. Con la
  v1 de este RFC (afinidad basada en inventario) este resultado dependía de que Viajes
  tuviera tier "medio" por volumen de catálogo; con el modelo corregido depende de que
  Movilidad-ocasional sea Dimensión A discrecional — la misma conclusión, pero por la
  razón correcta.
- **3 queda muy cerca de 1 (~0.51 vs ~0.55) con menos de la octava parte del
  descuento** (12% vs 100%): esto es exactamente lo que el CPO pidió poder explicar.
  Combustible tiene solo 167 promos activas en el catálogo (Dimensión B, §5.2) — pero
  eso **no** le bajó la afinidad; su afinidad es Alta (~0.85) igual que Supermercados,
  porque la Dimensión A no mira inventario. Lo que lo separa de 2 no es la categoría,
  es que el descuento del 12% es menor y compite con menos margen.
- **4 queda último (~0.44) a pesar de tener el descuento más alto de los cuatro
  casos (50%)**: la afinidad baja (categoría discrecional, sin declarada) no lo
  descarta — sigue siendo un score competitivo, mayor a cero, puede aparecer en el
  Home — pero no gana. Esto es la prueba de que necesidad alta **no es un gate duro**:
  si el usuario **declarara** preferencia por Indumentaria (compra ropa seguido, lo dijo
  en el onboarding), su afinidad subiría al piso de "declarada" (§2) y este mismo caso
  podría ganarle a 1 y competir con 2 y 3 — el modelo no le cierra la puerta a
  Indumentaria, solo no la asume por default.

Si el usuario **declarara** preferencia por Combustible en vez de dejarlo en default,
el caso 3 subiría más todavía (afinidad al piso de "declarada", por encima de 0.85) y
pasaría a competir de igual a igual con el supermercado — coherente con que Combustible
es, en la vida real, tan cotidiano como Supermercados; lo único que lo frena hoy en el
caso default es el 12% de descuento, no la categoría.

Estos números son ilustrativos con pesos v1 propuestos, no una garantía de resultado
exacto en producción — sirven para mostrar que el modelo, con los pesos de §4-5,
produce el comportamiento que el principio de §0 exige, sin convertir necesidad en un
gate. La calibración fina de pesos reales ocurre en implementación, con datos de uso
real, no en este documento.

## 11. Qué no resuelve este RFC

- Fórmula exacta de normalización de `scoreAfinidad` (§3) — implementación.
- Umbral de evidencia y ponderación por tipo de evento (§8) — implementación,
  calibrado con datos reales de uso.
- Pesos numéricos finales (§4) — aceptados solo como hipótesis de spike (§12), no
  cerrados. La calibración real depende del resultado del spike, no de este documento.
- Aplicabilidad/recurrencia de la promoción individual (§8.5) — dimensión identificada,
  sin diseño técnico ni implementación; requiere primero investigar qué dato real
  entregan los scrapers.
- Onboarding completo y mecanismo de aprendizaje inferido — explícitamente diferidos
  hasta después del spike (§12), no se implementan en esta etapa.
- Cambios permanentes de código, schema o a `lib/decisionEngine.ts`. El spike (§12)
  corre en `feature/nueva-home` / dev-promoar; cualquier cambio permanente a producción
  requiere presentar el resultado del spike y pasar su propia revisión de DR-001.

## 12. Spike de validación — diseño (próximo paso, aprobado por CPO)

**Objetivo**: demostrar, con datos reales, que agregar afinidad + default de necesidad
mejora la relevancia del ranking sin destruir buenas recomendaciones que el modelo v1
ya acierta — antes de invertir en implementación permanente.

**Alcance**: comparación offline de `ranking v1` (el `scorePromo` actual, sin
afinidad) contra `ranking v2` (con `scoreAfinidad` agregado, pesos de §4 como
hipótesis) sobre perfiles reales de usuarios de dev-promoar. No es una feature en
producción — es un script/notebook de comparación, corrido contra `feature/nueva-home`
y la base de dev-promoar exclusivamente.

**Método propuesto** (a confirmar con el CPO antes de correr, según lo pedido):
1. Tomar un conjunto de perfiles financieros reales (o representativos) de
   dev-promoar, con distintas combinaciones de bancos/wallets/redes.
2. Para cada perfil, calcular el pool de promos matcheadas (mismo matching actual,
   sin tocar `/api/promos` ni `matchesProfile`).
3. Rankear ese pool dos veces: una con `scorePromo` v1, otra con v1+afinidad (v2,
   usando el default de necesidad de §5.1 dado que ningún perfil real tiene todavía
   preferencia declarada/inferida — ese dato no existe aún).
4. Generar un diff por perfil: qué promos suben, cuáles bajan, y la razón del cambio
   (qué factor explica el movimiento — típicamente afinidad venciendo a ahorro o
   viceversa).
5. Revisar manualmente los diffs agrupados por categoría, cubriendo específicamente:
   Supermercados, Combustible, Farmacias, Transporte, Mascotas, Gastronomía,
   Indumentaria, Tecnología, Viajes y Turismo, y casos de descuento nominal
   extraordinariamente alto (los "Cabify 100%" reales del catálogo, no solo el
   ejemplo ilustrativo de §10).

**Criterio de éxito** (a validar con el CPO, propuesta inicial): v2 se considera mejor
que v1 si, en la revisión manual de los diffs, las promos que suben de posición son
mayoritariamente relevantes para el perfil/categoría de necesidad del usuario, y las
que bajan son mayoritariamente casos de descuento nominal alto pero baja aplicabilidad
real (poca cercanía, categoría discrecional, uso excepcional) — sin que categorías
enteras desaparezcan del top del ranking por el solo hecho de tener necesidad baja.

**No incluye**: onboarding de preferencias declaradas (RFC-006 §3) ni aprendizaje por
comportamiento inferido (§8) — ambos dependen de datos que hoy no existen en
producción. El spike corre exclusivamente en modo "default puro" (§5.1), que es el
único modo verificable con los datos actuales.

**Entregable del spike**: no es este documento — es un reporte separado (con datos
reales, tabla de diffs, y una recomendación explícita de ir/no ir a implementación)
para presentar al CPO antes de tocar `lib/decisionEngine.ts` de forma permanente.
