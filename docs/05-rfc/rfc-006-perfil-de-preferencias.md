# RFC-006 — Perfil de Preferencias (Recommendation Model v2)

**Fecha**: 2026-08-10
**Estado**: Propuesta — solo modelo de producto, sin implementar
**Deriva de**: Validación manual de Recommendation Block v1 (Home v2) — Top-3 real
mostró Rappi / Cabify / Glow Up a un usuario que no usa ninguno de los tres.
**Owner**: CPO (dirección de producto) / CTO (este documento + diseño técnico futuro)
**No tocar**: `lib/decisionEngine.ts` sigue congelado por DR-001. Este RFC no
implementa nada — es el documento que, una vez aprobado, habilita una revisión
puntual de DR-001 para agregar un factor nuevo.

## 1. Qué reveló la validación

El Top-3 de un usuario real (perfil financiero: 9 bancos, 8 billeteras, prácticamente
cobertura total) devolvió Rappi, Cabify y Glow Up. Las tres promos son financieramente
compatibles — el gate hizo su trabajo. Ninguna de las tres le interesa al usuario.

Causa raíz: **el perfil financiero amplio no es señal de interés**. Es señal de
capacidad de pago. Un usuario que cargó 9 bancos no usa 9 bancos activamente — cargó
todos los que tiene para no perderse nada. Cuantas más entidades tenga cargadas, más
grande es el pool de "compatible", y sin una segunda dimensión que filtre por interés,
el ranking queda a merced de cuál promo tiene mejor % o mejor cobertura horaria, sin
relación con si el rubro le importa al usuario.

Esto no es un bug de matching. Es una pieza de conocimiento del usuario que nunca
existió: **dónde quiere ahorrar**, separado de **con qué puede pagar**.

## 2. Qué significa una recomendación relevante

Una recomendación relevante no es la promo de mayor descuento entre las compatibles.
Es la promo que el usuario reconoce como "esto es para mí" en el primer segundo de
verla. Dos usuarios con el mismo perfil financiero pueden tener Top-3 completamente
distintos si uno prioriza el super y el otro prioriza combustible — hoy el sistema no
puede producir esa diferencia porque no sabe que existe.

La relevancia tiene dos condiciones, no una:
1. **Puede usarla** (perfil financiero — ya resuelto, gate duro).
2. **Le importa** (perfil de preferencias — no existe, este RFC lo propone).

Ambas son necesarias. Ninguna es suficiente por sí sola. Un descuento altísimo en un
rubro irrelevante sigue siendo irrelevante; un rubro de interés sin medio de pago
compatible no es usable. El modelo actual solo resuelve la primera.

## 3. Onboarding de preferencias

### 3.1 Formato

Selección múltiple de categorías, mismo lenguaje visual que ya existe en
`CategorySheet.tsx` (grid de categorías, multi-select) — no es un concepto nuevo de
UI, es reutilizar un patrón que el usuario ya conoce de otra parte de la app.

Un solo paso. Sin ranking de prioridad entre las elegidas, sin escalas de intensidad
("¿cuánto te interesa X?"), sin preguntas abiertas. La razón para mantenerlo así de
plano está en el punto 4: cualquier pregunta que pida al usuario que se autoevalúe con
precisión (ranquear, puntuar) tiene un costo de fricción que no se traduce en mejor
señal, porque el usuario no tiene forma de calibrar esos números de forma consistente.

### 3.2 Cuándo se pide

**Estado**: cerrado — "CPO Direction — Integración del Perfil de Intereses"
(11/8/2026). Reemplaza la propuesta preliminar original de esta sección (pedirlo en
el primer ingreso a la Home, antes del primer Top-3), descartada por contradecir el
principio rector: el usuario debe ver valor antes de que se le pida invertir en
calibrar el sistema.

No en el registro. El registro ya compite por atención con el perfil financiero, que
es el gate duro — agregar un segundo formulario ahí multiplica el abandono sin
necesidad, porque el sistema puede funcionar (con degradación aceptable, ver punto 4)
sin este dato.

**No en el primer ingreso a la Home tampoco.** La Home nueva sale primero con el
modelo default (ver `definicion-producto-home.md` §3, ya aprobado) — el usuario debe
experimentar ese default y percibir que funciona antes de que se le pida ayudar a
afinarlo. El onboarding de preferencias es, a nivel de producto, una mejora sobre un
sistema que ya demostró valor — nunca un requisito previo a percibirlo.

**Camino principal — disparo por valor percibido**: la invitación aparece después de
la **primera sesión en la que PromoAR tenga evidencia razonable de que el usuario
consumió una Home con contenido útil**. Deliberadamente a este nivel de abstracción:
qué combinación de señales constituye "evidencia razonable" (tiempo de lectura,
visibilidad de la card, scroll, apertura de detalle, favoritos, click al comercio,
etc.) es una decisión de implementación, calibrable con telemetría real, y no forma
parte del contrato de producto — puede ajustarse sin volver a abrir esta sección.
Interactuar con una recomendación (click, favorito, ir al comercio) es evidencia
suficiente por sí sola cuando ocurre, pero no es el único camino: un usuario puede
percibir valor con solo leer la Home, sin necesitar actuar todavía, y ese caso debe
seguir contando.

