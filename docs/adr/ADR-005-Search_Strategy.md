---
title: ADR-005 — Search Strategy
status: Accepted
date: 2026-07-15
owner: Dani
authors:
  - Dani (Founder)
  - ChatGPT (Chief Product Officer)
reviewers:
  - Claude
---

# ADR-005 — Search Strategy

## Estado

Accepted

---

## Contexto

PromoAR administra un volumen creciente de información.

Promociones.

Comercios.

Sucursales.

Medios de pago.

Categorías.

Ubicaciones.

Condiciones.

Restricciones.

A medida que el producto evolucione, la cantidad de información disponible continuará aumentando.

Sin una estrategia clara de búsqueda, el usuario deberá invertir cada vez más tiempo para encontrar aquello que realmente necesita.

Sin embargo, el propósito de PromoAR nunca fue facilitar la búsqueda de información.

Su propósito consiste en facilitar la toma de decisiones.

Buscar representa un medio.

No un fin.

Era necesario establecer una estrategia permanente sobre el rol que la búsqueda ocupa dentro del producto.

---

## Problema

Existen dos enfoques posibles.

### Modelo A

La búsqueda funciona como una herramienta para localizar información.

El usuario formula una consulta.

El sistema devuelve coincidencias.

La responsabilidad de interpretar esos resultados permanece completamente en manos del usuario.

---

### Modelo B

La búsqueda constituye el primer paso hacia una decisión.

El sistema interpreta la intención del usuario.

Comprende el contexto.

Prioriza la información relevante.

Reduce el esfuerzo necesario para llegar a una recomendación útil.

---

Ambos modelos permiten acceder a la información.

Pero representan experiencias profundamente diferentes.

---

## Decisión

PromoAR adopta el Modelo B.

La búsqueda no tendrá como objetivo principal devolver resultados.

Su objetivo será comprender la intención del usuario y facilitar la mejor decisión posible.

Siempre que el contexto resulte suficiente, el producto priorizará ofrecer respuestas relevantes por encima de listados extensos.

Cuando existan múltiples alternativas razonables, el usuario conservará la posibilidad de explorarlas.

La búsqueda deja de entenderse como un mecanismo de recuperación de datos.

Pasa a formar parte del proceso de recomendación.

---

## Principios derivados

Como consecuencia de esta decisión:

- Buscar deberá requerir el menor esfuerzo posible.
- La intención del usuario tendrá prioridad sobre la coincidencia literal de palabras.
- El contexto deberá incorporarse siempre que aporte valor a la respuesta.
- Las recomendaciones podrán convivir con los resultados de búsqueda cuando ello mejore la experiencia.
- El usuario conservará la posibilidad de explorar libremente cuando lo considere necesario.

El objetivo no consiste en mostrar más resultados.

Consiste en mostrar los resultados que realmente ayudan a decidir.

---

## Consecuencias para el producto

La búsqueda deja de ser una funcionalidad aislada.

Pasa a convertirse en uno de los mecanismos mediante los cuales PromoAR ayuda al usuario a tomar una decisión.

Como consecuencia de este ADR:

- El buscador deberá comprender la intención del usuario antes que limitarse a interpretar palabras clave.
- Los resultados podrán incorporar contexto para mejorar su relevancia.
- La experiencia de búsqueda deberá mantenerse simple, aun cuando el volumen de información continúe creciendo.
- Las recomendaciones podrán aparecer integradas dentro del proceso de búsqueda cuando ello reduzca el esfuerzo del usuario.

El éxito de una búsqueda no se medirá por la cantidad de resultados obtenidos.

Se medirá por la capacidad del usuario para llegar rápidamente a una buena decisión.

---

## Consecuencias para el desarrollo

Este ADR establece criterios permanentes para la evolución del motor de búsqueda.

En consecuencia:

- La arquitectura deberá permitir incorporar nuevos mecanismos de interpretación sin modificar la experiencia del usuario.
- La lógica de búsqueda deberá permanecer desacoplada de tecnologías específicas.
- Los algoritmos podrán evolucionar siempre que respeten los principios definidos en este documento.
- La incorporación de inteligencia artificial, procesamiento de lenguaje natural o nuevos modelos de búsqueda constituirá una evolución tecnológica y no un cambio de filosofía.

