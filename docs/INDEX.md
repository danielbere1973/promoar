# Índice Maestro — Product Knowledge Base

**Domain**: Process
**Knowledge Type**: Support
**Authority**: No

Índice de todos los documentos del PKB. Cada documento se clasifica en **dos
dimensiones independientes** (ver JRN-003 en `00-journal/DOC-000-Product-Journal.md`
para el detalle completo de esta resolución):

- **Domain** — de qué habla el documento: Product, Business, Brand, Technical,
  Architecture, Process.
- **Knowledge Type** — qué función cumple, independientemente del dominio:
  - **Normative** (Authority: Yes) — tiene autoridad, puede invalidar documentos de
    nivel inferior.
  - **Strategic** (Authority: No) — organiza y describe, no gobierna ni puede vetar.
  - **Specification** (Authority: No) — implementa una solución concreta.
  - **Support** (Authority: No) — preserva contexto, trazabilidad, navegación o
    vocabulario; no gobierna, no organiza, no especifica.

**Regla vigente**: el Knowledge Type nunca se infiere de la carpeta o el Domain de un
documento. Cada documento fue clasificado explícitamente por el CPO.

## Jerarquía de autoridad (documentos Normative, orden de precedencia)

```
Product Vision → Product Principles → Success Metrics (DOC-004)
→ Decision Documents → Functional Documents → RFC → Código
```

`Decision Map` (DOC-002) y `Decision Catalog` (DOC-005) son **Strategic** y quedan
**fuera** de esta jerarquía: no tienen autoridad y nunca pueden vetar un Decision
Document. Si hay una inconsistencia entre el Map/Catalog y un Decision Document, el
Decision Document gana y el Map/Catalog se actualiza después — nunca al revés.

`Business_Strategy.md`, `brand-playbook.md` y `tone-of-voice.md` son también
Normative/Yes, pero en los dominios Business y Brand respectivamente — son jerarquías
normativas paralelas a la de Product. No existe todavía una regla de precedencia entre
dominios normativos distintos si llegaran a contradecirse (ver ítem abierto en JRN-003).

---

## Journal

| Código | Documento | Ubicación | Domain | Knowledge Type | Authority |
|---|---|---|---|---|---|
| DOC-000 | Product Journal | `00-journal/DOC-000-Product-Journal.md` | Product | Support | No |

## Estrategia (Product)

| Código | Documento | Ubicación | Domain | Knowledge Type | Authority |
|---|---|---|---|---|---|
| — | Product Vision | `vision/product-vision.md` | Product | Normative | Yes |
| — | Product Principles | `vision/PRODUCT_PRINCIPLES.md` | Product | Normative | Yes |
| DOC-004 | Success Metrics | `01-strategy/DOC-004-Success-Metrics.md` | Product | Normative | Yes |
| — | Glossary | `vision/glossary.md` | Product | Support | No |

## Modelo de decisiones (Product — Strategic, sin autoridad)

| Código | Documento | Ubicación | Domain | Knowledge Type | Authority |
|---|---|---|---|---|---|
| DOC-002 | Decision Map | `02-decision-model/DOC-002-Decision-Map.md` | Product | Strategic | No |
| DOC-005 | Decision Catalog | `02-decision-model/DOC-005-Decision-Catalog.md` | Product | Strategic | No |

## Decision Documents

| Código | Documento | Domain | Knowledge Type | Authority |
|---|---|---|---|---|
| — | (sin documentos todavía) | — | Specification | No |

## Functional Documents

| Código | Documento | Domain | Knowledge Type | Authority |
|---|---|---|---|---|
| — | (sin documentos todavía) | — | Specification | No |

## RFC

| Código | Documento | Ubicación | Domain | Knowledge Type | Authority |
|---|---|---|---|---|---|
| — | RFC-002 — Reporte forense compute Neon | `technical/rfc-002/neon-compute-forensic-report.md` | Technical | Specification | No |
| — | RFC-002 Fase 1 — Línea de base | `technical/rfc-002/fase-1-baseline.md` | Technical | Specification | No |
| — | RFC-003 — Reducción de queries `/promos` | `technical/rfc-003-reduccion-queries-carga-promos.md` | Technical | Specification | No |

## ADR

| Documento | Ubicación | Domain | Knowledge Type | Authority |
|---|---|---|---|---|
| ADR-001 — La decisión es el producto | `adr/ADR-001_PRODUCT_FIRST.md` | Product | Specification | No |
| ADR-002 — Asistente y Exploración | `adr/ADR-002_ASSISTANT_AND_EXPLORATION.md` | Product | Specification | No |
| ADR-003 — Data Location Strategy | `adr/ADR-003-Data_Location_Strategy.md` | Product | Specification | No |
| ADR-004 — Neutralidad Comercial | `adr/ADR-004_COMMERCIAL_NEUTRALITY.md` | Product | Specification | No |
| ADR-005 — Search Strategy | `adr/ADR-005-Search_Strategy.md` | Product | Specification | No |
| ADR-006 — Recommendation Engine | `adr/ADR-006-Recommendation_Engine.md` | Product | Specification | No |
| ADR-007 — User Profile | `adr/ADR-007-User_Profile.md` | Product | Specification | No |
| ADR-008 — Notification Strategy | `adr/ADR-008-Notification_Strategy.md` | Product | Specification | No |

## Business

