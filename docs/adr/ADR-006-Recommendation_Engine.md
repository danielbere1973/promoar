---
title: ADR-006 — Recommendation Engine
status: Accepted
date: 2026-07-15
owner: Dani
authors:
  - Dani (Founder)
  - ChatGPT (Chief Product Officer)
reviewers:
  - Claude
---

# ADR-006 — Recommendation Engine

## Estado

Accepted

---

## Contexto

La principal propuesta de valor de PromoAR consiste en ayudar a las personas a tomar mejores decisiones antes de realizar una compra.

Para cumplir ese objetivo, el producto necesita transformar una gran cantidad de información en una recomendación útil.

Promociones.

Medios de pago.

Bancos.

Billeteras.

Categorías.

Ubicación.

Restricciones.

Preferencias del usuario.

Condiciones particulares.

Contexto.

Toda esa información carece de valor si el usuario debe analizarla manualmente.

El verdadero valor del producto aparece cuando PromoAR es capaz de sintetizar esa complejidad y convertirla en una recomendación clara, comprensible y útil.

Era necesario establecer una decisión arquitectónica permanente sobre el rol del motor de recomendaciones dentro del producto.

---

## Problema

Existen dos enfoques posibles.

### Modelo A

El producto actúa únicamente como un agregador de información.

Las promociones se presentan ordenadas mediante reglas simples.

El usuario analiza manualmente todas las alternativas y decide cuál le resulta más conveniente.

La inteligencia permanece completamente del lado del usuario.

---

### Modelo B

El producto interpreta la información disponible.

Comprende el contexto.

Evalúa múltiples variables simultáneamente.

Prioriza las alternativas más convenientes.

Entrega una recomendación fundamentada que reduzca el esfuerzo necesario para decidir.

El usuario conserva siempre la decisión final.

Pero el trabajo de análisis pasa a ser responsabilidad del producto.

---

Ambos enfoques permiten acceder a las promociones.

Pero únicamente uno de ellos convierte la información en una verdadera ayuda para decidir.

---

## Decisión

PromoAR adopta el Modelo B.

El motor de recomendaciones constituye el núcleo del producto.

Su responsabilidad no consiste en ordenar promociones.

Consiste en interpretar el contexto del usuario y generar la recomendación más conveniente disponible en ese momento.

Las recomendaciones deberán construirse considerando múltiples variables simultáneamente.

Ningún criterio individual será suficiente por sí solo para determinar una respuesta.

El motor deberá evolucionar continuamente junto con el producto, incorporando nuevas fuentes de información y mejorando progresivamente la calidad de sus recomendaciones sin modificar la filosofía definida en este documento.

---

## Principios derivados

Como consecuencia de esta decisión:

- Las recomendaciones tendrán prioridad sobre los listados.
- El contexto será un componente esencial del proceso de recomendación.
- El motor podrá incorporar nuevas variables sin alterar la experiencia del usuario.
- La calidad de una recomendación tendrá prioridad sobre la cantidad de información presentada.
- Toda recomendación deberá poder explicarse mediante criterios comprensibles para el usuario.

El objetivo del motor no consiste en encontrar promociones.

Consiste en ayudar a tomar la mejor decisión posible.

---

## Consecuencias para el producto

El motor de recomendaciones deja de ser una funcionalidad más.

Pasa a convertirse en el componente central sobre el cual se construye toda la experiencia de PromoAR.

Como consecuencia de este ADR:

- Toda nueva funcionalidad deberá evaluarse por el valor que aporta al motor de recomendaciones.
- La información recopilada por el producto deberá contribuir a mejorar la calidad de las decisiones sugeridas.
- La evolución del producto estará orientada a enriquecer el contexto disponible para recomendar con mayor precisión.
- La interfaz deberá presentar las recomendaciones de forma clara, comprensible y verificable.

El usuario no debería percibir la complejidad del motor.

Debería percibir únicamente que las recomendaciones resultan útiles.

---

## Consecuencias para el desarrollo

Este ADR establece criterios permanentes para la evolución del motor de recomendaciones.

En consecuencia:

- La arquitectura deberá permitir incorporar nuevas variables de decisión sin rediseñar el sistema.
- Los algoritmos podrán evolucionar sin modificar la filosofía del producto.
- La incorporación de inteligencia artificial constituirá una mejora del motor y no un reemplazo de sus principios.
- La lógica de recomendación deberá permanecer desacoplada de interfaces, proveedores y tecnologías específicas.

