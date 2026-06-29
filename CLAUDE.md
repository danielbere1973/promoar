# PromoAR — Contexto del proyecto

App Next.js 14 (App Router) + Prisma + PostgreSQL (CockroachDB) que agrega y muestra promociones bancarias de Argentina.

## Stack
- **Frontend**: Next.js 14, Tailwind CSS, NextAuth
- **Backend**: API Routes (App Router), Prisma ORM
- **DB**: PostgreSQL en Neon (migrado desde CockroachDB el 27/6/2026)
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

## Redes y segmentos de tarjetas — RESUELTO (18/6/2026)
Todas las entidades financieras tienen sus `cardNetworks` y `cardSegments` configurados correctamente.
- **Cabal**: exclusivo de Banco Credicoop (removido de los 15 bancos que lo tenían mal asignado).
- **Segmentos**: cada banco tiene sus segmentos Visa/Mastercard/AmEx cargados manualmente.
  Banco Macro incluye los segmentos exclusivos Selecta (Visa Signature Macro Selecta, Mastercard Black Macro Selecta, AmEx Black Macro Selecta).
  Bancos regionales con segmentos propios: Córdoba (Cordobesa), Santiago del Estero (BSE), Corrientes (Visa Agro/Business/Corporate).
- **Billeteras**: Cuenta DNI (Visa), Mercado Pago (Mastercard), Personal Pay (Visa), Uala (Mastercard), Brubank (Visa), Naranja X (Visa/AmEx/Naranja X), Carrefour Banco (Mastercard), CencoPay (Mastercard), BUEPP (Visa).

## Pendiente INMEDIATO — próxima sesión

### 1. Quick filters predefinidos en pantalla principal — RESUELTO/SUPERADO
Ya implementado en `app/promos/page.tsx`: `PRIORITY_CAT_SLUGS` (supermercados, combustible,
transporte, gastronomia, farmacias) ordena las secciones de categorías poniendo esas 5 primero,
y la sección "⭐ Destacadas hoy" muestra promos `isFeatured` + top por descuento dentro de esas
categorías (cap 6). Cubre el objetivo de accesos rápidos a lo más relevante sin agregar chips
de filtro adicionales.

### 2. Estado DB — RESUELTO (17/6/2026)
Limpieza completa: se borraron promos sin requisitos, las 3 con validUntil vencido,
y se revisó el job de expiración. DB limpia.

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

### 7. Normalización de comercios — RESUELTO
Modelo `CommerceAlias` implementado con ABM en admin y botón "Fusionar" en Comercios.
El scraper ya usa alias antes de crear un comercio nuevo (commit 6aabcc0).

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

**Fuente Club LaNación — RESUELTO, la más completa de todas**: cada promo tiene un `crmid`
(código tipo `A05876994` o `A38832`, visible en la URL de la promo,
ej. `https://club.lanacion.com.ar/beneficios/.../descuentos-en-la-pebeta-A05876994`).
`GET https://api-clubv2.lanacion.com.ar/v2/accounts/{crmid}/branches?page={n}`
Devuelve `{ data: [...], meta: { total } }`. Cada sucursal: `{ id, geolocation: { lat, lon }
(strings), display: [direccion, "localidad, provincia"], address, number, state,
neighborhood, city, country, cpa }`. **Trae lat/lng listos**, dirección ya separada en
calle/número/barrio/ciudad/provincia/CP — no requiere geocoding ni parseo. Paginado fijo
de 8 resultados por página (`limit`/`pageSize` se ignoran, hay que iterar `page=1..N` hasta
cubrir `meta.total`). Probado con A05876994 (La Pebeta, 1 sucursal), A01560366 (Estancia Las
Carreras, 1), A05875426 (Óptica Optilent, 1) y A38832 (Carrefour, **692 sucursales** en todo
el país). Sin WAF, funciona con `fetch`/`curl` directo, sin sesión de navegador ni headless
— junto con BBVA, la fuente más simple de implementar, y la única con cobertura nacional
completa de una cadena grande (Carrefour) vista hasta ahora.

**Fuente ICBC — RESUELTO (requiere el mismo bypass de WAF que el resto del scraper)**: el
endpoint ya usado por el scraper, `GET .../api/web/v1/beneficios/detail?url={url}&segment_id=0`
(via `prod-utilidades-icbc.pisol.net`, ver nota de scraper ICBC más abajo), devuelve además
un campo `locations` con sucursales adheridas agrupadas por región
(ej. `{ "Gran Buenos Aires": [{ street, city, state, shopping }, ...], "CABA": [...], ... }`).
Probado con la promo de Coto sábado/domingo → decenas de sucursales con `street`/`city`/
`state` pero **sin lat/lng** (requeriría geocoding). Mismo bloqueo WAF que el resto de ICBC:
el endpoint devuelve 401 con `fetch` directo, solo responde dentro de una sesión de
navegador real (headless está OK, no requiere `headless: false`). Debe correrse local, igual
que "Ejecutar todos" de ICBC.

**Banco Patagonia — investigado, sin datos utilizables**: las páginas de promo
(`ahorrosybeneficios.bancopatagonia.com.ar`, Magento) tienen instalado el módulo MageWorx
Store Locator (`store_locator/location/updatepopupcontent`, POST con `product={id}`), pero
para todas las promos probadas (Farmacity, Carrefour, Burger King, Coto Digital) devuelve
`{"location_ids":[]}` / "There are no stores" — el módulo existe en el theme pero no está
poblado con sucursales para estas promos. Sin sesión de navegador headed (con `headless:
true` ya da 200), pero no hay datos que extraer.

**Banco Supervielle — investigado, sin datos utilizables**: el listado de descuentos
(`https://www.supervielle.com.ar/personas/beneficios/descuentos`) está detrás de un WAF
CloudFront (403 con `fetch`/`headless: true`; requiere `headless: false`). Una vez cargada,
la grilla consume `GET /api/beneficios?rubro={rubro}&esIdentite=false`, que sí responde con
`fetch` directo sin WAF una vez conocido el endpoint. Cada item incluye un campo `zonas`
pensado para restricción geográfica, pero está **vacío en los ~50 items probados** (varios
rubros, incluyendo Supermercados y Carnicerías regionales) — no hay direcciones ni lat/lng
en ninguna parte de la respuesta.

