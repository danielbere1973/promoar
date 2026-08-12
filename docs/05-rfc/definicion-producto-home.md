# Definición de Producto — Qué es la Home de PromoAR

**Fecha**: 2026-08-11 (v3 — APROBADA por CPO, cierre de etapa)
**Estado**: **Aprobada.** Documento de producto cerrado — no se vuelve a abrir salvo
evidencia nueva de producción. A partir de acá, el esfuerzo se concentra en
implementación (ver Roadmap, §4).
**Pedido por**: CEO/CPO, "CPO Direction — Stop & Product Definition".
**Regla de esta etapa**: nada de lo que sigue habilita implementación por sí solo. Es
la definición que, una vez aprobada, hace que UI/roadmap/implementación salgan
derivados de acá, no al revés.

**Historial de versiones**:
- **v1**: aprobada conceptualmente en las 4 secciones. §1 (decisión de ahorro) y §3
  (perfil de intereses no bloquea lanzamiento) quedan ratificadas sin cambios.
- **v2**: el CPO observó que una cantidad 100% variable de decisiones (§2 v1) puede
  hacer que la Home "salte" de forma impredecible de un día a otro. Reescribe §2 para
  separar el **contrato visual** (estable, fijo) de la **exigencia de calidad**
  (estricta, nunca rellena). En la ronda de definición del contrato, el CPO tomó una
  posición adicional: el nivel que organiza ese contrato no es la promoción
  individual, es el **rubro** — ver nota en §2.3. Esto no cambia §1 (la promoción
  sigue siendo la unidad accionable, la que efectivamente se usa), pero sí agrega un
  nivel de agrupación por encima que §1 v1 no contemplaba explícitamente.
- **v3 (esta) — CPO Review, APROBADA**: §1, §2 (contrato visual + estado vacío
  explícito) y §3 aprobadas sin cambios de fondo. Única corrección: el número **5**
  de §2 se redacta como **hipótesis inicial de implementación**, no como constante
  permanente — el contrato visual en sí (rubros fijos, contenido variable, slot
  vacío explícito) es la parte permanente de la decisión; cuántos rubros entran es
  un parámetro sujeto a revisión con evidencia real de uso, no una verdad cerrada
  por este documento. Cierre de etapa: el CPO no invertirá más tiempo iterando este
  documento salvo que aparezca evidencia nueva en producción.

---

## 1. ¿Cuál es la unidad principal de la Home?

**Una decisión de ahorro.**

No una promoción, no un rubro. Justificación:

- **No es "una promoción"** porque una promoción es el dato crudo — existe igual en
  el Catálogo. Si la Home solo mostrara la promo con mejor %, sería una vidriera de
  ofertas, y eso ya lo demostró el propio Recommendation Block v1: el Top-3 por
  descuento nominal trajo Rappi/Cabify/Glow Up a un usuario que no usa ninguno de
  los tres. Una promoción sin el razonamiento de por qué importa para este usuario
  es indistinguible de cualquier fila del Catálogo — no justifica que la Home exista
  como experiencia separada.

