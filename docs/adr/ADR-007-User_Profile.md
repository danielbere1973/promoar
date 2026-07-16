---
title: ADR-007 — User Profile
status: Accepted
date: 2026-07-15
owner: Dani
authors:
  - Dani (Founder)
  - ChatGPT (Chief Product Officer)
reviewers:
  - Claude
---

# ADR-007 — User Profile

## Estado

Accepted

---

## Contexto

PromoAR tiene como propósito ayudar a las personas a tomar mejores decisiones antes de realizar una compra.

Sin embargo, una misma promoción puede representar una excelente alternativa para un usuario y carecer completamente de valor para otro.

La diferencia no depende únicamente de la promoción.

Depende del contexto de quien la recibe.

Los medios de pago disponibles.

Los bancos con los que opera.

Las billeteras que utiliza.

Su ubicación.

Sus comercios habituales.

Sus preferencias.

Sus restricciones.

Sus hábitos de consumo.

Toda esa información modifica la calidad de una recomendación.

Era necesario definir cuál será el papel del perfil del usuario dentro del producto.

---

## Problema

Existen dos enfoques posibles.

### Modelo A

El producto trata a todos los usuarios exactamente de la misma manera.

Las recomendaciones se construyen utilizando únicamente información general.

Cada usuario recibe esencialmente las mismas respuestas.

La personalización queda completamente en manos del usuario mediante filtros o configuraciones manuales.

---

### Modelo B

El producto construye progresivamente un conocimiento del usuario.

Ese conocimiento permite reducir el esfuerzo necesario para decidir.

Las recomendaciones evolucionan junto con el perfil, adaptándose al contexto, preferencias y comportamiento observado.

El usuario mantiene siempre el control sobre su información.

Pero el producto aprende lo suficiente para ofrecer respuestas cada vez más relevantes.

---

Ambos enfoques permiten utilizar PromoAR.

Sin embargo, únicamente uno de ellos permite convertir el conocimiento acumulado en una mejora permanente de la experiencia.

---

## Decisión

PromoAR adopta el Modelo B.

El perfil del usuario constituye un componente estratégico del producto.

Su finalidad no consiste en almacenar información personal.

Su finalidad consiste en comprender el contexto necesario para mejorar las recomendaciones.

Toda información incorporada al perfil deberá aportar un beneficio directo para el usuario.

El producto no solicitará datos simplemente porque puedan resultar interesantes.

Cada dato deberá justificar su existencia por el valor que agrega al proceso de decisión.

El perfil deberá evolucionar continuamente junto con el usuario, reflejando sus cambios de hábitos, preferencias y necesidades sin perder simplicidad ni transparencia.

---

## Principios derivados

Como consecuencia de esta decisión:

- El perfil existirá para mejorar recomendaciones, no para acumular información.
- Cada dato solicitado deberá aportar un beneficio concreto al usuario.
- El perfil evolucionará progresivamente junto con el uso del producto.
- La personalización deberá reducir esfuerzo y no incrementar complejidad.
- El usuario conservará siempre el control sobre la información utilizada para construir su perfil.

El objetivo no consiste en conocer más al usuario.

Consiste en ayudarlo mejor.

---

## Consecuencias para el producto

El perfil del usuario pasa a formar parte del núcleo de la experiencia de PromoAR.

Como consecuencia de este ADR:

- Las recomendaciones deberán adaptarse progresivamente al contexto personal del usuario.
- El producto solicitará únicamente la información necesaria para aportar valor.
- La personalización deberá producir una mejora perceptible en la calidad de las recomendaciones.
- La experiencia deberá evolucionar a medida que el perfil se vuelva más completo.

El usuario no debería sentir que completa formularios.

Debería percibir que PromoAR lo comprende cada vez mejor.

---

## Consecuencias para el desarrollo

Este ADR establece criterios permanentes para la evolución del perfil del usuario.

En consecuencia:

- El modelo de perfil deberá ser extensible, permitiendo incorporar nuevos atributos sin modificar la arquitectura general.
- Los datos del perfil deberán mantenerse desacoplados de implementaciones específicas o proveedores externos.
- Las nuevas funcionalidades deberán reutilizar la información existente antes de solicitar nuevos datos.
- El perfil deberá evolucionar mediante una combinación de información proporcionada explícitamente por el usuario y aprendizaje derivado del uso del producto.

