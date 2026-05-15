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

## Notas Santander scraper
`TEST_CATS` define qué categorías scrapear. Correr en 3 grupos:
- `'SUP,GAS,DIN,FAR'`
- `'DEP,HOG,IND,CPE,PER'`
- `'VIA,AUT,JUG,LIB,ESP,VAR,EDU'`