**Clarín 365 — parcialmente resuelto, sin lat/lng**: `365.clarin.com` es una app Nuxt; el
estado `window.__NUXT__` de cualquier página de beneficio incluye objetos de comercios con
`provinces: ["BUENOS AIRES"]` y `locations: ["PILAR","SAN ISIDRO",...]` (nombres de
localidades, sin dirección ni lat/lng). Estos objetos vienen del endpoint
`GET https://365.clarin.com/api/v1/search/companies?limit=N&categories=beneficio&subcategories={slug}`
(sin WAF, `fetch` directo funciona), pero no se logró encontrar el `slug` exacto que
devuelve el comercio de una promo puntual con `total>0` — quedó pendiente el mapeo
promo→`companySlug`/`subcategorySlug`. Útil en el mejor caso para filtrado a nivel
provincia/localidad (sin geocoding), no para sucursales puntuales.

**Fuente Megatone (comercio, no banco) — RESUELTO, sin WAF**: la página
`https://www.megatone.net/sucursales/` consume:
`GET https://www.megatone.net/apirecursoswebv4/api/sucursales`
Devuelve un array plano de **57 sucursales** con `{ idSucursalUnico, nombreCorto, horarios,
direccion, telefono, codigoPostal, localidad, provincia, latitud, longitud }`. **Las 57 con
lat/lng**, cubriendo 20 provincias (Santa Fe, Córdoba, Buenos Aires, Cuyo, NOA, Patagonia,
Litoral) — exactamente el perfil "cadena del interior" que se buscaba. Sin WAF, responde con
`fetch` directo (sin sesión de navegador, sin headless), sin necesidad de geocoding. Esto
abre la puerta a replicar el mismo patrón con otras cadenas: buscar `/sucursales`,
`/tiendas`, `/locales` en el sitio del comercio y revisar si exponen un endpoint JSON
similar antes de asumir que hace falta scraping de HTML o geocoding.

**Fuente Frávega (comercio) — RESUELTO, sin WAF**: la página
`https://www.fravega.com/sucursales/` es Next.js; el `<script id="__NEXT_DATA__">` incluye
`props.pageProps.branches`, un array de **109 sucursales** con
`{ id, name, enabled, contactPhone, openingTime, address: { coordinates: { latitude,
longitude }, postalCode, location, street } }`. **Las 109 con lat/lng** (`without coords: 0`),
`address.location` cubre las **24 provincias** de Argentina (incluye CABA por separado).
Sin WAF, basta un `fetch` directo al HTML y parsear el JSON embebido — no requiere sesión
de navegador ni geocoding. Calidad equivalente a Club LaNación/Banco Ciudad pero para un
comercio puntual (replicable para cualquier sitio Next.js con store locator: buscar
`__NEXT_DATA__` → `pageProps` → array con claves `lat`/`latitude`).

**Fuente ColorShop (comercio) — RESUELTO, la mejor de todas, sin WAF**: la página
`https://www.colorshop.com.ar/stores` (VTEX) consume una GraphQL persisted query propia
(`operationName=branchesList`, provider `iocolorshop.store-branches@0.x`):
`GET https://www.colorshop.com.ar/_v/public/graphql/v1?workspace=master&maxAge=medium&appsEtag=remove&domain=store&locale=es-AR&operationName=branchesList&variables=%7B%7D&extensions={"persistedQuery":{"version":1,"sha256Hash":"953a9a113738e3a3f0dfa67fa62d56990e70d09ee91a2359b5211e89bc762dfd","sender":"iocolorshop.custom-apps@0.x","provider":"iocolorshop.store-branches@0.x"},"variables":"<base64 de {page,pageSize,sortBy,where}>"}`
Devuelve `{ data: { branchesList: { data: [...], pagination } } }`. Cada sucursal:
`{ id, name, address, isActive, city, province, schedules, postalCode,
location: { lat, lng } (strings), contactInfo: { phone, email } }`. Con `pageSize: 500` en
una sola llamada trae **307 sucursales, las 24 provincias, 0 sin lat/lng**. Sin WAF, sin
sesión de navegador, `fetch` directo. El mismo patrón "io{marca}.store-branches" podría
existir para otras tiendas VTEX del mismo desarrollador — probado en Prestigio (también
VTEX, también tiene `/stores` con buscador de sucursales) pero no se encontró la misma
persisted query ahí.

**Fuente Havanna (comercio) — RESUELTO, sin WAF (requiere headers)**:
`POST https://havanna.com.ar/_ajax/getLocales` con header `Referer:
https://havanna.com.ar/nuestros-locales` y `Origin: https://havanna.com.ar` (sin estos
headers devuelve `{"error":true,"message":"Acceso Denegado."}`) devuelve `{ data: [...] }`
con **243 locales en Argentina** (más otros países), cada uno con `direccion`,
`nombre_localidad`, `nombre_zona`, `tipo` (cafe/heladería/etc), `latitud_local`,
`longitud_local`. **Las 243 con lat/lng**. Sin sesión de navegador, `fetch` directo con los
headers correctos.

**Grido — investigado, sin datos utilizables**: `https://argentina.gridohelado.com/locales/`
es una página WordPress estática (FAQ/acordeón "¿Cómo encontrar tu local?"), sin selects,
iframes ni links a un buscador de sucursales — solo dice "413 franquicias en Argentina" sin
listarlas. No se encontró ningún endpoint ni mapa embebido.

**Pinturerías Rex (comercio) — RESUELTO, sin WAF**: `https://somosrex.com/sucursales` (Magento,
módulo `SummaTheme_StorePickup`) embebe en el HTML, dentro de un bloque
`<script type="text/x-magento-init">`, un array `initialStores` con **73 sucursales**:
`{ pickup_location_code, name, latitude, longitude, country_id, region, city, street,
postcode, phone, schedule_id (HTML con horarios) }`. **72 de 73 con lat/lng** (1 sin),
8 provincias (Capital Federal, Buenos Aires, Río Negro, Santa Fe, Neuquén, Córdoba, Mendoza,
Salta). Sin WAF, `fetch` directo al HTML y parsear el JSON embebido (mismo patrón que
Frávega/`__NEXT_DATA__` pero para Magento).

