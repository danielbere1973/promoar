---
title: GOV-001 – Gobernanza del Product Knowledge Base (PKB)
version: "2.0"
status: Approved
owner: CPO
last_updated: "2026-07-23"
domain: Process
knowledge_type: Governance
authority: No
---

# GOV-001 — Gobernanza del Product Knowledge Base (PKB)

| Campo | Valor |
|--------|-------|
| **ID** | GOV-001 |
| **Versión** | 2.0 |
| **Estado** | Approved |
| **Clasificación** | Governance |
| **Autoridad** | No |
| **Owner** | Chief Product Officer (CPO) |
| **Revisores** | Chief Technology Officer (CTO) |
| **Aprobador** | Chief Executive Officer (CEO) |
| **Última actualización** | 2026-07-23 |
| **Documentos relacionados** | DOC-001, DOC-003, DOC-004 |
| **Reemplaza** | N/A |
| **Reemplazado por** | N/A |

---

# 1. Propósito

Este documento define el modelo de gobernanza del **Product Knowledge Base (PKB)** de PromoAR.

Su propósito es establecer las reglas que rigen la creación, clasificación, revisión, aprobación, mantenimiento y retiro de la documentación oficial del producto.

La gobernanza definida en este documento busca garantizar que el PKB permanezca consistente, trazable y escalable a medida que evolucionen el producto y la organización.

Este documento regula el funcionamiento del PKB, pero no define el comportamiento funcional del producto ni reemplaza la autoridad de los documentos normativos.

---

# 2. Alcance

Las reglas establecidas en este documento aplican a toda la documentación oficial incorporada al Product Knowledge Base.

Esto incluye:

- Documentos de producto clasificados como **Product Normative**.
- Documentos de producto clasificados como **Product Strategic**.
- Documentos de gobernanza (**Governance**).
- Architecture Decision Records (**ADR**).
- Product Journal (**JRN**).

Quedan expresamente excluidos del alcance de este documento:

- Notas personales.
- Documentación temporal de trabajo.
- Borradores que aún no hayan sido incorporados al PKB.
- Documentación técnica auxiliar utilizada únicamente durante el desarrollo.

---

# 3. Objetivos del Product Knowledge Base

El Product Knowledge Base constituye la fuente oficial de conocimiento del producto.

Sus objetivos son:

- Mantener una única fuente de verdad para cada concepto relevante.
- Preservar la trazabilidad de las decisiones tomadas durante la evolución del producto.
- Reducir inconsistencias entre documentos.
- Facilitar la incorporación de nuevos integrantes al equipo.
- Permitir la evolución controlada del conocimiento del producto.
- Garantizar que toda decisión relevante pueda justificarse mediante documentación vigente.

El PKB no busca almacenar toda la información disponible sobre PromoAR.

Su objetivo es preservar únicamente el conocimiento necesario para comprender, diseñar, evolucionar y gobernar el producto.

---

# 4. Principios de Gobernanza

Toda la documentación incorporada al PKB deberá respetar los siguientes principios.

## 4.1 Fuente Única de Verdad (Single Source of Truth)

Cada concepto deberá estar definido en un único documento oficial.

No podrán coexistir dos documentos con igual nivel de autoridad describiendo el mismo concepto.

Cuando exista información duplicada, deberá identificarse un único documento como fuente oficial y actualizar el resto mediante referencias o archivado.

---

## 4.2 Trazabilidad

Toda decisión relevante deberá poder rastrearse hasta el documento que la originó.

Los documentos deberán declarar explícitamente las dependencias necesarias para comprender su contenido.

La trazabilidad deberá permitir responder, en cualquier momento:

- qué decisión fue tomada;
- por qué fue tomada;
- cuándo fue tomada;
- qué documento la respalda.

---

## 4.3 Consistencia

Los documentos aprobados no deberán contradecir información vigente contenida en otros documentos oficiales.

Cuando una modificación implique un cambio de criterio previamente aprobado, deberá actualizarse el documento correspondiente siguiendo el proceso de gobernanza definido en este documento.

