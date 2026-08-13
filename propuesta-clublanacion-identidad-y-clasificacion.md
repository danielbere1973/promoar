# Club La Nación — identidad externa y clasificación (revisión 2)

**Fecha**: 12/8/2026
**Estado**: propuesta, sin implementar. Responde a los dos ajustes pedidos sobre la propuesta previa (`propuesta-clublanacion-multi-beneficio.md`, que sigue vigente en todo lo demás: `extractBenefitCards()`, scoping por card, `flatMap`, fallback, YPF como caso de aceptación).
**No se tocó código ni datos.**

---

## 1. Identidad externa

### 1.1 — Qué existe hoy en el modelo (`prisma/schema.prisma`, `model Promo`, líneas 430-476)

No hay `source` ni `externalId` como campos discretos. Lo que existe:

- `sourceUrl String?` — sin `@unique`, sin índice propio.
- `sourceNote String?` — texto libre, hoy usado por otros scrapers para notas legibles ("Sucursales adheridas", condiciones), no como clave de matching.
- `sourceText String?` — texto crudo capturado, tampoco es clave.
- `slug String? @unique` — es la única columna con constraint de unicidad real relacionada a "fuente", pero `slug` es un identificador *interno* de PromoAR (usado en URLs propias `/promos/[slug]`), no representa la identidad externa del beneficio en el sitio de origen.

Ningún campo actual está semánticamente pensado para "identidad de la oportunidad en el sistema de origen". `sourceUrl` es lo más cercano, pero — como decís — mezcla dos conceptos: *de dónde vino* (navegación/auditoría) y *qué es, unívocamente, en el origen* (identidad).

### 1.2 — Cómo se usa `sourceUrl` HOY en el upsert (hallazgo relevante, cambia el análisis)

Reviné `app/api/admin/scrape/route.ts` y encontré algo que no había registrado en la propuesta anterior: **el patrón `sourceUrl` + fragmento `#` ya es la convención de facto del upsert actual**, no una idea nueva mía:

```ts
// línea 640-641
const isUniqueUrl = (url?: string | null) =>
  !!url && (url.includes('#') || /\/detalle\/\d+/.test(url));
const byUrl = new Map(existingPromos.filter(p => isUniqueUrl(p.sourceUrl)).map(p => [p.sourceUrl!, p]));
```

```ts
// línea 667-670 (savePromo)
const byUrlMatch = isUniqueUrl(sourceUrl) ? byUrl.get(sourceUrl!) : undefined;
const existing = (byUrlMatch && byUrlMatch.title === title)
  ? byUrlMatch
  : byKey.get(`${title}|${commerceId}`);
```

Es decir: el upsert **ya prioriza `sourceUrl` como clave de identidad cuando es "única"** (tiene `#` o `/detalle/{id}`), y solo cae a `title+commerceId` cuando no lo es. Esto significa que mi propuesta anterior (`sourceUrl` + fragmento `#benefit-{uuid}`) no era un hack aislado — es coherente con un patrón que el sistema ya usa para otras fuentes con URLs de detalle únicas. Lo marco igual como corregible: tu objeción de fondo (mezclar procedencia con identidad en un solo campo string parseado por convención) es válida independientemente de que el patrón ya exista, porque:

- Es implícito: nada en el schema documenta que `#`/`/detalle/\d+` son "marcadores de identidad". Se descubre leyendo el código del upsert, no el modelo de datos.
- Es frágil: si algún scraper genera legítimamente una URL con `#` que no es una identidad (ancla de navegación real, por ejemplo), rompe el matching sin que sea obvio por qué.
- No es queryable con intención: no se puede preguntar "dame todas las promos de la fuente Club La Nación" sin parsear URLs.

### 1.3 — Propuesta explícita: `source` + `externalId` + `sourceUrl` separados

```prisma
model Promo {
  // ...campos existentes sin cambios...
  source     String?   // slug de la fuente/scraper, ej. "club-lanacion", "bancochubut"
  externalId String?   // identidad única del beneficio EN esa fuente, ej. el UUID de benefit-card
  sourceUrl  String?   // ya existe — pasa a ser SOLO procedencia/navegación (link "ver oferta original")
  // ...
  @@unique([source, externalId])
}
```

Semántica:
- `source`: qué scraper/sitio originó la promo. Es un campo chico y estable (un enum informal por convención de nombre, no hace falta un `enum` de Prisma — nuevas fuentes se agregan sin migración).
- `externalId`: el identificador que el sitio de origen le da a *esa oportunidad puntual*. Para Club La Nación: el UUID de `article.benefit-card`. Para otras fuentes con URLs `/detalle/{id}` (que ya existen y ya usan el mecanismo de la sección 1.2), sería literalmente ese `{id}`.
- `sourceUrl`: vuelve a ser puramente "dónde ver esto en el sitio original" — puede repetirse entre varias promos si corresponde (ej. los 3 beneficios de YPF comparten el mismo `sourceUrl` de página, cosa que hoy el mecanismo de fragmento no permite representar limpiamente porque *necesita* que la URL sea distinta por fragmento para servir de clave).
- La identidad lógica de una oportunidad pasa a ser `source + externalId`, explícita y con constraint real en DB (`@@unique`), no una convención de parseo de string.

