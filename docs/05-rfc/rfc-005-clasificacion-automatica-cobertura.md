# RFC-005 — Clasificación automática de cobertura (ADR-001)

**Fecha**: 2026-07-25
**Estado**: Propuesta — solo diseño, sin implementar
**Deriva de**: ADR-001 (`Commerce.locationModel`, `Promo.salesChannel`, `Promo.geographicScope`)
**Owner**: CTO (diseño técnico) / CPO (aprobación de umbrales y prioridad)

## 1. Objetivo

ADR-001 ya está migrado y funcionando: el 100% de las 32.780 promos activas y de los
17.424 comercios están en `UNKNOWN`, y el sistema se comporta de forma segura ante esa
falta de dato (pass-through, nada se oculta de más). El valor del modelo aparece
recién cuando ese `UNKNOWN` empieza a bajar con clasificaciones correctas.

Este documento propone **cómo** reducir el `UNKNOWN` de forma progresiva, auditable y
reversible — no propone todavía qué heurística específica implementar primero; eso
requiere aprobación de este diseño y luego un sprint de implementación aparte.

## 2. Qué información ya existe hoy (investigación contra la DB de dev)

| Señal | Cobertura real | Utilidad |
|---|---|---|
| `CommerceBranch` (branches cargadas) | 6.226 / 17.424 comercios (36%) tienen ≥1 branch | Señal más fuerte y ya explotable. De esos, 1.274 tienen `province` poblado (889 en 1 provincia, 206 en 2-3, 179 en 4+) |
| Comercios con promos activas sin ninguna branch | 10.379 (64% del universo accionable) | No clasificable por esta vía sin más carga de sucursales |
| Texto libre (`title`/`description`/`sourceText`) | 1.148 promos con "online" (3,5%), 1.841 con "sucursal" (5,6%) | Señal débil, requiere regex nueva, riesgo de ambigüedad ("online o en sucursal") |
| `Promo.provinces[]` | **0 de 32.780** poblado | Campo preparado en schema pero ningún scraper lo llena — no es backfill, es feature nueva |
| `Commerce.defaultCategory` | 834 comercios en Supermercados/Farmacias/Combustible | Señal indirecta de alta confianza: estas categorías son casi siempre `PHYSICAL_BRANCHES` |
| Marcas 100% online conocidas (Rappi, Uber, Cabify, Despegar, PedidosYa, Mercado Libre) | 43 promos activas (0,13%) | Volumen mínimo, pero confianza altísima — cero riesgo de falso positivo |

**Conclusión de la investigación**: la señal ya disponible sin escribir ninguna
heurística nueva (pura agregación de `CommerceBranch`) cubre como máximo un 36% de
comercios, y de forma completa (con provincia) solo un ~7%. Todo lo demás requiere
o bien una heurística nueva (con riesgo de error) o carga manual/de sucursales
adicional. Esto determina el diseño de abajo: no hay atajo de "clasificación gratis",
así que el sistema tiene que estar preparado para convivir con `UNKNOWN` alto durante
mucho tiempo, mejorando gradualmente.

## 3. Modelo de clasificación propuesto

### 3.1 Principio rector

**Ninguna clasificación se escribe directamente sobre `locationModel` /
`salesChannel` / `geographicScope`.** Esos siguen siendo los campos que lee
`getPromos.ts`, y siguen default `UNKNOWN`. Se agrega una capa intermedia con dos
conceptos separados: **evidencia** (qué observamos) y **confianza** (qué tan seguros
estamos de que esa evidencia implica el valor sugerido). No son lo mismo: la misma
evidencia puede justificar distinta confianza según el método que la interprete (ej.
"el comercio tiene branches en 1 provincia" es la misma observación tanto para
`branch_aggregation` con confianza 0.9 como para una versión futura más estricta del
mismo método con confianza 0.7), y dos evidencias distintas pueden producir la misma
confianza por coincidencia. Modelarlos como el mismo campo escondería esa distinción.

```
ClassificationSuggestion
  id
  targetType       CommerceField | PromoField
  targetId         (commerceId o promoId)
  field            "locationModel" | "salesChannel" | "geographicScope"
  suggestedValue   String   (el valor del enum correspondiente)
  method           String   ("branch_aggregation" | "category_rule" | "keyword_v1" | "manual" | ...)
  evidence         Json     (qué datos concretos se observaron — branches usadas, keyword matcheada, categoría del comercio. Hecho, no interpretación)
  confidence       Float    (0.0 – 1.0. Interpretación: qué tan bien esa evidencia predice el valor sugerido, según el método)
  confidenceModel  String   (versión del cálculo de confianza usado, ej. "branch_aggregation_v1" — permite recalcular confianza sin recolectar evidencia de nuevo, ver 3.5)
  status           "PENDING" | "AUTO_APPLIED" | "APPROVED" | "REJECTED"
  createdAt / reviewedAt / reviewedBy
```

