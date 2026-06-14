# PromoAR — Contexto del proyecto

App Next.js 14 (App Router) + Prisma + PostgreSQL (Neon) que agrega y muestra promociones bancarias de Argentina.

## Stack
- **Frontend**: Next.js 14, Tailwind CSS, NextAuth
- **Backend**: API Routes (App Router), Prisma ORM
- **DB**: PostgreSQL en Neon
- **Scrapers**: Playwright + custom fetchers en `lib/scrapers/`

## Estructura clave
- `app/page.tsx` — Pantalla principal de promos (client component)
- `app/admin/page.tsx` — Panel admin (promos, entidades, scrapers)
- `app/perfil/page.tsx` — Perfil financiero del usuario
- `app/promos/[slug]/page.tsx` — Detalle de promo (server component)
- `app/api/promos/route.ts` — API principal de promos con matching por perfil
- `app/api/admin/` — APIs del admin (entities, promos, scrape, etc.)
- `app/api/public/entities/route.ts` — Bancos/billeteras/redes para filtros
- `app/api/categories/route.ts` — Categorías con conteo de promos activas
- `app/components/FilterDrawer.tsx` — Drawer de filtros avanzados (acordeón)
- `app/components/CategorySheet.tsx` — Bottom sheet de selección de categorías
- `app/components/BackButton.tsx` — Botón atrás con router.back() para preservar state
- `lib/scrapers/` — Scrapers individuales por entidad

## Categorías (19 + Sin Categoría)
Supermercados, Combustible, Gastronomía, Farmacias, Indumentaria, Tecnología, Petshops, Transporte, Heladerías, Hogar, Entretenimiento, Salud y Belleza, Deportes, Jugueterías, Librerías, Viajes y Turismo, Shoppings, Automotores, Otros, Sin Categoría

## Estado de scrapers — todos completos
Coto, Diarco, Jumbo, Disco, Vea, Changomas, Carrefour, MODO, MercadoPago, CuentaDNI, VISA, AmEx, Naranja X, Cabal/Credicoop, Galicia, BBVA, Santander, Macro, BNA, Ciudad, Supervielle, Patagonia, ICBC

## Features implementados (sesiones recientes)
- Categorías dinámicas desde DB — CategorySheet bottom sheet multi-select grid 3 columnas
- `selectedCats` usa slugs guardados en URL (`?cats=supermercados,farmacias`), restaurados al montar con `window.history.replaceState` (sin re-render)
- FilterDrawer rediseñado: acordeón por sección, entidades del perfil del usuario primero, buscador comercios top-12
- Filtros `discountRanges` y `hasInstallments` implementados en API (filtrado JS post-fetch)
- Perfil financiero del usuario fetcheado en `page.tsx` y pasado al FilterDrawer
- Matching por perfil en API incluye `cardSegmentId`
- BackButton con `router.back()` en página de detalle `/promos/[slug]`
- Chips de info rápida en cada tarjeta: banco (gris), tarjeta (azul), forma de pago (amarillo), tope/mínimo
- **Ordenamiento de promos implementado** en `/api/promos/route.ts`:
  1. Mayor descuento primero (ignorando CSI)
  2. Comercio más popular (`_count` promos activas)
  3. Alfabético por nombre de comercio
  4. Más cuotas sin interés primero como desempate final
- **Búsqueda de productos** ("¿cómo busco carteras?"): modelo `CommerceProduct`
  (commerceId, categoria, subcategoria, productos, source) cargado desde
  `unicenter-catalogo.csv` vía `scripts/load-commerce-products.ts` (2534 filas, 138 comercios).
  Endpoint `/api/search/products?q=` reutiliza el matching por perfil de `/api/promos`
  (REGLA 1-3 + caso CUENTA_DNI). UI: bottom sheet `ProductSearch.tsx` con buscador debounced,
  invocado desde botones "Buscar producto" / "Productos" en `page.tsx`.
  Comercios sin catálogo scrapeado pero con promos activas (Zara, Adidas, Lacoste, Samsonite,
  Swatch, Burger King, Bimba y Lola, Despegar, Pandoras, Ave Caesar, G-Shock Casio, The Embers)
  se cargaron a mano con `source: 'manual'` (sitios bloqueados por Akamai/SSL o de baja calidad
  de extracción — se usó navegador headed para inspeccionar y curar categorías reales).