**Bonafide (comercio) — RESUELTO, con limitación de cobertura**: `https://bonafide.com.ar/locales/`
usa el plugin WordPress "WP Store Locator":
`GET https://bonafide.com.ar/wp-admin/admin-ajax.php?action=store_search&lat={lat}&lng={lng}&max_results=500&search_radius=500&skip_cache=1`
Devuelve un array de locales con `id`, `lat`, `lng`, `address`, `city`, `country`, etc. —
**todos con lat/lng**. Sin WAF, `fetch` directo. Limitación: el plugin cappea **siempre a 25
resultados** sin importar `max_results`/`search_radius` (probado con valores hasta 500/500).
Probado desde 3 puntos: Buenos Aires → 25 (capped), Tucumán → 24, Bariloche → solo 3 (poca
cobertura en el sur). Para cobertura nacional completa requeriría el mismo enfoque
multi-punto + dedupe por `id` que BNA (punto 10, fuente BNA).

**Centro Pinturerías TDF (comercio, Tierra del Fuego) — resuelto, sin lat/lng, bajo
volumen**: `https://centropintureriastdf.com.ar/nuestras-sucursales/` es HTML estático sin
API, lista exactamente **6 sucursales** (2 en Río Grande, 4 en Ushuaia) con dirección y
teléfono, sin lat/lng. Volumen tan bajo que geocoding manual de las 6 direcciones sería
trivial si se decide cargar este comercio.

**Pinturerías Rex, Open 25hs, Big Pizza, Seitú — pendiente, dominio no identificado**: los
dominios probados (`rex.com.ar`, `open25.com.ar`, `bigpizza.com.ar`, `seitu.com.ar`) o no
cargaron, dieron error de certificado, o no tienen contenido relacionado (Big Pizza redirige
a un dominio ajeno `tokoagung.store`, probablemente el dominio caducó). La URL provista por
Pablo para "pinturerias rex" (`https://bonafide.com.ar/locales/`) parece un copy-paste
duplicado de la de Bonafide — falta confirmar la URL real de cada cadena.

**Tiendeo.com.ar — RESUELTO, agregador nacional multi-rubro, sin WAF**: Tiendeo (parte de
Shopfully) tiene, para cada cadena con presencia en una ciudad, una página
`https://www.tiendeo.com.ar/{ciudad-slug}/{cadena-slug}` (ej. `/buenos-aires/coto`) con una
sección "Horarios y direcciones {Cadena}" que linkea a páginas individuales por sucursal:
`https://www.tiendeo.com.ar/Tiendas/{ciudad-slug}/{sucursal-slug}/{storeId}` (ej.
`/Tiendas/buenos-aires/coto-peron/50342`). Esa página de sucursal individual sí trae, en
`__NEXT_DATA__` → `props.pageProps.pageInfo.store`, el objeto completo: `{ id, retailer_id,
city, address, zip, province, slug, lat, lng, phone, StoreHour: [...] }` — **lat/lng listos
como string**, más horarios por día de semana. Todo server-rendered, `fetch` directo sin
sesión de navegador ni headless.

Cobertura: `https://www.tiendeo.com.ar/ciudades` (34 páginas, `?page=1..34`) lista cientos
de localidades del país (ej. `/buenos-aires`, `/cordoba`, `/rosario`, ...). Cada
`/{ciudad}/{cadena}` muestra solo las ~5-6 sucursales más cercanas a la geolocalización de
esa ciudad (`pageInfo.storesLimit = 5`), con su slug/id para visitar la página individual.
Esto cubre **decenas de cadenas regionales y nacionales a la vez** (la lista de cadenas con
presencia en Buenos Aires incluye Coto, Carrefour, Changomas, Vea, Makro, Maxiconsumo,
Cordiez, Diarco, Día, Jumbo, Disco, Cooperativa Obrera, La Anónima, Easy, Hiper Libertad,
Atomo Conviene, Farmacity, Naldo Lombardi, Tadicor, Comodín, Hipertehuelche, etc.) — varias
de estas son cadenas que en otras fuentes (La Anónima, Atomo/Cordiez, Cooperativa Obrera)
habían quedado sin datos o solo parcialmente resueltas.

**Implementado**: `scripts/load-tiendeo-branches.ts --retailer-slug <slug-tiendeo> --commerce
<nombre-comercio> [--dry-run] [--cities N]`. Recorre una lista curada de ~31 ciudades (1-2
por provincia, cubriendo las 24), para cada una pide `/{ciudad}/{cadena-slug}`, extrae los
links `/Tiendas/{ciudad}/{slug}/{id}` de la sección "Horarios y direcciones", dedupea por
`id` y luego visita cada página individual para sacar `pageInfo.store` (lat/lng, dirección,
ciudad, provincia, teléfono) y hacer upsert en `CommerceBranch` (`source: 'TIENDEO'`,
`osmId: tiendeo_{storeId}`). ~31 + N_sucursales fetches, sin WAF, ~250ms de delay entre
requests.

Resultados ya cargados (resuelven definitivamente cadenas que en otras fuentes habían
quedado sin datos o solo parcialmente resueltas):
- **Cordiez** (`--retailer-slug cordiez --commerce "Supermercado Cordiez"`): 6 sucursales,
  todas en Córdoba capital, todas con lat/lng.
- **Atomo Conviene** (`--retailer-slug atomo-conviene --commerce "Atomo con MODO"`): 30
  sucursales en CABA/Buenos Aires, Córdoba, Mendoza, Santa Fe, Tucumán, San Juan, San Luis
  y Bariloche, todas con lat/lng.
- **Cooperativa Obrera** (`--retailer-slug cooperativa-obrera --commerce "COOPERATIVA
  OBRERA"`): 25 sucursales en Buenos Aires (La Plata/Mar del Plata/Bahía Blanca), Neuquén,
  Río Negro y Chubut, todas con lat/lng — resuelve el bloqueo 401 de
  `extranet.cooperativaobrera.coop`.
- **Naldo Lombardi** (`--retailer-slug naldo-lombardi --commerce "NALDO"`): 29 sucursales
  distribuidas en casi todas las provincias, todas con lat/lng.