La resolución de contradicciones tendrá prioridad sobre la incorporación de nuevo contenido.

---

## 4.4 Evolución Controlada

Todo documento del PKB podrá evolucionar a lo largo del tiempo.

Ningún documento aprobado podrá modificarse directamente sin atravesar el proceso formal de revisión y aprobación.

Toda evolución deberá preservar la trazabilidad histórica mediante el control de versiones y el Product Journal.

---

## 4.5 Estabilidad

Los identificadores documentales deberán permanecer estables durante todo el ciclo de vida del documento.

La modificación de un documento no alterará su identificador.

La renumeración de documentos solo podrá realizarse mediante una decisión explícita de gobernanza.

---

## 4.6 Gobernanza Explícita

Las reglas que gobiernan el PKB deberán encontrarse documentadas dentro del propio PKB.

No deberán existir reglas de funcionamiento conocidas únicamente por los integrantes del equipo.

Toda práctica recurrente deberá formalizarse mediante documentación cuando resulte necesaria para garantizar la consistencia del repositorio.

---

## 4.7 Escalabilidad

La gobernanza deberá diseñarse para soportar el crecimiento del PKB sin requerir modificaciones frecuentes.

Las reglas establecidas deberán permanecer válidas independientemente de la cantidad de documentos, dominios o equipos que participen en la evolución del producto.

---

# 5. Clasificación Documental

El PKB organiza su documentación en categorías documentales.

La clasificación de un documento determina su propósito, su nivel de autoridad y el proceso de mantenimiento esperado.

Todos los documentos deberán pertenecer exactamente a una categoría.

---

## 5.1 Product Normative

Define las reglas oficiales del producto.

Características:

- Autoridad: Sí.
- Puede establecer restricciones para documentos posteriores.
- Requiere aprobación formal.
- Toda modificación debe seguir el proceso completo de gobernanza.

Ejemplos:

- Product Vision.
- Product Principles.
- Success Metrics.
- Product Scope.

---

## 5.2 Product Strategic

Describe conocimiento utilizado para diseñar y evolucionar el producto.

Estos documentos ayudan a comprender el contexto de negocio y de los usuarios, pero no modifican por sí mismos el comportamiento oficial del producto.

Características:

- Autoridad: No.
- Evolución frecuente.
- Pueden servir como insumo para documentos normativos.

Ejemplos:

- Personas.
- Jobs To Be Done.
- User Research.
- Market Analysis.
- Competitive Analysis.

---

## 5.3 Governance

Define las reglas de funcionamiento del propio Product Knowledge Base.

Estos documentos gobiernan la documentación, no el producto.

Características:

- Autoridad sobre el PKB.
- No define funcionalidades del producto.
- Regula procesos documentales.

Ejemplos:

- GOV-001 — Gobernanza del PKB.

---

## 5.4 Architecture Decision Records (ADR)

Documentan decisiones relevantes de arquitectura técnica.

Su objetivo es preservar el razonamiento detrás de decisiones tecnológicas importantes.

Características:

- Alcance técnico.
- Trazabilidad de decisiones.
- No reemplazan documentos de producto.

---

## 5.5 Product Journal

Constituye el registro cronológico de la evolución del producto y del PKB.

Características:

- Histórico.
- No normativo.
- No reemplaza documentación oficial.
- Registra únicamente eventos relevantes.

---

## 5.6 Creación de Nuevas Categorías

Las categorías definidas en este documento constituyen el modelo oficial de clasificación documental del PKB.

La incorporación de una nueva categoría documental implica una modificación de la arquitectura de gobernanza.

Por lo tanto, requerirá una nueva versión de GOV-001 siguiendo el proceso de aprobación definido en este documento.

No podrán crearse categorías nuevas mediante decisiones operativas.

---

# 6. Convención de Identificadores

Todo documento oficial del PKB deberá poseer un identificador único y permanente.

Los identificadores permiten garantizar la trazabilidad documental y evitar ambigüedades durante toda la vida útil del documento.

Ejemplos:

```text
DOC-001
DOC-015

GOV-001

ADR-003

JRN-012
```

Los identificadores:

- deberán ser únicos;
- no podrán reutilizarse;
- permanecerán invariables durante todo el ciclo de vida del documento.

La modificación del contenido de un documento nunca implicará modificar su identificador.

---

## 6.1 Asignación de Identificadores

Cada serie documental (DOC, GOV, ADR y JRN) mantendrá un registro oficial de numeración.

La asignación de un nuevo identificador se realizará en el momento en que el documento sea creado en estado **Draft**.

La asignación del identificador implica su reserva permanente.

Si posteriormente el documento fuera cancelado, archivado o nunca llegara a aprobarse, dicho identificador no podrá reutilizarse.

El objetivo de esta regla es preservar la estabilidad de las referencias históricas y evitar colisiones de numeración.

El registro oficial de numeración será responsabilidad del **Chief Product Officer (CPO)**.

La sincronización del repositorio y la verificación de consistencia serán responsabilidad del **Chief Technology Officer (CTO)**.

---

## 6.2 Registro Oficial de Numeración

El PKB mantendrá un registro único de identificadores asignados para cada serie documental.

Como mínimo, dicho registro deberá indicar:

- Identificador.
- Título del documento.
- Estado.
- Fecha de asignación.
- Versión vigente.

El registro oficial constituye la referencia autorizada para determinar el próximo identificador disponible.

Ningún documento podrá recibir un identificador que no haya sido previamente reservado en dicho registro.

---

# 7. Ciclo de Vida de los Documentos

Todos los documentos del PKB seguirán el mismo ciclo de vida documental.

```text
Draft
   │
   ▼
Review
   │
   ▼
Approved
   │
   ├──────────────► Deprecated
   │                     │
   │                     ▼
   └────────────────► Archived
```

---

## 7.1 Draft

Documento en elaboración.

Puede modificarse libremente por su Owner.

No constituye documentación oficial.

---

## 7.2 Review

Documento sometido al proceso formal de revisión.

Durante esta etapa podrán generarse observaciones por parte del CEO y del CTO.

El documento permanecerá en estado Review hasta que las observaciones aceptadas sean incorporadas y el proceso de aprobación concluya.

---

## 7.3 Approved

Documento aprobado oficialmente.

Constituye la versión vigente del conocimiento documentado.

Toda modificación posterior requerirá una nueva versión del documento.

---

## 7.4 Deprecated

Documento reemplazado por una versión superior o por otro documento.

Permanece disponible únicamente por razones de trazabilidad histórica.

No deberá utilizarse como referencia para nuevas decisiones.

---

## 7.5 Archived

Documento retirado del uso operativo.

Se conserva únicamente como registro histórico.

No podrá volver al estado Approved.

Si el conocimiento archivado necesitara recuperarse, deberá generarse una nueva versión documental siguiendo el proceso normal de gobernanza.

---

# 8. Roles y Responsabilidades

La gobernanza del PKB se apoya en tres roles principales.

Cada rol posee responsabilidades claramente definidas para evitar superposiciones de autoridad.

---

## 8.1 Chief Executive Officer (CEO)

El CEO representa la autoridad final sobre el producto.

Sus responsabilidades incluyen:

- aprobar documentos oficiales;
- resolver desacuerdos entre CPO y CTO;
- validar cambios estratégicos del PKB;
- aprobar modificaciones de la gobernanza.

El CEO no participa en la administración operativa del repositorio.

---

## 8.2 Chief Product Officer (CPO)

El CPO es responsable del contenido funcional del PKB.

Sus responsabilidades incluyen:

- redactar documentación;
- mantener la coherencia funcional entre documentos;
- aceptar o rechazar observaciones recibidas durante el proceso de revisión;
- asignar identificadores documentales;
- mantener el registro oficial de numeración;
- decidir la incorporación de nuevos documentos;
- mantener la consistencia del conocimiento del producto.

El CPO constituye el Owner de la documentación del PKB.

---