## Decisiones de arquitectura importantes
- `selectedCats` en page.tsx usa **slugs** (no ids) — se guarda en URL y se restaura al montar leyendo `window.location.search` directamente (no `useSearchParams`)
- `categorias` NO está en las dependencias del useEffect de carga de promos (evita doble fetch)
- `window.history.replaceState` para sincronizar URL sin re-render
- FilterState incluye: banks, wallets, networks, days, channels, hasCap, capMin, capMax, capPeriods, commerces, discountRanges, hasInstallments
- El backend filtra por perfil financiero cuando `for_me=true` y el usuario tiene perfil cargado
- Admin bypass: admins ven todas las promos sin filtro de perfil
- En `promo.commerce` el select incluye `_count: { promos activas }` para el score de popularidad

## Pendiente INMEDIATO — próxima sesión

### 1. Quick filters predefinidos en pantalla principal — RESUELTO/SUPERADO
Ya implementado en `app/promos/page.tsx`: `PRIORITY_CAT_SLUGS` (supermercados, combustible,
transporte, gastronomia, farmacias) ordena las secciones de categorías poniendo esas 5 primero,
y la sección "⭐ Destacadas hoy" muestra promos `isFeatured` + top por descuento dentro de esas
categorías (cap 6). Cubre el objetivo de accesos rápidos a lo más relevante sin agregar chips
de filtro adicionales.

### 2. Pendiente DB
- DELETE FROM promos + re-scraping completo (hay ~20k promos con datos corruptos)
- Antes de borrar: exportar CSV desde admin
- Después: DELETE FROM commerces WHERE "logoUrl" IS NULL

### 3. Promos con múltiples comercios ("Disco y Vea", "Supermercados Disco & Vea") — RESUELTO
En `app/api/admin/scrape/route.ts`: si el `storeName` no matchea un comercio exacto y contiene
" y "/" & ", se separa en 2 partes; si ambas matchean comercios reales distintos (helper
`matchCommerceByName`), se generan 2 `resolvedItems` (uno por comercio) en vez de crear un
comercio combinado ficticio. Limpieza de datos: se eliminó "Disco y Vea" (vacío) y se dividió
la promo de "Supermercados Disco & Vea" en Disco y Vea, borrando el comercio ficticio.

### 4. Comercios Cencosud a limpiar — RESUELTO
"Especial Cencosud" (AmEx) y "CENCOSUD PRODUCTOS SELECCIONADOS" (Macro) eran promos
genéricas de CSI/reintegro aplicables a todas las cadenas Cencosud, guardadas como
2 comercios ficticios (7 promos en total). Se duplicaron las 7 promos en Jumbo, Disco y
Vea (21 promos nuevas) y se borraron los 2 comercios ficticios. En `app/api/admin/scrape/route.ts`
se agregó `CENCOSUD_GENERIC_NAMES` para que futuros scrapeos repartan estas promos entre
Jumbo/Disco/Vea automáticamente (mismo mecanismo que el punto 3).

### 5. Personal Pay promos con "2%" incorrecto — RESUELTO
La API devuelve `discounts: "2x1"`, pero la regex `^(\d+)[xX](\d+)$` no toleraba espacios
y en 23 casos cayó al fallback `parseInt("2x1")` = 2, guardando "2% de descuento" en vez de
"2x1". Se relajó la regex en `lib/scrapers/personalpay.ts` (`(\d+)\s*[xX]\s*(\d+)` + `.trim()`)
y se borraron las 23 promos corruptas de la DB — el próximo "Ejecutar todos" las recrea
correctamente como "2x1".

### 6. Logos faltantes o incorrectos
Ver `logos-report.csv` en la raíz. 700 sin logo, 522 con favicon Google (algunos incorrectos).
Priorizar comercios con 5+ promos. Algunos favicon Google son el ícono genérico de globo.

### 7. Normalización de comercios — tabla de alias permanente
Crear tabla `CommerceAlias` para que futuros scrapeos normalicen nombres automáticamente.
Evita que "HAVANNA GOOGLE PAY APPLE PAY" vuelva a crearse como comercio separado.

### 8. Búsqueda de productos — DONE (ver "Features implementados")
Implementada: modelo `CommerceProduct`, endpoint `/api/search/products?q=` y UI `ProductSearch.tsx`.
122 de las 273 marcas del catálogo de Unicenter no tienen `Commerce` en la base (nunca aparecieron
con promos bancarias activas) — no se les puede cargar catálogo hasta que exista el comercio.
Cuando aparezca una promo nueva de alguna de esas marcas, recargar `unicenter-catalogo.csv`
contra el `Commerce` recién creado (mismo bloqueo del punto 7: requiere matching de nombres).
Pendiente menor: completar matching difuso marca↔Commerce para los que no matchearon exacto.