- **La Anónima** (`--retailer-slug la-anonima --commerce "La Anónima"`): 31 sucursales en
  Neuquén, Río Negro, Chubut, Santa Cruz y Tierra del Fuego (Patagonia), todas con lat/lng
  y dirección completa. `Commerce` ya existía (slug `la-anonima`, sin promos activas).

**Toledo — sin datos en Tiendeo**: `supermercados-toledo` existe como retailer pero la
página es siempre `pageType=RETAILER_NATIONAL` con 0 links a sucursales (probado en
Mendoza, San Rafael, San Juan, La Plata, Santa Rosa, Neuquén, Bahía Blanca, Río Cuarto,
San Luis) — Tiendeo no tiene el listado de locales de esta cadena. Sin resolver por esta
vía.

**Tiendeo vs OSM — direcciones**: para los comercios que Tiendeo cubre, sus direcciones
(`pageInfo.store.address`, mantenidas por el propio retailer) son más completas y
confiables que las de `scripts/import-osm-branches.ts` (que dependen de los tags
`addr:street`/`addr:housenumber` de OSM, frecuentemente ausentes o genéricos en
Argentina). No hace falta "reemplazar" OSM: ambas fuentes coexisten como filas separadas
de `CommerceBranch` (`source: 'TIENDEO'` vs `source: 'OSM'`, deduplicadas por
`source`+`osmId`). Para un comercio con cobertura Tiendeo, esa fuente es preferible; para
los que no aparecen en Tiendeo, OSM sigue siendo el fallback.

Pablo sugiere además: aunque un comercio listado en Tiendeo no tenga promos bancarias
activas hoy, vale la pena darlo de alta en `Commerce` + cargar sus `CommerceBranch` igual
(no depende de que tenga promo para ser útil en el filtrado por ubicación).

**MODO — sin fuente de sucursales**: Pablo ya revisó la app/sitio de MODO y no encontró
ningún endpoint o sección de "sucursales adheridas" por comercio. Las promos de MODO se
aplican a través del comercio (QR/NFC en el POS), no hay un listado propio de MODO que
indique qué sucursales de una cadena participan — para comercios con wallet MODO, la
cobertura de `CommerceBranch` debe completarse vía otra fuente (ej. Club LaNación o BBVA si
ese comercio también tiene promos ahí) o quedar sin filtro de sucursal.

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

### 12. Agrupar promos por comercio en una sola tarjeta expandible — DONE
Hoy un mismo comercio (ej. Coto) puede aparecer varias veces en la grilla porque tiene
promos de distintos bancos/billeteras/tipos. Se agrupan todas las promos de un mismo
`commerceId` en una sola tarjeta, mostrando la destacada (mayor descuento) + chip
"+N promos" que expande el resto inline.

Dentro de esa tarjeta expandida hay 2 secciones:
- **Hoy**: promos válidas el día actual (según `validDays`), mostradas primero/expandidas.
- **Otros días**: el resto, colapsado por defecto con un "ver también" — al expandir, se
  muestran en grid de 2 columnas las promos válidas otros días de la semana.

Implementado en `app/components/CommerceGroupCard.tsx` (recibe `nearbyCount` y lo propaga
al `PromoCard` destacado/expandido para el badge "📍 N sucursales"). Integrado en
`app/promos/page.tsx`: dentro de cada `Section` (layout Netflix por categoría), `promoList`
se agrupa por `commerce.id ?? commerce.name` preservando el orden (ya viene ordenado por
descuento/popularidad), y el límite `PREVIEW`/"Ver todas →" ahora cuenta **comercios
agrupados**, no promos individuales. El prototipo `app/promos/grouped-demo/page.tsx` queda
como referencia/demo aislada.

### 14. Sincronización de categorías comercio↔promo — RESUELTO (17/6/2026)
1565 promos tenían categoría detectada por keyword (scraper) que no coincidía con la
`defaultCategory` del comercio (ej. Farmacity en "Salud y Belleza" en vez de "Farmacias").
Fix en DB: `UPDATE promos SET categoryId = commerce.defaultCategoryId WHERE diffieren`.
Fix en scraper (`app/api/admin/scrape/route.ts`): en el upsert de promo usar
`target.defaultCategoryId ?? catMatch.id` para que la categoría del comercio resuelto
(post alias) siempre pise la detección por keywords.
Fix en Banco Ciudad (`lib/scrapers/bancociudad.ts`): no asignar rubro "Combustible" a
comercios cuyo nombre no es una empresa de combustible conocida.

### 16. Auto-validador de DRAFTs — DONE (19/6/2026)
`POST /api/admin/auto-validate`: corre 7 reglas sobre cada DRAFT y aprueba automáticamente
los que pasan. Los problemáticos quedan en DRAFT con el motivo visible en el panel.

**Reglas (en orden):**
1. Sin requirements → "Sin requisitos de pago"
2. Requisito con banco+wallet+red todos null → "Requisito sin entidad financiera"
3. `cap === 0 && !capUnlimited` → "Tope en $0 — verificar si es sin tope"
4. `discountValue === 0` → "Descuento en 0"
5. `validDays === 0` → "Sin días válidos"
6. Requirements duplicados (mismo bankId|walletId|discountType|discountValue) → "Requisitos duplicados"
7. Ya existe ACTIVE con mismo commerceId + título (normalizado) → "Ya existe activa con mismo comercio y título"

**UI**: botón "Auto-validar" (azul con escudo) en toolbar de pendientes. Banner de resultado
post-ejecución. Chips amarillos por promo flaggeada con el motivo exacto.
**Resultado típico**: ~90% aprobadas automáticamente, ~10% quedan para revisión manual.
**Próximo paso**: correr automáticamente post-scraper una vez validado que las reglas son suficientes.

### 17. Mejoras scraper MODO — DONE (19/6/2026)
- **cardNetworks eliminados**: pagos MODO van por la wallet, no por la red de tarjeta.
  Antes generaba 4-8 requirements por promo (banco+MODO, banco+Visa, banco+Mastercard, banco+null),
  ahora solo banco+MODO. Fix: `cardNetworks: undefined` cuando hay `walletNames`.