`evidence` registra el hecho (ej. `{ branchCount: 12, provinces: ["Buenos Aires"] }`);
`confidence` + `confidenceModel` registran el juicio derivado de ese hecho. Esta
separación tiene una consecuencia práctica directa: si más adelante se ajusta cómo se
calcula la confianza de `branch_aggregation` (ej. se decide que 1 provincia con pocas
sucursales debería pesar menos que 1 provincia con muchas), se puede **recalcular
`confidence` para las sugerencias ya generadas a partir de su `evidence` guardada**,
sin tener que volver a consultar `CommerceBranch` ni re-ejecutar el método completo.
Si evidencia y confianza fueran un solo número, esa recalibración no sería posible sin
regenerar todo desde cero.

Un job de **promoción** (separado, corre después de generar sugerencias) aplica el
campo real (`Commerce.locationModel`, etc.) solo cuando:
- `method` está en una lista blanca de métodos ya validados como seguros, **y**
- `confidence` supera el umbral definido para ese método (ver 3.3), **o**
- un admin aprobó manualmente la sugerencia desde el panel.

Esto separa completamente "generar candidatos" de "tocar el dato que el producto
usa en producción" — se puede correr, revisar y ajustar la generación de
sugerencias sin ningún riesgo de que una mala heurística degrade el filtro real.

### 3.1.1 ¿Por qué una tabla genérica y no una específica de cobertura?

Es una pregunta justa — el RFC hasta acá está redactado pensando exclusivamente en
`locationModel`/`salesChannel`/`geographicScope`, y conviene ser honesto sobre el
costo de generalizar antes de tiempo: una tabla genérica es más abstracta, más
difícil de razonar de un vistazo, y su `evidence`/`suggestedValue` como `Json`/`String`
sueltos pierden el tipado fuerte que tendría una tabla con columnas específicas
(`suggestedLocationModel LocationModel?`, etc.). Si el único caso de uso fuera este
sprint, la respuesta correcta sería **no generalizar**: tres columnas nullable
tipadas en una tabla `CommerceCoverageSuggestion` son más simples y más seguras que
un `field: String` + `suggestedValue: String` sin validación de enum a nivel de DB.

La razón concreta para generalizar ahora es que el proyecto **ya tiene un problema
estructuralmente idéntico resuelto de forma ad hoc, sin esta capa**: el
auto-validador de DRAFTs (`POST /api/admin/auto-validate`, ver CLAUDE.md punto 16)
aplica 7 reglas sobre promos en borrador y aprueba automáticamente las que pasan,
dejando el resto para revisión manual con el motivo visible — es exactamente el
mismo patrón (regla → confianza implícita → auto-aplicar o dejar para humano), pero
construido una vez, sin reutilización, sin historial de qué se sugirió antes de
aplicarse, y sin métrica de tasa de acierto por regla. Y hay un segundo candidato
real y ya visible en los datos: la categorización de comercios (`defaultCategoryId`)
hoy se resuelve por keyword matching dentro del scraper al momento del upsert
(`app/api/admin/scrape/route.ts`), con la misma necesidad de "esto es una sugerencia
de baja confianza que un admin debería poder revisar", pero sin ningún registro de
sugerencia — si el keyword falla, el comercio simplemente queda mal categorizado
hasta que alguien lo nota manualmente.

Generalizar la tabla ahora significa que ambos casos (y el de cobertura) comparten:
el mismo panel de revisión en el admin, la misma noción de umbral configurable por
método, el mismo dashboard de calidad (sección 5) y el mismo mecanismo de auditoría
por muestreo (3.4) — en vez de construir tres paneles y tres formas de medir
confianza que terminan pareciéndose entre sí por convergencia, como ya pasó una vez
con el auto-validador de DRAFTs.

**Trade-off explícito, para que quede claro qué se sacrifica**: con `field`/
`suggestedValue` como texto libre en vez de columnas tipadas, la integridad de tipo
se valida en código (al generar y al promocionar la sugerencia), no en el schema de
Postgres — un bug en el job de promoción podría en teoría intentar escribir un
`suggestedValue` inválido para el enum destino. Se mitiga validando contra el enum de
Prisma en el momento de la promoción (falla el job, no corrompe el dato), pero es una
capa de seguridad menos que con columnas nativas. Si en la práctica el auto-validador
de DRAFTs y la categorización de comercios no llegan a migrarse a este modelo en un
plazo razonable, la generalización no se pagó sola y correspondería volver a una
tabla específica de cobertura — lo dejo como criterio de revisión a 2-3 meses, no
como asunción cerrada.