Esto es exactamente lo que pediste y además **corrige una limitación real** del mecanismo actual: hoy, para que `sourceUrl` sirva de clave, tiene que ser distinta por promo — lo cual fuerza a "ensuciar" la URL con un fragmento inventado por nosotros en vez de guardar la URL real de la página y la identidad por separado.

### 1.4 — Migración concreta y su impacto

**Qué migración exactamente:**

```prisma
source     String?
externalId String?
```

Ambos **opcionales** (`String?`), sin `NOT NULL`, sin default obligatorio. Con Prisma + Postgres (Neon), esto es un `ALTER TABLE promos ADD COLUMN source TEXT, ADD COLUMN "externalId" TEXT;` — **agregar columnas nullable no bloquea ni reescribe la tabla en Postgres moderno** (no requiere table rewrite como sí lo requeriría un `NOT NULL DEFAULT` en algunas versiones). Es la migración de menor riesgo posible en Postgres.

El índice único **no** se agrega en el mismo paso:

```prisma
@@unique([source, externalId])
```

Un `UNIQUE` sobre dos columnas nullable en Postgres permite múltiples `NULL` (Postgres trata `NULL` como distinto de sí mismo a efectos de unicidad), así que technically es seguro aplicarlo incluso con las ~32.781 filas existentes todas en `NULL` — no chocaría con nada. Pero antes de aplicarlo yo esperaría a: (a) que Club La Nación esté migrado y poblando estos campos, para validar que el patrón realmente no colisiona en la práctica, y (b) decidir si otras fuentes (las que hoy usan `/detalle/\d+` en `sourceUrl`) migran su identidad a estos campos nuevos también, o conviven con el mecanismo viejo indefinidamente — este es un tradeoff de alcance que excede el vertical slice de YPF.

**Impacto en código existente:**

- `prisma/schema.prisma`: +2 líneas de campo, +1 línea de índice único (esta última en un paso posterior, no junto con las columnas).
- `app/api/admin/scrape/route.ts`: el mecanismo de matching (`isUniqueUrl`/`byUrl`/`byKey`) necesitaría un tercer camino de lookup por `source+externalId` cuando esos campos vienen poblados, sin romper el camino actual para scrapers que no los usan todavía. Esto es codeable sin tocar el comportamiento de ningún scraper existente — es aditivo.
- Ningún dato existente se modifica: las 32.781 filas actuales quedan con `source`/`externalId` en `NULL`, siguen matcheando por el mecanismo viejo (`sourceUrl`/`title+commerceId`) sin cambios.
- `PromoRequirement` y el resto del schema no se tocan.

**Costo estimado**: bajo. Es la clase de migración más segura que existe en Postgres (columnas nullable sin default), reversible (`DROP COLUMN`), y no tiene impacto en las 32.781 filas actuales porque no las toca.

### 1.5 — Comparación explícita: `#benefit-{uuid}` vs `source`+`externalId`

| | `sourceUrl` + fragmento `#benefit-{uuid}` | `source` + `externalId` (columnas nuevas) |
|---|---|---|
| Migración de schema | Ninguna | 2 columnas nullable + índice único (bajo riesgo, ver 1.4) |
| Claridad semántica | Implícita, requiere leer el código del upsert para entenderla | Explícita, autodescriptiva en el schema |
| `sourceUrl` mantiene su propósito original (link a la oferta real) | No — se ensucia con un fragmento inventado por nosotros | Sí — queda limpio, solo para navegación |
| Queryable ("dame todo lo de Club La Nación") | No, sin parsear URLs con regex | Sí, `WHERE source = 'club-lanacion'` |
| Generalizable a futuras fuentes con identidad propia | Sí, pero cada una inventa su propia convención de fragmento | Sí, de forma uniforme |
| Consistencia con el patrón ya existente (`isUniqueUrl` con `#`/`/detalle/`) | Total — es literalmente el mismo patrón | Requiere run en paralelo con el patrón viejo hasta migrar el resto |
| Riesgo de implementar ya | Cero (no toca schema) | Bajo pero no cero (toca schema, aunque de forma no destructiva) |