## 8.3 Chief Technology Officer (CTO)

El CTO actúa como revisor independiente del PKB.

Sus responsabilidades incluyen:

- revisar consistencia documental;
- detectar contradicciones;
- verificar trazabilidad;
- validar cumplimiento de las reglas de gobernanza;
- verificar la correcta sincronización del repositorio;
- registrar inconsistencias encontradas durante las revisiones.

El CTO formula recomendaciones técnicas y documentales, pero no modifica directamente el contenido aprobado.

---

# 8.4 Resolución de Observaciones

Durante el proceso de revisión podrán surgir observaciones emitidas por el CTO o por el CEO.

Cada observación deberá recibir una disposición explícita por parte del CPO.

Las posibles disposiciones son:

- Aceptada.
- Aceptada parcialmente.
- Rechazada.

Toda observación aceptada deberá incorporarse antes de la aprobación del documento.

Las observaciones rechazadas deberán conservar su trazabilidad mediante el historial de revisión correspondiente.

Cuando exista desacuerdo entre el CPO y el CTO respecto de una observación, la decisión final corresponderá al CEO.

El CTO no posee autoridad para bloquear unilateralmente la aprobación de un documento.

---

# 9. Proceso de Aprobación

Todo documento oficial seguirá el mismo flujo de aprobación.

```text
Draft
   │
   ▼
Review
   │
   ▼
CEO Review
   │
   ▼
CTO Review
   │
   ▼
Disposition of Findings (CPO)
   │
   ▼
Consolidated Version
   │
   ▼
Final Consistency Verification (CTO)
   │
   ▼
Approved
   │
   ▼
PKB Synchronization
   │
   ▼
Product Journal
```

Este proceso garantiza que:

- exista una revisión funcional;
- exista una revisión de consistencia;
- exista una decisión explícita sobre cada observación;
- toda modificación aprobada quede registrada.

Ningún documento podrá pasar a estado **Approved** sin completar este flujo.

---

# 10. Gestión de Versiones

Todo documento aprobado deberá mantener un historial de versiones.

Cada nueva versión representará una evolución identificable del conocimiento documentado.

Las versiones deberán incrementarse siguiendo un criterio consistente.

---

## 10.1 Cambios Mayores

Constituyen cambios que modifican el significado o el alcance del documento.

Ejemplos:

- incorporación de nuevas reglas;
- eliminación de reglas existentes;
- redefinición de responsabilidades;
- modificación de procesos.

Los cambios mayores requerirán una nueva versión mayor.

Ejemplo:

```text
2.0 → 3.0
```

---

## 10.2 Cambios Menores

Corresponden a mejoras que no modifican el significado del documento.

Ejemplos:

- aclaraciones;
- reorganización del contenido;
- mejoras de redacción;
- incorporación de ejemplos.

Los cambios menores incrementarán la versión secundaria.

Ejemplo:

```text
2.0 → 2.1
```

---

## 10.3 Cambios Operativos

Los cambios operativos representan la ejecución normal de las reglas definidas por este documento.

No constituyen modificaciones de la gobernanza.

Entre ellos se incluyen, por ejemplo:

- asignación de nuevos identificadores;
- reserva de numeración;
- incorporación de nuevos documentos siguiendo las reglas vigentes;
- actualización del registro oficial de numeración;
- sincronización del repositorio;
- actualización del Product Journal;
- archivado o deprecación de documentos conforme a su ciclo de vida.

Estas actividades no requerirán una nueva versión de GOV-001.

---

## 10.4 Cambios de Gobernanza

Las modificaciones que alteren las reglas establecidas en este documento sí constituyen cambios de gobernanza.

Entre ellas se incluyen:

- creación de nuevas categorías documentales;
- modificación de roles;
- cambios en el proceso de aprobación;
- cambios en el ciclo de vida documental;
- modificación del esquema de identificadores;
- incorporación o eliminación de principios de gobernanza.

Toda modificación de gobernanza requerirá una nueva versión de GOV-001 siguiendo el proceso completo de aprobación definido en este documento.