### 3.2 Niveles de confianza y método (en orden de implementación sugerido)

| Nivel | Método | Ejemplo | Confianza | Acción |
|---|---|---|---|---|
| 1 | `manual` | Lista curada de marcas 100% online (Rappi, Despegar, etc.) | 1.0 | Auto-aplicar |
| 2 | `branch_aggregation` | Comercio con branches en 1 provincia → `PHYSICAL_BRANCHES`; en 4+ → `DISTRIBUTED_NETWORK` (mismo umbral `NATIONAL_COVERAGE_THRESHOLD=4` ya usado en el filtro) | 0.9 | Auto-aplicar |
| 3 | `category_rule` | `defaultCategory` en Supermercados/Farmacias/Combustible → `locationModel=PHYSICAL_BRANCHES` | 0.75 | Auto-aplicar con revisión muestral (ver 3.4) |
| 4 | `keyword_v1` | Regex sobre `title`/`description` ("tienda online", "comprá desde casa" → ONLINE; "presentá tu tarjeta en caja", dirección explícita → PHYSICAL) | 0.5–0.6 | **Solo sugerencia — requiere aprobación manual**, nunca auto-aplicar en v1 |
| 5 | `manual` (individual) | Admin clasifica un comercio/promo puntual desde el panel | 1.0 | Auto-aplicar (es la fuente de verdad humana) |

Los niveles 1-3 no requieren heurística de texto (son agregación/reglas
estructuradas) y ya están validados por la investigación de este mismo documento.
El nivel 4 es explícitamente el más riesgoso y el único que arranca en modo
"solo sugerir, nunca aplicar solo" — se promueve a auto-aplicable recién si una
muestra de revisión manual confirma una tasa de acierto aceptable (propongo
≥95% sobre una muestra de al menos 200 casos, a validar con el CPO).

### 3.3 Umbrales de confianza — parámetro configurable, no hardcodeado

Los umbrales de auto-aplicación (0.9 para nivel 2, 0.75 para nivel 3, etc.) se
guardan en `SiteConfig` (tabla ya existente, usada hoy para el badge de
"última actualización"), no en código. Esto permite subir o bajar el umbral de
cualquier método sin deploy, y es auditable (queda en DB, no en un valor mágico
en un archivo).

### 3.4 Cómo evitar clasificaciones incorrectas

- **Ningún método nuevo empieza en modo auto-aplicar.** Todo método nuevo arranca
  generando `ClassificationSuggestion` con `status=PENDING` durante un período de
  observación (propongo 1-2 semanas o un lote fijo, ej. las primeras 500
  sugerencias del método).
- **Muestreo de auditoría continua**: incluso para métodos ya promovidos a
  auto-aplicar, un job separado toma una muestra aleatoria pequeña (ej. 2% de las
  aplicadas) y las deja en `PENDING` para revisión manual — detecta degradación
  silenciosa (ej. un scraper nuevo que cambia el formato de texto y rompe el
  regex de nivel 4).
- **Reversión**: como el campo real solo se escribe desde `ClassificationSuggestion`,
  revertir una clasificación mala es un `UPDATE` a `UNKNOWN` + marcar la
  sugerencia como `REJECTED` — nunca hay que "adivinar" qué la escribió.
- **Ningún método puede degradar una clasificación ya manual**: si
  `reviewedBy` indica que un admin aprobó/corrigió el valor a mano, ningún job
  automático puede sobreescribirlo sin pasar de nuevo por revisión.

### 3.5 Cómo medir la confianza de cada clasificación

`confidence` no es una sola heurística global — cada método define su propio
cálculo (su `confidenceModel`, ver 3.1), que toma el `evidence` ya guardado y lo
traduce a un número. Separar ambos campos (3.1) es lo que permite versionar este
cálculo de forma independiente: si se detecta que un `confidenceModel` está mal
calibrado, se puede recorrer las sugerencias existentes y recalcular `confidence`
a partir de su `evidence` histórica, sin volver a tocar `CommerceBranch` ni el
scraper de origen.

- **`branch_aggregation`**: confianza proporcional a cuántas provincias distintas
  tienen branches y qué tan reciente es el dato (`CommerceBranch.updatedAt`) —
  una sucursal cargada hace 8 meses de una fuente que ya no se scrapea pesa
  menos que una cargada la semana pasada.
- **`category_rule`**: confianza fija por categoría, basada en cuán "físico por
  definición" es el rubro (Farmacias/Supermercados más alta que, por ejemplo,
  Indumentaria, que puede tener sucursales o ser pure online).
- **`keyword_v1`**: confianza basada en cuántos keywords distintos matchearon y
  si hubo señales contradictorias en el mismo texto (ej. "online" y "sucursal"
  ambos presentes → confianza baja, se descarta o queda en revisión manual
  obligatoria, nunca se auto-aplica un promedio).