La implementación podrá cambiar.

La experiencia buscada por el producto deberá permanecer constante.

---

## Riesgos asumidos

Adoptar una estrategia centrada en la intención implica aceptar determinados riesgos.

Entre ellos:

- Incrementar la complejidad del motor de búsqueda.
- Requerir mayor contexto para interpretar correctamente algunas consultas.
- Generar respuestas diferentes para consultas aparentemente similares.
- Necesitar una mejora continua basada en el comportamiento real de los usuarios.

Estos riesgos fueron considerados aceptables porque permiten construir una experiencia significativamente más útil que una búsqueda basada únicamente en coincidencias textuales.

---

## Alternativas descartadas

### Alternativa A — Búsqueda tradicional

Se evaluó implementar un buscador convencional basado exclusivamente en coincidencias entre la consulta y los datos disponibles.

Esta alternativa resulta simple y predecible.

Sin embargo, obliga al usuario a conocer previamente qué debe buscar y cómo formular correctamente la consulta.

No responde adecuadamente al propósito de PromoAR.

---

### Alternativa B — Navegación mediante filtros

También se evaluó resolver la exploración principalmente mediante filtros, categorías y navegación manual.

Este enfoque funciona correctamente cuando el usuario sabe exactamente qué desea encontrar.

Sin embargo, incrementa el esfuerzo necesario para descubrir la mejor alternativa y traslada al usuario una parte importante del análisis.

---

### Alternativa C — Estrategia híbrida

Se decidió combinar búsqueda, recomendación y exploración.

El usuario podrá formular consultas, navegar libremente o recibir recomendaciones asistidas.

Las tres experiencias compartirán la misma información y el mismo objetivo.

Cambiará únicamente la forma en que el producto acompaña la decisión.

---

## Decisiones derivadas

Como consecuencia de este ADR, se establecen las siguientes decisiones permanentes:

- La búsqueda deberá evolucionar junto con el conocimiento que PromoAR adquiera sobre el usuario y su contexto.
- La intención tendrá prioridad sobre la coincidencia literal de palabras cuando ello mejore la experiencia.
- Los resultados deberán priorizar utilidad antes que cantidad.
- La búsqueda deberá integrarse naturalmente con el sistema de recomendaciones.
- El usuario conservará siempre la posibilidad de explorar y verificar la información obtenida.

---

## Relación con otros documentos

Este ADR implementa decisiones definidas en la documentación fundacional de PromoAR.

Se encuentra directamente relacionado con:

- `docs/vision/product-vision.md`, donde se establece que PromoAR ayuda a tomar decisiones y no simplemente a consultar promociones.
- `docs/vision/PRODUCT_PRINCIPLES.md`, especialmente con los principios **"Recomendar antes que listar"**, **"La simplicidad siempre gana"**, **"El contexto cambia la respuesta correcta"** y **"El usuario conserva el control"**.
- `docs/adr/ADR-001_PRODUCT_FIRST.md`, que define la decisión como el verdadero producto.
- `docs/adr/ADR-002_ASSISTANT_AND_EXPLORATION.md`, donde se establece la convivencia entre el Modo Asistente y el Modo Exploración como formas complementarias de interacción.

---

## Vigencia

Este ADR permanecerá vigente mientras PromoAR utilice la búsqueda como mecanismo para facilitar decisiones de consumo.

La incorporación de nuevas tecnologías de búsqueda no requerirá modificar este documento siempre que se mantengan los principios aquí establecidos.

Únicamente un cambio en la filosofía de interacción justificará un nuevo ADR que sustituya esta decisión.

---

## Cierre

Las personas no abren PromoAR porque quieran buscar.

Lo abren porque necesitan decidir.

La búsqueda representa únicamente uno de los caminos posibles para llegar a esa decisión.

Cada consulta expresa una intención.

Cada intención refleja una necesidad.

Y cada necesidad constituye una oportunidad para que el producto reduzca esfuerzo, simplifique el análisis y entregue una respuesta verdaderamente útil.

Por ese motivo, la estrategia de búsqueda de PromoAR no se mide por la precisión de un algoritmo.

Se mide por la calidad de las decisiones que ayuda a tomar.
