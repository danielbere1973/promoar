# Why Users Don't Come Back v1

Responde a "CPO Decision — Financial Match Index" (cierre de esa línea de investigación,
cambio de foco). Documento de producto, no de arquitectura. No propone soluciones — el
objetivo es entender el problema de retención con los datos que existen hoy, y señalar
explícitamente qué no se puede saber todavía porque no lo medimos.

## Qué se pudo medir y qué no

`UserEvent` (`prisma/schema.prisma:123`) es el único registro de comportamiento real que
existe. Se llena vía `POST /api/events`, invocado desde `PromosClient.tsx` en puntos
específicos de interacción (filtros, clicks, búsqueda) y desde `recommendationEvents.ts`
(Recommendation Block). **No existe un evento de "sesión iniciada" ni de "página vista"** —
solo eventos de interacción puntual. Esto significa que todo lo que sigue sobre "los primeros
30 segundos" es una reconstrucción a partir de la secuencia de eventos disponibles, no una
medición directa de sesión completa — se señala en cada punto dónde el dato es sólido y dónde
es inferencia.

Tampoco existe registro server-side de: onboarding completado, tour guiado visto/completado
(vive solo en `localStorage.promoar_tour_done`, nunca llega al backend), ni de página vista
sin interacción. Ver §5 para el listado completo de huecos de instrumentación.

## 1. Qué hace un usuario desde que se registra hasta que abandona

Datos medidos (`scratch_retention_stats.ts`, `scratch_retention_stats2.ts`, dev branch,
ventana 6/jun–8/ago/2026):

| Métrica | Valor |
|---|---:|
| Usuarios registrados totales | 45 |
| Usuarios con al menos un evento registrado | 41 |
| Usuarios sin ningún evento (registrados, cero actividad detectada) | 4 |
| Usuarios con `FinancialProfile` cargado | 32 de 45 (71%) |
| Usuarios con al menos una promo guardada | 3 de 45 (7%) |
| Total de promos guardadas (todas las cuentas) | 10 |

De los 41 usuarios con actividad:

| Métrica | Valor |
|---|---:|
| Aparecen en un solo día (nunca volvieron) | **25 (61%)** |
| Aparecen en más de un día | 16 (39%) |
| De esos 16, volvieron dentro de las 24hs del primer evento | 16 (100% de los que volvieron) |
| Promedio de días activos por usuario | 3,44 |
| Sesiones distintas totales (browser/localStorage `sessionId`) | 1.024 |
| Usuarios (con userId) con 2+ sesiones distintas | 6 de 41 |

**El dato más duro**: 6 de cada 10 usuarios que interactúan con la app no vuelven ningún otro
día. De los que sí vuelven, todos lo hacen rápido (dentro de 24hs) — no hay un patrón de
"vuelve a la semana" visible; o vuelve casi enseguida, o no vuelve.

Cargar el perfil financiero (71% lo hace) no se traduce en guardar promos (solo 7% lo hace).
Hay una caída grande entre "configuré mi perfil" y "encontré algo que quise guardar para
después" — no sabemos, con los datos actuales, si es porque no encontraron nada relevante, o
porque no vieron el botón de guardar, o porque no volvieron a tiempo de necesitarlo.

## 2. Cuáles son los primeros 30 segundos de experiencia

No hay un evento de "sesión iniciada" para anclar un reloj de 30 segundos con precisión —
esto es la limitación más importante de este documento (ver §5). Lo que sí se puede
reconstruir es la **secuencia típica de los primeros eventos** por sesión, usando el orden
temporal dentro de cada `sessionId`:

- `TIME_FILTER` es, por lejos, el evento más frecuente (1.937 de 4.108 eventos totales, 47%)
  — sugiere que tocar el selector Hoy/Semana es de las primeras interacciones más comunes,
  consistente con que es un control visible arriba de la grilla desde el primer render.
- `CATEGORY_CLICK` (226) y `COMMERCE_SEARCH` (275) muestran que una fracción de usuarios
  explora por categoría o busca un comercio puntual en vez de mirar la grilla default.
- `FOR_ME_TOGGLE` (431) — activar/desactivar la vista personalizada — es frecuente, pero no
  podemos saber si ocurre en los primeros 30 segundos o más tarde en la sesión sin un
  timestamp de inicio de sesión confiable.
- `PUSH_PROMPT_DISMISS` (623, el segundo evento más frecuente) indica que una porción grande
  de usuarios recibe el prompt de notificaciones push temprano (según `CLAUDE.md`, arranca a
  los 2s del mount) y lo descarta. Comparado con solo 1 `PUSH_PERMISSION_GRANTED` registrado
  en toda la base — la tasa de aceptación del prompt push es, con los datos actuales,
  extremadamente baja.

**Lo que no podemos afirmar con esta evidencia**: cuánto tiempo real pasa un usuario antes
de su primera interacción, cuántos abandonan sin interactuar en absoluto (esos ni siquiera
generan un `UserEvent`), o si el tour guiado (que arranca a los 3,5s) se completa, se
abandona a mitad, o ni se ve — porque no se registra en el servidor.

## 3. Qué valor recibe realmente en ese tiempo

Con los datos existentes, el valor entregado en la primera sesión se puede describir solo
indirectamente:

- El 71% carga su perfil financiero — es una señal de intención real (no es un paso trivial,
  requiere elegir banco/tarjeta/tipo), pero no mide si el usuario entendió *para qué* sirve
  antes de hacerlo, ni si lo completó de una sola vez o abandonado a mitad.
- Solo el 7% guarda una promo. Guardar es la señal más cercana a "encontré algo de valor
  concreto que quiero recordar" — es la conversión más baja de todo el funnel medido.