| Documento | Ubicación | Domain | Knowledge Type | Authority |
|---|---|---|---|---|
| Business Strategy | `business/Business_Strategy.md` | Business | Normative | Yes |
| Business Model | `business/business-model.md` | Business | Strategic | No |
| Metrics | `business/metrics.md` | Business | Strategic | No |
| Monetization | `business/monetization.md` | Business | Strategic | No |
| Partnerships | `business/partnerships.md` | Business | Strategic | No |

> `business/metrics.md` (Strategic) mide la operación del negocio y es distinto de
> `DOC-004-Success-Metrics.md` (Normative), que define cómo se mide el éxito del
> producto.

## Brand

| Documento | Ubicación | Domain | Knowledge Type | Authority |
|---|---|---|---|---|
| Brand Playbook | `brand/brand-playbook.md` | Brand | Normative | Yes |
| Tone of Voice | `brand/tone-of-voice.md` | Brand | Normative | Yes |
| Storytelling | `brand/storytelling.md` | Brand | Strategic | No |
| Instagram Strategy | `brand/instagram-strategy.md` | Brand | Strategic | No |

## Product (estrategia y especificación)

| Documento | Ubicación | Domain | Knowledge Type | Authority |
|---|---|---|---|---|
| AI Strategy | `product/AI_STRATEGY.md` | Product | Strategic | No |
| Data Strategy | `product/DATA_STRATEGY.md` | Product | Strategic | No |
| Domain Model | `product/DOMAIN_MODEL.md` | Product | Strategic | No |
| Information Architecture | `product/INFORMATION_ARCHITECTURE.md` | Product | Strategic | No |
| User Journeys | `product/USER_JOURNEYS.md` | Product | Strategic | No |
| User Personas | `product/USER_PERSONAS.md` | Product | Strategic | No |
| Use Cases | `product/use-cases.md` | Product | Strategic | No |
| Design System | `product/DESIGN_SYSTEM.md` | Product | Specification | No |
| Privacy Principles | `product/PRIVACY_PRINCIPLES.md` | Product | Normative | Yes |

## Roadmap

| Documento | Ubicación | Domain | Knowledge Type | Authority |
|---|---|---|---|---|
| Roadmap (maestro) | `roadmap/ROADMAP.md` | Product | Strategic | No |
| Roadmap de Producto | `roadmap/roadmap-product.md` | Product | Strategic | No |
| Roadmap Técnico | `roadmap/roadmap-tech.md` | Technical | Strategic | No |

## Technical

| Documento | Ubicación | Domain | Knowledge Type | Authority |
|---|---|---|---|---|
| Architecture | `technical/architecture.md` | Technical | Specification | No |
| Geolocation Strategy | `technical/geolocation-strategy.md` | Technical | Specification | No |
| Recommendation Engine | `technical/recommendation-engine.md` | Technical | Specification | No |
| Incidentes de tráfico (README) | `technical/incidentes-trafico/README.md` | Technical | Support | No |
| Cronología Neon bot traffic (7/2026) | `technical/incidentes-trafico/2026-07-cronologia-neon-bot-traffic.md` | Technical | Support | No |

(RFC-002 y RFC-003 listados arriba, en la sección "RFC".)

## Process (soporte y navegación del PKB)

| Documento | Ubicación | Domain | Knowledge Type | Authority |
|---|---|---|---|---|
| README raíz de docs | `docs/README.md` | Process | Support | No |
| README `03-decisions/` | `03-decisions/README.md` | Process | Support | No |
| README `04-functional/` | `04-functional/README.md` | Process | Support | No |
| README `05-rfc/` | `05-rfc/README.md` | Process | Support | No |
| Preguntas para el CPO — Auditoría PKB | `pkb-audit-questions-for-cpo.md` | Process | Support | No |
| Template — Decision Document | `templates/Decision-Template.md` | Process | Support | No |
| Template — Functional Document | `templates/Functional-Template.md` | Process | Support | No |
| Template — RFC | `templates/RFC-Template.md` | Process | Support | No |
| Template — Journal Entry | `templates/Journal-Entry-Template.md` | Process | Support | No |
| Template — ADR | `adr/TEMPLATE.md` | Process | Support | No |
| Este índice | `INDEX.md` | Process | Support | No |

> Los archivos de template llevan además, dentro del cuerpo, el placeholder de
> metadata que debe completar cada documento nuevo creado a partir de ellos (que no es
> Support — depende de qué tipo de documento generen).

---

## Estructura de carpetas

```
docs/
├── 00-journal/          Product Journal — memoria histórica, inmutable
├── 01-strategy/          Documentos normativos de producto (Success Metrics)
├── 02-decision-model/    Decision Map + Decision Catalog — navegación operativa (Strategic)
├── 03-decisions/         Decision Documents (DS-XXX) — una decisión por documento
├── 04-functional/        Documentos funcionales (FN-XXX)
├── 05-rfc/               RFCs técnicos derivados de documentos funcionales
├── vision/, product/, business/, technical/, adr/, brand/, roadmap/
│                          Contenido real existente, clasificado por Domain + Knowledge Type
└── templates/            Plantillas vacías por tipo de documento
```

---

*Última actualización: incorporación del modelo de gobernanza de dos dimensiones
(Domain + Knowledge Type + Authority) a todos los documentos del PKB — ver
`00-journal/DOC-000-Product-Journal.md`, JRN-003.*