**Mi lectura**: dado que la migración es de bajo riesgo real (nullable, sin rewrite, reversible, no toca las 32.781 filas existentes) y vos ya señalaste la razón conceptual correcta (procedencia ≠ identidad), me inclino por `source`+`externalId` — pero lo dejo como tu decisión final, ya que pediste explícitamente comparar el costo antes de decidir vos.

---

## 2. Clasificación: beneficio como señal primaria, comercio como fallback

### 2.1 — Diagnóstico del mecanismo actual

`detectCategoria(text)` (`lib/scrapers/bank-helpers.ts`, líneas 165-186) es una cascada de regex por palabra clave, sin noción de prioridad entre "nombre de marca" y "texto de alcance" — hoy Club La Nación la llama con `item.name` solo (`"YPF"`), y el resto de los scrapers la llaman con `storeName + text` concatenados sin distinción (`buildPromos`, línea 237: `allText = ${raw.storeName} ${raw.text}`). En ambos casos, **una coincidencia de marca (`\bYPF\b`) pesa exactamente igual que una coincidencia de alcance real** porque están en la misma bolsa de texto y la regex de Combustible (línea 169) no distingue de dónde vino el match.

Ya existe, en cambio, un mecanismo de **prioridad de comercio sobre scraper** en otro lugar: `app/api/admin/scrape/route.ts` líneas 254-260, donde `commerce.defaultCategoryId` (curado a mano) pisa lo que detecte el scraper. Ese mecanismo resuelve "este comercio siempre es Farmacias" — pero no resuelve "este comercio tiene beneficios de distinto rubro entre sí", que es el caso YPF.

### 2.2 — Por qué "si contiene lubricante → Automotores" no alcanza (de acuerdo con tu objeción)

Cualquier regla nueva basada en una palabra puntual agregada a mano (lubricante, service, colectora, etc.) resuelve YPF y falla en el próximo comercio multipropósito no anticipado (un supermercado con un beneficio de farmacia interna, una estación de servicio con un local de comida rápida, un club de beneficios con un rubro "boutique" dentro de un shopping). El problema no es que falte una palabra en la lista — es que **la señal de marca y la señal de alcance compiten en el mismo texto sin jerarquía**.

### 2.3 — Propuesta: clasificar en dos pasadas, con el texto del beneficio primero

**Regla general** (no específica de YPF, aplicable a cualquier fuente que tenga texto de alcance separable del nombre de comercio):

```
resultado = detectCategoria(textoDelBeneficio)          // pasada 1: SOLO el texto real del beneficio
         ?? detectCategoria(nombreDelComercio)           // pasada 2: fallback, nombre de marca
         ?? commerce.defaultCategoryId                    // pasada 3: fallback final, curado a mano (ya existe)
         ?? 'Sin Categoría'
```

Es decir: **la misma función `detectCategoria` que ya existe, sin reescribirla**, pero invocada dos veces con inputs separados en vez de una vez con el texto concatenado — y quedándose con el primer resultado no vacío, en ese orden de prioridad. Esto no agrega ninguna palabra clave nueva ni ninguna excepción por marca: es un cambio de **orden y de qué texto se le pasa**, no de qué reconoce la función.

Por qué esto resuelve YPF sin ser una excepción ad-hoc:

- **Beneficio 1** — texto: *"¡Sobre lubricante sintético en BOXES, a través de APP YPF!"*. `detectCategoria` de ese texto solo (sin "YPF" pesando aparte) — hoy no matchea ninguna regex existente (no hay regla de "lubricante"/"Boxes"), así que pasada 1 da `''`. Cae a pasada 2 (`detectCategoria("YPF")` → "Combustible" por la regex de marca). **Este caso concreto no se resuelve solo con el reordenamiento** — hace falta que pasada 1 tenga alguna noción de "servicio de auto" que hoy no existe en absoluto en `detectCategoria` (ni para lubricantes, gomerías, lavaderos, etc. — es un hueco real de cobertura, no específico de YPF). Ver 2.4.
- **Beneficio 2** — texto: *"¡De descuento en tiendas YPF Full!"*. Tampoco matchea nada en pasada 1 (no hay regla para "tiendas de conveniencia"/"kiosco de estación de servicio" en `detectCategoria` — otro hueco real). Cae a pasada 2 → "Combustible" por marca. Es debatible si "YPF Full" (tienda de conveniencia) debería ser "Combustible" o algo como "Gastronomía"/"Supermercados chico" — no hay una respuesta obviamente correcta sin una categoría de "tienda de conveniencia", que hoy no existe en las 19+1 categorías de PromoAR.
- **Beneficio 3** — texto: *"¡En la carga de Infinia, pagando con dinero en cuenta a través de App YPF!"*. Pasada 1: "Infinia" no matchea nada, pero **"carga" es una señal de combustible** que hoy tampoco está en la regex (`NAFTA|COMBUSTIBLE|...` no incluye "carga"). Con la regex actual, cae a pasada 2 → "Combustible" por marca — que en este caso **es el resultado correcto**, aunque llegue por el camino del fallback en vez de por señal directa.