- `PROMO_VIEW` (540 eventos) muestra que sí hay exploración de detalle de promos — pero
  "ver el detalle" y "la promo me sirvió" no son lo mismo, y no hay ningún evento que capture
  la segunda cosa (ej. "click a comprar/ir al comercio", que si existe en el código no está
  llegando a `UserEvent`).

**No sabemos, con la instrumentación actual, si el usuario típico:**
- entiende que la app filtra promos específicamente para SU perfil (vs. una lista genérica);
- llega a ver una promo que de verdad le sirve en su primera sesión;
- entiende cómo volver a encontrar lo que vio si no lo guardó.

Este es el hueco más importante para responder la pregunta de negocio (§ "Cambio de
prioridad" del CPO): no podemos hoy distinguir entre "el usuario no volvió porque no le
sirvió el contenido" y "el usuario no volvió porque no entendió que había algo para volver a
buscar".

## 4. Qué eventos podrían generar un motivo concreto para volver mañana

Inventario de mecanismos YA CONSTRUIDOS en el código, con su estado real de uso (no
propuestas nuevas — esto es "qué hay hoy", el objetivo explícito es no proponer soluciones
todavía):

| Mecanismo | Estado en datos reales |
|---|---|
| Push notifications (`PushSubscription`, `notify` endpoint) | 1 `PUSH_PERMISSION_GRANTED` registrado en toda la base, contra 623 `PUSH_PROMPT_DISMISS` y 31 `PUSH_PERMISSION_DENIED`. Tasa de aceptación visible: prácticamente nula. |
| `SavedPromo` (favoritos) | 3 usuarios, 10 promos guardadas — el mecanismo existe y se usa, pero por muy pocos usuarios. Sin un motivo explícito para "volver a mirar tus guardados" (no hay evidencia de recordatorio ni de badge de vencimiento próximo en lo revisado). |
| `NotificationPreference` (alertas por categoría/comercio/banco) | Modelo existe en schema, no se verificó en este documento cuántos usuarios lo configuraron — dato pendiente, no medido acá. |
| Recommendation Block | Instrumentado (`recommendationEvents.ts`) pero **cero eventos `recommendation_block_shown`/`recommendation_clicked` encontrados** en `UserEvent` — no hay evidencia todavía de que esté generando tráfico de vuelta, sea porque no se desplegó, no se usa, o el evento no se está disparando. |
| Tour guiado | Vive solo en `localStorage`, no genera ningún `UserEvent` — no hay forma de saber cuántos usuarios lo completan ni si mejora retención. |

El patrón visible: existen varios mecanismos pensados para traer al usuario de vuelta, pero
ninguno tiene evidencia medida de estar funcionando — algunos porque la adopción es baja
(push), otros porque no hay datos para juzgarlos (tour, notification preferences,
recommendation block).

## 5. Qué métricas hoy no estamos midiendo y deberíamos empezar a medir

En orden de lo que más directamente respondería "¿por qué no vuelven?":

1. **Evento de inicio de sesión/página vista.** Sin esto no se puede calcular tiempo real en
   los primeros 30 segundos, ni tasa de abandono sin interacción, ni funnel real
   registro→primera interacción→primera promo relevante→retorno.
2. **Evento de onboarding/tour completado vs. abandonado**, con el paso exacto donde se
   cierra o se abandona — hoy es 100% invisible server-side.
3. **Evento de "acción de valor" explícita** — click a "ir al comercio"/"cómo usar esta
   promo", no solo `PROMO_VIEW` (que puede ser un roce accidental, no interés real).
4. **Motivo de cierre del prompt push** (dismiss inmediato vs. después de interactuar con la
   app) — ayudaría a saber si el prompt llega demasiado pronto (a los 2s, antes de que el
   usuario haya visto valor) — ver la nota de `CLAUDE.md` sobre el timing del prompt.
5. **Uso real de `NotificationPreference`** — cuántos usuarios configuran alertas, sobre qué
   categorías/comercios, y si eso correlaciona con volver más seguido.
6. **Cohortes de registro vs. retorno** — hoy se puede aproximar cruzando `User.createdAt`
   con `UserEvent.createdAt`, pero no se hizo en este documento porque la muestra (45
   usuarios) es chica; vale la pena repetir esta medición cuando la base crezca.
7. **Sesiones sin ningún usuario identificado** (guests) — hay 1.024 `sessionId` distintos
   pero solo 41 usuarios con eventos; la enorme mayoría de sesiones son anónimas. No sabemos
   cuántas de esas corresponden a usuarios que después SÍ se registraron (falta un puente
   sessionId→userId al momento del registro) — sin eso, no se puede medir si la exploración
   anónima previa al registro predice retorno.

## Nota sobre el tamaño de la muestra

45 usuarios registrados, 41 con actividad, es una base chica — cualquier porcentaje acá
(61% no vuelve, 7% guarda promos) tiene margen de error grande y puede cambiar mucho con
pocos usuarios nuevos. Los números no deben leerse como una tasa estable de producto, sino
como la mejor foto disponible hoy con lo que se mide. La brecha de instrumentación (§5) es
más importante que cualquier porcentaje puntual de este documento — sin llenarla, la próxima
medición de retención va a tener las mismas limitaciones.

## Qué NO responde este documento (a propósito)

No propone qué construir. No compara performance vs. contenido vs. onboarding vs.
personalización como causa — la evidencia actual no alcanza para separar esas hipótesis con
confianza (ver huecos de §5). Esa decisión queda para después de llenar, al menos en parte,
la instrumentación faltante, o de decidir invertir en growth/analytics como el próximo paso
en sí mismo.
