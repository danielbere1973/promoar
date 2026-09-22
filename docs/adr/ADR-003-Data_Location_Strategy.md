---
title: ADR-003 — Data Location Strategy
status: Accepted
date: 2026-07-15
owner: Dani
authors:
  - Dani (Founder)
  - ChatGPT (Chief Product Officer)
reviewers:
  - Claude
---

# ADR-003 — Data Location Strategy

## Estado

Accepted

---

## Contexto

PromoAR ayuda a las personas a decidir dónde les conviene realizar una compra.

Para que esa recomendación tenga valor, el producto necesita conocer no sólo qué promociones existen, sino también dónde pueden utilizarse.

La ubicación deja de ser un dato accesorio.

Pasa a formar parte de la información necesaria para construir una recomendación útil.

Sin una estrategia consistente de datos de ubicación, dos problemas aparecen inmediatamente.

Por un lado, un comercio puede quedar fuera de las recomendaciones simplemente porque no existe dentro de la base de datos.

Por otro, la cobertura geográfica puede variar según la fuente utilizada, generando desigualdades entre comercios con diferente presencia digital.

El problema no consiste únicamente en localizar comercios.

Consiste en garantizar que todos tengan la posibilidad de ser considerados cuando realmente ofrecen una alternativa conveniente para el usuario.

Era necesario establecer una política permanente sobre cómo debe construirse la estrategia de datos de ubicación.

---

## Problema

Existen dos enfoques posibles.

### Modelo A

Construir toda la estrategia de ubicación alrededor de un único proveedor.

La implementación resulta más simple.

Pero el producto queda condicionado por la cobertura, disponibilidad, costos y evolución de esa plataforma.

Un cambio externo puede afectar directamente la capacidad de recomendar comercios.

---

### Modelo B

Diseñar una estrategia independiente del proveedor.

La información de ubicación se considera un recurso propio del producto.

Las distintas fuentes geográficas pueden combinarse, reemplazarse o evolucionar sin modificar la experiencia del usuario.

La arquitectura permanece estable aunque cambien las herramientas utilizadas para obtener los datos.

---

Ambos modelos son técnicamente posibles.

Era necesario elegir cuál representaría la filosofía permanente de PromoAR.

---

## Decisión

PromoAR adopta el Modelo B.

La estrategia de datos de ubicación será independiente de cualquier proveedor específico.

Las fuentes geográficas deberán seleccionarse en función de su calidad, cobertura, actualización y confiabilidad.

Ninguna tecnología individual constituirá un componente irremplazable del producto.

La arquitectura deberá permitir incorporar nuevas fuentes, reemplazar las existentes o utilizar varias simultáneamente cuando ello mejore la cobertura y la calidad de la información.

El usuario nunca debería percibir estas decisiones técnicas.

Lo que debe percibir es que las recomendaciones representan adecuadamente la realidad del entorno donde desea comprar.

---

## Principios derivados

Como consecuencia de esta decisión:

- Los datos de ubicación constituyen un activo estratégico de PromoAR.
- La cobertura geográfica tendrá prioridad sobre la dependencia tecnológica.
- La arquitectura deberá facilitar la incorporación de múltiples fuentes de datos.
- Ningún proveedor será considerado parte permanente del diseño del producto.
- La estrategia de ubicación deberá evolucionar sin modificar la experiencia del usuario.

La tecnología podrá cambiar.

La capacidad de representar correctamente el mundo real deberá mantenerse.

---

## Consecuencias para el producto

La estrategia de datos de ubicación pasa a formar parte de la arquitectura permanente de PromoAR.

Como consecuencia de este ADR:

- La ubicación de un comercio será considerada un dato estratégico para el motor de recomendaciones.
- La incorporación de nuevas fuentes geográficas deberá realizarse sin alterar la experiencia del usuario.
- La calidad de las recomendaciones dependerá, en parte, de la calidad y cobertura de los datos de ubicación.
- La arquitectura deberá facilitar la normalización y unificación de información proveniente de múltiples orígenes.

El objetivo no consiste únicamente en conocer dónde está un comercio.

Consiste en representar correctamente el entorno donde el usuario toma sus decisiones de compra.

---

## Consecuencias para el desarrollo

Este ADR condiciona distintas decisiones técnicas futuras.

En consecuencia:

- La capa de datos geográficos deberá mantenerse desacoplada de los proveedores específicos.
- Las integraciones deberán poder reemplazarse sin modificar la lógica de negocio.
- Los modelos internos de ubicación deberán ser estables, independientemente de la fuente de origen.
- La incorporación de nuevas bases geográficas deberá representar una evolución de datos y no una reescritura del producto.

Esto permite que PromoAR evolucione junto con el ecosistema tecnológico sin quedar condicionado por una plataforma determinada.

---

## Riesgos asumidos

Adoptar una estrategia independiente del proveedor implica aceptar ciertos desafíos.

Entre ellos:

- Mayor complejidad de integración.
- Necesidad de normalizar información proveniente de distintas fuentes.
- Posibles diferencias de calidad entre proveedores.
- Mayor esfuerzo para mantener consistencia geográfica.

Estos riesgos fueron considerados aceptables porque permiten construir un producto más resiliente, flexible y preparado para evolucionar.

---

## Alternativas descartadas

### Alternativa A — Dependencia total de un proveedor

Se evaluó utilizar una única plataforma geográfica como fuente exclusiva de información.

Esta alternativa simplifica la implementación inicial.

Sin embargo, incrementa la dependencia tecnológica y limita la capacidad de adaptación del producto frente a cambios externos.

---

### Alternativa B — Base de datos propia exclusivamente

También se evaluó construir una base geográfica completamente mantenida por PromoAR.

Esta alternativa ofrece máximo control sobre la información.

Sin embargo, requiere un esfuerzo operativo muy elevado y dificulta mantener una cobertura amplia y permanentemente actualizada.

---

### Alternativa C — Estrategia híbrida

Se decidió adoptar un enfoque híbrido.

PromoAR podrá integrar distintas fuentes geográficas y complementar esa información con datos propios cuando resulte necesario.

De esta manera se combina cobertura, flexibilidad y capacidad de evolución sin depender completamente de una única estrategia.

---

## Decisiones derivadas

Como consecuencia de este ADR, se establecen las siguientes decisiones permanentes:

- Ningún proveedor geográfico será considerado obligatorio para el funcionamiento de PromoAR.
- La arquitectura deberá facilitar la incorporación, reemplazo o combinación de fuentes de ubicación.
- La cobertura geográfica tendrá prioridad sobre la dependencia tecnológica.
- Los modelos internos de datos deberán permanecer estables aun cuando cambien las fuentes externas.
- Toda incorporación de nuevos datos geográficos deberá justificarse por el valor que aporta a la calidad de las recomendaciones.

---

## Relación con otros documentos

Este ADR implementa decisiones definidas en la documentación fundacional de PromoAR.

Se encuentra directamente relacionado con:

- `docs/vision/product-vision.md`, especialmente con la sección **"La cobertura geográfica como herramienta de equidad"**.
- `docs/vision/PRODUCT_PRINCIPLES.md`, en particular con los principios **"Todos los comercios merecen competir"** y **"Cada dato debe trabajar para el usuario"**.
- `docs/adr/ADR-001_PRODUCT_FIRST.md`, dado que la calidad de una recomendación depende de disponer de información geográfica representativa.
- `docs/roadmap/ROADMAP.md`, donde la evolución del producto incorpora progresivamente mayor contexto para personalizar y optimizar las recomendaciones.

---

## Vigencia

Este ADR permanecerá vigente mientras PromoAR utilice información geográfica para construir recomendaciones de valor para el usuario.

La incorporación de nuevos proveedores, tecnologías o modelos de datos no requerirá modificar este documento siempre que se mantengan los principios aquí establecidos.

Únicamente un cambio en la estrategia de independencia respecto de los proveedores justificará un nuevo ADR que sustituya esta decisión.

---

## Cierre

La ubicación no constituye únicamente una coordenada.

Representa contexto.

Y el contexto constituye uno de los insumos fundamentales para ayudar a una persona a tomar una mejor decisión.

PromoAR no construye una estrategia alrededor de un proveedor de mapas.

Construye una estrategia alrededor de datos confiables, representativos y capaces de describir el entorno donde ocurre una compra.

Las tecnologías evolucionarán.

Los proveedores cambiarán.

La cobertura mejorará.

Pero el compromiso del producto permanecerá inalterable:

Representar el mundo real con la mayor fidelidad posible para que cada recomendación tenga sentido allí donde el usuario realmente la necesita.
