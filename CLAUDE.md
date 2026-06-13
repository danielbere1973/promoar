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
Supermercados, Combustible, Gastronomía, Farmacias, Indumentaria, Tecnología, Mascotas, Transporte, Heladerías, Hogar, Entretenimiento, Salud y Belleza, Deportes, Jugueterías, Librerías, Viajes y Turismo, Shoppings, Automotores, Otros, Sin Categoría

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

### 1. Quick filters predefinidos en pantalla principal
Chips rápidos fijos en la barra (sin abrir el drawer):
- Top 3 categorías más populares del día (ya viene `promoCount` de `/api/categories`)
- Top 3 rangos de descuento más frecuentes entre las promos activas hoy
Calcular en `page.tsx` a partir de las promos ya cargadas y las categorías.

### 2. Pendiente DB
- DELETE FROM promos + re-scraping completo (hay ~20k promos con datos corruptos)
- Antes de borrar: exportar CSV desde admin
- Después: DELETE FROM commerces WHERE "logoUrl" IS NULL

### 3. Promos con múltiples comercios ("Disco y Vea", "Supermercados Disco & Vea")
Cuando el scraper trae storeName con " y " o " & " y ambas partes matchean comercios existentes,
duplicar la promo asignando una a cada comercio. Actualmente se guarda como un comercio ficticio.

### 4. Comercios Cencosud a limpiar
"Especial Cencosud" y "CENCOSUD PRODUCTOS SELECCIONADOS" no son comercios reales —
Cencosud no vende con esa marca al público. Identificar qué scraper los genera y filtrarlos.
Eliminar de la DB o reasignar las promos a los comercios correctos (Jumbo/Disco/Vea).

### 5. Personal Pay promos con "2%" incorrecto
Scraper interpreta promos "2x1" como "2%" porque detecta número seguido de símbolo.
Agregar lógica para detectar y descartar o etiquetar correctamente promos tipo "Nx1".

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
