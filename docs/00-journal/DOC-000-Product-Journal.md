# DOC-000 — Product Journal

**Domain**: Product
**Knowledge Type**: Support
**Authority**: No

## Objetivo

Responder: **¿por qué tomamos determinadas decisiones?**

Registro cronológico de decisiones tomadas. Nunca se modifica — es la memoria del
producto. Distinto de `02-decision-model/DOC-002-Decision-Map.md` (versión vigente, no
histórica) y `02-decision-model/DOC-005-Decision-Catalog.md` (índice de decisiones existentes).

## Cómo registrar nuevas entradas

Cada entrada nueva se agrega al final de la Tabla de contenido, con fecha en formato
`YYYY-MM-DD` y un título breve. El contenido de la entrada se desarrolla en su propia
sección debajo de la tabla.

## Convención para numeración

Cada entrada se identifica como `JRN-XXX`, con numeración secuencial ascendente que nunca
se reutiliza, incluso si una entrada se invalida o se reemplaza.

## Tabla de contenido

| Código | Fecha | Título |
|--------|-------|--------|
| JRN-001 | 2026-07-22 | Reorganización inicial del Product Knowledge Base |
| JRN-002 | 2026-07-22 | Decision Catalog sale de Strategy — nueva carpeta 02-decision-model |
| JRN-003 | 2026-07-22 | Modelo de gobernanza de dos dimensiones (Domain + Knowledge Type) y metadata obligatoria |
| JRN-004 | 2026-07-23 | Aprobación de DOC-001 – Product Vision v2.1 |
| JRN-005 | 2026-07-23 | Aprobación de DOC-003 – Product Principles v2.1 |
| JRN-006 | 2026-07-23 | Aprobación de DOC-004 – Success Metrics v2.1 |
| JRN-007 | 2026-07-23 | Aprobación de GOV-001 – Gobernanza del PKB v2.0, nuevo namespace GOV-* |

---

### JRN-001 — Reorganización inicial del Product Knowledge Base

**Fecha**: 2026-07-22
**Decidido por**: CPO
**Ejecutado por**: Claude

**Contexto**: se propuso inicializar una estructura nueva de PKB (`00-journal`,
`01-strategy`, `02-decisions`, `03-functional`, `04-rfc`, `templates/`) sin auditar
primero el contenido real ya existente en `docs/` (vision/, product/, business/,
technical/, adr/, brand/, roadmap/). Se detuvo la ejecución a mitad de camino para
evitar duplicar documentación ya existente sin aprobación explícita del CPO.

**Decisión**: extender y reorganizar la estructura existente en vez de crear una
paralela. Se realizó una auditoría completa de los 44 archivos de `docs/` y el CPO
resolvió los solapamientos detectados.

**Acciones ejecutadas** (todas con aprobación explícita del CPO):

- *Eliminados*: `docs/PKB-README.md` (duplicado de `docs/README.md`);
  `docs/01-strategy/DOC-001-Product-Vision.md`, `DOC-003-Product-Principles.md`,
  `DOC-999-Glossary.md` (placeholders — el contenido real ya existía en `vision/`);
  `docs/product/product-decisions.md` (placeholder vacío, propósito absorbido por
  Product Journal + Decision Map + Decision Catalog).
- *Movidos*: `docs/product/roadmap-product.md` y `docs/technical/roadmap-tech.md` →
  `docs/roadmap/` (junto al `ROADMAP.md` real); `docs/technical/rfc-002-fase-1-baseline.md`
  y `docs/technical/rfc-002-neon-compute-forensic-report.md` → `docs/technical/rfc-002/`
  (mismo patrón que `technical/incidentes-trafico/`).
- *Enlaces corregidos*: 3 referencias rotas en `docs/technical/rfc-003-...md` apuntando
  a las rutas antiguas de los archivos rfc-002 movidos.
- *Cross-links agregados*: `vision/PRODUCT_PRINCIPLES.md` ↔ `vision/product-vision.md`
  (documentos hermanos, cada uno responde una pregunta distinta — no se fusionan).
