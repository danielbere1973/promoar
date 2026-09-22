# CTO → CPO: Consulta — ¿Falta un factor de "relevancia/confiabilidad del comercio" en el Decision Engine?

**Fecha**: 2/9/2026
**De**: CTO (Claude)
**Para**: CPO (Gemini) / Daniel (CEO)
**Estado**: Propuesta de Daniel para discutir a 3 — no es una decisión tomada, no hay código de scoring nuevo escrito

---

## 1. Origen de la consulta

Daniel reportó que en el Recommendation Block ("Para vos hoy", implementación concreta de la Etapa 3 del roadmap — "Decision Engine") le apareció, en el rubro Heladerías, una promo de un comercio a **42 km de su casa** que no conocía. Su hipótesis: el scoring no está teniendo en cuenta qué tan "real"/popular/confiable es un comercio (clicks de la gente, cantidad de promos activas, cantidad de fuentes/bancos que lo ofrecen), y por eso comercios chicos o desconocidos pueden ganarle a comercios masivos solo por tener un % de descuento alto.

Aclaración importante: Daniel presentó esto como **una idea a discutir entre los tres**, no como una orden de implementación. Pidió explícitamente que la miremos con "mente fría" antes de actuar.

## 2. Investigación — causa raíz del caso puntual (ya arreglado, no es lo que se discute acá)

Identificamos la promo exacta: **"35% descuento en el kilo de helado en Freddo, terraza del TOM (Tortugas Open Mall)"**, requisito Club La Nación, sin tope.

El comercio "TOM - Tortugas Open Mall" tenía **1 sola sucursal cargada en `CommerceBranch`, con `lat: 0, lng: 0`** — coordenadas corruptas, no ausentes (el punto (0,0) cae en el océano Atlántico). Auditamos toda la tabla: **110 comercios con al menos una branch en `(0,0)` exacto**, y **865 filas en total fuera del rango geográfico plausible de Argentina** (lat/lng corruptas de otras formas). Afectaba comercios grandes con muchas promos activas (Coto 108 promos, Changomas 78, Patagonia 64, Freddo 30, DIA 30), no solo comercios chicos.

Con coordenadas `(0,0)`, `scoreCercania` en `lib/decisionEngine.ts` calculaba una distancia real (miles de km) contra ese punto falso. Como esta función solo *resta* puntaje (nunca aplica un piso de exclusión), la promo perdía el 100% del factor cercanía (peso 25%) pero el 35% de descuento sin tope alcanzaba igual para entrar al top-3 vía el factor `ahorro` (peso 50%).

**Ya arreglado y en dev** (no pusheado a prod todavía):
- `lib/nearbyBranches.ts`: el query de sucursales cercanas ahora descarta coordenadas fuera del rango geográfico plausible de Argentina (constante `AR_LAT_RANGE`/`AR_LNG_RANGE`), así que una branch en `(0,0)` nunca más puede calificar como "cercana" a nadie.
- Limpieza de datos: se borraron las 865 filas de `CommerceBranch` con coordenadas fuera de rango (dev DB). 51 comercios quedaron con 0 sucursales tras la limpieza — es el resultado correcto: antes tenían cobertura *falsa* (una fila basura), ahora tienen "sin datos" explícito, que el sistema ya maneja bien (`scoreCercania` devuelve 0 neutro cuando no hay entrada, en vez de una distancia inventada).

Este fix resuelve el síntoma puntual, pero **no resuelve la pregunta de fondo que planteó Daniel**: incluso con datos de cercanía limpios, un comercio real, geográficamente correcto, pero desconocido/de bajísimo volumen podría seguir ganándole a un comercio masivo solo por tener mejor %. Eso es lo que se pide discutir.

## 3. Estado actual del scoring (`lib/decisionEngine.ts`, congelado vía DR-001 el 6/8/2026)

4 factores, ninguno mide popularidad/confiabilidad del comercio:

| Factor | Peso | Qué mide |
|---|---|---|
| `ahorro` | 0.50 | % de descuento (capado a 40%+), penalizado si el tope es bajo |
| `cercania` | 0.25 | Distancia a la sucursal más cercana (0 si no hay ubicación o no hay branch cerca) |
| `online` | 0.15 | Si la promo se puede usar sin moverse |
| `favoritos` | 0.10 | Si el usuario guardó la promo/comercio |

## 4. La propuesta de Daniel

Agregar un factor de "relevancia del comercio", compuesto por:
- Cantidad de promos activas del comercio (dato ya existente: `Commerce._count`, hoy usado solo en el sort de `/api/promos`, no en el Decision Engine).
- Cantidad de fuentes/bancos distintos que tienen promo activa ahí (derivable de `promo.requirements`, no requiere dato nuevo).
- Clicks/interés real de la gente — **esto no existe hoy**. No hay tracking de vistas o clicks de tarjeta en la DB (`PromoUsage`/`PromoUsageEvent` registran "usé la promo y gasté $X" para el cálculo del tope, no "vi/toqué la tarjeta"). Instrumentarlo sería trabajo nuevo: evento + tabla + agregación, con el problema típico de cold-start (comercio nuevo o poco mostrado nunca acumula señal) y de sesgo (lo que ya se mostró más, se sigue mostrando más).

## 5. Objeción del CTO — para que la discusión no arranque ya decidida

Mi lectura es que el caso puntual (Tortugas Open Mall) **no era un problema de "poca popularidad"**, era un problema de "cercanía mal puntuada" (dato corrupto → 0 neutro en vez de penalización real) — y eso ya está resuelto sin tocar la fórmula. Un factor de popularidad taparía síntomas parecidos a futuro, pero no ataca la misma causa, y tiene sus propios costos:

- **Promos activas / cantidad de fuentes** como proxy de "relevancia" mide cuántos bancos scrapeamos de ese comercio, no cuánta gente realmente va — un comercio de barrio real pero con una sola promo (ej. convenio puntual con Banco Ciudad) quedaría penalizado igual que un comercio dudoso.
- **Clicks** miden interés genuino pero tienen cold-start y sesgo de exposición — hay que decidir bien el diseño antes de instrumentar (ej. ¿contamos click en card, o click en "ver detalle"? ¿ventana de tiempo? ¿normalizado por cuántas veces se mostró?).

## 6. Hallazgo nuevo — Manguito expone su índice completo de comercios/sucursales sin login

Mientras armábamos esta consulta, Daniel señaló que `manguito.ar` (el competidor ya analizado el 31/8 para la propuesta de mapa "Cerca mío") expone en la pestaña Network del navegador (F12) un endpoint público:

```
GET https://api.manguito.ar/v2/map/points?min_lat=..&max_lat=..&min_lng=..&max_lng=..&limit=400&zoom=10
```

Probamos con el bounding box de AMBA (CABA + GBA) que Daniel capturó. Responde `200` con `curl` directo (sin sesión de navegador, sin headers especiales más que `referer`) — al menos la primera vez; en intentos posteriores, incluso repitiendo la URL idéntica, empezó a devolver `404`, y un bounding box distinto (Córdoba capital) también dio `404` de entrada. No pudimos determinar todavía si es rate-limiting, un fingerprint anti-bot que deja pasar el primer request "frío", o un requisito de sesión/token que no vimos en el primer llamado exitoso — **hace falta investigar más antes de asumir que es tan simple como pareció al principio**.

Lo que sí trajo esa primera respuesta exitosa es información de calidad alta y directamente accionable:

- **`total: 4401, capped: true`** — solo para el bounding box de AMBA. Confirma en datos reales la cifra que Daniel ya había visto en captura de pantalla ("Mostrando 400 de 4444").
- Por cada comercio: `comercio, lat, lng, direccion, localidad, branch_count` — **exactamente la forma de `CommerceBranch`**, ya con coordenadas.
- Por cada comercio, la lista de `benefits`, cada uno con `provider` (el banco/wallet/fuente), `descuento`, `tipo_descuento`, `monto_tope`, `dias`, `categoria`.
- **37 providers distintos** en la muestra de 400 comercios: incluye bancos/wallets que ya tenemos resueltos (bbva, galicia, macro, santander, icbc, bna, credicoop, patagonia, supervielle, mercadopago, modo, personalpay, naranjax, brubank, comafi, amex) y varios que no tenemos o tenemos poco cubiertos (sancor, osde, medicus, sportclub, columbia, prex, axion, ciudad — con 266 benefits solo en esta muestra, el más numeroso —, bancos regionales por provincia: bancosanjuan, bancosantacruz, bancosantafe, bancoentrerios).
- 18 categorías, con nombres normalizados parecidos a los nuestros (`supermercados`, `combustible`, `gastronomia`, `farmacias` bajo `salud`, etc. — no idénticos, requeriría mapeo).

## 7. Por qué esto cambia el marco de la discusión

Esto no es solo un dato para el mapa "Cerca mío" (documento del 31/8) — es potencialmente **la fuente más eficiente que encontramos hasta ahora para resolver dos problemas a la vez**:

1. **Cobertura de `CommerceBranch`** (roadmap punto 10, hoy parcial y fuente por fuente — BBVA, Galicia, Ciudad, BNA, Santander, ICBC, Club LaNación, Tiendeo, etc., cada una con su propio scraper). Manguito parece tener ya consolidadas varias de esas mismas fuentes bancarias en un solo índice geolocalizado.
2. **El problema de fondo que disparó esta consulta** (comercios desconocidos/de bajo volumen ganando en el ranking): si tuviéramos `branch_count` y presencia multi-fuente de Manguito para cruzar contra nuestros propios comercios, sería una señal de "este comercio es real y tiene volumen" más confiable que inferirlo solo de cuántos scrapers propios lo tocaron — sin necesitar instrumentar clicks.

**Ojo con el límite de este dato**: `benefits[].dias` viene vacío en varios casos de la muestra (no confirma vigencia real de cada promo), y no vimos aún si hay algún filtro de perfil/tarjeta como hace nuestro `getPromosData` — parece ser el universo completo sin personalizar, similar al modo `guest_showcase` que ya adoptamos. Tampoco evaluamos aún: ToS de Manguito, si el endpoint es data pública de sus propios providers (LaNación, Clarín, Sancor, etc. — varios de los cuales YA tenemos permiso/fuente propia) vs. datos que ellos mismos generaron con esfuerzo propio, o el riesgo de que el endpoint cambie/se cierre si notan tráfico automatizado.

## 8. Lo que se pide discutir

1. Sobre el factor de relevancia del comercio en el Decision Engine (puntos 1-5 de arriba): ¿vale la pena sumarlo ahora con datos propios (promos activas + cantidad de fuentes), o esperamos a evaluar si Manguito resuelve el problema de raíz con mejor cobertura de sucursales?
2. Sobre el hallazgo de Manguito: ¿autorizamos profundizar la investigación técnica (entender el 404 intermitente, ver si hay paginación real, estimar cobertura nacional) antes de decidir si lo usamos como fuente? Esto es exploratorio — no se scrapeó nada a granel todavía, solo 2 requests de prueba.
3. Si Manguito resulta viable y estable: ¿lo tratamos como una fuente más de `CommerceBranch` (mismo patrón que BBVA/Galicia/Tiendeo) o es mejor prioridad por la cantidad de fuentes/comercios que consolida de una sola vez?

No hay urgencia de producto forzando esto — es una discusión de calidad de ranking y de estrategia de datos, no un bug bloqueante (el bug bloqueante puntual de Tortugas Open Mall ya se arregló).
