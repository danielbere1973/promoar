---
title: ADR-008 — Notification Strategy
status: Accepted
date: 2026-07-15
owner: Dani
authors:
  - Dani (Founder)
  - ChatGPT (Chief Product Officer)
reviewers:
  - Claude
---

# ADR-008 — Notification Strategy

## Estado

Accepted

---

## Contexto

PromoAR acompaña a las personas durante el proceso de toma de decisiones de consumo.

En ese contexto, las notificaciones representan una herramienta capaz de aportar información útil incluso cuando el usuario no se encuentra utilizando activamente la aplicación.

Sin embargo, también constituyen uno de los mecanismos más invasivos dentro de la experiencia digital.

Una notificación innecesaria interrumpe.

Una notificación irrelevante genera desconfianza.

Una notificación repetitiva termina siendo ignorada.

Era necesario establecer una política permanente sobre el propósito de las notificaciones dentro de PromoAR.

---

## Problema

Existen dos enfoques posibles.

### Modelo A

Las notificaciones funcionan como un canal de comunicación del producto.

Se utilizan para incrementar la actividad de los usuarios.

Promocionar funcionalidades.

Difundir campañas.

Aumentar métricas de apertura.

La prioridad consiste en lograr que el usuario regrese a la aplicación.

---

### Modelo B

Las notificaciones funcionan como una extensión del motor de recomendaciones.

Se envían únicamente cuando aportan valor concreto para el usuario.

La prioridad consiste en ayudar a tomar una mejor decisión en el momento oportuno.

El objetivo no es atraer atención.

Es entregar utilidad.

---

Ambos modelos pueden incrementar el uso de la aplicación.

Pero únicamente uno resulta coherente con la filosofía definida para PromoAR.

---

## Decisión

PromoAR adopta el Modelo B.

Las notificaciones constituyen un servicio para el usuario.

No una herramienta de promoción del producto.

Cada notificación deberá justificar su existencia por el valor que aporta a quien la recibe.

La oportunidad será tan importante como el contenido.

Una recomendación correcta enviada en el momento equivocado deja de ser útil.

El sistema deberá privilegiar la relevancia antes que la frecuencia.

La ausencia de una notificación siempre será preferible al envío de una notificación innecesaria.

---

## Principios derivados

Como consecuencia de esta decisión:

- Las notificaciones existirán para ayudar al usuario, no para aumentar métricas de interacción.
- La relevancia tendrá prioridad sobre la cantidad.
- El contexto determinará cuándo una notificación resulta útil.
- El usuario conservará siempre el control sobre las comunicaciones que desea recibir.
- El silencio será considerado una decisión válida cuando no exista información de valor para comunicar.

El propósito de una notificación no consiste en interrumpir.

Consiste en ser útil.

---

## Consecuencias para el producto

Las notificaciones pasan a formar parte de la experiencia de recomendación.

No constituyen un canal independiente.

Como consecuencia de este ADR:

- Toda notificación deberá responder a una necesidad concreta del usuario.
- La frecuencia nunca tendrá prioridad sobre la utilidad.
- El contexto determinará tanto el contenido como el momento del envío.
- Las recomendaciones podrán llegar mediante notificaciones únicamente cuando ello represente un beneficio evidente.

El usuario no debería sentir que PromoAR intenta llamar su atención.

Debería sentir que aparece únicamente cuando realmente puede ayudar.

---

## Consecuencias para el desarrollo

Este ADR establece criterios permanentes para la evolución del sistema de notificaciones.

En consecuencia:

- La arquitectura deberá permitir generar notificaciones basadas en eventos y contexto, no únicamente en reglas temporales.
- Los mecanismos de envío deberán permanecer desacoplados de proveedores específicos.
- Cada nueva categoría de notificación deberá justificar el valor que aporta al usuario.
- El sistema deberá incorporar mecanismos que eviten comunicaciones repetitivas o innecesarias.

La infraestructura podrá evolucionar.

La filosofía de comunicación deberá permanecer constante.

---

## Riesgos asumidos

Adoptar una estrategia centrada en la utilidad implica aceptar determinados desafíos.

