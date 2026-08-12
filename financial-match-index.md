# Financial Match Index — diseño de arquitectura

Responde a "CPO Decision — Resultado del análisis de descarte" / "Nueva dirección
aprobada". Pregunta a resolver: **cómo persistir el resultado de `matchesProfile()`
como estado derivado del dominio**, para que Recommendation Block deje de recalcular
matching financiero en cada request.

Documento de diseño. No implementa nada, no crea tablas, no migra. Compara variante A
(índice por usuario) vs. variante B (índice por firma de perfil) con datos medidos, no
supuestos.

## 0. Principio obligatorio, verificado

`matchesProfile()` sigue siendo la única implementación de las reglas financieras. El
índice, en cualquier variante, se llena **ejecutando** esa función (o una función
equivalente extraída del mismo cuerpo, ver §7) contra cada promo — nunca reimplementando
sus reglas en SQL. Esto es compatible con todo lo medido en
`analisis-descarte-matchesprofile.md`: la razón de que subir reglas a SQL no sirva
(82% del descarte vive en la combinatoria banco+wallet) es la misma razón por la que el
índice tiene que construirse corriendo la función real, no una aproximación.

## 1. Cuántos perfiles financieros distintos existen hoy

Medido contra la base de datos actual (dev branch, `ep-cool-lake`):

| Métrica | Valor |
|---|---:|
| Usuarios totales | 45 |
| Usuarios con `FinancialProfile` | 32 |
| Firmas de perfil únicas (banco+wallet+cards, normalizado y ordenado) | **32** |
| Perfiles que comparten firma exacta con algún otro | **0** |

**Ningún par de usuarios comparte hoy una firma de perfil idéntica.** La firma se calculó
serializando `banks[].bankId`, `wallets[].walletId` y cada `cards[]` (bankId, cardNetworkId,
cardType, cardTier, cardSegmentId, segmentId, walletId, isPayroll, isPensioner), todo
ordenado para que el orden de carga no afecte la comparación.

## 2. Cuántos usuarios podrían compartir una misma firma