La arquitectura deberá facilitar la evolución del perfil sin incrementar innecesariamente la complejidad para el usuario.

---

## Riesgos asumidos

Adoptar un perfil progresivo implica aceptar determinados desafíos.

Entre ellos:

- Solicitar información que algunos usuarios prefieran no compartir.
- Requerir mecanismos claros para actualizar preferencias y hábitos.
- Gestionar cambios en el comportamiento del usuario a lo largo del tiempo.
- Equilibrar personalización con simplicidad.

Estos riesgos fueron considerados aceptables porque una personalización responsable mejora significativamente la calidad de las recomendaciones.

---

## Alternativas descartadas

### Alternativa A — Sin perfil

Se evaluó construir un producto completamente anónimo y sin memoria del usuario.

Esta alternativa simplifica el desarrollo y reduce la cantidad de información utilizada.

Sin embargo, obliga a repetir decisiones y configuraciones en cada uso, limitando la capacidad del producto para mejorar con el tiempo.

---

### Alternativa B — Perfil completamente manual

También se evaluó delegar toda la construcción del perfil al usuario mediante formularios y configuraciones.

Este enfoque ofrece mayor control.

Pero incrementa el esfuerzo inicial y dificulta la adopción del producto.

---

### Alternativa C — Perfil progresivo

Se decidió construir un perfil que evolucione gradualmente.

El usuario podrá completar información cuando lo considere conveniente.

Al mismo tiempo, PromoAR aprenderá de los hábitos y preferencias observados para reducir el esfuerzo futuro.

La información explícita y el aprendizaje del comportamiento se complementarán para construir una experiencia cada vez más relevante.

---

## Decisiones derivadas

Como consecuencia de este ADR, se establecen las siguientes decisiones permanentes:

- Todo dato almacenado deberá aportar un beneficio concreto para el usuario.
- La personalización deberá reducir esfuerzo y nunca aumentar la complejidad.
- El perfil deberá poder evolucionar sin requerir reconstrucciones completas.
- El usuario podrá revisar, modificar o eliminar la información utilizada para personalizar su experiencia.
- La ausencia de determinados datos nunca impedirá utilizar PromoAR; únicamente limitará el nivel de personalización disponible.

---

## Relación con otros documentos

Este ADR implementa decisiones definidas en la documentación fundacional de PromoAR.

Se encuentra directamente relacionado con:

- `docs/vision/product-vision.md`, donde se establece que el propósito del producto es ayudar a cada persona a tomar mejores decisiones de consumo.
- `docs/vision/PRODUCT_PRINCIPLES.md`, especialmente con los principios **"El contexto cambia la respuesta correcta"**, **"Cada dato debe trabajar para el usuario"** y **"El usuario conserva el control"**.
- `docs/product/USER_PERSONAS.md`, que describe los distintos comportamientos que el perfil deberá ayudar a comprender.
- `docs/adr/ADR-001_PRODUCT_FIRST.md`, al considerar el contexto personal como un elemento esencial para mejorar las decisiones.
- `docs/adr/ADR-006-Recommendation_Engine.md`, donde el perfil constituye una de las principales fuentes de contexto para el motor de recomendaciones.

---

## Vigencia

Este ADR permanecerá vigente mientras PromoAR utilice información del usuario para mejorar la calidad de sus recomendaciones.

La incorporación de nuevos atributos, modelos de aprendizaje o tecnologías de personalización no requerirá modificar este documento siempre que se respeten los principios aquí definidos.

Únicamente un cambio en la filosofía de personalización justificará un nuevo ADR que sustituya esta decisión.

---

## Cierre

Un perfil no representa una colección de datos.

Representa el conocimiento que el producto construye para comprender mejor a quien lo utiliza.

Cada información incorporada debería responder una única pregunta:

**¿Ayuda realmente a tomar una mejor decisión?**

Si la respuesta es negativa, ese dato no pertenece al perfil.

Si la respuesta es afirmativa, el producto tiene la responsabilidad de utilizarlo únicamente para generar recomendaciones más útiles, más relevantes y más simples.

El verdadero valor del perfil no reside en conocer al usuario.

Reside en permitir que PromoAR necesite preguntarle cada vez menos para poder ayudarlo cada vez más.