- *Objetivo redefinido* (sin tocar contenido funcional) en 4 placeholders para reflejar
  la regla "un documento, una pregunta": `DOC-000` (Product Journal), `DOC-002`
  (Decision Map), `DOC-004` (Success Metrics), `DOC-005` (Decision Catalog).
- *Creados*: `docs/02-decisions/README.md`, `docs/03-functional/README.md`,
  `docs/04-rfc/README.md`; 4 templates (`Decision-Template.md`,
  `Functional-Template.md`, `RFC-Template.md`, `Journal-Entry-Template.md`) en
  `docs/templates/`.
- *`docs/INDEX.md` actualizado*: columna Owner agregada (mapeo de responsabilidad final
  por área: CPO para vision/estrategia/decisiones/roadmap/product, CEO+CPO para
  business, CTO para technical/ADR/RFC, Marketing para brand); referencias a
  DOC-001/003/999 corregidas para apuntar a los documentos reales en `vision/`.

**No ejecutado** (fuera de alcance de esta reorganización, requiere aprobación
separada del CPO): redacción de contenido estratégico nuevo (Product Vision, Decision
Map, Decision Catalog, etc. siguen siendo placeholders de estructura).

**Regla nueva establecida**: todo documento del PKB debe responder una única
pregunta; si intenta responder más de una, debe dividirse.

---

### JRN-002 — Decision Catalog sale de Strategy — nueva carpeta 02-decision-model

**Fecha**: 2026-07-22
**Decidido por**: CPO
**Ejecutado por**: Claude

**Contexto**: mientras el CPO revisaba el informe de JRN-001, detectó que el Decision
Catalog (DOC-005) no pertenece conceptualmente a `01-strategy/`: es un documento
operativo de navegación (un índice de decisiones), no una pieza de reflexión
estratégica. Mantenerlo junto a documentos como Success Metrics violaba la regla de
que cada carpeta debe representar una única capa de conocimiento.

**Decisión**: crear `02-decision-model/` como carpeta propia para los documentos de
navegación de decisiones (Decision Map + Decision Catalog), separada tanto de
`01-strategy/` (reflexión estratégica pura) como de `03-decisions/` (Decision Documents
individuales, DS-XXX). Esto implicó renumerar las carpetas siguientes en un lugar:
`02-decisions/` → `03-decisions/`, `03-functional/` → `04-functional/`,
`04-rfc/` → `05-rfc/`.

**Acciones ejecutadas**:

- *Movidos*: `01-strategy/DOC-002-Decision-Map.md` y `01-strategy/DOC-005-Decision-Catalog.md`
  → `02-decision-model/`.
- *Carpetas renombradas*: `02-decisions/` → `03-decisions/`; `03-functional/` →
  `04-functional/`; `04-rfc/` → `05-rfc/`.