Con la base actual: cero, en la práctica. Con 32 perfiles y 0 coincidencias exactas, el
espacio de firmas posibles (combinaciones de hasta 41 bancos × 17 wallets × variantes de
card) es enorme comparado con la cantidad de usuarios reales — cada usuario tiende a tener
una combinación particular de tarjetas (no solo "tengo Galicia", sino "Galicia Visa Gold +
Cuenta DNI + Naranja X Mastercard"), lo que hace que la firma sea, en la práctica, casi tan
específica como el propio `userId`.

Esto es el dato más importante de todo el documento para decidir entre A y B: **con la base
actual, un índice por firma de perfil (B) tendría el mismo número de filas base que un
índice por usuario (A)** — 32 firmas para 32 usuarios. B no ahorra nada hoy. Su valor
depende de que, a futuro, la tasa de perfiles compartidos crezca (más usuarios con
combinaciones de tarjetas comunes, ej. "Visa + Banco Galicia" sin nada más) — algo plausible
a medida que crezca la base, pero no medible todavía porque la muestra es demasiado chica
(32 casos) y demasiado dispersa.

## 3. Cuánto costaría generar el índice inicial

Con 32 perfiles y ~24.443 promos activas, el techo teórico de un cross-product completo
sería `32 × 24.443 ≈ 782.000` evaluaciones. En la práctica es mucho menor: el paso ya
existente de candidate selection (`getCandidatePromosForProfile()`, permisivo, ya filtra por
banco/wallet en SQL) reduce ese universo a un pool por perfil de **2.300 a 8.400 filas**
según DR-004 (medido con perfiles reales) — el mismo pool que ya se hidrata hoy en el camino
"oráculo". Generar el índice inicial es, en el peor caso, equivalente a correr el pipeline
actual (candidate query + hidratación + `matchesProfile()`) una vez por cada uno de los 32
perfiles, sin la parte de ranking. Con el dato medido en la Parte A de
`medicion-http-http-two-stage-hydration.md` (~9-12s de hidratación+matching por perfil en
frío), el cálculo inicial completo rondaría **32 × ~10s ≈ 5-6 minutos** corrido una sola vez,
en background, no en el camino de un request de usuario.

Con guest profiles (perfiles temporales sin cuenta, ver §10) este número no aplica — no hay
un universo fijo de perfiles guest para precalcular por adelantado.

## 4. Cuántas filas produciría

- **Variante A (por usuario)**: `usuarios_con_perfil × promos_matcheadas_por_ese_usuario`.
  Con los datos medidos (32 perfiles, aceptación real 53% del pool candidato, pool candidato
  2.300-8.400 filas) esto da aproximadamente `32 × 1.200-4.500 ≈ 38.000-144.000` filas hoy.
  Escala linealmente con la cantidad de usuarios con perfil — con 1.000 usuarios activos,
  del orden de 1,2M-4,5M filas.
- **Variante B (por firma de perfil)**: hoy, idéntico a A (32 firmas únicas = 32 usuarios).
  El ahorro de B solo aparece si la tasa de firmas compartidas sube significativamente a
  medida que crece la base — algo que no se puede proyectar con 32 datos, ninguno repetido.

## 5. Qué ocurre cuando cambia cada evento relevante

| Evento | Efecto en A (por usuario) | Efecto en B (por firma) |
|---|---|---|
| Cambia una tarjeta del usuario | Recalcular filas de ESE `userId` únicamente (32 promos × 1 perfil, acotado) | Recalcular la firma nueva del usuario. Si la firma resultante ya existe en el índice (otro usuario ya la generó), no hace falta recalcular nada — se reusa. Si es nueva, mismo costo que A. |
| Cambia un requirement de una promo | Recalcular esa `promoId` contra TODOS los perfiles/firmas existentes (columna, no fila) | Igual, pero contra firmas en vez de usuarios — potencialmente menos evaluaciones si hay firmas compartidas |
| Entra una promo nueva | Evaluar la promo nueva contra todos los perfiles/firmas existentes | Igual, potencialmente menos evaluaciones con firmas compartidas |
| Vence una promo | Borrar/marcar inválidas las filas de esa `promoId` (barato, no requiere recalcular matching) | Igual |
| Corre un scraper | Scraper típicamente toca cientos de promos por corrida (upsert). Cada una dispara el caso "cambia un requirement" o "entra una promo nueva" arriba — el costo es proporcional a `promos_tocadas × perfiles_existentes`, no al universo completo | Igual, con el mismo posible ahorro de B si hay firmas compartidas |

En ambas variantes, el caso más caro estructuralmente es **"corre un scraper"**, porque
toca muchas promos a la vez y cada una dispara una re-evaluación contra todo el universo de
perfiles/firmas. Esto es él lo que responde la pregunta 6.

## 6. Cómo evitar recalcular todo el universo cuando cambia una sola promo

No hace falta recalcular usuarios no afectados. El cambio de una promo solo puede alterar
el resultado de `matchesProfile()` para perfiles cuyas cards tocan alguno de los campos que
cambiaron en sus `requirements` (bankId, walletId, cardNetworkId, etc.) — el filtro
permisivo de candidate selection (banco/wallet, ya existente en SQL) sirve acá también como
filtro de invalidación: solo hace falta re-evaluar la promo contra los perfiles/firmas cuyo
`userBankIds`/`userWalletIds` intersecta con los `bankId`/`walletId` de los requirements de
esa promo (nuevos o viejos, por si un requirement cambió de banco). Esto acota la
recalculación de "cambia una promo" a un subconjunto de perfiles, no al universo completo —
mismo principio que ya usa DR-004 para acotar el pool de candidatas por request, aplicado
ahora a la invalidación del índice en vez de al filtro de un request.

Esto no está implementado — es el mecanismo a diseñar en el spike, no una decisión tomada
acá.

## 7. Cómo garantizar consistencia con `matchesProfile()`

El índice se llena ejecutando la función real, no reimplementándola. En términos concretos:
`matchesProfile()` hoy está definida como closure dentro de `getPromosData()` (cierra sobre
`userCards`/`tierToSegmentId`, `lib/getPromos.ts:843`) — para reusarla desde un proceso de
indexado (job en background, no un request HTTP) haría falta extraerla a una función pura
exportada, con `userCards`/`tierToSegmentId` como parámetros explícitos en vez de variables
de clausura. Esa extracción es un refactor mecánico (mismo cuerpo, mismas reglas, distinta
firma de función) — no una segunda implementación. El request path y el proceso de indexado
llamarían a la misma función exportada, así que no hay forma de que diverjan silenciosamente
(la clase de bug que ya ocurrió dos veces entre el path oráculo y el light, ver
`candidate-retrieval-v2.md` §2).

## 8. Latencia de un request con índice ya calculado

Leer el índice es un `SELECT promoId FROM financial_match_index WHERE userId = ? AND matched
= true ORDER BY ... LIMIT N` (o el equivalente por `profileHash` en B) — sin `EXISTS`, sin
loop combinatorio, sin hidratar miles de filas para descartar la mayoría. Es estructuralmente
equivalente a lo que ya mide rápido en el pipeline actual: `candidateQueryMs` (350-900ms
medido en la Parte B de `medicion-http-two-stage-hydration.md`) es del mismo tipo de query
(un `SELECT` con índice, sin combinar filas contra el perfil en memoria). Es razonable
esperar que el índice, una vez poblado, quede dentro del objetivo de **p95 < 3s** —
matching financiero deja de ser parte del tiempo de request porque ya no se ejecuta ahí.
Esto es una expectativa fundamentada en datos ya medidos, no una medición nueva — falta
confirmarla con el spike de implementación.

## 9. Latencia del primer request de un perfil nunca calculado (cache miss)

Es el caso a diseñar con más cuidado. Dos caminos posibles, ninguno implementado:

- **Bloqueante**: el request dispara el cálculo síncrono (candidate query + hidratación +
  `matchesProfile()`, el mismo camino que existe hoy) y además escribe el resultado en el
  índice para la próxima vez. Ese primer request no mejora — sigue costando lo mismo que
  hoy (9-12s medido en frío). Solo los requests siguientes del mismo perfil se benefician.
- **No bloqueante con fallback**: el request dispara el cálculo del oráculo actual en el
  camino de respuesta (igual que arriba) PERO no espera a que el índice se escriba para
  responder — el índice se llena de forma asíncrona (fire-and-forget o cola) después de
  responder. El usuario ve la misma latencia que hoy en el primer request, sin bloquear
  adicionalmente por la escritura del índice.

Ninguna variante evita que el primer request de un perfil nuevo pague el costo actual — el
índice ayuda a partir del segundo request en adelante. Esto es works-as-designed para un
"estado derivado": no hay forma de tener un derivado sin haberlo derivado al menos una vez.

## 10. Cómo manejar usuarios invitados (`guest_profile`)

Un guest profile llega en un query param base64 (`guestProfileParam`, decodificado en
`getPromosData()` y `getLightRecommendationCandidates()`), sin `userId` ni cuenta. No hay
una clave estable para indexarlo en variante A (no hay `userId`).

Esto es exactamente el caso donde la variante B tiene una ventaja estructural, no solo de
volumen: un guest con un perfil de cards específico puede indexarse por su `profileHash`
sin necesitar una cuenta. Si otro guest (o un usuario registrado) más adelante genera el
mismo hash, reusa la fila sin recalcular. En variante A, los guests quedarían directamente
afuera del índice (siempre camino oráculo) o requerirían una clave sintética adicional
(ej. hash del guest profile usado como pseudo-userId) — que termina siendo, en los hechos,
lo mismo que B pero con un nombre distinto.

## 11. Espacio aproximado en Neon

Estimación por fila: `userId`/`profileHash` (~25 bytes), `promoId` (~25 bytes), `matched`
(1 byte booleano), `version`/`updatedAt` (8 bytes) ≈ 60-80 bytes por fila más overhead de
índice B-tree (variable, típicamente 1.5-2x el tamaño de fila en Postgres/CockroachDB-style
storage).

- Hoy (32 perfiles, pool real ~2.300-8.400 candidatas por perfil): 38.000-144.000 filas
  (§4) × ~150 bytes con overhead ≈ **6-22 MB**. Insignificante frente al storage actual de
  Neon post-migración (~0,05 GB total, ver nota de migración CockroachDB→Neon en
  `CLAUDE.md`).
- Proyectado a 1.000 usuarios con perfil: 1,2M-4,5M filas × ~150 bytes ≈ **180 MB - 675 MB**.
  Ya no insignificante, pero manejable para un plan de Neon estándar — a confirmar contra el
  plan actual antes de decidir la variante final.
- La variante B reduce este número solo en la medida en que existan firmas compartidas —
  con los datos de hoy (0% compartido), B no reduce nada; el ahorro es una apuesta a que la
  tasa de perfiles compartidos suba con la escala, no un hecho medido.

## 12. Complejidad operacional que introduce

- Un nuevo modelo (`financial_match_index` o similar) con dos claves candidatas según la
  variante elegida, y su propio ciclo de vida (escritura inicial, invalidación, posible
  recalculo por vencimiento de `version`).
- Un job o mecanismo de invalidación que hoy no existe: algo tiene que decidir cuándo
  recalcular filas tras un scraper run, un cambio de perfil, o el vencimiento de una promo.
  El scraper (`app/api/admin/scrape/route.ts`) ya calcula `activePromoCount` al final de
  cada run (ver `CLAUDE.md`, punto 13) — el mismo lugar sería candidato natural para
  disparar la invalidación del índice, pero eso es una decisión del spike, no de este
  documento.
- Una fuente más de verdad a mantener sincronizada con `matchesProfile()` — mitigado por
  §7 (extraer la función real en vez de reimplementarla), pero no elimina el riesgo de que
  el índice quede desactualizado si el mecanismo de invalidación tiene un bug (a diferencia
  del camino actual, que siempre calcula en vivo y por lo tanto nunca puede "quedar viejo").
- Requiere definir explícitamente qué pasa si el índice y el oráculo en vivo alguna vez
  difieren (¿hay una forma de detectarlo? ¿un chequeo periódico tipo el harness de 40 casos
  ya usado en los spikes anteriores?) — no resuelto acá, ver §14.

## 13. Freshness — cuándo un resultado deja de ser válido

Mecanismos evaluados, sin elegir ninguno todavía:

- **Versión global de promociones**: un contador único que se incrementa en cada scraper
  run. Toda fila del índice con `version < versionGlobalActual` se considera potencialmente
  vieja. Simple de implementar, pero grueso: invalida (o marca sospechoso) el índice
  completo aunque el scraper haya tocado solo 200 de 24.000 promos.
- **Versión del perfil**: análogo pero por usuario/firma — se incrementa cuando cambia el
  `FinancialProfile`. Correcto y barato de mantener (cambios de perfil son eventos de
  usuario, poco frecuentes), pero no resuelve el lado de "cambió una promo".
- **Timestamps simples (`updatedAt` por fila)**: permite TTL-style invalidación ("si pasaron
  más de X horas, recalcular"), pero no es preciso — puede servir contenido desactualizado
  dentro de la ventana, o recalcular de más si la ventana es corta.
- **Invalidación incremental por promo**: cuando cambia una promo, recalcular solo las
  filas de esa `promoId` contra los perfiles/firmas afectados (mecanismo descrito en §6).
  Es el más preciso y el más caro de implementar bien — requiere que el scraper (o quien
  actualice promos) dispare explícitamente la invalidación, no un cron periódico ciego.
- **Cálculo lazy**: no invalidar proactivamente — en cada lectura, verificar si la fila es
  "suficientemente fresca" (combinando alguna de las anteriores) y, si no, recalcular en el
  momento y servir eso. Evita trabajo sobre perfiles que no se consultan, a costa de que el
  primer request post-cambio pague el costo (mismo trade-off que §9).

Ninguna de estas se elige en este documento — es la comparación que pide la CPO, no una
decisión.

## 14. Comparación objetiva A vs. B

| Dimensión | A — por usuario | B — por firma de perfil |
|---|---|---|
| Filas hoy (32 perfiles reales) | ~38.000-144.000 | **Idéntico** — 0 firmas compartidas medidas |
| Filas proyectadas a escala | Crece linealmente con usuarios | Crece más lento SI aparecen firmas compartidas (no confirmado con datos actuales) |
| Soporta guest profiles nativamente | No (requiere clave sintética) | **Sí** — un hash no depende de tener cuenta |
| Complejidad de invalidación por cambio de card | Recalcular 1 fila del usuario | Recalcular 1 firma, potencialmente compartida por más de un usuario (mismo costo si no hay compartidos hoy) |
| Riesgo de "falso ahorro" | Ninguno — cada fila es exactamente lo que ese usuario ve | Si dos perfiles casi iguales (ej. difieren en una sola card) generan hashes distintos, no hay ahorro real — el hash debe ser exacto, no aproximado |
| Evidencia a favor, medida hoy | Ninguna ventaja de volumen sobre B | Ninguna ventaja de volumen sobre A (0% compartido) |

**Con los datos disponibles hoy, ninguna de las dos variantes demuestra ventaja de volumen
sobre la otra** — la muestra (32 perfiles, 0 firmas compartidas) es demasiado chica para
proyectar si B empieza a ahorrar a escala. La única ventaja objetivamente medible de B hoy
es estructural, no de volumen: **maneja guest profiles sin necesitar una clave sintética**,
mientras que A no tiene una clave natural para un perfil sin `userId`.

## 15. Qué mediría el spike de validación (si se aprueba)

No propuesto como decisión — enumerado porque la CPO pidió que el diseño responda "qué
mediría", no que decida el paso siguiente:

1. Extraer `matchesProfile()` (y el ensamblado de `userCards`/`tierToSegmentId`) a una
   función pura reusable desde un proceso de indexado, sin cambiar una sola regla.
2. Medir el costo real de un full-build del índice (32 perfiles hoy) para confirmar o
   corregir la estimación de §3.
3. Medir la tasa de firmas compartidas en una muestra más grande si existe (o esperar a que
   la base crezca) antes de decidir entre A y B basándose en volumen.
4. Prototipar el mecanismo de invalidación incremental de §6 contra un caso real de scraper
   run, midiendo cuántos perfiles/firmas quedan afectados por una corrida típica.
5. Medir p95 de lectura del índice ya poblado, mismo protocolo cold+warm que
   `medicion-http-two-stage-hydration.md`, para confirmar la expectativa de §8.

## Restricciones respetadas en este documento

No se implementó nada. No se crearon tablas ni migraciones. No se tocaron los artefactos de
los spikes anteriores (`scratch_*`, `medicion-http-two-stage-hydration.md`,
`candidate-retrieval-v2.md`, `analisis-descarte-matchesprofile.md`) — siguen sin limpiarse.
No se volvió a evaluar la Alternativa B (descartada, ver `analisis-descarte-matchesprofile.md`).
Este documento no elige variante A ni B, ni mecanismo de freshness — es el análisis
comparativo pedido, la decisión queda para la CPO.
