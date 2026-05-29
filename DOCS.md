# PromoAR — Documentación Técnica

> Última actualización: mayo 2026

---

## Índice

1. [Arquitectura general](#1-arquitectura-general)
2. [Modelos de base de datos](#2-modelos-de-base-de-datos)
3. [Scrapers](#3-scrapers)
4. [API Routes principales](#4-api-routes-principales)
5. [Pipeline Cencosud (VtexPromoCache)](#5-pipeline-cencosud-vtexpromocache)
6. [Matching de perfil financiero](#6-matching-de-perfil-financiero)
7. [Variables de entorno](#7-variables-de-entorno)
8. [Tareas programadas](#8-tareas-programadas)

---

## 1. Arquitectura general

### Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS |
| Backend | Next.js API Routes (Edge-compatible) |
| ORM | Prisma 5 |
| Base de datos | CockroachDB (PostgreSQL-compatible, 10 GB, sin límite de egress) |
| Autenticación | NextAuth.js (JWT, Credentials + Google OAuth) |
| Email transaccional | Resend |
| Scraping estático | Playwright (Chromium headless) |
| Scraping dinámico | fetch nativo + cheerio (HTML) |
| CI/CD | GitHub Actions |
| Hosting | Vercel (inferido del uso de Next.js + env vars de producción) |

### Flujo de datos general

```
Usuario (browser)
        │
        ▼
  Next.js 14 (Vercel)
  ┌─────────────────────────────────────────────┐
  │  app/page.tsx           ← pantalla principal │
  │  app/admin/page.tsx     ← panel admin        │
  │  app/promos/[slug]      ← detalle promo      │
  │  app/precios/           ← comparador precios │
  │  app/finanzas/          ← tasas/finanzas     │
  └───────────────────────┬─────────────────────┘
                          │ fetch / server action
                          ▼
                 API Routes (app/api/)
                          │
                          ▼
                  Prisma Client
                          │
                          ▼
                   CockroachDB
                  (AWS us-east-1)
```

### Flujo de scrapers

```
Admin  ──POST /api/admin/scrape──►  lib/scrapers/*.ts
                                          │
                              ┌───────────┴──────────────┐
                              │ HTTP fetch / Playwright   │
                              │ (sitios de bancos/supers) │
                              └───────────────────────────┘
                                          │
                                  ScrapedPromo[]
                                          │
                                  Agrupación por
                                  title + sourceUrl
                                          │
                                  Resolución de entidades
                                  (banco, wallet, red, cat.)
                                          │
                              Prisma upsert → CockroachDB
```

### Flujo Cencosud (asincrónico)

```
GitHub Actions (cron cada 2 días)
        │
        ▼
scripts/refresh-vtex-sessions.js
  (Playwright en Ubuntu + Xvfb)
        │  navega categorías
        │  intercepta /_v/search-promotions
        │  acumula { skuId, promoCode, effectiveDiscount }
        ▼
POST /api/internal/vtex-promos
  (Bearer VTEX_SESSION_SECRET)
        │
        ▼
  VtexPromoCache en DB
        │
        ▼ (leída en cada búsqueda de /precios)
GET /api/precios/search
  getCencosudPromos() → cache en memoria 30 min
```

---

## 2. Modelos de base de datos

### Tablas principales

| Tabla | Descripción |
|---|---|
| `users` | Usuarios registrados (email/password o Google). Incluye datos de perfil personal y dirección. |
| `accounts` | Cuentas OAuth de NextAuth |
| `sessions` | Sesiones de NextAuth |
| `trusted_devices` | Dispositivos confiables para saltear 2FA |
| `financial_profiles` | Perfil financiero de cada usuario (1:1 con User) |
| `user_banks` | Bancos declarados por el usuario |
| `user_wallets` | Billeteras declaradas por el usuario |
| `user_cards` | Tarjetas del usuario (banco + red + tipo + segmento) |
| `banks` | Catálogo de bancos (nombre, slug, BCRA code, código MODO) |
| `wallets` | Catálogo de billeteras digitales |
| `card_networks` | Redes de tarjetas (Visa, Mastercard, AmEx…) |
| `card_segments` | Segmentos de tarjeta por red y tipo (Visa Gold Crédito, AmEx Black Macro Selecta…) |
| `bank_segments` | Segmentos bancarios (Selecta, Eminent…) |
| `bank_modo_codes` | Tabla auxiliar: códigos MODO adicionales por banco |
| `categories` | Categorías de promos (19 + Sin Categoría). Tiene `icon`, `color`, `order`. |
| `commerces` | Comercios. Tiene `logoUrl`, `defaultCategoryId` (aprendizaje automático). |
| `promos` | Tabla central. Tiene `validDays` (bitmask de 7 bits), `specificDates` (JSON), `provinces` (array), `salesChannel`. |
| `promo_requirements` | Requisitos de cada promo (banco/wallet/red/tipo/segmento + descuento). Una promo puede tener N requirements (ej: 30% + 6 CSI). |
| `finance_items` | Instrumentos financieros: plazos fijos, caución, LECAP, ON, FCI MM, tipos de dólar. |
| `vtex_promo_cache` | Cache de promos de Jumbo/Disco/Vea generado por GitHub Actions. Clave: (site, skuId, segment). |
| `community_posts` | Posts de la comunidad (AVIVADA, PROMO, ERROR_PRECIO, COMBO, CONSULTA) |
| `post_likes` | Likes de posts de comunidad |
| `promo_reports` | Reportes de promos incorrectas |
| `saved_promos` | Promos guardadas por usuario |
| `currencies` | Catálogo de monedas |
| `financial_account_types` | Tipos de cuenta financiera |
| `verification_tokens` | Tokens de verificación de NextAuth |

### Campos clave del modelo `Promo`

| Campo | Tipo | Descripción |
|---|---|---|
| `validDays` | `Int` | Bitmask de 7 bits (bit 0 = domingo). 127 = todos los días. |
| `specificDates` | `String?` | JSON `string[]` con fechas ISO específicas (overrides validDays). |
| `provinces` | `String[]` | Array de provincias donde aplica. Vacío = todas. |
| `salesChannel` | `String?` | `"ONLINE"` \| `"FISICA"` \| null |
| `status` | `PromoStatus` | DRAFT, ACTIVE, EXPIRED, PAUSED |
| `slug` | `String?` | Slug SEO único generado al crear. |

### Campos clave de `PromoRequirement`

| Campo | Tipo | Descripción |
|---|---|---|
| `discountType` | `DiscountType` | PERCENTAGE_REINTEGRO, PERCENTAGE_DESCUENTO, BONIFICACION, FIXED_AMOUNT, NXM, CUOTAS_SIN_INTERES |
| `discountValue` | `Float` | Valor del descuento (% o $). Para CSI = cantidad de cuotas. |
| `cap` | `Float?` | Tope máximo del beneficio. |
| `capPeriod` | `CapPeriod?` | PER_TRANSACTION, DAILY, WEEKLY, MONTHLY, TOTAL |
| `capTarget` | `CapTarget?` | USER, CARD, ACCOUNT, TRANSACCION |
| `accountType` | `AccountType` | ANY, HABERES, JUBILADO, ANSES |
| `paymentChannel` | `PaymentChannel` | ANY, QR, NFC, TARJETA_FISICA, TRANSFERENCIA, DINERO_EN_CUENTA |
| `segmentId` | `String?` | FK a `bank_segments` |
| `cardSegmentId` | `String?` | FK a `card_segments` |

---

## 3. Scrapers

Todos los scrapers están en `lib/scrapers/` e implementan la interfaz `Scraper`:

```typescript
interface Scraper {
  name: string;
  run(categoria?: string): Promise<ScrapedPromo[]>;
}
```

### Tabla de scrapers activos

| Nombre | Tipo | Fuente URL | Categoría |
|---|---|---|---|
| Coto | HTTP | `coto.com.ar/legales/` | Supermercado |
| Diarco | HTTP | `diarco.com.ar/promociones/` | Supermercado |
| Jumbo | Playwright | `jumbo.com.ar/descuentos-del-dia` | Supermercado |
| Disco | Playwright | `disco.com.ar/descuentos-del-dia` | Supermercado |
| Vea | Playwright | `vea.com.ar/descuentos-del-dia` | Supermercado |
| ChangoMas | Playwright | `masonline.com.ar/promociones-bancarias` | Supermercado |
| Carrefour | Playwright | `carrefour.com.ar/descuentos-bancarios` | Supermercado |
| Dia | Playwright | `diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones` | Supermercado |
| MODO | HTTP | API `modo.com.ar/promos/api/rewards/slots` | Billetera |
| MercadoPago | HTTP | `promociones.mercadopago.com.ar` | Billetera |
| CuentaDNI | HTTP | API `bancoprovincia.com.ar/cuentadni` (cheerio, sin Playwright) | Billetera |
| Openpay | HTTP | API JSON `openpayargentina.com.ar/translations/ar-es.json` | Billetera |
| Club La Nacion | HTTP | API `api-clubv2.lanacion.com.ar/v2/accounts` | Billetera |
| Clarin 365 | HTTP | API `365.clarin.com/api/v1/search/companies` | Billetera |
| Personal Pay | HTTP | API `personal.com.ar/pay/api/benefits` | Billetera |
| Visa | Playwright | `visa.com.ar/es_ar/promociones/` | Tarjeta |
| AmEx | Playwright | `americanexpress.com/es-ar/beneficios/promociones/` | Tarjeta |
| Naranja X | Playwright | `naranjax.com/promociones/` | Tarjeta |
| Cabal / Credicoop | Playwright | `beneficios.bancocredicoop.coop/coop/beneficios/` | Tarjeta + Banco |
| Galicia | Playwright | API `loyalty.bff.bancogalicia.com.ar` | Banco |
| Brubank | HTTP | `brubank.com/beneficios` | Banco |
| BBVA | Playwright | API `go.bbva.com.ar/willgo/fgo/API/v3` | Banco |
| Santander | Playwright | `santander.com.ar/personas/beneficios` | Banco |
| Macro | Playwright | `macro.com.ar/beneficios` | Banco |
| BNA | HTTP | API `backend.activx.production.digiventures.la/api` | Banco |
| Banco Ciudad | Playwright | `bancociudad.com.ar/beneficios/` | Banco |
| Supervielle | Playwright | API `supervielle.com.ar/api/beneficios` | Banco |
| Patagonia | HTTP | `ahorrosybeneficios.bancopatagonia.com.ar` | Banco |
| ICBC | Playwright | `beneficios.icbc.com.ar` | Banco |

### Proceso de ingesta al correr un scrape (`POST /api/admin/scrape`)

1. **Scraping**: se ejecutan los scrapers seleccionados y se reúnen todos los `ScrapedPromo[]`.
2. **Agrupación**: promos con mismo `title + sourceUrl` se fusionan en una sola con múltiples requirements (ej: 30% reintegro + 6 CSI).
3. **Resolución de entidades**: se buscan bancos, wallets, redes de tarjetas, categorías y comercios en la DB (insensible a acentos/mayúsculas). Los comercios inexistentes se crean automáticamente.
4. **Categorización**: orden de prioridad: (1) categoría del scraper, (2) `defaultCategoryId` del comercio, (3) detección automática por keyword (`detectCategoria()`), (4) "Sin Categoría".
5. **Generación de requirements**: producto cartesiano de bancos × wallets × redes × descuentos, evitando combinaciones imposibles (wallet + red de tarjeta específica).
6. **Upsert**: si ya existe la promo (por `sourceUrl` único o por `title + commerceId`), se actualizan sus requirements. Si es nueva, se crea con slug SEO.

---

## 4. API Routes principales

### Promos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/promos` | Ninguna (opcional) | Lista promos activas con filtros avanzados, matching de perfil financiero, deduplicación por tier y ordenamiento por popularidad. Expira promos vencidas en cada llamada (lazy expiration). |
| POST | `/api/promos` | Ninguna | Crea una promo manualmente con sus requirements. |
| GET | `/api/promos/[id]` | Ninguna | Detalle de una promo por ID. |
| POST | `/api/promos/[id]/save` | Session | Guarda/desguarda una promo para el usuario. |

#### Parámetros de GET /api/promos

| Parámetro | Tipo | Descripción |
|---|---|---|
| `category` | string | Slug de categoría única (legacy). |
| `categories` | string | Lista CSV de slugs de categorías. |
| `day` | int | Filtro por día de semana (0=dom). |
| `days` | string | CSV de días (bitmask acumulado). |
| `view` | string | `"today"` (default) o `"week"` (ignora filtro de día). |
| `for_me` | bool | Si `true`, aplica matching de perfil financiero. |
| `banks` | string | CSV de IDs de bancos. |
| `wallets` | string | CSV de IDs de wallets. |
| `networks` | string | CSV de IDs de redes de tarjeta. |
| `channels` | string | CSV de `PaymentChannel`. |
| `hasCap` | bool | Filtrar promos con/sin tope. |
| `capMin` / `capMax` | float | Rango de tope en pesos. |
| `capPeriods` | string | CSV de `CapPeriod`. |
| `commerces` | string | CSV de nombres de comercios. |
| `discountRanges` | string | CSV: `0-10`, `10-20`, `20-30`, `30+`. |
| `hasInstallments` | bool | Filtrar por CSI. |
| `province` | string | Provincia (para guests). |
| `guest_profile` | string | Perfil base64 para matching sin login. |

#### Ordenamiento (resultado de GET /api/promos)

1. Promos con descuento `%` primero; promos solo CSI al final.
2. Popularidad de categoría (cantidad de promos con % en esa categoría).
3. Popularidad de comercio (`_count` de promos activas).
4. Mayor descuento `%`.
5. Alfabético por nombre de comercio.
6. Promos solo CSI: más cuotas primero.

---

### Categorías

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/categories` | Ninguna | Lista todas las categorías con `promoCount` (hoy), `totalCount` y flag `isPopular`. Soporta `?for_me=true` para filtrar por perfil. |

---

### Perfil financiero

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/perfil` | Session | Devuelve datos personales y perfil financiero completo (bancos, wallets, tarjetas con joins). |
| POST | `/api/perfil` | Session | Acciones: `update_profile`, `add_bank`, `remove_bank`, `add_wallet`, `remove_wallet`, `add_card`, `update_card`, `remove_card`. |
| GET/POST | `/api/perfil/guardadas` | Session | Lista / actualiza promos guardadas. |
| POST | `/api/perfil/import-guest` | Session | Importa perfil guest (base64) al usuario registrado. |
| POST | `/api/perfil/sync` | Session | Sincroniza perfil con MODO (obtiene datos de tarjetas). |

---

### Autenticación

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | — | Handler de NextAuth. Soporta Credentials (email/password + 2FA) y Google OAuth. |
| POST | `/api/registro` | — | Registro de nuevo usuario. Envía código de verificación por Resend. |
| POST | `/api/registro/verificar` | — | Verifica el código de 6 dígitos. |
| POST | `/api/registro/reenviar-codigo` | — | Reenvía el código de verificación. |
| POST | `/api/recuperar` | — | Solicita recuperación de contraseña. |
| POST | `/api/nueva-password` | — | Establece nueva contraseña tras recuperación. |

---

### Públicas (sin auth)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/public/entities` | Devuelve bancos, wallets y redes para poblar filtros del frontend. |
| GET | `/api/public/commerces` | Lista comercios activos. |

---

### Admin (requieren rol ADMIN)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/admin/scrape` | Ejecuta scrapers (body: `{ scraper?, categoria? }`). |
| GET/POST/PUT/DELETE | `/api/admin/entities` | CRUD de categorías, bancos, wallets, redes, comercios y segmentos. |
| GET/POST/PUT/DELETE | `/api/admin/promos` | CRUD completo de promos. |
| GET | `/api/admin/export` | Exporta todas las promos activas como CSV (con BOM para Excel). |
| GET | `/api/admin/stats` | Estadísticas generales (conteos, promos por banco, etc.). |
| GET | `/api/admin/reports` | Lista reportes de promos incorrectas. |
| GET | `/api/admin/users` | Lista usuarios. |
| GET | `/api/admin/card-segments` | Gestión de segmentos de tarjeta. |
| GET | `/api/admin/account-types` | Tipos de cuenta financiera. |
| GET | `/api/admin/segments` | Segmentos bancarios. |
| GET | `/api/admin/classify` | Herramienta de clasificación automática de categorías. |
| GET | `/api/admin/cleanup` | Limpieza de promos duplicadas/expiradas. |
| GET | `/api/admin/currencies` | Catálogo de monedas. |
| POST | `/api/admin/trigger-vtex-refresh` | Dispara manualmente el workflow de GitHub Actions `refresh-vtex-sessions.yml`. |

---

### Finanzas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/finanzas` | Instrumentos financieros en DB: FCI MM, cauciones, LECAPs, ON. |
| GET | `/api/finanzas/plazo-fijo` | TNA/TEA de plazos fijos desde API oficial del BCRA. Caché 6 horas. |
| GET | `/api/finanzas/divisas` | Cotizaciones de divisas. |
| GET | `/api/finanzas/lecaps` | LECAPs / instrumentos de deuda. |
| GET | `/api/finanzas/iol/[tipo]` | Datos de Invertir Online (IOL). |
| GET | `/api/finanzas/iol-scraper/[tipo]` | Scraper alternativo IOL. |
| GET | `/api/finanzas/iol/discovery` | Discovery de endpoints IOL. |
| GET | `/api/finanzas/yahoo` | Precios de activos vía Yahoo Finance. |

---

### Comparador de precios

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/precios/search?q=&cat=&section=` | Busca el mismo producto en múltiples supermercados/farmacias en paralelo. Agrupa resultados por EAN. Soporta `section=supermercados` (Coto, Carrefour, Jumbo, Disco, Vea, Dia, Más Online, ChangoMas) y `section=farmacias` (Farmacity, Farmaplus, OpenFarma, Farmatodo, Central Oeste). |

---

### Comunidad

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/comunidad` | Lista posts activos (max 100). Soporta `?type=` |
| POST | `/api/comunidad` | Crea un post (requiere sesión). Tipos: AVIVADA, PROMO, ERROR_PRECIO, COMBO, CONSULTA. |
| POST | `/api/comunidad/[id]/like` | Like/unlike de un post. |

---

### Interna (sin browser, solo server-to-server)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/internal/vtex-promos` | Bearer `VTEX_SESSION_SECRET` | Recibe el cache de promos Cencosud desde GitHub Actions y lo guarda en `vtex_promo_cache`. Borra el site completo antes de insertar. |

---

## 5. Pipeline Cencosud (VtexPromoCache)

Jumbo, Disco y Vea usan la plataforma VTEX. Sus promos (NxM, 2do al X%) no son accesibles vía API pública — requieren navegar el sitio con una sesión autenticada para que el servidor devuelva las promos personalizadas en el endpoint `/_v/search-promotions`.

### Flujo completo

```
1. GitHub Actions (cron: cada 2 días a las 6:00 AM UTC)
   └── .github/workflows/refresh-vtex-sessions.yml
       ├── Instala Node 24 + Playwright + Chromium + Xvfb
       └── node scripts/refresh-vtex-sessions.js

2. scripts/refresh-vtex-sessions.js
   ├── Lee SITES = [jumbo.com.ar, disco.com.ar, vea.com.ar]
   ├── Para cada site:
   │   ├── Abre Chromium con Playwright (Xvfb para display virtual)
   │   ├── Navega ~150 categorías/subcategorías (bebidas, almacén, carnes, etc.)
   │   ├── Intercepta respuestas de /_v/search-promotions
   │   │   (cada página de categoría dispara este endpoint con los SKUs visibles)
   │   ├── Acumula { skuId, promoCode, effectiveDiscount, segment }
   │   │   segment = "generic" | "jumbo_prime"
   │   └── Al terminar, POST /api/internal/vtex-promos con los datos
   └── Repite para los 3 sites

3. POST /api/internal/vtex-promos (app/api/internal/vtex-promos/route.ts)
   ├── Valida Bearer token (VTEX_SESSION_SECRET)
   ├── DELETE vtex_promo_cache WHERE site = ...
   └── INSERT en batches de 100 con skipDuplicates

4. GET /api/precios/search (al buscar en /precios)
   ├── getCencosudPromos(host, skuIds)
   │   ├── Si cache en memoria < 30 min: usa cache
   │   └── Si no: lee TODA la tabla vtex_promo_cache WHERE site = host
   │       y puebla promoCacheMemory[host]
   └── Devuelve { promoCode, effectiveDiscount, primePromoCode, primeEffectiveDiscount }
       por skuId para enriquecer los productos en la respuesta
```

### Tabla `vtex_promo_cache`

| Campo | Descripción |
|---|---|
| `site` | Host del supermercado (ej: `www.jumbo.com.ar`) |
| `skuId` | ID del SKU en la plataforma VTEX |
| `segment` | `"generic"` o `"jumbo_prime"` |
| `promoCode` | Código de la promo (texto descriptivo: `"2x1"`, `"3er al 70%"`, etc.) |
| `effectiveDiscount` | Descuento efectivo (fracción: 0.33 = 33%) |
| `productId` / `productName` | Enriquecimiento para análisis |
| `ean` | Código EAN del producto |
| `listPrice` / `salePrice` | Precios originales |
| `category` | Categoría de la plataforma VTEX |

### Trigger manual

Desde el panel admin, el botón "Refresh VTEX" llama a `POST /api/admin/trigger-vtex-refresh`, que usa el `GITHUB_PAT` para disparar el workflow vía la API de GitHub (`workflow_dispatch`).

---

## 6. Matching de perfil financiero

Cuando un usuario logueado hace `GET /api/promos?for_me=true`, el sistema filtra las promos según su perfil financiero. El perfil está compuesto por:

- **UserBank[]**: bancos del usuario (informativo, no usado en matching directo).
- **UserWallet[]**: billeteras declaradas (se convierten en "tarjetas virtuales" para matching).
- **UserCard[]**: tarjetas reales con bankId, cardNetworkId, cardType, segmentId, cardSegmentId, walletId, isPayroll, isPensioner.

### Función `matchesProfile(requirement) → boolean`

**Regla 0 — Sin restricciones:** si el requirement no tiene banco, wallet, red ni tipo de tarjeta → retorna `false` con perfil activo (se requiere match explícito).

**Regla 1 — Banco + Wallet simultáneos:**
- Excepción: si el requirement es `BancoProvincia + CuentaDNI`, basta con tener CuentaDNI.
- Si no: se verifica por separado que el usuario tenga (a) una tarjeta del banco correcto con red/tipo/segmento válidos, Y (b) la wallet requerida en alguna tarjeta.

**Regla 2 — Solo banco O solo wallet:**
- Se recorre `userCards` buscando alguna que cumpla todos los campos especificados del requirement: `bankId`, `walletId`, `cardNetworkId`, `cardType`, `segmentId`, `cardSegmentId`, `cardTier`, `accountType` (JUBILADO/ANSES → `isPensioner`, HABERES → `isPayroll`).

### Deduplicación por tier

Si el usuario matchea una promo con `cardTier` para un banco+comercio determinado, se oculta la promo genérica del mismo banco+comercio (evita mostrar dos veces el mismo beneficio).

### Enriquecimiento `userBestDiscount`

Una vez filtradas, cada promo devuelve `userBestDiscount`: el requirement con mayor `discountValue` que matchea el perfil del usuario (permite mostrar "tu descuento: 30%" en lugar del máximo global).

### Perfil guest (sin registro)

El parámetro `?guest_profile=<base64>` permite pasar un perfil temporal codificado en base64 (JSON con array `cards`). Se usa para mostrar promos personalizadas antes de crear una cuenta.

---

## 7. Variables de entorno

### Variables requeridas en producción

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión a CockroachDB (con `sslmode=verify-full`). Se usa para el connection pool. |
| `DIRECTURL` | Cadena de conexión directa a CockroachDB (sin pgBouncer). Necesaria para migraciones de Prisma. |
| `NEXTAUTH_SECRET` | Secreto para firmar los JWT de NextAuth. Cambiar en producción. |
| `NEXTAUTH_URL` | URL base del sitio (ej: `https://promoar.com.ar`). |
| `GOOGLE_CLIENT_ID` | Client ID de Google OAuth (Google Cloud Console). |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google OAuth. |
| `RESEND_API_KEY` | API key de Resend para enviar emails de verificación/recuperación. |
| `VTEX_SESSION_SECRET` | Secreto compartido entre GitHub Actions y `/api/internal/vtex-promos`. |
| `GITHUB_PAT` | Personal Access Token de GitHub con permisos `workflow`. Usado para disparar `workflow_dispatch` desde el admin. |

### Variables opcionales / desarrollo

| Variable | Descripción |
|---|---|
| `GEMINI_API_KEY` | API key de Google Gemini (funcionalidad de clasificación automática). |
| `GROQ_API_KEY` | API key de Groq (alternativa de LLM para clasificación). |
| `IOL_USERNAME` / `IOL_PASSWORD` | Credenciales de Invertir Online para el scraper de instrumentos financieros. |
| `ADMIN_EMAIL` | Email del admin principal. |
| `NEXT_PUBLIC_ADMIN_PIN` | PIN visible en el frontend para acceso rápido al panel admin (solo desarrollo). |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Poner en `0` solo en desarrollo para saltear SSL. |
| `API_URL` | URL base de la API, usada por `scripts/refresh-vtex-sessions.js` (default: `http://localhost:3000`). |

---

## 8. Tareas programadas

### GitHub Actions

| Workflow | Archivo | Schedule | Qué hace |
|---|---|---|---|
| Refresh VTEX Sessions | `.github/workflows/refresh-vtex-sessions.yml` | Cron `0 6 */2 * *` (cada 2 días a las 6 AM UTC) + `workflow_dispatch` | Navega Jumbo, Disco y Vea con Playwright (Ubuntu + Xvfb) para capturar promos de `/_v/search-promotions` y guardarlas en `vtex_promo_cache` vía `POST /api/internal/vtex-promos`. |

### Expiración lazy de promos

No hay un cron dedicado para expirar promos. La expiración ocurre de forma "lazy" en cada llamada a `GET /api/promos`: se ejecuta un `prisma.promo.updateMany({ where: { status: 'ACTIVE', validUntil: { lt: startOfToday } }, data: { status: 'EXPIRED' } })` antes de devolver resultados.

### Cache en memoria de precios Cencosud

`/api/precios/search` mantiene un cache en memoria por proceso de Node.js con TTL de 30 minutos por site (`promoCacheMemory`). No es un cron, sino un caché lazy cargado en el primer request tras expirar.

---

*Documentación generada a partir del código fuente. Para cambios en el esquema de DB, ver `prisma/schema.prisma`. Para scrapers nuevos, registrarlos en `lib/scrapers/index.ts` y agregar a `ALL_SCRAPERS`.*