---

# 11. Migración de Documentos

La incorporación de este modelo de gobernanza no invalida la documentación existente del PKB.

Los documentos creados con anterioridad a la aprobación de GOV-001 conservarán su validez hasta que sean recertificados conforme a las reglas establecidas en este documento.

La migración del repositorio se realizará de manera incremental.

No será necesario detener la evolución del producto para completar dicha migración.

---

## 11.1 Recertificación

La recertificación consiste en verificar que un documento existente cumple con el modelo de gobernanza vigente.

Como mínimo deberá revisarse:

- clasificación documental;
- nivel de autoridad;
- identificador permanente;
- ubicación dentro del repositorio;
- unicidad del contenido;
- relaciones con otros documentos;
- versión vigente.

La recertificación no implica necesariamente modificar el contenido funcional del documento.

Su objetivo es garantizar que el documento quede correctamente integrado al modelo de gobernanza del PKB.

---

# 12. Declaración de Dependencias

Todo documento oficial deberá declarar explícitamente los documentos de los cuales depende.

Las dependencias representan la información mínima necesaria para comprender correctamente un documento.

Las dependencias podrán declararse:

- en el encabezado documental;
- o en una sección específica denominada **Referencias**.

No será obligatorio declarar dependencias indirectas.

Cada documento será responsable únicamente de declarar sus dependencias directas.

---

# 13. Relaciones entre Documentos

Los documentos del PKB podrán mantener relaciones entre sí.

Las relaciones documentales no modifican el nivel de autoridad de los documentos involucrados.

Entre las relaciones más comunes se encuentran:

- depende de;
- reemplaza a;
- es reemplazado por;
- complementa;
- referencia.

Estas relaciones tienen por objetivo facilitar la navegación, preservar la trazabilidad y mejorar la comprensión del conocimiento documentado.

---

# 14. Regla de Unicidad

Cada concepto relevante deberá poseer un único documento oficial responsable de definirlo.

Cuando un documento necesite utilizar un concepto definido en otro documento, deberá referenciarlo en lugar de duplicar su contenido.

La duplicación sistemática de conocimiento constituye una violación de los principios de gobernanza establecidos en este documento.

Cuando se detecten duplicaciones, deberá identificarse un único documento como fuente oficial y actualizar el resto mediante referencias, consolidación o archivado.

---

# 15. Fuera del Alcance

Este documento no regula:

- la organización funcional del producto;
- la arquitectura técnica de PromoAR;
- las decisiones de negocio;
- la metodología de desarrollo;
- la planificación de producto;
- la jerarquía entre dominios funcionales (por ejemplo, Producto, Negocio, Tecnología o Marca).

La definición de dominios documentales especializados podrá incorporarse en futuras versiones del PKB cuando resulte necesaria.

---

# 16. Evolución de la Gobernanza

La gobernanza del PKB constituye un activo vivo.

Podrá evolucionar cuando las necesidades del producto o de la organización lo requieran.

Toda modificación deberá preservar:

- la estabilidad del repositorio;
- la trazabilidad histórica;
- la unicidad documental;
- la coherencia del modelo de gobernanza.

Las modificaciones de gobernanza seguirán el proceso de aprobación definido en este documento.

---

# 17. Vigencia

La versión aprobada de GOV-001 constituye la referencia oficial para la gobernanza del Product Knowledge Base.

Toda documentación creada o modificada con posterioridad a su aprobación deberá cumplir las reglas establecidas en este documento.

Las versiones anteriores permanecerán disponibles únicamente con fines históricos y de trazabilidad.

---

## Referencias

- DOC-001 — Product Vision
- DOC-003 — Product Principles
- DOC-004 — Success Metrics

---

## Historial de Versiones

| Versión | Estado | Descripción |
|----------|--------|-------------|
| 2.0 | Approved | Primera versión consolidada del modelo de gobernanza del PKB. Integra las observaciones aceptadas durante las revisiones del CTO y establece el marco normativo para la gestión documental del repositorio. |

---

**Fin del documento**
