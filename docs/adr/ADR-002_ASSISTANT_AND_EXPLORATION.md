---
title: ADR-002 — Asistente y Exploración
status: Accepted
date: 2026-07-15
owner: Dani
authors:
  - Dani (Founder)
  - ChatGPT (Chief Product Officer)
reviewers:
  - Claude
---

# ADR-002 — Asistente y Exploración

## Estado

Accepted

---

## Contexto

Desde el inicio del diseño de PromoAR surgió una tensión natural entre dos formas de utilizar el producto.

Una parte de los usuarios desea obtener una respuesta inmediata.

No quieren analizar promociones.

No quieren comparar condiciones.

Simplemente quieren saber cuál es la mejor opción para una situación concreta.

Otros usuarios disfrutan explorando.

Prefieren recorrer promociones, comparar alternativas, descubrir beneficios y decidir por sí mismos.

Ambos comportamientos son legítimos.

Sin embargo, diseñar una única experiencia para satisfacer simultáneamente ambas necesidades genera conflictos de usabilidad.

Si toda la interfaz se orienta hacia la exploración, el usuario que busca rapidez percibe una aplicación compleja.

Si toda la interfaz se orienta únicamente a recomendaciones, el usuario pierde libertad para investigar por su cuenta.

Era necesario definir una decisión de producto.

---

## Problema

Existen dos enfoques posibles.

### Modelo A

Construir una única experiencia basada exclusivamente en navegación y exploración.

El usuario conserva todo el control.

Pero también asume todo el esfuerzo de análisis.

---

### Modelo B

Construir una única experiencia basada exclusivamente en recomendaciones generadas por el sistema.

El esfuerzo disminuye.

Pero algunos usuarios pueden sentir que pierden capacidad de decisión o transparencia.

---

Ninguno de estos enfoques representa completamente la filosofía de PromoAR.

---

## Decisión

PromoAR ofrecerá dos modos complementarios de interacción.

### Modo Asistente

Representa la experiencia principal del producto.

Su objetivo consiste en ayudar al usuario a tomar una decisión rápida mediante recomendaciones contextualizadas.

La interacción comienza con una necesidad.

El sistema interpreta el contexto.

Analiza las alternativas disponibles.

Propone una recomendación explicada.

---

### Modo Exploración

Representa una experiencia secundaria, pero permanente.

Permite navegar libremente por promociones, comercios, categorías, medios de pago y beneficios.

Su objetivo consiste en ofrecer transparencia, descubrimiento y control.

El usuario puede verificar recomendaciones, comparar alternativas o simplemente explorar oportunidades de ahorro.

---

Ambos modos coexistirán dentro del mismo producto.

No representan aplicaciones diferentes.

Representan dos formas distintas de interactuar con la misma inteligencia y la misma información.

---

## Principios derivados

Esta decisión establece los siguientes principios permanentes:

- El Modo Asistente constituye la puerta de entrada principal al producto.
- El Modo Exploración nunca desaparecerá.
- Ninguna recomendación impedirá al usuario explorar otras alternativas.
- Toda recomendación deberá poder justificarse mediante información visible para el usuario.
- El usuario conservará siempre la decisión final.

El objetivo de PromoAR no consiste en reemplazar el criterio de las personas.

Consiste en reducir el esfuerzo necesario para que puedan decidir mejor.

---

## Consecuencias para la experiencia de usuario

La existencia de dos modos de interacción influye directamente en la forma en que las personas perciben PromoAR.

El Modo Asistente reduce el tiempo necesario para obtener una respuesta y disminuye el esfuerzo cognitivo asociado a la toma de decisiones.

El Modo Exploración ofrece transparencia y permite verificar, comparar y descubrir información de manera autónoma.

La combinación de ambos enfoques busca equilibrar eficiencia y control.

El usuario nunca deberá sentir que el producto le oculta información.

Tampoco deberá sentirse obligado a analizar manualmente todas las alternativas cuando únicamente necesita una recomendación.

---

## Consecuencias para el desarrollo del producto

Esta decisión condiciona el diseño funcional de PromoAR.

Toda nueva funcionalidad deberá definir explícitamente cuál es su comportamiento dentro de cada modo de interacción.

En consecuencia:

- El Modo Asistente priorizará experiencias conversacionales y orientadas a objetivos.
- El Modo Exploración priorizará herramientas de búsqueda, filtros, navegación y comparación.
- Ambos modos compartirán exactamente la misma información de base.
- No deberán existir promociones exclusivas para uno u otro modo.
- Las diferencias estarán dadas únicamente por la forma de presentar y utilizar la información.

Esto garantiza consistencia funcional y evita mantener dos productos distintos dentro de una misma aplicación.

---

## Riesgos asumidos

Adoptar un modelo de doble interacción implica aceptar determinados desafíos.

Entre ellos:

- Incrementar la complejidad del diseño de la interfaz.
- Mantener coherencia entre dos experiencias diferentes.
- Evitar que ambos modos compitan entre sí.
- Impedir que el Modo Exploración se convierta en un reemplazo del Asistente o viceversa.

Estos riesgos fueron considerados aceptables porque el beneficio para distintos perfiles de usuarios supera ampliamente la complejidad adicional de implementación.

---

## Alternativas descartadas

### Alternativa A — Sólo Asistente

Se evaluó construir una aplicación completamente conversacional donde todas las decisiones fueran guiadas por recomendaciones automáticas.

Esta alternativa fue descartada porque reduce la capacidad del usuario para verificar información, explorar promociones y generar confianza en las recomendaciones.

---

### Alternativa B — Sólo Exploración

También se evaluó construir una plataforma centrada exclusivamente en búsquedas, filtros y navegación.

Esta alternativa fue descartada porque obliga al usuario a realizar el trabajo de análisis que PromoAR pretende simplificar.

---

### Alternativa C — Aplicaciones separadas

Otra posibilidad consistía en desarrollar dos productos independientes.

Uno orientado a recomendaciones.

Otro orientado a exploración.

Esta alternativa fue descartada porque fragmenta la experiencia del usuario, duplica esfuerzos de desarrollo y genera inconsistencias funcionales.

La coexistencia de ambos modos dentro de un único producto representa una solución más coherente con la visión de PromoAR.

---

## Decisiones derivadas

Como consecuencia de este ADR, se establecen las siguientes decisiones permanentes:

- El Modo Asistente será la experiencia recomendada para la mayoría de los usuarios.
- El Modo Exploración permanecerá disponible de forma permanente.
- Ambos modos compartirán la misma información y las mismas reglas de negocio.
- Ninguna funcionalidad deberá existir exclusivamente para favorecer uno de los modos sin una justificación explícita.
- Las recomendaciones deberán ser siempre explicables y verificables mediante información accesible para el usuario.

---

## Relación con otros documentos

Este ADR implementa decisiones definidas en la documentación fundacional de PromoAR.

Se encuentra directamente relacionado con:

- `docs/vision/product-vision.md`, donde se establece que PromoAR ayuda a tomar decisiones y no únicamente a consultar promociones.
- `docs/vision/PRODUCT_PRINCIPLES.md`, especialmente con los principios **"Recomendar antes que listar"**, **"Explorar seguirá siendo un derecho del usuario"** y **"El usuario conserva el control"**.
- `docs/roadmap/ROADMAP.md`, particularmente con las etapas **Recomendar** y **Optimizar**, donde el Modo Asistente adquiere un rol cada vez más relevante sin reemplazar la capacidad de exploración.

---

## Vigencia

Este ADR permanecerá vigente mientras PromoAR mantenga una estrategia de interacción basada en la coexistencia del Modo Asistente y el Modo Exploración.

Cualquier decisión que implique eliminar uno de estos modos o modificar su rol principal deberá registrarse mediante un nuevo ADR que sustituya explícitamente esta decisión.

---

## Cierre

PromoAR no considera que exista una única forma correcta de interactuar con el producto.

Algunas personas buscan respuestas inmediatas.

Otras prefieren comprender cada alternativa antes de decidir.

El producto debe ser capaz de acompañar ambos comportamientos sin perder coherencia.

El Asistente representa la forma más eficiente de llegar a una decisión.

La Exploración representa la libertad de validar, descubrir y aprender.

No compiten entre sí.

Se complementan.

Este equilibrio constituye uno de los pilares de la experiencia de usuario de PromoAR y forma parte de su identidad como producto.
