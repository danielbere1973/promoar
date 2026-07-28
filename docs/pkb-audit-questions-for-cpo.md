# Preguntas para el CPO — Auditoría PKB

**Estado**: RESUELTO — respondido por el CPO, reorganización ejecutada
**Fecha**: 2026-07-22
**Autor**: Claude (CTO/implementación)
**Domain**: Process
**Knowledge Type**: Support
**Authority**: No

> Documento histórico. Todas las preguntas de abajo fueron respondidas por el CPO y la
> reorganización aprobada ya fue ejecutada (ver informe en
> `00-journal/DOC-000-Product-Journal.md`). Se conserva como registro de qué se
> preguntó y qué se decidió — no reabrir ni usar como checklist activo.

Antes de ejecutar la reorganización propuesta en la auditoría de `docs/`, necesito
confirmación del CPO en dos puntos. No se mueve, fusiona ni elimina nada hasta recibir
respuesta.

---

## 1. Mapeo de Owners en `INDEX.md`

Propuesta default a confirmar o corregir:

| Carpeta / tema | Owner propuesto | ¿Confirmado? |
|---|---|---|
| `vision/`, `01-strategy/`, `02-decisions/`, `00-journal/`, `product/` (excepto `DOMAIN_MODEL.md`/`DESIGN_SYSTEM.md` si los toca CTO) | CPO | — |
| `adr/`, `technical/`, `04-rfc/` | CTO | — |
| `brand/` | Marketing | — |
| `business/` | CPO (¿o un rol de Business/CEO separado?) | — |
| `roadmap/` | ¿Compartido CPO+CTO en un mismo doc, o dos filas separadas (producto/técnico)? | — |

---

## 2. Fusiones propuestas — necesitan aprobación explícita una por una

### 2.1 `vision/product-vision.md` §3 + `vision/PRODUCT_PRINCIPLES.md`
Mismos 10 principios en dos niveles de detalle, sin cross-reference entre ambos.

- [ ] Fusionar en un solo documento
- [ ] Dejar `product-vision.md` como versión ejecutiva que enlaza a `PRODUCT_PRINCIPLES.md` como desarrollo extendido
- [ ] Otro (especificar)

### 2.2 Cuatro mecanismos de registro de decisiones/eventos de producto
`product/product-decisions.md`, `01-strategy/DOC-002-Decision-Map.md`,
`01-strategy/DOC-005-Decision-Catalog.md`, `00-journal/DOC-000-Product-Journal.md`.

¿Cuál es el registro autoritativo? Lectura propuesta (a confirmar):
- **Decision Map** → mapa de decisiones vigentes
- **Decision Catalog** → catálogo histórico completo
- **Product Journal** → cronológico crudo, entrada por evento
- **product-decisions.md** → candidato a eliminar por redundante con los tres anteriores

- [ ] Confirmar esta lectura
- [ ] Corregir (especificar propósito real de cada uno)

### 2.3 `business/metrics.md` + `01-strategy/DOC-004-Success-Metrics.md`
Mismo tema (KPIs de negocio), dos ubicaciones.

- [ ] Mantener solo `DOC-004-Success-Metrics.md`, eliminar `business/metrics.md`
- [ ] Mantener solo `business/metrics.md`, eliminar `DOC-004`
- [ ] Son cosas distintas, mantener ambos (especificar diferencia)

### 2.4 `product/use-cases.md` + `product/USER_JOURNEYS.md`
`use-cases.md` es placeholder vacío; `USER_JOURNEYS.md` ya tiene 6 journeys reales desarrollados.

- [ ] Eliminar `use-cases.md` por redundante
- [ ] Mantener ambos (especificar qué cubre `use-cases.md` que `USER_JOURNEYS.md` no cubre)

---

## Una vez respondido esto puedo ejecutar sin más consultas

- Mover los 3 archivos "roadmap" a una misma carpeta
- Agrupar `rfc-002-*` en `technical/rfc-002/`
- Crear los README pendientes de `02-decisions/`, `03-functional/`, `04-rfc/`
- Crear los 4 templates pendientes
- Desarrollar `vision/glossary.md` derivando de `product/DOMAIN_MODEL.md`
- Actualizar `INDEX.md` con la columna Owner ya confirmada
