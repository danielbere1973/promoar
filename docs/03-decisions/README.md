# 03-decisions

**Domain**: Process
**Knowledge Type**: Support
**Authority**: No

## Qué contiene esta carpeta

Decision Documents: documentos de decisión de negocio/producto, uno por decisión.

Cada Decision Document responde una única pregunta de negocio (ej. "¿deberíamos cobrar
por el perfil financiero avanzado?"). No es código, no es arquitectura — eso vive en
`05-rfc/` bajo la forma de ADR o RFC técnico derivado.

## Convención de nombres

`DS-XXX-nombre-corto.md`, con numeración secuencial ascendente que nunca se reutiliza
(mismo criterio que `JRN-XXX` en `00-journal/DOC-000-Product-Journal.md`).

Ejemplos ilustrativos de código (no son decisiones reales todavía): `DS-001`, `DS-002`,
`DS-003`.

## Relación con otros documentos

- Se registra en `02-decision-model/DOC-005-Decision-Catalog.md` (índice).
- Su motivo/contexto histórico queda en `00-journal/DOC-000-Product-Journal.md`.
- Si la decisión sigue vigente, se refleja en `02-decision-model/DOC-002-Decision-Map.md`.

## Owner

CPO.

---

*Placeholder — todavía no existen Decision Documents. Este archivo describe la
convención; el contenido real será creado por el CPO cuando exista la primera decisión
a documentar.*