### 9. Precios en línea — IMPORTANTE: debe ser consulta en vivo, NO scraping/almacenamiento
Fase futura. El usuario fue explícito: los precios varían demasiado
seguido (inflación, dólar, temporada, promos) como para guardarlos scrapeados — quedarían
desactualizados rápido. La consulta de precios debe hacerse **en el momento**, contra la
fuente online (API del comercio), no contra una tabla propia con datos scrapeados.

El scrapeo de categorías de Unicenter (punto 8) ya identificó qué plataforma e-commerce usa
cada marca (Shopify/VTEX/TiendaNube/WooCommerce/Powla/generic) — eso es el mapa que indica
qué API de cada plataforma consultar en vivo para traer precio actualizado
(ej. Shopify `/products.json` trae precio, VTEX tiene API de búsqueda con precio, etc.).

### 10. Filtrado de promos por ubicación del usuario (sucursales por comercio)
Objetivo: que un usuario en Buenos Aires no vea promos de comercios/sucursales que solo
existen en Jujuy (u otra provincia lejana) — mejora de relevancia/UX, no elimina la promo,
solo no la muestra si no aplica a la zona del usuario.

Requiere llenar `CommerceBranch` (`commerceId, name, address, city, province, lat, lng,
source, osmId`) por comercio. `lat`/`lng` son obligatorios.

**Fuente Macro**: la página de detalle de cada promo
(`https://www.macro.com.ar/beneficios/beneficio?id=<code>%7C<external-code>`) trae
server-side, dentro de un div colapsado `.mc-map-listado`, el listado de sucursales
adheridas (nombre + dirección, ej. `<b>ALBA MIA </b>: ALVARADO  445, ORAN`). No viene en la
respuesta JSON de `apipublic.macro.com.ar` (campo `restricted-stores` vacío). No trae
lat/lng — requeriría geocoding (ej. Nominatim/OSM, rate-limit 1 req/seg).

**Fuente Banco Nación (Club LaNación / Semana Nación) — RESUELTO**: el buscador de
sucursales de `semananacion.com.ar` consume:
`GET https://backend.activx.production.digiventures.la/api/points/?bank=bna-semananacion&checkValidity=true&status=active&search={merchant}&select=merchant+locationData.province+locationData.city+locationData.address+location.coordinates+campaign&lat={lat}&lng={lng}&distance=10000000`
Devuelve siempre los **5 puntos más cercanos** al `lat`/`lng` dado (no pagina con
`skip`/`limit`/`page`, esos params se ignoran), con `locationData` (province, city, address)
y `location.coordinates` ([lng, lat]) listos — sin geocoding. Sin WAF, funciona con `fetch`
directo (sin sesión de navegador). `search` es texto libre y puede traer falsos positivos
(ej. buscar "modo" matchea "Comodoro") — hay que filtrar resultados cuyo `merchant` no
coincida razonablemente con el nombre del comercio.

Implementado en `scripts/load-bna-branches.ts`: para cada comercio con promo BNA activa,
limpia el nombre (saca "con MODO", "www.", ".com.ar"), consulta desde 10 puntos
distribuidos por el país (CABA, Córdoba, Rosario, Mendoza, Salta, Bahía Blanca, Posadas,
Comodoro Rivadavia, Mar del Plata, Resistencia) para cubrir regiones, dedupea por
distancia y filtra por coincidencia de nombre.

**Fuente Galicia — RESUELTO**: el botón "Conocer más" (junto al ícono de ubicación) en el
detalle de una promo con `tiendaFisica: true` dispara:
`GET https://loyalty.bff.bancogalicia.com.ar/api/portal/catalogo/v1/locales/idPromocion/{idPromocion}?page=1&pageSize=15`
Devuelve `{ data: { list: [...], totalSize } }` con un objeto por sucursal:
`{ id, tipoLocal: "Físico", calle, numero, aclaracion, codigoPostal, localidadNombre,
partidoNombre, provinciaNombre, paisNombre, latitud, longitud, telefono, nombreMarca,
tipoPromocion }`. **Trae lat/lng listos** (algunas sucursales pueden venir con `null`),
no requiere geocoding. Paginar con `page`/`pageSize` si `totalSize` > pageSize.
Probado con idPromocion=156200 (Supermercados El Nene, idMarca=112375) → 6 sucursales en
La Plata/Los Hornos/San Lorenza/Tolosa, Buenos Aires.
Hay también `GET .../locales/ubicacion/filtro?IdPromocion={id}` que devuelve solo las
provincias/localidades disponibles (para el filtro UI), no las direcciones completas —
usar el endpoint `/locales/idPromocion/{id}` para los datos reales.
Nota WAF: estos endpoints solo responden con headers/sesión de navegador real
(Referer `https://beneficios.galicia.ar/...`, cookies de sesión); llamarlos directo con
`fetch`/`curl` sin pasar por un `page.goto` previo da `403 Request Rejected`.