**Camino de rescate — sin sesión exitosa**: si después de un número de sesiones o de
días definido en implementación el usuario nunca tuvo una sesión considerada
exitosa (ej. recibe slots vacíos con frecuencia, o abandona muy rápido siempre), el
sistema **no debe quedar en silencio indefinidamente**. Se muestra la invitación de
todas formas, encuadrada como hipótesis de mejora ("Ayudanos a personalizar mejor
tus recomendaciones") en vez de como consecuencia de valor ya demostrado — este es
justamente el perfil de usuario que el modelo default puede estar sirviendo peor, y
por lo tanto quien más se beneficia de aportar contexto declarado.

**Forma de la invitación**: superficie contextual dentro del flujo normal de uso, no
un modal ni una pantalla interruptiva. El copy debe declarar el motivo en la misma
frase que pide la acción (ej. "¿Querés que prioricemos más de esto?"), conectando la
pregunta con algo que el usuario acaba de experimentar — no un trámite de
configuración separado del value prop.

Debe ser saltable y dismissible sin fricción (un tap para cerrar, sin flujo de
confirmación). Un usuario que lo saltea entra al camino de pesos default (punto 4) —
nunca queda bloqueado. No debe reaparecer en cada sesión tras ser descartada una vez;
solo el camino de rescate la reintroduce, y como evento único, no como reintento
recurrente.

### 3.3 Qué se pregunta

Las categorías ya existentes del catálogo (las 19 + Sin Categoría) son demasiadas
para un onboarding de un paso — pedir que alguien evalúe 19 opciones en la primera
sesión es fricción, no señal. Se reduce a un subconjunto curado de 8-10 categorías de
alto reconocimiento inmediato (supermercados, combustible, farmacias, gastronomía,
indumentaria, tecnología, entretenimiento, viajes — a definir el corte exacto con
datos de volumen de promos por categoría), con una opción "más categorías" que
despliega el resto para quien quiera ser más específico. Nadie debe sentir que la
opción que buscaba no estaba.

## 4. Qué información aporta valor (y qué no)

**Aporta valor:**
- Selección de categorías de interés (el onboarding en sí).
- Señales de comportamiento ya existentes en la app y hoy no usadas para esto:
  favoritos guardados, promos abiertas (detalle visto), clicks a "ir al comercio". Son
  gratis — ya se generan, solo falta conectarlos al modelo de preferencia.
- Categoría del comercio en cada una de esas interacciones (no el comercio puntual —
  la categoría es la unidad que generaliza; saber que a alguien le gustó Coto es
  útil para todo el rubro supermercados, no solo para volver a mostrar Coto).

**No vale la pena preguntar:**
- Marca/comercio específico dentro de una categoría ("¿te interesa Coto o Carrefour?")
  — la granularidad correcta para declarar interés es categoría, no comercio. El
  comercio puntual se resuelve solo, vía las señales de comportamiento del punto
  anterior, sin pedírselo al usuario.
- Rango de gasto o frecuencia de compra por categoría — es el tipo de pregunta que
  suena útil en abstracto pero que el usuario no puede responder con precisión sin
  pensarlo (¿"con qué frecuencia" comprás indumentaria? depende de la temporada, del
  año), y un dato ruidoso pesa igual o peor que no tener el dato.
- Ubicación/sucursal preferida en este onboarding — ya existe un mecanismo aparte
  (selector de provincia + `CommerceBranch`, ver pendiente #10 del proyecto) que
  resuelve esto mejor, con datos reales de sucursal en vez de una declaración vaga.
- Negativos explícitos ("no me interesa X") — agregan una categoría de UI (positivo /
  negativo / neutro) por un beneficio marginal: no declarar una categoría ya la deja
  fuera de las priorizadas. El caso real que un negativo explícito resolvería mejor
  que "no seleccionar" es raro y no justifica la complejidad extra del formulario.

## 5. Pesos iniciales sin preferencias declaradas

Un usuario que no completa el onboarding no puede quedar sin recomendaciones ni con
recomendaciones aleatorias — necesita un default razonable el día 1.

Ese default ya existe en el código, aunque no está formalizado como tal:
`PRIORITY_CAT_SLUGS` en la Home actual (supermercados, combustible, transporte,
gastronomía, farmacias) es, de hecho, una apuesta implícita de "estas son las
categorías de mayor interés general" que ya se usa para ordenar secciones. Es la base
correcta para el peso default — no hace falta inventar un ranking nuevo, hace falta
promoverlo de heurística de layout a heurística de producto explícita, con los pesos
más altos concentrados ahí y el resto de las categorías con peso base uniforme y bajo.

Este default no es "sin preferencia = todas las categorías iguales". Es "sin
preferencia declarada = asumir que probablemente le interesa lo que le interesa a la
mayoría", que es una apuesta con mucho mejor fundamento estadístico que uniforme, y
consistente con lo que la Home ya hace hoy para todos los usuarios sin este feature.

## 6. Evolución automática de los pesos con el uso

Este RFC no define el algoritmo exacto (eso es diseño técnico, fuera de alcance acá),
pero sí el principio: la preferencia declarada es el punto de partida, no el techo. El
comportamiento real debe poder mover el peso de una categoría, en ambas direcciones —
subirlo si el usuario interactúa seguido con una categoría que no declaró, bajarlo si
declaró una categoría y nunca vuelve a tocar nada de ese rubro.

Dos principios de diseño para cuando se aterrice el algoritmo:
- **Lo declarado nunca debe ir a cero por falta de actividad.** Si alguien dijo
  "me interesan viajes" y hace 3 meses no vio ninguna promo de viajes (porque no hubo
  ninguna relevante, no porque perdió el interés), el sistema no tiene forma de
  distinguir "perdió el interés" de "no tuvo oportunidad" — bajar el peso en ese caso
  penalizaría al usuario por algo que no hizo. La preferencia declarada decae, si
  decae, muy lentamente y con piso.
- **Lo inferido por comportamiento puede subir rápido pero también debe poder bajar.**
  Si alguien empieza a clickear mucho en gastronomía sin haberlo declarado, el sistema
  debe poder aprenderlo pronto — pero sin “anclarse” de forma permanente a un pico de
  actividad puntual (ej. buscó restaurantes por un evento único, no es un interés
  sostenido). Ventana de tiempo con decaimiento, no acumulador infinito.

La implementación concreta (ventanas, tasas de decaimiento, umbrales) queda para el
sprint de diseño técnico, una vez aprobado el modelo de producto.

## 7. Integración con el Recommendation Engine sin romper el modelo actual

`decisionEngine.ts` ya separa gates (financiero, geográfico, vigencia) de factores de
score (ahorro, cercanía, online, favoritos) — ver `scoreCandidates` en el código
actual. La integración correcta de este RFC es agregar **un factor de score más**, no
un gate:

- **No es gate.** Un gate bloquea. Si "afinidad de categoría" fuera gate, un usuario
  sin preferencias declaradas y sin historial de comportamiento (usuario nuevo, día 1,
  saltó el onboarding) se quedaría sin ninguna recomendación — exactamente el
  escenario que el punto 5 (pesos default) existe para evitar. Tiene que degradar
  suavemente, nunca bloquear.
- **Convive con los factores actuales, no los reemplaza.** Ahorro sigue importando
  (nadie quiere la promo de su categoría favorita si el descuento es insignificante
  frente a otra opción del mismo rubro). El factor de afinidad multiplica/pesa la
  relevancia del rubro; no decide solo.
- **El gate financiero sigue siendo el primer filtro, sin cambios.** Este RFC no
  toca compatibilidad de pago. Une una segunda dimensión sobre el conjunto que el gate
  ya dejó pasar.

Esto significa que la propuesta técnica futura es: agregar `scoreAfinidad(promo,
preferencesProfile)` a la lista de factores en `scorePromo`, con su propio peso en
`WEIGHTS`, ajustando los pesos existentes para que sigan sumando 1. Ese es el único
punto de contacto con el código congelado por DR-001, y por eso este RFC es el
prerequisito formal para reabrir esa revisión puntual — no para destrabar el freeze en
general.

## 8. Impacto esperado sobre el ranking

Con el mismo pool de candidatas financieramente compatibles, el efecto esperado es que
usuarios con perfiles financieros amplios (como el caso de la validación) dejen de ver
su Top-3 dominado por lo que tiene mejor descuento nominal entre "todo lo que puede
pagar", y empiecen a ver primero lo que además es de un rubro que les importa. El
descuento sigue siendo un desempate fuerte dentro de las categorías relevantes, no
desaparece — cambia el universo sobre el que compite.

Efecto secundario esperado y deseable: las razones causales que ya arma
`buildReasons()` (“Es el mayor ahorro para tus tarjetas”, “Está a X metros tuyo”)
ganan una razón nueva y probablemente la más convincente de todas — algo del estilo
“Es de una categoría que te interesa” — porque es la que más se acerca a explicarle al
usuario *por qué confiar* en la recomendación, que es exactamente el problema que
esta validación puso en evidencia.

## 9. Qué no resuelve este RFC

- No define el algoritmo de decaimiento/ventanas del punto 6 (diseño técnico
  posterior).
- No define el corte exacto de qué 8-10 categorías van en el onboarding corto vs. cuáles
  quedan en "más categorías" (requiere mirar volumen real de promos por categoría antes
  de cerrarlo).
- No toca `CommerceBranch`/filtrado geográfico (RFC/pendiente aparte, punto 10 del
  roadmap del proyecto) — son dimensiones distintas de relevancia (dónde puede ir vs.
  qué le interesa) que conviven pero no se resuelven con el mismo mecanismo.
- No propone cambios de schema, API ni código. Es intencional — el pedido explícito
  fue definir el modelo de producto antes de cualquier implementación.