- **Dedup de reqData** en `app/api/admin/scrape/route.ts`: antes de upsert, filtra requirements
  con clave idéntica `(bankId|walletId|cardNetworkId|cardSegmentId|discountType|discountValue)`.
- **Fallback de descuento desde slug**: si `discount_info`/`title`/`short_description` no tienen "%",
  extrae desde el slug (`30off` → 30%, `12csi` → 12 CSI, `10-comercio-banco` → 10%).
  La API de MODO no siempre incluye el símbolo % en los campos textuales.

### 18. Panel edición pendientes — rediseño como modal — DONE (19/6/2026)
`EditPanel` (sidebar 288px) → `EditModal`: overlay centrado max-w-4xl, cierre con backdrop.
- Requirements en tabla con todas las columnas editables: Banco | Billetera | Red | Canal | Tope ($) | Período | Mínimo ($)
- `buildForm` y API PATCH ahora incluyen `cap`, `capPeriod`, `capUnlimited`, `minPurchase` por requirement.
- Promo fields en grilla 2 columnas.

### 15. OG image dinámica `/api/og/daily` — EN PROGRESO
Genera una imagen 1080×1080 con las mejores promos del día (top categorías prioritarias).
Código en `app/api/og/daily/route.tsx`, sin commitear. Falta integrarlo a `<meta og:image>`
o endpoint de generación para redes sociales.

### 13. SSR + Paginación de `/promos` — DONE (rama `feature/pagination`, pendiente merge)

**Fase 1 SSR** — ya mergeada a `main`: `app/promos/page.tsx` (Server Component) hace
SSR de 300 promos (`PREVIEW_TAKE=300`) para dar HTML real al crawler. LCP en Vercel:
**2.1s**, SEO: **1.0**. `getPromosData` acepta `take?` y devuelve `{ promos, totalCount }`.

**Fase 2 Paginación** — rama `feature/pagination`, commiteada, pendiente push y merge:
Resuelve el fetch de 38MB por carga anónima. Resultado verificado localmente:
**~1.3MB por carga inicial** (500 promos por página). Implementado:

- **Schema** (`prisma/schema.prisma`): nuevos campos en `Promo` (`maxDiscountPct Int?`,
  `isCSIOnly Boolean @default(false)`) y en `Commerce` (`activePromoCount Int @default(0)`).
  Índice compuesto `@@index([status, isCSIOnly, maxDiscountPct(sort: Desc)])`. Ya aplicado
  con `npx prisma db push` y backfill (`scripts/backfill-sort-fields.ts`,
  `scripts/backfill-commerce-count.ts`).

- **Sort DB-level** (`lib/getPromos.ts`): cuando `paginate=true`, usa
  `orderBy: [isCSIOnly ASC, maxDiscountPct DESC NULLS LAST, id ASC]` directamente en
  Prisma (sin el sort JS que era filter-dependent). El sort JS original se mantiene
  para el path `paginate=false` (usuarios con perfil, filtros → set chico).

- **API** (`app/api/promos/route.ts`): auto-detecta `paginate=true` cuando es invitado
  sin filtros de banco/wallet/red/categoría. Acepta `?page=N&pageSize=500`, devuelve
  `hasMore` en la respuesta.

- **Scraper** (`app/api/admin/scrape/route.ts`): calcula `maxDiscountPct` e `isCSIOnly`
  al hacer upsert de cada promo; actualiza `activePromoCount` en los comercios afectados
  al final de cada run.

- **Cliente** (`app/promos/PromosClient.tsx`): estado `page`/`hasMore`/`loadingMore`,
  append de promos en page>1, reset a page=1 al cambiar filtros, botón
  "Ver más promos →" visible cuando `hasMore=true`, overlay "Ver todas" de cada
  categoría hace fetch on-demand `/api/promos?categories=X` en vez de filtrar el array.

**Pendiente**: push de `feature/pagination` y merge a `main`, correr Lighthouse en
Vercel para confirmar LCP ~2s y banda <2MB por carga anónima.

## Sesión 28/6/2026 — Hecho y pendiente

### Hecho

**Migración CockroachDB → Neon — DONE**
- `scripts/neon-drop-all.ts`: borra todas las tablas y enums del schema público de Neon (para limpiar antes de migrar)
- `scripts/migrate-to-neon.ts`: migra tabla por tabla respetando FKs, batch de 500 filas, fallback fila a fila en caso de FK violation, `ON CONFLICT DO NOTHING` para rerun seguro
- Resultado: 12826 promos, 42855 requirements, 7939 comercios, 18701 branches, 3228 vtex_promo_cache migrados
- `prisma/schema.prisma`: provider cambiado de `cockroachdb` a `postgresql`
- `.env` y Vercel apuntan a Neon. CockroachDB en standby (no eliminado, para referencia de billing)
- Impacto en storage: CockroachDB ~604MB → Neon ~0.05GB (compresión/encoding diferente)

**Logo login actualizado — DONE**
- `public/promoar_logo_transparent.png`: fondo blanco removido con Python/PIL (umbral R,G,B > 230 → alpha 0)
- `app/login/page.tsx`: reemplaza el ícono verde con rayo por el logo nuevo transparente; se eliminó el texto "Gestioná tus ahorros inteligentemente"

**Badge "Última actualización" en cartel de promos — DONE**
- Modelo `SiteConfig` en Prisma (key/value), tabla `site_config` creada con `db push`
- `app/api/admin/site-config/route.ts`: POST (admin only) para guardar config
- `app/api/site-config/route.ts`: GET público para leer config (agregado a `PUBLIC_PATHS` en middleware)
- Admin → tab Stats: campo editable + botón Guardar para setear el texto
- `PromosClient`: badge naranja `absolute top-3 right-4` en el cartel azul, visible cuando hay valor en DB
- Layout desktop rediseñado: días de la semana movidos a la fila de categorías (junto a los chips), liberando el espacio arriba a la derecha para el badge