Esto garantiza que PromoAR pueda evolucionar tecnológicamente sin alterar la experiencia que promete a sus usuarios.

---

## Riesgos asumidos

Adoptar un motor de recomendaciones como núcleo del producto implica aceptar determinados riesgos.

Entre ellos:

- Incrementar la complejidad del análisis interno.
- Necesitar información de mayor calidad para producir recomendaciones confiables.
- Generar expectativas crecientes por parte de los usuarios.
- Requerir mejoras continuas a medida que aumenta el conocimiento del producto.

Estos riesgos fueron considerados aceptables porque representan una consecuencia natural de construir un producto cuya propuesta de valor se basa en ayudar a decidir.

---

## Alternativas descartadas

### Alternativa A — Ranking simple

Se evaluó ordenar promociones utilizando reglas fijas, como porcentaje de descuento, monto de reintegro o popularidad.

Esta alternativa resulta sencilla de implementar.

Sin embargo, ignora el contexto del usuario y suele producir recomendaciones poco relevantes.

---

### Alternativa B — Personalización exclusivamente manual

También se evaluó permitir que el usuario configure completamente sus preferencias para obtener recomendaciones.

Este enfoque ofrece mayor control.

Pero traslada nuevamente al usuario una parte importante del trabajo que PromoAR busca eliminar.

---

### Alternativa C — Motor contextual

Se decidió construir un motor capaz de combinar múltiples variables de forma dinámica.

El objetivo no consiste en aplicar una regla universal.

Consiste en encontrar la mejor respuesta posible para cada contexto.

La inteligencia del producto radica precisamente en esa capacidad de adaptación.

---

## Decisiones derivadas

Como consecuencia de este ADR, se establecen las siguientes decisiones permanentes:

- Las recomendaciones deberán construirse utilizando múltiples variables y no un único criterio de ordenamiento.
- El contexto del usuario constituirá un componente esencial del proceso de recomendación.
- Toda mejora tecnológica deberá orientarse a incrementar la calidad de las recomendaciones y no simplemente la complejidad del algoritmo.
- El motor deberá evolucionar continuamente mediante evidencia, aprendizaje y nuevos datos.
- El usuario conservará siempre la decisión final y la posibilidad de comprender por qué recibió una determinada recomendación.

---

## Relación con otros documentos

Este ADR implementa decisiones definidas en la documentación fundacional de PromoAR.

Se encuentra directamente relacionado con:

- `docs/vision/product-vision.md`, donde se establece que PromoAR existe para ayudar a las personas a tomar mejores decisiones de consumo.
- `docs/vision/PRODUCT_PRINCIPLES.md`, especialmente con los principios **"La decisión es el producto"**, **"Recomendar antes que listar"**, **"El contexto cambia la respuesta correcta"** y **"El usuario conserva el control"**.
- `docs/adr/ADR-001_PRODUCT_FIRST.md`, que define la decisión como el verdadero producto.
- `docs/adr/ADR-002_ASSISTANT_AND_EXPLORATION.md`, donde se establece que el Modo Asistente materializa las recomendaciones generadas por el motor.
- `docs/adr/ADR-005-Search_Strategy.md`, que define la búsqueda como una puerta de entrada al proceso de recomendación y no como un mecanismo aislado de recuperación de información.

---

## Vigencia

Este ADR permanecerá vigente mientras PromoAR utilice un motor de recomendaciones como núcleo de su propuesta de valor.

La incorporación de nuevas tecnologías, algoritmos o modelos de inteligencia artificial no requerirá modificar este documento siempre que se mantengan los principios aquí definidos.

Únicamente un cambio en la filosofía de recomendación justificará un nuevo ADR que sustituya esta decisión.

---

## Cierre

Las promociones existen.

Los datos también.

Lo difícil nunca fue acceder a esa información.

Lo verdaderamente complejo es transformarla en una decisión útil para una persona concreta, en un contexto concreto y en un momento concreto.

Ese es el propósito del motor de recomendaciones de PromoAR.

No reemplaza el criterio del usuario.

Lo potencia.

No busca decidir por las personas.

Busca reducir el esfuerzo necesario para que puedan decidir mejor.

Mientras ese principio permanezca inalterable, el motor podrá evolucionar, incorporar nuevas capacidades y adaptarse a tecnologías futuras sin perder aquello que define la identidad del producto.