- *Referencias corregidas*: los 3 README de las carpetas renombradas
  (`03-decisions/README.md`, `04-functional/README.md`, `05-rfc/README.md`); el propio
  Objetivo de `DOC-002` (ya no se describe como "documento estratégico" sino como
  "documento operativo de navegación"); `INDEX.md` (nueva sección "Modelo de
  decisiones" separada de "Estrategia", tabla de estructura de carpetas agregada); la
  referencia cruzada al inicio de este mismo documento (Objetivo de DOC-000).

**Estructura final de carpetas numeradas**:

```
00-journal/          → memoria histórica
01-strategy/          → reflexión estratégica pura
02-decision-model/    → Decision Map + Decision Catalog (navegación operativa)
03-decisions/         → Decision Documents (DS-XXX)
04-functional/         → documentos funcionales (FN-XXX)
05-rfc/                → RFCs técnicos
```

**Regla reafirmada**: cada carpeta debe representar una única capa de conocimiento.

---

### JRN-003 — Modelo de gobernanza de dos dimensiones (Domain + Knowledge Type) y metadata obligatoria

**Fecha**: 2026-07-22
**Decidido por**: CPO
**Ejecutado por**: Claude

**Contexto**: al formalizar la Directiva permanente del CPO al CTO (roles, jerarquía
documental, principio de mínima sorpresa), el CTO señaló una ambigüedad: la jerarquía
de autoridad no distinguía entre documentos que *gobiernan* (tienen autoridad
normativa) y documentos que *organizan* (Decision Model/Catalog), lo que dejaba sin
resolver qué pasaba si un Decision Document contradecía al Decision Map.

**Decisión — primera iteración**: el CPO definió 3 tipos de conocimiento (Normativo,
Estratégico, Especificación) y aclaró que el Decision Model queda fuera de la
jerarquía de autoridad: nunca bloquea, solo se actualiza después de que se apruebe un
Decision Document que lo contradiga.

**Decisión — segunda iteración**: al intentar clasificar el resto del PKB (Journal,
Glossary, README, INDEX, Templates), se detectó que estos documentos no encajaban en
ninguno de los 3 tipos (no gobiernan, no organizan decisiones, no especifican
soluciones). El CPO agregó un cuarto tipo: **Soporte** (preserva contexto,
trazabilidad, navegación y vocabulario).

**Decisión — tercera iteración**: al intentar clasificar `business/`, `brand/` y
`product/` (dominios no cubiertos por los ejemplos originales), el CTO se negó a
inferir la clasificación por criterio propio (para no introducir decisiones de
producto desde el lado técnico) y elevó una tabla de propuesta con huecos explícitos.
El CPO resolvió que el PKB se organiza en **dos dimensiones independientes**:

- **Domain** (de qué habla el documento: Product, Business, Brand, Technical,
  Architecture, Process). No implica Knowledge Type.
- **Knowledge Type** (qué función cumple: Normative, Strategic, Specification,
  Support). No se infiere de la carpeta — un documento de Business puede ser
  Normative, uno de Product puede ser Strategic, etc.

**Jerarquía de autoridad normativa final** (documentos con `Authority: Yes`):
Product Vision → Product Principles → Success Metrics → Decision Documents →
Functional Documents → RFC → Código.

**Inconsistencia informada por el CTO, no resuelta unilateralmente**: `Business
Strategy`, `brand-playbook` y `tone-of-voice` quedaron clasificados como Normative +
Authority: Yes, pero fuera del árbol de autoridad de Producto — esto implica al menos
3 jerarquías normativas independientes (Producto, Negocio, Marca) sin una regla
explícita de qué prevalece si chocan entre sí (ej. una regla de tono de marca vs. un
Functional Document de producto). Queda pendiente que el CPO defina esa regla cuando
sea relevante; no bloqueó el trabajo de clasificación.

**Acciones ejecutadas**:

- *Metadata agregada* (`Domain`, `Knowledge Type`, `Authority`) en el header de los 59
  documentos del PKB, sin modificar contenido funcional de ninguno.
- *Clasificación completa* (ver `INDEX.md` para la tabla por documento).
- *`docs/INDEX.md` actualizado* para reflejar ambas dimensiones.

**Regla nueva establecida**: Domain y Knowledge Type son dimensiones independientes;
nunca se infiere una a partir de la otra ni a partir de la ubicación en carpetas.

---

### JRN-004 — Aprobación de DOC-001 – Product Vision v2.1

**Fecha**: 2026-07-23
**Decidido por**: CPO
**Ejecutado por**: Claude

**Contexto**: el CPO presentó un borrador v2.0 de `DOC-001 – Product Vision` para
review crítico del CTO, con instrucción explícita de no reescribir el documento. El
CTO revisó el borrador contra 6 ejes (nivel de contenido, contradicciones de
gobernanza, conceptos mal ubicados, ambigüedades, afirmaciones frágiles, omisiones) y
recomendó no aprobar sin una v2.1.

**Proceso de revisión**: CPO redacta v2.0 → CTO revisa → CPO decide qué observaciones
acepta/rechaza → CPO redacta v2.1 → CTO revisa nuevamente → CPO aprueba.

**Principales decisiones tomadas durante la revisión**:

- El CPO aceptó separar responsabilidades entre Vision, Principles y Success Metrics:
  la v2.1 eliminó de la Vision el desarrollo completo de los principios (ahora
  referencia a DOC-003) y agregó una referencia explícita a DOC-004 para la
  definición de éxito.
- El CPO rechazó modificar la sección "Qué no es PromoAR": la consideró
  posicionamiento de producto, no un asunto de metodología documental, y por lo tanto
  fuera del alcance de un review de gobernanza.
- El CPO aceptó reformular la negación de "agregador de beneficios" (única
  ambigüedad señalada por el CTO como genuina) para distinguir explícitamente
  posicionamiento de producto de capacidad técnica real de integrar múltiples
  fuentes.
- El CTO señaló dos hallazgos de gobernanza documental (numeración DOC-001/DOC-003
  sin reflejo en `INDEX.md`; ausencia de referencia a DOC-004) que el CPO determinó
  explícitamente que no bloquean la aprobación del contenido — quedan reservados
  para un sprint específico de gobernanza del PKB.
- Se mantuvo el flujo de roles definido: el CTO desafía y revisa, nunca redacta
  contenido de producto; toda redacción y resolución final es del CPO.

**Resolución**: `DOC-001 – Product Vision` v2.1 queda **Approved**, con Domain:
Product, Knowledge Type: Normative, Authority: Yes.

**Acciones ejecutadas**:

- *Reemplazado* el contenido de `docs/vision/product-vision.md` (antes v1.0/Draft,
  15 secciones incluyendo Carta del Fundador, 10 Principios desarrollados in
  extenso, 5 etapas de evolución, sección de métricas y "Qué nunca deberíamos
  hacer") por el texto exacto de DOC-001 v2.1 aprobado (9 secciones). El contenido
  de Principios y de métricas de éxito no se pierde: sigue viviendo, con mayor
  desarrollo, en `PRODUCT_PRINCIPLES.md` y (una vez redactado) en DOC-004.
- *Metadata actualizada* en el frontmatter y en la tabla de encabezado del
  documento: `version: 2.1`, `status: Approved`, `owner: CPO`,
  `last_updated: 2026-07-23`.

**No ejecutado** (fuera de alcance de esta iteración, reservado para un sprint de
gobernanza documental): asignación formal de los códigos DOC-001/DOC-003 en
`INDEX.md` (hoy listados con código `—`).

---

### JRN-005 — Aprobación de DOC-003 – Product Principles v2.1

**Fecha**: 2026-07-23
**Decidido por**: CPO
**Ejecutado por**: Claude

**Contexto**: tras el cierre de DOC-001, el CPO presentó un borrador v1.0 de
`DOC-003 – Product Principles` (8 principios) para review crítico del CTO, con un
foco distinto al usado en DOC-001: no revisar redacción, sino evaluar la solidez del
sistema de principios (atemporalidad, redundancia, vacíos fundamentales, invasión de
terreno de otros documentos, conflictos internos).

**Proceso de revisión**: CPO redacta v1.0 → CTO revisa contra el marco de 5 preguntas
→ CPO rechaza la v1.0 y decide replantear el sistema completo (no un ajuste
incremental) → CPO redacta v2.0 → CTO revisa nuevamente → CPO acepta parcialmente,
incorpora la observación de neutralidad comercial y rechaza explícitamente incorporar
el derecho a explorar (lo considera una decisión de producto/UX, no un principio
fundacional) → CPO redacta v2.1 → CTO revisa por tercera vez → CPO aprueba.

**Principales cambios respecto de la versión anterior** (`PRODUCT_PRINCIPLES.md` v1.0,
10 principios desarrollados in extenso):

- El sistema pasa de 10 principios desarrollados en extenso (con estructura Qué
  significa/Por qué existe/Impacto en UX/Impacto en desarrollo/Decisiones
  correctas-incorrectas) a 8 principios formulados de manera más compacta y
  normativa.
- Se eliminó un principio que fijaba una jerarquía de producto de la etapa actual
  (recomendación por sobre exploración) por no ser atemporal — el CTO señaló que
  describía una decisión de roadmap, no un criterio de evaluación permanente. El CPO
  decidió no corregirlo sino remover ese principio del sistema.
- Se incorporó un principio nuevo y explícito de **independencia de las
  recomendaciones frente a intereses comerciales** (Principio 2), que cubre tanto
  neutralidad comercial como equidad entre comercios en una sola formulación —
  cerrando el vacío más señalado por el CTO en las dos iteraciones previas (v1.0 y
  v2.0), heredado del principio equivalente ya existente en la versión anterior
  ("Todos los comercios merecen competir").
- El derecho del usuario a explorar (antes un principio propio, "Explorar seguirá
  siendo un derecho del usuario") no fue incorporado en el nuevo sistema: el CPO lo
  consideró una decisión de producto/UX, a resolver en un Decision Document, no un
  valor fundacional del documento de Principles.
- Los principios de confianza, explicabilidad, contexto sobre datos, simplicidad y
  evolución sin pérdida de identidad se mantienen conceptualmente equivalentes a la
  versión anterior, reformulados de manera más concisa.

**Resolución**: `DOC-003 – Product Principles` v2.1 queda **Approved**, con Domain:
Product, Knowledge Type: Normative, Authority: Yes. Reemplaza la versión anterior
(v1.0) como referencia normativa oficial.

**Acciones ejecutadas**:

- *Reemplazado* el contenido de `docs/vision/PRODUCT_PRINCIPLES.md` (antes v1.0/
  Approved, 10 principios in extenso) por el texto exacto de DOC-003 v2.1 aprobado
  (8 principios).
- *Metadata actualizada*: `version: 2.1`, `status: Approved`, `owner: CPO`,
  `last_updated: 2026-07-23`.

**No ejecutado** (fuera de alcance de esta iteración, mismo ítem pendiente señalado en
JRN-004): asignación formal de los códigos DOC-001/DOC-003 en `INDEX.md`.

---

### JRN-006 — Aprobación de DOC-004 – Success Metrics v2.1

**Fecha**: 2026-07-23
**Decidido por**: CPO
**Ejecutado por**: Claude

**Contexto**: con DOC-001 y DOC-003 aprobados, el CPO presentó un borrador v0.1 de
`DOC-004 – Success Metrics` (el documento existía hasta entonces como placeholder sin
contenido). El CTO revisó el borrador con foco en medibilidad y consistencia (en vez
del foco en atemporalidad usado para DOC-003, propio de un documento de métricas y no
de principios).

**Proceso de revisión**: CPO redacta borrador → CTO señala que la North Star Metric
propuesta ("Ahorros Activos", basada en "ahorro efectivo") no era medible con los
eventos que el producto captura hoy (no existe evento de conversión/uso real de una
promoción en el comercio), y que faltaba un guardrail que hiciera auditable el
Principio 2 de DOC-003 (independencia comercial) → CPO redacta v2.1 → CTO confirma que
ambos hallazgos quedaron resueltos, con una observación menor de gobernanza (que los
eventos observables de la North Star Metric no queden abiertos a redefinición fuera
del proceso de la Sección 8) → CPO incorpora esa observación → CTO revisa por tercera
vez sin nuevas objeciones → CPO aprueba.

**Principales decisiones tomadas durante la revisión**:

- La North Star Metric se redefinió de "ahorro efectivo" (no medible con la
  instrumentación actual) a **"Usuarios que Descubren Oportunidades de Ahorro"**,
  calculada exclusivamente mediante eventos observables (apertura de detalle, guardado,
  compartir). El documento deja explícito que esta es una aproximación, con una
  cláusula de evolución hacia una métrica de ahorro real una vez exista un mecanismo
  confiable de confirmación de uso.
- Se incorporó el **Guardrail de Neutralidad Comercial** (Sección 6.3), que hace
  auditable el Principio 2 de DOC-003 mediante indicadores de distribución de
  recomendaciones por comercio, por categoría, y entre comercios con y sin acuerdos
  comerciales.
- Se agregó **Eficiencia de Descubrimiento** (Sección 4.5) para dar trazabilidad al
  objetivo "reducir el esfuerzo necesario para encontrar promociones" (Sección 7), que
  antes no tenía métrica asociada.
- Se separaron los Guardrail Metrics en **Operativos** (6.1, monitoreo continuo) y de
  **Experiencia** (6.2, medición periódica vía NPS/CSAT), reflejando su distinta
  naturaleza y cadencia.
- Se agregó una cláusula de gobernanza explícita: cualquier cambio en los eventos
  observables que componen la North Star Metric debe seguir el mismo proceso de
  aprobación del documento (Sección 8), para preservar la comparabilidad histórica de
  la métrica.

**Resolución**: `DOC-004 – Success Metrics` v2.1 queda **Approved**, con Domain:
Product, Knowledge Type: Normative, Authority: Yes.

**Acciones ejecutadas**:

- *Reemplazado* el contenido de `docs/01-strategy/DOC-004-Success-Metrics.md` (antes
  placeholder v0.1/Draft, sin contenido) por el texto exacto de DOC-004 v2.1 aprobado.
- *Metadata actualizada*: `version: 2.1`, `status: Approved`, `owner: CPO`,
  `last_updated: 2026-07-23`.

**No ejecutado** (fuera de alcance, mismo ítem pendiente señalado en JRN-004 y
JRN-005): asignación formal de códigos y reconciliación de `INDEX.md`, reservada para
el sprint de gobernanza documental.

---

### JRN-007 — Aprobación de GOV-001 – Gobernanza del PKB v2.0, nuevo namespace GOV-*

**Fecha**: 2026-07-23
**Decidido por**: CPO
**Ejecutado por**: Claude

**Contexto**: durante la elaboración de DOC-005 (Personas), el CPO identificó que el
proceso de trabajo documento-por-documento ya venía arrastrando síntomas de un problema
de fondo: colisiones de identificadores (Decision Catalog vs. una hipotética DOC-005 de
Personas), ambigüedad entre clasificación histórica y normativa, y carpetas con
propósitos mezclados. En vez de continuar agregando documentos de producto, el CPO
decidió pausar ese trabajo y resolver primero la arquitectura y gobernanza del propio
PKB, mediante un documento nuevo y distinto de la serie `DOC-*`: los `DOC-*` representan
conocimiento del producto, mientras que este documento nuevo describe cómo se administra
ese conocimiento, no el producto en sí. Nace así una serie separada, `GOV-*`, y dentro de
ella el primer documento: `GOV-001 — Gobernanza del Product Knowledge Base (PKB)`.

**Proceso de revisión**: CPO presenta v1.0 Draft, clasificado deliberadamente como
Governance / Autoridad: No (autoridad sobre el repositorio documental, no sobre el
producto) → CTO revisa y plantea 6 hallazgos: (1) colisión de identificadores no
resuelta formalmente pese a estar diagnosticada; (2) ausencia de un mecanismo de
recertificación para documentos preexistentes al propio GOV-001; (3) ambigüedad entre
qué constituye un cambio operativo del PKB y qué constituye un cambio de la gobernanza
misma (incluida la autoridad para crear una categoría documental nueva); (4) ausencia de
un mecanismo formal de resolución cuando el CPO y el CTO no coinciden sobre una
observación; (5) ausencia de una regla de declaración de dependencias entre documentos;
(6) la jerarquía entre dominios normativos paralelos (Producto/Negocio/Marca), abierta
desde JRN-003, seguía sin resolverse → CPO acepta los 6 hallazgos e incorpora, para cada
uno, una sección o subsección específica → CPO consolida todo en una v2.0 completa y
autoconsistente (Estado: Review) → CTO realiza la verificación final de consistencia,
con foco específico en dos puntos de integración (Roles §8 vs. la nueva "Resolución de
Observaciones" §8.4; Ciclo de Vida §7 vs. los nuevos "Cambios Operativos" §10.3) → CTO no
encuentra contradicciones bloqueantes; señala una superposición de redacción menor entre
"Cambios Mayores" (§10.1) y "Cambios de Gobernanza" (§10.4), y una fecha sin completar en
el encabezado, ambas no bloqueantes → CPO incorpora las mejoras editoriales señaladas →
CPO aprueba.

**Principales decisiones tomadas durante la revisión**:

- Se creó una serie de identificadores nueva y separada, `GOV-*`, distinta de `DOC-*`
  (conocimiento del producto), `ADR-*` (decisiones de arquitectura técnica) y `JRN-*`
  (Product Journal histórico) — GOV-* gobierna el repositorio documental, no el producto.
- Se estableció el modelo oficial de clasificación documental del PKB en cinco
  categorías: Product Normative (Autoridad: Sí), Product Strategic (Autoridad: No),
  Governance (autoridad sobre el repositorio, no sobre el producto), ADR (alcance
  técnico) y Product Journal (histórico, no normativo).
- Se formalizó que la creación de una categoría documental nueva requiere una nueva
  versión mayor de GOV-001 (§5.6, §10.4) — no puede resolverse mediante una decisión
  operativa.
- Se estableció el Registro Oficial de Numeración (§6.1, §6.2): cada serie documental
  mantiene un único registro; la asignación de un identificador ocurre al crear el
  documento en Draft y es permanente e irreversible, incluso si el documento nunca se
  aprueba; el registro es responsabilidad del CPO, y su sincronización, del CTO.
- Se formalizó la Recertificación (§11.1) para documentos preexistentes a GOV-001: la
  clasificación histórica es válida por precedencia hasta que cada documento sea
  recertificado individualmente (clasificación, autoridad, ubicación, identificador,
  unicidad).
- Se distinguió explícitamente entre Cambios Mayores, Cambios Menores, **Cambios
  Operativos** (§10.3 — asignar un identificador, archivar un documento, sincronizar el
  PKB: ejecutan la gobernanza, no la modifican, y no requieren nueva versión) y
  **Cambios de Gobernanza** (§10.4 — modificar roles, categorías, ciclo de vida o
  proceso de aprobación: sí requieren nueva versión mayor).
- Se formalizó la Resolución de Observaciones (§8.4): las observaciones del CTO son
  recomendaciones, no vetos; el CPO decide cuáles incorpora y debe justificar los
  rechazos; ante desacuerdo entre CPO y CTO, el CEO es la instancia final; el CTO no
  tiene autoridad para bloquear unilateralmente una aprobación.
- Se formalizó la Declaración de Dependencias (§12): todo documento debe declarar sus
  dependencias directas (en el encabezado o en una sección "Referencias"); las
  dependencias indirectas no son obligatorias.
- Se dejó explícitamente Fuera de Alcance (§15) la jerarquía entre dominios normativos
  paralelos (Producto/Negocio/Marca) — el ítem abierto desde JRN-003 — diferida a un
  futuro documento de "Arquitectura del PKB".

**Resolución**: `GOV-001 – Gobernanza del Product Knowledge Base (PKB)` v2.0 queda
**Approved**, con Domain: Process, Knowledge Type: Governance, Authority: No.

**Acciones ejecutadas**:

- *Creado* `docs/governance/GOV-001-PKB-Governance.md` con el texto completo aprobado.
- *Creado* `docs/governance/REGISTRO-NUMERACION.md`, el Registro Oficial de Numeración
  exigido por GOV-001 §6.2, con GOV-001 como primera entrada de la serie GOV (próximo
  identificador disponible: GOV-002) y DOC-004 registrado en la serie DOC.
- Registrada esta entrada (JRN-007) en el Product Journal.

**No ejecutado** (fuera de alcance de esta sincronización, explícitamente diferido por
el propio GOV-001 y por el CPO):

- Recertificación formal de DOC-001, DOC-003 y DOC-004 conforme a GOV-001 §11.1.
- Reconciliación de códigos y creación de una sección "Governance" en `docs/INDEX.md`
  (sigue mostrando "—" para Product Vision y Product Principles).
- Resolución de la jerarquía entre dominios normativos paralelos (Producto/Negocio/
  Marca), explícitamente fuera de alcance de GOV-001 (§15) y diferida a un futuro
  documento de Arquitectura del PKB.

Ambos ítems de recertificación y reconciliación de `INDEX.md` quedan reservados para el
sprint de gobernanza documental, para el cual GOV-001 es ahora el marco de referencia.
