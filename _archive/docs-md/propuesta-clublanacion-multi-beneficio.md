# Propuesta técnica — Club La Nación como vertical slice (multi-beneficio por página)

**Fecha**: 12/8/2026
**Estado**: propuesta, sin implementar. Caso de aceptación: YPF (`A10677`) debe producir 3 promos separadas, correctas y estables entre reruns.
**No se tocó código ni datos** — esta es solo la propuesta pedida.

## 1. Confirmación empírica de la estructura real

Descargué el HTML real de `club.lanacion.com.ar/beneficios/automovil/combustible/descuentos-en-ypf-A10677` (el mismo que compartió Pablo) y lo inspeccioné con cheerio, la misma librería que ya usa el scraper. Hallazgos:

- La página server-renderiza cada beneficio como un `<article class="benefit-card" id="benefit-{uuid}">` independiente. El selector `article.benefit-card[id]` da **exactamente 3** resultados para YPF — ninguno espurio.
- Cada card trae, dentro de sí misma (no a nivel de página): el `%` y `OFF` (`.benefit-type`), el título real del beneficio en `h4` (ej. *"¡Sobre lubricante sintético en BOXES, a través de APP YPF!"*, *"¡De descuento en tiendas YPF Full!"*, *"¡En la carga de Infinia, pagando con dinero en cuenta a través de App YPF!"*), los días activos (`ul li`, con clase `bg-primary-negative` marcando el día activo — para YPF: beneficio 1 y 2 son "todos los días", el 3° es L-M-S-D específicamente), y su **propio** bloque de `condition-item` (vigencia, sucursales adheridas, modalidad, credenciales, legales).
- Confirmé que las vigencias **difieren entre beneficios de la misma página**: beneficio 1 vigente 01/01/2025-31/12/2026, beneficios 2 y 3 vigentes 01/07/2026-31/12/2026. El scraper actual (`extractConditions`, que busca `[class*="condition-item"]` en toda la página sin acotar a una card) mezclaría estos 3 bloques de condiciones entre sí — es una causa adicional de datos incorrectos más allá de la ya identificada en la auditoría.
- El `id` del `article` (`benefit-3be38442-c1c3-ef11-814d-0ab6811d4821`, etc.) es un **UUID estable generado por el propio sitio**, no algo que dependa del texto o de nuestro scraping. Es la pieza que hoy falta para tener una identidad de oportunidad confiable.

Esto confirma que la información para resolver el caso ya está disponible en el HTML actual — no hace falta un endpoint nuevo ni tocar `fetchAllSlugs`/la API de listado.

## 2. Diagnóstico de por qué el scraper actual pierde 2 de 3 beneficios

En el código actual (`lib/scrapers/clublanacion.ts`):

- `fetchAllSlugs` (línea 179) construye **un item por slug**, tomando `item.displayBenefit?.type` — la propia API de listado ya resume la página a "el beneficio destacado", perdiendo los otros 2 antes de llegar siquiera al detalle.
- `fetchDetail` → `extractDescription` (líneas 104-111) toma `meta[name="description"]` o el primer párrafo de `.benefit-title` — coincide exactamente con el beneficio 1 (30% lubricante), nunca ve los otros 2 `article.benefit-card`.
- `extractConditions` (líneas 80-102) itera `[class*="condition-item"]` sin acotar a una card — si se usara para extraer 3 beneficios sin cambios, mezclaría vigencias/sucursales entre ellos.
- El resultado final (línea 220 en adelante) genera **1 `ScrapedPromo` por `item` del listado**, nunca por beneficio real dentro de la página.

## 3. Cambio propuesto

### 3.1 — Nueva función: `extractBenefitCards(html, item)`

Reemplaza el uso combinado de `extractDescription` + `extractConditions` a nivel de página por una función que:

1. Selecciona `$('article.benefit-card[id]')`.
2. Para cada card, extrae **acotado a esa card** (`$el.find(...)`, nunca `$(...)` global):
   - `benefitId`: el UUID de `id="benefit-{uuid}"` (quitando el prefijo `benefit-`).
   - `pct`: número desde `.benefit-type` (ej. `30`, `15`, `10`).
   - `benefitTitle`: texto del `h4` dentro de `.benefit-title` — este es el texto real del alcance (*"lubricante sintético en BOXES"*, *"tiendas YPF Full"*, *"Infinia... dinero en cuenta"*), y es la pieza que hoy no se usa para nada.
   - `validDays`: de los `li` con clase activa (`bg-primary-negative`) dentro del `ul` de esa card — mismo parseo día-a-día que ya existe en `parseDias`, pero ahora por posición de `li` en vez de por texto libre "todos los días"/nombres sueltos (más robusto, y ya viene resuelto por el propio HTML con days activos marcados).
   - `conditions`: `$el.find('[class*="condition-item"]')` (acotado a la card) → mismo `extractConditions` de hoy pero recibiendo el subárbol de la card en vez de la página completa.
3. Devuelve un array de N beneficios (para YPF, 3), cada uno con su propio texto, %, días y condiciones.

Si `article.benefit-card[id]` da 0 resultados (páginas más simples/antiguas, o un cambio de markup del sitio), cae a un **fallback**: tratar la página entera como 1 solo beneficio usando la lógica actual (`extractDescription`/`extractConditions` a nivel de página) — así no se rompen los comercios de un solo beneficio, que hoy funcionan bien y son la mayoría.

### 3.2 — `run()`: generar 1 `ScrapedPromo` por beneficio, no por item de listado

`fetchDetail(item.slug)` pasa de devolver `Partial<ScrapedPromo>` a devolver `Partial<ScrapedPromo>[]` (uno o más beneficios). El `map` final (línea 220) se convierte en un `flatMap`: por cada `item` del listado, se generan tantas `ScrapedPromo` como beneficios reales tenga su página.

El **título** de cada promo deja de ser `"{discountValue}% descuento – {item.name}"` (que colapsa a "30% descuento – YPF" sin distinguir cuál de los 3) y pasa a incorporar el texto real del beneficio, ej.: `"30% descuento – YPF (lubricante sintético Boxes)"` o usando el `benefitTitle` recortado como sufijo distintivo. Esto resuelve en el mismo cambio el problema de que hoy dos beneficios distintos del mismo comercio son indistinguibles en la UI.

### 3.3 — Clasificación por contenido del beneficio, no por nombre del comercio (Punto 1 de la auditoría)

Hoy: `detectCategoria(item.name)` — solo ve "YPF". Propuesta: `detectCategoria(`${item.name} ${benefitTitle}`)`, igual que ya hacen el resto de los scrapers vía `buildPromos`/`allText` en `bank-helpers.ts`. Con el texto real del beneficio disponible ("lubricante sintético en BOXES"), el mismo `detectCategoria` ya existente probablemente siga devolviendo "Combustible" por la regex de marca YPF (línea 169 de `bank-helpers.ts` matchea `\bYPF\b` sin mirar el resto) — **esto solo no alcanza para arreglar la categoría**, así que además propongo:

Agregar a `detectCategoria` (o a una capa específica de Club LaNación, a decidir) una comprobación de **excepción por palabra de alcance** que, si aparece un término como "lubricante"/"lubricentro"/"aceite" en el texto, categorice como algo distinto de Combustible (ej. "Automotores", que ya existe como categoría y es donde semánticamente cae un service de auto) **incluso si el nombre de marca matchea la regex de combustible**. Esto es un cambio quirúrgico y acotado, no una reescritura de `detectCategoria` — pero lo marco explícitamente como parte de esta propuesta porque sin él, el fix de multi-beneficio por sí solo no resuelve el Punto 1 original que disparó todo esto (el 30% seguiría cayendo en "Combustible").

### 3.4 — Identidad estable de la oportunidad (clave de upsert)

Este es el punto central pedido: **no usar `commerceId + requirement + discountType + discountValue`** como clave de upsert, porque ya se demostró en la auditoría que puede fusionar beneficios legítimamente distintos (Farmacity, Shell, y ahora los propios 15%/10% de YPF si compartieran algún día el mismo % que otro beneficio).

Propuesta de clave de identidad para Club La Nación específicamente (no para todos los scrapers — el problema y la solución son específicos de esta fuente, que es la única que tiene el UUID de card disponible):

```
sourceUrl (la página del comercio, sin cambios) + benefitId (el UUID del article.benefit-card)
```

