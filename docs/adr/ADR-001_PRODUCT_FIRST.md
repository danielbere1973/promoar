---
title: ADR-001 — La decisión es el producto
status: Accepted
date: 2026-07-15
owner: Dani
authors:
  - Dani (Founder)
  - ChatGPT (Chief Product Officer)
reviewers:
  - Claude
---

# ADR-001 — La decisión es el producto

## Estado

Accepted

---

## Contexto

La mayoría de las aplicaciones de promociones disponibles en el mercado siguen un mismo paradigma.

Reúnen beneficios provenientes de distintas entidades financieras y permiten que el usuario los explore mediante categorías, filtros y búsquedas.

Ese enfoque resuelve parcialmente el problema.

Reduce el tiempo necesario para encontrar promociones, pero no reduce el esfuerzo requerido para decidir cuál conviene utilizar.

A medida que aumenta la cantidad de promociones disponibles, el costo cognitivo del usuario también aumenta.

Paradójicamente, ofrecer más información puede hacer más difícil tomar una decisión.

Durante el diseño de PromoAR surgió una pregunta fundamental.

> ¿Cuál es realmente nuestro producto?

La respuesta definió la arquitectura conceptual de toda la plataforma.

PromoAR no pretende construir el mayor catálogo de promociones.

Pretende construir el mejor sistema para ayudar a decidir.

Las promociones son información.

La decisión es el producto.

---

## Problema

Existen dos modelos posibles.

### Modelo A

Mostrar toda la información disponible.

La responsabilidad de comparar alternativas continúa siendo del usuario.

El producto funciona como un buscador.

---

### Modelo B

Analizar automáticamente el contexto del usuario.

Interpretar las promociones disponibles.

Generar una recomendación.

Permitir luego explorar el resto de las alternativas.

El producto funciona como un asistente para la toma de decisiones.

---

Ambos modelos son técnicamente válidos.

Era necesario elegir uno como eje principal del producto.

---

## Decisión

PromoAR adopta el Modelo B.

La experiencia principal del producto estará orientada a recomendar antes que listar.

Las promociones seguirán siendo accesibles mediante búsqueda y exploración.

Sin embargo, la interfaz priorizará siempre responder una pregunta antes que mostrar un catálogo.

La navegación libre continúa existiendo.

Pero deja de ser el camino principal.

---

## Consecuencias

Esta decisión afecta prácticamente todo el diseño del producto.

A partir de este momento:

- La pantalla principal prioriza recomendaciones.
- La IA interpreta contexto antes de responder.
- Los motores de ranking tienen mayor importancia que los listados.
- El éxito del producto deja de medirse por cantidad de promociones consultadas.
- El principal indicador pasa a ser la calidad de las decisiones asistidas.

La pregunta que deberá responder cualquier nueva funcionalidad será siempre la misma:

> ¿Ayuda al usuario a decidir mejor?

Si la respuesta es negativa, esa funcionalidad deberá reconsiderarse.

---

## Alternativas consideradas

Durante el diseño conceptual de PromoAR se evaluaron distintos enfoques para resolver el problema de la consulta de promociones.

### Alternativa A — Catálogo de promociones

Construir una plataforma centrada en reunir la mayor cantidad posible de promociones y ofrecer herramientas de búsqueda, filtros y categorías.

#### Ventajas

- Implementación relativamente sencilla.
- Comportamiento conocido por la mayoría de los usuarios.
- Baja complejidad para explicar el funcionamiento del producto.

#### Desventajas

- El usuario continúa realizando todo el análisis.
- A mayor cantidad de promociones, mayor esfuerzo para decidir.
- El valor diferencial del producto disminuye con el tiempo.
- Resulta fácilmente replicable por otros competidores.

---

### Alternativa B — Motor de recomendaciones

Construir un sistema capaz de comprender el contexto del usuario y generar una recomendación antes de presentar el listado completo de alternativas.

#### Ventajas

- Reduce significativamente el esfuerzo cognitivo.
- Incrementa el valor percibido del producto.
- Permite aprovechar el contexto y la personalización.
- Genera un diferencial competitivo difícil de replicar.

#### Desventajas

- Requiere mayor calidad de datos.
- Incrementa la complejidad técnica.
- Exige explicar las recomendaciones para generar confianza.

---

Después de analizar ambas alternativas, se decidió adoptar la segunda como eje principal de PromoAR.

---

## Justificación

La misión de PromoAR no consiste en organizar promociones.

Consiste en ayudar a las personas a tomar mejores decisiones.

Si el usuario todavía necesita comparar manualmente decenas de promociones para descubrir cuál le conviene, el problema original continúa existiendo.

El verdadero valor del producto aparece cuando esa comparación deja de ser una carga para el usuario.

Por ese motivo, las recomendaciones constituyen el núcleo de la experiencia.

Los listados continúan existiendo, pero como una herramienta complementaria y nunca como el objetivo principal del producto.

---

## Riesgos asumidos

Adoptar un modelo centrado en recomendaciones implica aceptar ciertos desafíos.

Entre ellos:

- Necesidad de mantener información confiable y actualizada.
- Mayor responsabilidad sobre la calidad de las recomendaciones.
- Incremento de la complejidad del producto.
- Necesidad permanente de preservar la confianza del usuario.

Estos riesgos fueron considerados aceptables porque representan el costo de construir un producto con un valor diferencial sostenible.

---

## Decisiones derivadas

Como consecuencia de este ADR, se establecen las siguientes decisiones permanentes para PromoAR:

- El Modo Asistente constituye la experiencia principal del producto.
- El Modo Exploración continuará disponible como complemento para quienes deseen analizar alternativas manualmente.
- Toda nueva funcionalidad deberá demostrar cómo ayuda al usuario a decidir mejor.
- La incorporación de nuevos datos sólo tendrá sentido si mejora la calidad de las recomendaciones.
- Las métricas del producto priorizarán la utilidad de las recomendaciones por encima del volumen de información presentada.

---

## Relación con otros documentos

Este ADR implementa decisiones definidas en la documentación fundacional de PromoAR.

Se encuentra directamente relacionado con:

- `docs/vision/product-vision.md`, donde se establece que la decisión constituye el verdadero producto.
- `docs/vision/PRODUCT_PRINCIPLES.md`, especialmente con el principio **"La decisión es el producto"** y el principio **"Recomendar antes que listar"**.
- `docs/roadmap/ROADMAP.md`, particularmente con la transición entre las etapas **Personalizar** y **Recomendar**, donde esta decisión comienza a materializarse como capacidad central del producto.

---

## Vigencia

Este ADR permanecerá vigente mientras PromoAR mantenga como propósito principal ayudar a las personas a tomar mejores decisiones de consumo.

Cualquier cambio que implique abandonar este enfoque deberá registrarse mediante un nuevo ADR que reemplace explícitamente esta decisión.

---

## Cierre

Este documento registra una de las decisiones fundacionales de PromoAR.

No define una tecnología.

No impone una arquitectura de software.

Define un criterio para construir el producto.

A partir de este ADR, toda discusión sobre nuevas funcionalidades deberá comenzar con una pregunta simple:

> **¿Esto ayuda al usuario a decidir mejor?**

Si la respuesta es afirmativa, probablemente la decisión esté alineada con la esencia de PromoAR.

Si la respuesta es negativa, será necesario revisar si esa funcionalidad realmente aporta al propósito del producto.