**Fuente Santander — parcialmente resuelto**: cada promo tiene un botón que lleva a
`https://www.santander.com.ar/personas/beneficios#/shops?programId={programId}` (página de
"Locales adheridos"). Los datos vienen de:
`GET https://www.santander.com.ar/bff-benefits/publications/{programId}?brandId={brandId}`
Devuelve el objeto completo de la promo, con `brands: [{ id, brand: {...}, establishments: [...] }]`.
Cada `establishment`: `{ id, address, city, province, fantasyName, homePage, shopping,
isApp, latitude, longitude }`. `address`/`city`/`province` siempre vienen completos, pero
`latitude`/`longitude` son frecuentemente `null`. Probado con dos ejemplos:
- programId=5636, brandId=1715 (Mostaza): 223 sucursales, solo 9 con lat/lng null.
- programId=7166, brandId=245 (Jumbo): 41 sucursales, **las 41 con lat/lng null**.

Para las que tienen `null`, requeriría geocoding por `address + city + province` (Nominatim,
rate-limit 1 req/seg) — mismo caso que Macro pero con menos volumen porque algunos brands sí
traen coordenadas.

Nota WAF: igual que Macro, este endpoint requiere `page.goto()` con `headless: false`
(F5/Akamai detecta automation); con `context.request.get()` o `curl` directo el request
queda colgado/timeout sin responder.

**Fuente Banco Ciudad — RESUELTO, la mejor de todas**: la página de detalle
(`https://www.bancociudad.com.ar/beneficios/detalle/{id}`) hace:
`POST https://www.bancociudad.com.ar/beneficios_rest/beneficios/{id}` con body
`{"data":{"latitud": <num>, "longitud": <num>}, "header":{}}`.
- Con `latitud`/`longitud` en `null` (sin permiso de geolocalización), la respuesta NO
  incluye `sucursales_cercanas`.
- Con cualquier par de coordenadas válidas (no importa cuáles — es solo el punto desde el
  que se calcula `distancia`), `retorno.sucursales_cercanas` devuelve **TODAS** las
  sucursales del comercio a nivel país, ordenadas por distancia — no solo las cercanas.
  Cada item: `{ distancia, latitud, longitud, direccion, otrosDatos }`. `direccion` es
  texto libre con calle, localidad y provincia juntos (ej. `"Av. Cabildo 1927, CABA, Buenos
  Aires"`) — requeriría parseo simple para separar `address`/`city`/`province`.
  También viene `retorno.comercio = { nombre, logo, web }`.
  Probado con id=13963 (Cúspide) → 52 sucursales en todo el país, con lat/lng listos
  (sin geocoding).
- Sin problemas de WAF: funciona con `headless: true` y `fetch` normal desde el contexto
  de la página (no requiere `headless: false` como Macro/Santander).
- Una sola consulta por promo trae el universo completo de sucursales del comercio — ideal
  para la arquitectura "una vez por comercio, usando cualquier promo activa".

**Fuente BBVA — RESUELTO, sin WAF**: la página de detalle de cada promo
(`https://www.bbva.com.ar/beneficios/beneficio?id={id}`) consume:
`GET https://go.bbva.com.ar/willgo/fgo/API/v3/communication/{id}`
Responde `{ code, message, data: { ..., canalesVenta: { sucursales: [...], web } } }`.
Cada sucursal: `{ direccion, localidad, latitude, longitude }` (lat/lng vienen como string,
parsear con `parseFloat`). Probado con id=85462 (Sarkany) → 43 sucursales en todo el país,
**0 con lat/lng null**. Funciona con `curl`/`fetch` directo, sin sesión de navegador ni
headless — el más simple de los 4 resueltos hasta ahora. Falta provincia (`localidad` es
solo ciudad/partido), pero no es bloqueante.