Esto es estable porque:
- `sourceUrl` ya identifica el comercio/página de forma unívoca (no cambia entre reruns).
- `benefitId` es un UUID generado y mantenido por el propio sitio de Club LaNación para ese beneficio puntual — no depende de texto, %, ni de nuestro parseo, así que sobrevive a que el club edite el título o el % del beneficio en el futuro.

En la práctica, esto requiere:
1. Agregar un campo (ej. `externalBenefitId` o reusar/extender `sourceNote`) al modelo `Promo`, o — más simple y sin migración de schema — **codificar el `benefitId` dentro de `sourceUrl`** como query string o fragment propio (ej. `${SITE_BASE}${item.slug}#benefit-{uuid}`), de forma que `sourceUrl` siga siendo la clave única natural sin tocar el schema. Esta segunda opción es la que recomiendo para no abrir una migración de DB en esta etapa — coherente con "no modificar datos existentes todavía".
2. En el upsert del scraper (`app/api/admin/scrape/route.ts`, sin tocarlo todavía — solo señalando dónde aplicaría), buscar promo existente por `sourceUrl` exacto (con el fragmento de `benefitId` incluido) antes de decidir crear una fila nueva. Si existe, actualizar in place (título, %, vigencia, condiciones) en vez de insertar — esto es lo que hoy falta y genera el 61% de duplicados por rerun identificados en la auditoría.

### 3.5 — Por qué esto preserva beneficios distintos aunque compartan comercio/%/medio de pago

Con la clave `sourceUrl + benefitId`, dos beneficios del mismo comercio con el mismo % (hipotético: si YPF tuviera dos beneficios al 30%) **nunca colisionan**, porque el UUID de card es distinto aunque el resto de los atributos coincida. Esto es exactamente lo que el criterio de la auditoría (`commerceId+requirement+discountType+discountValue`) no podía garantizar — y es la razón por la que ese criterio se descarta acá, tal como pediste.

## 4. Caso de aceptación — cómo se valida

1. Correr el scraper de Club LaNación solo para el slug de YPF (usando el `categoriaFilter` existente o un modo de test acotado a 1 slug, a definir al implementar).
2. Verificar en DB: 3 promos activas para `commerceId` de YPF, cada una con:
   - Título distinto que refleje el beneficio real (lubricante Boxes / YPF Full / Infinia dinero en cuenta).
   - `discountValue` correcto por beneficio (30 / 15 / 10).
   - `validDays` correcto (127 para los dos "todos los días", máscara L-M-S-D para el de Infinia).
   - `categoryId` no clasificado ciegamente como Combustible si el texto indica otro alcance (a definir con el ajuste del punto 3.3).
3. Re-correr el scraper una segunda vez sin cambios en el sitio → confirmar que las 3 promos se **actualizan in place** (mismo `id` de Promo, `updatedAt` cambia, no aparecen filas nuevas).
4. Verificar `/api/promos/home-decision` para un usuario con Club LaNación en su perfil: el rubro Combustible/Automotores debe poder mostrar hasta 3 oportunidades distintas de YPF como candidatas (principal + alternativas), no la misma repetida.

## 5. Qué queda fuera de este vertical slice (a propósito)

- **No se generaliza todavía** a otras fuentes (Chubut, promosdelbanco, Galicia, NBCH, Santander — que concentran el 76% del volumen de duplicados de la auditoría). Esas fuentes no tienen un `benefitId` de sitio como el de Club LaNación; su fix de upsert requeriría una estrategia distinta (probablemente similaridad de texto, como se sugirió al cierre de la auditoría) — se evalúa después de validar este slice.
- **No se limpian los duplicados ya existentes en DB** (ni los de Club LaNación ni los de otras fuentes) — el fix aplica hacia adelante, en el próximo rerun del scraper corregido.
- **No se diseña todavía** el safety-net del Decision Engine — se evalúa una vez confirmado que arreglar la fuente alcanza para el caso YPF.
- **No se toca el schema de `Promo`** — la propuesta de identidad usa `sourceUrl` extendido con fragmento, evitando una migración en esta etapa.

Queda a la espera de que se apruebe el criterio de identidad (`sourceUrl + benefitId` vía fragmento de URL) y el enfoque de clasificación (excepción semántica por palabra de alcance sobre `detectCategoria`) antes de tocar `clublanacion.ts`.