Entre ellos:

- Enviar menos notificaciones que otros productos similares.
- Renunciar a métricas tradicionales de engagement como objetivo principal.
- Requerir mayor contexto para determinar cuándo una comunicación resulta verdaderamente útil.
- Aceptar que, en muchas ocasiones, la mejor decisión será no enviar ninguna notificación.

Estos riesgos fueron considerados aceptables porque preservan la confianza del usuario, uno de los activos más importantes de PromoAR.

---

## Alternativas descartadas

### Alternativa A — Comunicación masiva

Se evaluó utilizar las notificaciones para difundir campañas, promociones generales y novedades del producto.

Esta alternativa incrementa la visibilidad de la aplicación.

Sin embargo, reduce progresivamente la confianza del usuario cuando las comunicaciones dejan de aportar valor personal.

---

### Alternativa B — Configuración completamente manual

También se evaluó delegar toda la gestión de notificaciones al usuario mediante una gran cantidad de configuraciones.

Este enfoque ofrece máximo control.

Pero incrementa la complejidad y obliga al usuario a anticipar situaciones que el propio producto debería comprender.

---

### Alternativa C — Notificaciones contextuales

Se decidió construir un sistema de notificaciones basado en contexto, relevancia y oportunidad.

PromoAR comunicará únicamente aquello que represente una mejora concreta para la toma de decisiones.

La inteligencia del sistema no estará en enviar más mensajes.

Estará en saber cuándo el silencio resulta la mejor experiencia.

---

## Decisiones derivadas

Como consecuencia de este ADR, se establecen las siguientes decisiones permanentes:

- Ninguna notificación será enviada únicamente para incrementar métricas de uso.
- Toda comunicación deberá aportar un beneficio concreto para el usuario.
- El contexto tendrá prioridad sobre la frecuencia de envío.
- El usuario podrá configurar, limitar o desactivar las distintas categorías de notificaciones.
- El sistema deberá minimizar interrupciones innecesarias y privilegiar comunicaciones oportunas.

---

## Relación con otros documentos

Este ADR implementa decisiones definidas en la documentación fundacional de PromoAR.

Se encuentra directamente relacionado con:

- `docs/vision/product-vision.md`, donde se establece que PromoAR existe para ayudar a las personas a tomar mejores decisiones de consumo.
- `docs/vision/PRODUCT_PRINCIPLES.md`, especialmente con los principios **"La simplicidad siempre gana"**, **"El contexto cambia la respuesta correcta"**, **"Cada dato debe trabajar para el usuario"** y **"El usuario conserva el control"**.
- `docs/adr/ADR-001_PRODUCT_FIRST.md`, al considerar que toda interacción con el usuario debe contribuir a mejorar una decisión.
- `docs/adr/ADR-006-Recommendation_Engine.md`, dado que las notificaciones representan una extensión del motor de recomendaciones fuera de la aplicación.
- `docs/adr/ADR-007-User_Profile.md`, ya que el contexto personal del usuario constituye uno de los principales insumos para determinar qué comunicar y cuándo hacerlo.

---

## Vigencia

Este ADR permanecerá vigente mientras PromoAR utilice notificaciones como mecanismo para asistir al usuario durante sus decisiones de consumo.

La incorporación de nuevos canales de comunicación o tecnologías de mensajería no requerirá modificar este documento siempre que se mantengan los principios aquí establecidos.

Únicamente un cambio en la filosofía de comunicación justificará un nuevo ADR que sustituya esta decisión.

---

## Cierre

Una notificación representa una interrupción.

Y toda interrupción debe estar justificada.

PromoAR no buscará estar presente en la pantalla del usuario la mayor cantidad de veces posible.

Buscará estar presente únicamente cuando pueda aportar valor.

El éxito del sistema de notificaciones no se medirá por la cantidad de mensajes enviados.

Se medirá por la cantidad de veces que el usuario piense:

**"Qué bueno que me avisó justo ahora."**

Mientras las notificaciones respeten el tiempo, el contexto y la confianza de las personas, seguirán siendo una herramienta para ayudar a decidir y no un mecanismo para captar atención.