**Arquitectura propuesta**: cargar `branches` por **comercio**, no por código de promo
(los códigos de promo cambian con cada renovación, las sucursales físicas casi no cambian).
Para cada comercio sin `branches` cargadas, usar un código de promo activo cualquiera para
obtener el detalle una vez. No repetir en cada corrida del scraper — script separado o con
flag, no parte de "Ejecutar todos".

### 11. Notificaciones push de proximidad (post punto 10)
Idea: avisar al usuario cuando está físicamente dentro/cerca de un comercio que tiene una
promo aplicable a su perfil (ej. "entrás a Coto y la app te avisa que tenés 20% con tu
tarjeta"). Depende de `CommerceBranch.lat/lng` (punto 10) como prerequisito.

Requiere convertir la app en PWA con Service Worker + Web Push API, y geofencing
(`watchPosition` comparando contra `CommerceBranch` cercanos, ej. radio 100m). Limitación
importante: en iOS Safari el geofencing en background es muy limitado (solo notifica con
la app abierta/recién abierta) — para iOS real haría falta app nativa.

Arrancar con versión simple: al abrir la app, si el usuario está cerca de un comercio con
promo matcheada a su perfil, mostrar notificación/banner "soft" (sin background tracking).
Push real en background sería fase 2, una vez que `CommerceBranch` tenga cobertura
suficiente.

### 12. Agrupar promos por comercio en una sola tarjeta expandible — PROTOTIPO LISTO, falta integrar
Hoy un mismo comercio (ej. Coto) puede aparecer varias veces en la grilla porque tiene
promos de distintos bancos/billeteras/tipos. Idea (estilo Clash): agrupar todas las promos
de un mismo `commerceId` en una sola tarjeta, mostrando la destacada (mayor descuento, ya
es la primera por el ordenamiento actual) + chip "+N promos" que expande el resto inline.

Dentro de esa tarjeta expandida, dividir en 2 secciones:
- **Hoy**: promos válidas el día actual (según `validDays`), mostradas primero/expandidas.
- **Otros días**: el resto, colapsado por defecto con un "ver también" — al expandir, mostrar
  en fila horizontal con scroll ("tipo chorizo") las promos válidas otros días de la semana.

Ya implementado: `app/components/CommerceGroupCard.tsx` (grid de 2 col para "Hoy" y "Otros
días", botón "+N promos"/"Ver también") + prototipo `app/promos/grouped-demo/page.tsx`
(probado con Changomas vía `/api/promos?commerces=Changomas&searchMode=exact&view=week`).

Falta integrarlo en `app/promos/page.tsx`: reemplazar las `PromoCard` individuales de cada
`Section` por `CommerceGroupCard` agrupando por `commerceId`, y definir el límite/paginación
de cada sección (¿cuenta comercios agrupados o promos individuales?) — ver punto 11 también
pendiente, ambos quedan para después del punto 10.

## Notas Santander scraper
`TEST_CATS` define qué categorías scrapear. Correr en 3 grupos:
- `'SUP,GAS,DIN,FAR'`
- `'DEP,HOG,IND,CPE,PER'`
- `'VIA,AUT,JUG,LIB,ESP,VAR,EDU'`

## Notas ICBC scraper
`lib/scrapers/icbc.ts` funciona perfecto corrido **localmente** (1495 promos vía intercepción +
fallback con token). Desde GitHub Actions captura 0 rubros/0 items y termina sin promos —
las IPs de datacenter de los runners de GH Actions son bloqueadas por el WAF de
`utilidades-icbc-prod.pisol.net`, no es un bug del scraper. ICBC debe correrse siempre con
"Ejecutar todos" local desde el admin, nunca con "Ejecutar todos GH".

## GitHub Actions desactivado temporalmente (hasta 1/7)
El 13/6 se llegó al 90% de los 2000 minutos/mes de GH Actions (cuenta `danielbere1973`,
repo privado). Se desactivaron los `schedule` (cron) de los 3 workflows en
`.github/workflows/` (`run-scrapers.yml`, `expire-promos.yml`, `refresh-vtex-sessions.yml`),
dejando solo `workflow_dispatch` (disparo manual). El ciclo de minutos se reinicia el
**1 de julio** — reactivar los crons descomentando el bloque `schedule:` en cada archivo.
Mientras tanto, scrapers y expiración de promos se corren manualmente en local.
También se refactorizó `run-scrapers.yml`: el job `check` (sin contenedor) determina qué
scrapers están pendientes y los jobs `run-http`/`run-playwright` solo corren (con `if` a
nivel de job) si hay algo pendiente — evita el pull del contenedor pesado de Playwright
en corridas sin trabajo.