- **No es "un rubro"** porque un rubro es una categoría de agrupación, no algo
  accionable. "Supermercados" no es una decisión — es un contenedor. El usuario no
  entra a la Home a explorar rubros (eso es exactamente lo que el Catálogo ya
  resuelve, por diseño, según la decisión ya tomada de que "Home y Catálogo son
  experiencias distintas"). Si la Home organizara por rubro, se convertiría en un
  Catálogo con otro layout — colisiona con la decisión ya tomada, no la respeta.

- **Es "una decisión de ahorro"** porque es la única unidad que obliga a que exista
  todo lo que ya está construido y aprobado: el gate financiero (¿puede pagarla?),
  RFC-006/RFC-007 (¿le importa el rubro?), `buildReasons()` (¿por qué esta y no
  otra?). Una decisión de ahorro es el paquete completo — promoción + por qué se le
  muestra a este usuario en particular — presentado de forma que la única acción
  esperada del usuario sea "sí, la uso" o "no, seguí mostrándome otra cosa". Es lo
  que la Home "toma decisiones por el usuario" (decisión ya tomada) significa en
  la práctica: no le muestra inventario, le muestra una conclusión ya razonada.

La prueba de que esta es la unidad correcta: es la única de las tres que necesita el
Recommendation Engine para existir. Si "rubro" o "promoción" fueran la unidad, gran
parte de RFC-006/RFC-007/el spike ya validado sería trabajo de más. Con "decisión de
ahorro" como unidad, todo ese trabajo es la unidad misma.

**Nota v2 — matización, no contradicción**: §2 introduce el rubro como nivel de
*agrupación visual* del contrato de la Home. Esto no reabre esta sección: el rubro
sigue sin ser accionable por sí solo (nadie "usa" un rubro), solo organiza en qué
orden y bajo qué encabezado se presentan las decisiones de ahorro reales. La unidad
que el usuario efectivamente consume — la que tiene razón (`buildReasons()`), gate
financiero y afinidad — sigue siendo la promoción individual dentro de cada rubro.
Ver §2.3.

---

## 2. ¿Cuántas oportunidades debería mostrar la Home?

**Contrato visual fijo, contenido variable.** La Home tiene una estructura estable
de **hasta N rubros prioritarios para ese usuario** (hipótesis inicial de
implementación: N=5, ver nota más abajo), siempre en el mismo lugar, con el mismo
orden de aparición día a día — y dentro de cada rubro, tantas decisiones de ahorro
como el sistema pueda defender con confianza, nunca rellenadas por completar un
cupo.

**Qué es permanente y qué no (CPO Review v3)**: lo que este documento fija como
decisión de producto es la *forma* del contrato — rubros fijos en cantidad y
posición, contenido interno variable, slot vacío explícito cuando no hay calidad
suficiente. El valor concreto de N (5) es un punto de partida razonable, no una
constante cerrada — queda sujeto a revisión cuando exista evidencia real de uso en
producción (ej. si los usuarios interactúan con los primeros 3 rubros y nunca
llegan al 5º, o si 5 se queda corto para perfiles con mucha diversidad de gasto).
Cambiar N más adelante es un ajuste de parámetro, no reabre esta definición de
producto.

Esto reemplaza el enfoque de v1 de este documento (cantidad de *promociones*
totalmente variable, sin techo estructural), que el CPO observó que podía hacer que
la Home "saltara" de forma impredecible de un día a otro. La solución no es fijar la
cantidad de promociones — es fijar la cantidad de **rubros**, y dejar la exigencia de
calidad intacta puertas adentro de cada uno.

### 2.1 Por qué el contrato se fija en el rubro, no en la promoción

Fijar el número de *promociones* (ej. "siempre exactamente N tarjetas") fuerza una
disyuntiva falsa: o se rellena con la 4ª/5ª mejor opción de un pool chico (lo que ya
se descartó en v1 — "no rellenar con relleno de baja calidad"), o el layout cambia de
tamaño día a día (lo que preocupa en esta revisión). Fijar el número de *rubros* con
contenido interno variable resuelve ambas al mismo tiempo: el usuario ve la misma
estructura ("tus áreas de ahorro") todos los días, mientras que la cantidad de
oportunidades dentro de cada área sigue gobernada solo por calidad, sin ningún piso
artificial. Si Supermercados tiene dos decisiones de ahorro excelentes ese día, se
muestran las dos — ocultar la segunda solo para no romper un cupo de "una promoción
por rubro" perdería información real sin ninguna razón de calidad que lo justifique.

### 2.2 El rubro como nivel de agrupación, la promoción como unidad de valor

Esto no reemplaza la respuesta de §1. Cada rubro no es una tarjeta de rubro genérica
("Supermercados: mirá el catálogo") — es un encabezado que agrupa 1 o más decisiones
de ahorro reales, cada una con su propio gate financiero, afinidad y razón
(`buildReasons()`), exactamente como se definió en §1. El rubro ordena y da contexto;
la promoción sigue siendo lo único que el usuario efectivamente puede usar.

Qué determina *cuáles* rubros aparecen (y en qué orden) es exactamente lo que
`scoreAfinidad` y la Dimensión A de necesidad de RFC-007 §5.1 ya calculan por
usuario — no hace falta ningún mecanismo nuevo. El contrato visual de esta sección
consume el mismo output que ya existe; solo cambia el nivel al que se agrupa antes
de renderizar.

### 2.3 Slots sin contenido suficiente: vacío explícito, no relleno ni colapso

Si para un usuario dado el sistema no logra construir N rubros con al menos una
decisión de confianza suficiente, los rubros faltantes **no se ocultan ni colapsan
el layout** — se muestran como un espacio con estado explícito ("sin oportunidad
destacada en este rubro hoy" o equivalente). La estructura de N posiciones se
mantiene siempre visible; lo que varía es cuánto contenido tiene cada una.

Esta decisión es consistente con el mismo principio que ya rechazó el relleno en
§2.1: un slot vacío es información honesta (el sistema es selectivo, no que algo
falló), mientras que ocultarlo generaría exactamente la inestabilidad visual día a
día que motivó esta revisión — un layout que a veces tiene N bloques y a veces menos,
sin ninguna estructura fija, es el problema original disfrazado a nivel rubro en vez
de nivel promoción.

### 2.4 Dentro de cada rubro, el criterio de v1 se mantiene sin cambios

El piso (gate financiero) y la exigencia de "nunca rellenar por completar cupo") de
la v1 de esta sección siguen aplicando **dentro** de cada rubro, sin modificación:
la cantidad de decisiones de ahorro mostradas en "Supermercados" ese día depende
solo de cuántas superan el umbral de confianza, nunca de un número fijo a completar.
Lo único que esta revisión cambia es que ese criterio ahora opera puertas adentro de
un contrato visual estable de N rubros, en vez de gobernar directamente el tamaño
total del layout.

En una frase: **la Home siempre muestra la misma estructura de hasta N rubros
prioritarios para ese usuario (N=5 como hipótesis inicial, sujeta a revisión con
evidencia real de uso); dentro de cada uno, tantas decisiones de ahorro como
el sistema pueda defender con confianza — nunca menos rubros visibles por no tener
contenido (se muestran vacíos, explícitos), nunca más promociones por rubro de las
que la calidad sostiene.**

---

## 3. ¿Qué rol juega el perfil de intereses?

**Posición: la Home sale primero con el modelo por defecto (Dimensión A de
necesidad, RFC-007 §5.1) — el perfil de intereses no es requisito de lanzamiento.**

### Por qué

El propio spike (ya corrido, ya con evidencia) es la prueba de que el default por
necesidad, solo, ya produce mejoras defendibles: 17 casos de "cotidiano vence a
flashy de baja utilidad" en 9 perfiles, sin ningún caso de empeoramiento evidente,
**sin que ningún perfil evaluado tuviera preferencia declarada o inferida real** —
todos corrieron en modo default puro, exactamente como correría el día 1 de
lanzamiento sin onboarding de preferencias.

Esto no es una suposición sobre el costo de esperar — es el resultado medido de la
única corrida real que existe hoy. El sistema ya demostró que resuelve el problema
que motivó todo esto (Rappi/Cabify/Glow Up ganando por descuento nominal a un
usuario al que no le interesan) sin el perfil de intereses. El perfil de intereses
mejora sobre esa base — no la habilita.

### Costo de retrabajo de cada alternativa

**Alternativa A — Home sale con default, perfil de intereses después (recomendada):**
- Costo de retrabajo: ninguno estructural. RFC-007 §1-§2 ya diseñó la jerarquía de
  precedencia (declarada > inferida > default) para que agregar declarada e inferida
  más adelante sea *sumar una fuente al vector existente*, no rediseñar el modelo.
  El "Default" no es un parche temporal — es una de las tres fuentes contempladas
  desde el diseño original, con estatus permanente en el sistema (sigue existiendo
  incluso después de que declarada/inferida existan, para usuarios nuevos o que
  saltearon el onboarding).
- Lo único que cambia cuando el perfil de intereses se implemente es *qué alimenta*
  el factor `scoreAfinidad` para ese usuario puntual — el punto de entrada al
  `scorePromo` ya está definido, el rango 0-1 ya está definido, la regla de que
  nunca es gate ya está definida. No hay migración de datos ni cambio de contrato.

**Alternativa B — esperar a tener el perfil de intereses implementado antes de lanzar:**
- Costo de retrabajo: no hay retrabajo técnico (es el mismo sistema, construido en
  el mismo orden), pero hay un costo de oportunidad que sí es real y medible: la
  Home queda sin salir mientras se construye un onboarding completo (RFC-006 §3),
  su UI, el mecanismo de aprendizaje por comportamiento (RFC-006 §6, RFC-007 §8, con
  umbrales que el propio RFC-007 dice explícitamente que "quedan para calibrar con
  datos reales de uso" — es decir, no se pueden cerrar bien *sin* usuarios reales
  usando el sistema ya en producción). Es una dependencia circular: para calibrar
  bien la inferencia hace falta comportamiento real, y el comportamiento real solo
  existe si la Home ya está en producción.

**Conclusión**: A dispara antes y no genera deuda técnica — el modelo fue diseñado
en tres capas exactamente para este caso. B no reduce riesgo técnico (el diseño ya
resolvió eso) y sí introduce una dependencia circular que solo se resuelve mal
(calibrar sin datos) o tarde (esperar datos que solo llegan si ya se lanzó). No hay
ninguna ganancia de B que compense el costo de tiempo.

---

## 4. Roadmap (máximo 5 pasos, cierra esta etapa)

**Estado (CPO Review v3, aprobado)**: la definición de producto está cerrada. El
esfuerzo se concentra ahora en tres frentes de implementación: (1) Decision Engine
nuevo vía DR-001, (2) diseño visual definitivo de la Home, (3) onboarding de
intereses (RFC-006) como evolución posterior al lanzamiento. Este documento no se
reabre salvo evidencia nueva de producción.

1. **Aprobación de esta definición de producto** (este documento) — **DONE**, cierra
   la pregunta "qué es la Home", habilita todo lo siguiente sin volver a abrirla.

2. **Revisión puntual de DR-001** para incorporar `scoreAfinidad` con Dimensión A de
   necesidad (default puro, sin onboarding) a `lib/decisionEngine.ts` — el único
   cambio de código que este roadmap habilita en esta etapa, ya validado por el
   spike, ya con diseño técnico cerrado en RFC-007 §1-§6.

3. **Definir el criterio operativo del punto 2** (agrupación por rubro con
   contrato fijo de hasta N posiciones — N=5 como hipótesis inicial, ver §2 —,
   estado vacío explícito por rubro sin contenido de confianza suficiente, umbral
   de confianza dentro de cada rubro) como parámetros concretos de implementación —
   deriva directo de la sección 2 de este documento, sin volver a discutir
   producto. Incluye el diseño visual definitivo de la Home sobre este contrato.

4. **Salida de la Home nueva a producción** con el modelo default — sin onboarding
   de intereses, sin perfil de preferencias. Es el lanzamiento real, no un
   prototipo más.

5. **Instrumentar y esperar señal real de uso** antes de retomar RFC-006
   (onboarding de preferencias declaradas) — el paso 4 es lo que genera los datos de
   comportamiento que RFC-007 §8 necesita para calibrar inferencia con evidencia en
   vez de suposición, y también la evidencia que podría ajustar N (§2). Retomar
   RFC-006 es, a propósito, el primer ítem del *próximo* ciclo, no de este.

No se abren proyectos nuevos: los pasos 2-3 ya tienen diseño técnico aprobado
(RFC-007), el spike ya corrió, no falta investigación — falta la decisión de
producto que este documento pide cerrar.
