# 05-rfc

**Domain**: Process
**Knowledge Type**: Support
**Authority**: No

## Qué contiene esta carpeta

RFCs técnicos: documentos de diseño técnico derivados de un documento funcional ya
aprobado (`04-functional/`). Describen cómo se implementa algo, no si debería hacerse
(esa decisión ya está tomada aguas arriba).

Distinto de los ADR (`docs/adr/`): un ADR registra una decisión de arquitectura puntual
y su justificación; un RFC de esta carpeta describe el diseño completo de una
implementación, que puede incluir o referenciar varios ADRs.

## Convención de nombres

Se mantiene la convención ya usada en `docs/technical/` para los RFCs existentes
(`rfc-00X-nombre-corto.md`, con subcarpeta propia si el RFC tiene múltiples documentos
asociados, como `rfc-002/`).

## Relación con otros documentos

- Se deriva de un documento funcional aprobado en `04-functional/`.
- Puede generar uno o más ADR en `docs/adr/`.

## Owner

CTO.

---

*Placeholder — los RFC técnicos existentes (RFC-002, RFC-003, RFC-004) siguen viviendo
en `docs/technical/` por continuidad; esta carpeta define la convención para RFCs
nuevos derivados del flujo de Product Knowledge Base. El contenido real será creado
por el CTO cuando exista el primer RFC bajo este esquema.*