### 3.6 Qué requiere intervención manual sí o sí

- Los 10.379 comercios con promos activas y **cero** `CommerceBranch` — no hay
  ninguna señal estructurada para ellos. La única vía de reducir su `UNKNOWN` sin
  intervención manual es seguir cargando sucursales (mismo trabajo ya hecho para
  BNA/Galicia/Ciudad/BBVA/Club LaNación/ColorShop/Tiendeo) para más comercios.
- `Promo.geographicScope=PROVINCES`: hoy no hay ningún dato para inferir esto —
  requiere que los scrapers empiecen a poblar `provinces[]` (trabajo de
  extracción nuevo, no backfill) o carga manual promo por promo.
- Todo caso con señales contradictorias (ej. keyword "online" pero el comercio
  tiene 40 branches con provincia) — se deja en revisión manual, nunca se
  resuelve por prioridad de método sin que un humano lo vea al menos la primera
  vez que ese patrón de conflicto aparece.

## 4. Evolución sin romper el comportamiento actual

- El comportamiento de `getPromos.ts` **no cambia**: sigue leyendo
  `locationModel`/`salesChannel`/`geographicScope` directamente de `Commerce`/
  `Promo`, con el mismo pass-through en `UNKNOWN`. La capa de clasificación solo
  decide *qué valor escribir* en esos campos — nunca cambia cómo se leen.
- Cada aplicación de una sugerencia (auto o manual) es un `UPDATE` normal,
  versionable en el sentido de que `ClassificationSuggestion` guarda el
  historial completo de qué se sugirió, con qué evidencia, y qué se terminó
  aplicando — permite auditar retroactivamente por qué un comercio quedó
  clasificado de una forma.
- Los métodos se activan de a uno, en orden de confianza (nivel 1 → nivel 2 →
  nivel 3 → nivel 4), cada uno medible por separado en el dashboard (sección 5)
  antes de habilitar el siguiente — si un método resulta problemático, se apaga
  sin afectar a los demás.
- Ningún método nuevo se ejecuta como parte de "Ejecutar todos" (el flujo de
  scrapers existente) — corre aparte, con su propio botón/endpoint en el admin,
  igual que hoy `load-colorshop-branches.ts` o `auto-validate`.

## 5. Dashboard de calidad del conocimiento (KPI permanente)

Propuesta de sección nueva en el admin (`app/admin/page.tsx`, tab nuevo o
ampliando el tab Stats existente), con snapshot diario:

**Métricas principales**:
- % de promos activas con `salesChannel` clasificado (≠ `UNKNOWN`)
- % de promos activas con `geographicScope` clasificado (≠ `UNKNOWN`)
- % de comercios con `locationModel` clasificado (≠ `UNKNOWN`)
- Desglose de lo anterior por `method` (cuánto aportó cada nivel de confianza)

**Métricas de salud del proceso**:
- Sugerencias `PENDING` sin revisar, por método y antigüedad
- Tasa de aprobación/rechazo manual de sugerencias, por método (detecta métodos
  con mala precisión antes de que se note en producción)
- Resultado del muestreo de auditoría continua (3.4) — tasa de acierto sobre la
  muestra revisada

**Serie histórica**:
- Snapshot diario de los 3 % principales, guardado en una tabla simple
  (`CoverageSnapshot`: fecha, métrica, valor) para graficar evolución semanal/
  mensual — mismo patrón que ya existe para otras métricas del admin, sin
  necesidad de herramienta externa.

Este dashboard se convierte en el KPI de seguimiento del sprint de clasificación:
el objetivo no es "llegar a 0% UNKNOWN" (algunos casos legítimamente no tienen
dato, y el pass-through está para eso), sino una tendencia sostenida a la baja,
medible semana a semana.

## 6. Fuera de alcance de este RFC

- Implementación de cualquier método de clasificación — este documento es
  diseño, no código.
- Heurísticas de NLP más sofisticadas que regex simple (ej. modelos de
  clasificación de texto) — se puede evaluar más adelante si el volumen de
  casos ambiguos lo justifica, pero no es parte de la v1.
- Cambios al modelo ADR-001 en sí (los 3 enums quedan como están).

## 7. Siguiente paso

Este RFC queda para revisión del CPO. Una vez aprobado el diseño (en particular:
el modelo `ClassificationSuggestion`, los umbrales iniciales de 3.3, y el
criterio de promoción del nivel 4 en 3.2), se abre un sprint de implementación
aparte — recomiendo empezar por los niveles 1-2 (manual + `branch_aggregation`),
que no requieren ninguna heurística nueva y ya cubren el mayor volumen posible
sin riesgo.