**Tour guiado de funciones — DONE**
- `app/components/TourOverlay.tsx`: overlay con spotlight SVG (recorte sobre el elemento), tooltip con flechas, dots de progreso, botones Siguiente/Atrás/Saltar
- 2 flujos: invitado (8 pasos) y logueado (10 pasos)
- Pasos: bienvenida, etiquetas de tarjetas, Todas/Para Mí (con explicación del perfil financiero), Hoy/Semana, Filtros avanzados, Buscador de comercios y productos, Favoritos (solo logueado), Finanzas, Perfil, CTA registro
- IDs agregados: `#tour-todas-parami`, `#tour-hoy-semana`, `#tour-favoritos`, `#tour-filtros`, `#tour-buscador`, `#tour-nav-{label}` en BottomNav, clase `promo-card` en PromoCard
- Arranca 3.5s después del mount (para no chocar con el popup de ubicación que arranca a 2s)
- Bloqueado mientras `showProvinceSelector=true`
- Botón `?` fijo en esquina inferior derecha para relanzarlo manualmente
- `localStorage.promoar_tour_done` marca si ya fue visto

**Refresh Cencosud local — DOCUMENTADO**
- El botón "Refresh Cencosud" del admin dispara `refresh-vtex-sessions.yml` en GH Actions (consume minutos)
- Alternativa local: `VTEX_SESSION_SECRET="promoar-vtex-2026" node scripts/refresh-vtex-sessions.js` (requiere `npm run dev` corriendo)

**Primer usuario registrado y tracción SEO**
- Google Search Console: 1230 impresiones / 22 clics en 24hs, posición media 10.2 (primera página)
- 2 usuarios registrados
- Post publicado en r/descuentosargentina

### Sesión 27/6/2026 — Hecho

**Favacard scraper — DONE**
- `lib/scrapers/favacard.ts`: POST a `promosfavacard.com.ar`, parsea ~2773 promos de ~1988 comercios locales del interior de Bs As (Mar del Plata, Bahía Blanca, Necochea, etc.)
- Wallet `Favacard` + CardNetwork `FAVA` + 5 CardSegments (Trayectoria, Beca, Recargable, Cabal, FAVA)
- Integrado en `lib/scrapers/index.ts` (TARJETA_SCRAPERS + ALL_SCRAPERS)
- Integrado en `app/admin/page.tsx` (SCRAPERS_CONFIG, reporte banco, SOURCE_LABELS)
- Integrado en `app/api/admin/stats/route.ts` (scraperDomains + SCRAPER_DOMAINS)

**SEO páginas de promo — DONE** (`app/promos/[slug]/page.tsx`)
- Title sin duplicado: se quitó "— PromoAR" del título generado; el template del layout agrega "| PromoAR" una sola vez
- Meta description generada desde datos estructurados (comercio, descuento, banco, redes, días, vencimiento) en lugar del texto crudo del scraper
- Párrafo SEO visible en el body (`text-justify`, `dark:text-slate-400`) con el mismo contenido natural
- Helper `buildDaysLabel()` con patrones comunes (lun-vie, finde, lun-sáb, etc.)

**Páginas informativas — DONE**
- `app/como-funciona/page.tsx`: guía paso a paso (4 pasos + features grid + disclaimer + CTA)
- `app/faq/page.tsx`: 14 preguntas frecuentes con `<details>` expandible, incluye Comunidad, Finanzas y Favacard

### Sesión 29/6/2026 — Hecho

**Tour guiado mobile — DONE**
- `TourOverlay.tsx` rediseñado para mobile: panel fijo arriba del navbar con flechita apuntando al elemento resaltado. En desktop sigue como tooltip flotante cerca del elemento.
- `findVisibleEl()`: busca el primer selector visible (tamaño > 0) entre múltiples separados por coma. Permite fallbacks mobile/desktop en el mismo step.
- IDs mobile agregados en `PromosClient.tsx`: `#tour-todas-parami-mobile`, `#tour-hoy-semana-mobile`, `#tour-buscador-mobile` apuntando a los elementos reales de la UI mobile (no al sidebar desktop ni a `hidden md:flex`).
- Steps actualizados con fallbacks: `'#tour-todas-parami, #tour-todas-parami-mobile'`, etc.
- Botón `?` movido a la izquierda (`bottom-20 left-4`) para no chocar con el chat de Crisp.
- `scrollIntoView({ block: 'center' })` + 650ms timeout en mobile para dejar el elemento centrado en pantalla antes de capturar rect.
- Badge "Actualizado" solo en desktop (`hidden lg:block absolute`); en mobile aparece como texto pequeño debajo del contador de promos.

**Auto-validador — fixes DONE**
- Regla "Descuento en 0" excluye NXM: promos 2x1 tienen `discountValue=0` por diseño (se guardan con `nxmN/nxmM`), no deben ser rechazadas.
- Galicia scraper: `topeReintegro=0` en la API significa "sin tope" → ahora setea `capUnlimited=true` en vez de dejar `cap=0`.
- Scrape route: fix de requirement fantasma `bankId=null+walletId=null+networkId=null` generado cuando una promo tiene wallet + red de tarjeta específica (ej. Personal Pay + Visa). El loop producía la combinación all-null que disparaba "Requisito sin entidad financiera". Fix: skip en el loop cuando los tres son null.

### Pendiente inmediato — próxima sesión

**Restyling version mobile — PRIORITARIO**
La UI mobile necesita una revisión de diseño completa. Ver con Pablo qué aspectos mejorar.

**GitHub Actions — reactivar el 1/7**
Descomentar bloque `schedule:` en `.github/workflows/run-scrapers.yml`, `expire-promos.yml` y `refresh-vtex-sessions.yml`.

**Domain promoar.com.ar — migrar a nuevo Vercel**
El viejo Vercel (bloqueado por bandwidth) tiene el dominio. El nuevo Vercel tiene el código actualizado.
Opciones: esperar reset del 1/7 y actualizar env vars, o hacer la migración a las 3am (poco tráfico).
Ambos Vercel son espejo del mismo código en GitHub.

**Tour guiado — mejoras pendientes**
- Videos cortos interactivos explicativos por funcionalidad (fase 2 del tour)
- Instructivo del perfil financiero (tour propio separado del tour general)