### 2.4 — Consecuencia honesta: la regla de dos pasadas es necesaria pero no suficiente

El reordenamiento (beneficio antes que comercio) es la pieza estructural correcta y generalizable que pediste — pero, al aplicarlo al caso real de YPF, expone que **`detectCategoria` no tiene cobertura de vocabulario para "servicios de auto en estación de servicio"** (lubricante, service, gomería, lavadero) ni para "tienda de conveniencia" como conceptos. Esto no es una excepción por marca — es una categoría/vocabulario faltante, del mismo tipo que las otras 19 ya cubiertas (Farmacias, Gastronomía, etc.), y su ausencia es indiferente a si el comercio se llama YPF, Shell o Axion.

Dos caminos, ninguno implementado todavía, para que decidas:

1. **Agregar vocabulario de alcance a `detectCategoria`** (ej. sumar a la regla de Automotores línea 170: `LUBRICANTE|LUBRICENTRO|SERVICE\s+(DE\s+)?AUTO|GOMERIA|LAVADERO\s+DE\s+AUTOS`). Esto es una ampliación de cobertura léxica igual a las que ya existen para las otras 19 categorías — no es una excepción de marca porque no menciona "YPF" en ningún lado, aplicaría igual a un lubricentro de cualquier marca. Es la extensión más chica y consistente con el patrón actual del archivo.
2. **Categoría nueva "Servicios de Auto"** dentro del rubro Automotores, si el volumen de casos lo justifica (hoy no medido — requeriría muestrear cuántos comercios en la base tienen beneficios de este tipo, algo que no se hizo en esta propuesta).

Recomiendo (1) como el paso mínimo necesario para que YPF pase el caso de aceptación con el mecanismo de dos pasadas, dejando (2) como una decisión de producto aparte si aparece más volumen. Pero remarco: esto es distinto de lo que rechazaste — no es "si contiene lubricante en el texto de YPF → Automotores", es "el texto de *cualquier* beneficio que mencione vocabulario de servicio de auto → Automotores, evaluado con prioridad sobre el nombre de marca del comercio". La diferencia es que sobrevive a que mañana aparezca un beneficio de lubricentro en Shell o Axion sin tocar código de nuevo.

### 2.5 — Dónde aplica esto (alcance del cambio)

`detectCategoria` en sí **no cambia su firma ni su contenido** salvo la ampliación léxica puntual de 2.4(1). El cambio real es en el *call site* de Club La Nación (y, si se decide generalizar después, en `buildPromos` de `bank-helpers.ts` para el resto de scrapers — no incluido en este vertical slice):

```ts
// clublanacion.ts, dentro del flatMap por beneficio (reemplaza la línea 223 actual)
const categoria =
  CATEGORY_MAP[item.categorySlug]                    // ya existía: taxonomía propia del club, sigue con más prioridad si aplica
  || detectCategoria(benefit.benefitTitle)            // NUEVO: pasada 1, texto real del beneficio
  || detectCategoria(item.name)                       // pasada 2 (antes era la única): nombre de comercio
  || 'Otros';
```

`CATEGORY_MAP[item.categorySlug]` (la taxonomía propia que Club La Nación ya expone por URL, ej. `automovil/combustible`) queda con prioridad más alta que ambas pasadas porque es una señal curada por el sitio de origen, no inferida por regex — pero notar que hoy esa taxonomía es la que puso a los 3 beneficios de YPF bajo `automovil/combustible` en primer lugar (viene del breadcrumb de la URL), así que **no resuelve el caso YPF por sí sola** — de ahí que las pasadas 1/2 sigan haciendo falta como se especifica arriba. Esto también es información nueva que no había registrado antes: el propio Club La Nación clasifica la página entera (los 3 beneficios) en un solo rubro de navegación, aunque el beneficio 1 (lubricante) semánticamente no sea combustible.

---

## Resumen de lo que se pide decidir

1. **Identidad externa**: elegir entre mantener `sourceUrl`+fragmento (cero migración, coherente con patrón ya existente) o migrar a `source`+`externalId` (migración de bajo riesgo, semánticamente más limpio y generalizable, según comparación de la sección 1.5).
2. **Clasificación**: aprobar el mecanismo de dos pasadas (beneficio → comercio → `defaultCategoryId`) como regla general, y decidir si la ampliación léxica puntual de Automotores (lubricante/service/gomería — sección 2.4 opción 1) se hace ahora como parte del vertical slice, o se pausa como su propia decisión de producto.

Nada de esto se implementó — sigue pendiente de tu aprobación antes de tocar `clublanacion.ts`, el schema o cualquier dato.