**SSR + Paginación — pendiente merge** (rama `feature/pagination`)
Fase 1 SSR ya mergeada. Fase 2 paginación: reduce la carga anónima de 38MB a ~1.3MB (500 promos por página).
Rama commiteada localmente, nunca pusheada ni mergeada a main.
Después del merge: correr Lighthouse en Vercel para confirmar LCP ~2s y <2MB por carga anónima.

**Título dinámico "DISPONIBLES HOY/SEMANA/TODOS" — pendiente**
El cuadro superior de promos siempre dice "DISPONIBLES HOY" aunque el usuario haya filtrado por semana o todos los días.
- Filtro "Hoy" → "DISPONIBLES HOY"
- Filtro "Semana" → "DISPONIBLES ESTA SEMANA"
- Sin filtro / todos → "DISPONIBLES TODOS LOS DÍAS"

**Logos faltantes — pendiente**
Ver `logos-report.csv` en la raíz. 700 comercios sin logo, 522 con favicon Google (algunos son el ícono genérico de globo).
Priorizar comercios con 5+ promos activas.

**OG image dinámica — pendiente commitear**
`app/api/og/daily/route.tsx`: genera imagen 1080×1080 con las mejores promos del día para compartir en redes.
Código existe pero sin commitear. Falta integrarlo al `<meta og:image>` del sitio.

**Filtrado por ubicación del usuario — parcialmente implementado**
Scripts listos para cargar sucursales desde: BNA, Galicia, Ciudad, BBVA, Club LaNación, ICBC, Tiendeo.
Falta: cargar sucursales de más comercios y conectar el filtrado real en `/api/promos`.
Depende de `CommerceBranch` con lat/lng completos por comercio.

**Post Reddit — DONE (r/descuentosargentina)**
Publicado. 500+ vistas, tracción SEO visible en Google Search Console.

## Estrategia de monetización — referencia futura

**Cuándo pensarlo**: cuando haya tracción real sostenida (>5.000 usuarios activos/mes o
>50.000 sesiones/mes). Antes de ese umbral, monetizar distrae del producto y puede ahuyentar
usuarios en etapa de crecimiento. El foco ahora es retención y SEO.

### Opciones simples (arrancar rápido, bajo riesgo, no requieren acuerdos)

- **Adsense / display ads**: banner en página de detalle de promo o al final de la grilla.
  Bajo RPM en Argentina (~$0.3–$1 CPM), pero cero fricción para implementar. Riesgo: degrada UX.
  Solo vale si el volumen es alto.

- **Afiliados de tarjetas/bancos**: algunos bancos y fintechs tienen programas de referidos
  (Uala, Naranja X, Mercado Pago, Brubank). CPA por cuenta abierta o tarjeta activada.
  Encaja natural con el perfil financiero del usuario. Implementar como CTA contextual
  ("¿No tenés esta tarjeta? Abrila gratis →") en página de detalle de promo.

- **Afiliados de e-commerce**: si el comercio tiene tienda online (Shopify, VTEX, etc.),
  enlazar "Comprar online" con link de afiliado (ej. Awin, Admitad, programas propios).
  Depende de que los comercios tengan programas activos en Argentina.

### Opciones de mediana complejidad (requieren algo de desarrollo o acuerdos simples)

- **Suscripción premium**: plan gratuito (promos del día, perfil básico) vs plan pago
  (~$2.000–$4.000 ARS/mes) con: alertas push personalizadas, historial de ahorro,
  comparador de cuotas, export CSV, acceso anticipado a promos del día siguiente.
  Implementar con Stripe (pesos vía MercadoPago como alternativa local).

- **Destacado de promos patrocinadas**: los bancos pagan para que su promo aparezca primero
  en la grilla o en la sección "Destacadas hoy". Badge "Patrocinado" para cumplir
  transparencia. Comercializar directamente con áreas de marketing de bancos medianos
  (Ciudad, Supervielle, regional). Precio sugerido: fee fijo mensual por categoría destacada.

- **Newsletter de ahorro semanal**: resumen de las mejores promos de la semana, segmentado
  por perfil financiero. Monetizar con sponsors bancarios (el banco X "patrocina" la sección
  supermercados de esa semana). Herramienta: Resend o SendGrid + lista de suscriptores.

- **Widget embebible para medios**: widget JS que muestra las mejores promos del día,
  embebible en sitios de noticias de economía (Infobae, Cronista, Ámbito). Revenue share
  con el medio o fee fijo. Requiere API pública y acuerdo comercial.

### Opciones complejas (alto potencial, requieren inversión de tiempo o terceros)

- **Datos B2B / research**: vender informes agregados de comportamiento de promos
  (qué bancos tienen más descuentos en qué categorías, evolución de caps, etc.) a consultoras,
  medios especializados, o a los propios bancos para benchmarking competitivo.
  Requiere dashboard de reportes y contratos. Alta barrera de entrada, alto ticket.

- **API para fintechs / apps de finanzas personales**: exponer un feed de promos matcheadas
  por perfil a apps como Fintual, Mango, Portfolio Personal u otras que quieran mostrar
  beneficios a sus usuarios. Modelo: licencia mensual por cantidad de requests o usuarios.
  Requiere API key management, SLA, documentación.

- **Marketplace de cashback propio**: en vez de simplemente informar la promo, intermediar
  la transacción y cobrar comisión (% de la venta). Complejidad muy alta, requiere
  integración con POS o e-commerce de cada comercio.

### Principios para no arruinar el producto al monetizar
- Nunca mostrar promos falsas o infladas para beneficiar a un sponsor — la confianza es el activo.
- Separar siempre contenido editorial (promos scrapeadas) de contenido pagado (badge visible).
- El perfil financiero del usuario es privado: no vender datos individuales, solo aggregados.
- Empezar por el canal que menos fricción agrega a la UX existente (afiliados contextuales).

## Estrategia de promoción / marketing — referencia futura

El objetivo de cada canal es distinto: SEO y Reddit traen usuarios con intención alta (buscan ahorrar),
TikTok/Instagram traen volumen con costo de atención alto. Mezclar ambos según la etapa del producto.

### Orgánico — sin presupuesto

**SEO (ya iniciado)**
- Páginas de detalle de promo ya indexadas, posición media 10.2 en Google.
- Oportunidad: páginas de categoría (`/promos/supermercados`, `/promos/combustible`) con
  contenido estático que explique "cómo aprovechar descuentos en supermercados con tarjeta en 2026".
- Oportunidad: artículos tipo "¿Cuándo conviene usar Visa vs Mastercard en Coto?" — long-tail de búsqueda.
- Herramienta: Google Search Console (ya activo) + Ahrefs free tier para keywords.

**Reddit**
- r/descuentosargentina: ya publicado, 500+ vistas. Seguir con posts semanales de las mejores promos.
- r/argentina, r/finanzaspersonalesarg: posts educativos ("cómo configurar tu perfil para no
  perderte ninguna promo de tu banco").
- Regla: nunca spamear. Un post útil cada 2-3 semanas. La comunidad detecta y banea el spam.

**TikTok orgánico**
- Formato ideal: video corto (15-30 seg) mostrando "esta semana con Visa en Coto tenés 30% — así
  se carga el perfil en PromoAR". Demostración de la app en uso real, no publicidad.
- Gancho de alto engagement en Argentina: "cuánto ahorrás en el super si usás la tarjeta correcta".
- Frecuencia sugerida: 3-4 videos por semana para ganar alcance orgánico inicial.
- Cuenta dedicada @promoar.ar o @ahorraararg. Niche de finanzas personales en español crece fuerte.

**Instagram orgánico**
- Stories: "promo del día" — imagen de la promo destacada, swipe up a la app.
  Herramienta: OG image dinámica (`/api/og/daily`) ya en desarrollo, ideal para esto.
- Reels: mismo contenido que TikTok, resubido (Instagram favorece Reels en el algoritmo actual).
- Carruseles: "Las 5 mejores promos de este finde" — alto share rate, guardados.
- Hashtags: #descuentosargentina #ahorrarpesos #tarjetasdecredito #promosbancos

**Facebook orgánico**
- Grupos de ahorro y finanzas: "Ahorro en Argentina", "Descuentos y promociones Argentina" —
  hay grupos con 100k+ miembros. Publicar las mejores promos semanalmente con link a la app.
- Página de PromoAR: menos orgánico que antes, pero sirve como canal de soporte y credibilidad.
- Funciona bien para el segmento +35 años que todavía usa Facebook activamente.

**WhatsApp / Telegram**
- Canal de WhatsApp o grupo de Telegram "PromoAR Alertas": enviar las 3 mejores promos del día.
  Costo cero, engagement altísimo (open rate ~90% vs ~20% email). 
- Conectar con el sistema de notificaciones push existente para no duplicar trabajo.
- Estrategia de crecimiento: invitar desde la app ("Unite al canal de alertas").

**Comunidades y foros**
- MercadoLibre Comunidad, foros de bancos (ej. grupos de clientes Galicia/Santander en Facebook).
- Responder consultas de ahorro en Quora España/Argentina con links a promos relevantes.
- Colaboraciones con creadores de contenido de finanzas personales en Argentina (micro-influencers,
  canales de YouTube tipo "Finanzas con [nombre]") — canjes o revenue share.

### Pagado — con presupuesto

**Google Ads (Search)**
- Mayor intención de compra de todos los canales: alguien que busca "30% descuento Coto Visa"
  ya quiere la info. CPC bajo en nicho finanzas Argentina ($0.05–$0.20 USD estimado).
- Keywords objetivo: "promociones bancarias Argentina", "descuentos tarjeta [banco]",
  "cuotas sin interés supermercados", "promos [día de semana]".
- Página de destino: `/promos` con filtro pre-aplicado según la keyword.
- Presupuesto mínimo razonable para testear: USD 50-100/mes.

**Google Ads (Performance Max / Display)**
- Remarketing: usuarios que visitaron la app y no se registraron → mostrar banner
  "Activá alertas gratis para no perderte ninguna promo".
- Audiencias similares basadas en visitantes actuales.

**Meta Ads (Facebook + Instagram)**
- Audiencia: 25-50 años, Argentina, intereses en "ahorro", "finanzas personales",
  "tarjetas de crédito", "supermercados".
- Formato más efectivo para este tipo de app: video demo de 15-30 seg mostrando el flow
  (abrir app → ver promo → ir al super → ahorrar).
- Objetivo de campaña: conversiones (registro en la app) o tráfico a `/promos`.
- CPM en Argentina es barato (~$1-3 USD). Presupuesto mínimo para testear: USD 50/mes.
- Lead Ads: capturar email directamente en Facebook para newsletter → luego onboarding.

**TikTok Ads**
- Spark Ads: boost de videos orgánicos que ya funcionaron bien. Más creíble que un ad puro.
- In-feed Ads: mismo formato que un TikTok orgánico pero con CTA "Instalar app" o "Abrir sitio".
- Audiencia: 18-35 años, Argentina. CPM muy bajo (~$0.5–$1.5 USD), buen momento para entrar.
- Funciona mejor cuando ya hay contenido orgánico probado — primero crecer orgánico, luego escalar con paid.

**Influencer / creadores de contenido pagados**
- Micro-influencers (10k–100k seguidores) de finanzas personales en Argentina: fee único por
  video o post mostrando la app. Más auténtico y barato que macros.
- Buscar en: TikTok (#ahorrar #finanzasargentina), Instagram, YouTube.
- Fee estimado: USD 50-300 por post para micro-influencer. Medir con UTM por creador.

### Cuándo arrancar con paid

- Orgánico primero hasta ~2.000-3.000 usuarios activos/mes. Sirve para validar qué mensaje
  resuena antes de pagar por amplificarlo.
- Primera inversión pagada recomendada: Google Search Ads (intención alta, resultados medibles).
- Segunda: Meta Ads con video orgánico que ya funcionó bien en TikTok/Instagram.
- TikTok Ads: cuando haya contenido orgánico probado y presupuesto para escalar.

### Métricas clave por canal
- SEO: posición media, clics orgánicos (Google Search Console).
- Redes sociales: tasa de conversión visita → registro (Google Analytics / Vercel Analytics).
- Paid: CAC (costo de adquisición por usuario registrado), comparado contra LTV estimado.
- Retención: % de usuarios que vuelven a la semana siguiente (el único número que importa a largo plazo).

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
