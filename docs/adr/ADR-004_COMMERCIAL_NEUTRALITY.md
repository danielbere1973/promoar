---
title: ADR-004 — Neutralidad Comercial
status: Accepted
date: 2026-07-15
owner: Dani
authors:
  - Dani (Founder)
  - ChatGPT (Chief Product Officer)
reviewers:
  - Claude
---

# ADR-004 — Neutralidad Comercial

## Estado

Accepted

---

## Contexto

PromoAR nació con un objetivo muy claro:

Ayudar a las personas a tomar mejores decisiones antes de gastar su dinero.

Desde su concepción, el producto fue diseñado para representar los intereses del usuario y no los intereses de bancos, comercios o cualquier otra entidad participante del ecosistema.

A medida que PromoAR crezca, será natural que aparezcan oportunidades de monetización.

Algunas organizaciones podrán querer destacar promociones.

Otras podrán solicitar mayor visibilidad dentro de la plataforma.

También podrán existir acuerdos comerciales, programas de afiliación o modelos publicitarios.

Estas oportunidades representan una evolución esperable para cualquier producto exitoso.

Sin embargo, también introducen un riesgo.

Si las recomendaciones comienzan a estar influenciadas por intereses comerciales, el usuario perderá confianza en el producto.

Y una vez perdida la confianza, el principal activo de PromoAR desaparecerá.

Era necesario definir un criterio permanente antes de que esas situaciones aparezcan.

---

## Problema

Existen dos enfoques posibles.

### Modelo A

Permitir que acuerdos comerciales influyan directamente sobre las recomendaciones del producto.

Los comercios con mayor inversión económica obtienen mayor exposición.

Las recomendaciones dejan de responder exclusivamente al beneficio del usuario.

---

### Modelo B

Mantener completamente separadas las recomendaciones del sistema y cualquier mecanismo de monetización.

Las recomendaciones continúan priorizando únicamente aquello que resulte más conveniente para el usuario.

La monetización se desarrolla mediante mecanismos claramente identificados y transparentes.

---

Ambos modelos son económicamente viables.

Pero representan productos profundamente diferentes.

---

## Decisión

PromoAR adopta el Modelo B.

Las recomendaciones generadas por el producto deberán responder exclusivamente al interés del usuario.

Ningún acuerdo comercial podrá modificar el orden de una recomendación, alterar el resultado de un ranking o favorecer artificialmente a un comercio, banco o medio de pago.

La confianza constituye un activo estratégico.

Por ese motivo, la independencia de las recomendaciones pasa a formar parte de la arquitectura del producto y no únicamente de una decisión comercial.

---

## Principios derivados

Como consecuencia de esta decisión:

- Las recomendaciones deberán construirse utilizando únicamente criterios objetivos definidos por el producto.
- Toda acción publicitaria deberá identificarse claramente como contenido patrocinado.
- El usuario deberá poder distinguir sin ambigüedades una recomendación de una promoción comercial.
- Ningún anunciante podrá comprar una recomendación.
- Ningún acuerdo económico podrá modificar los criterios utilizados por el motor de recomendaciones.

La monetización podrá evolucionar con el tiempo.

La neutralidad de las recomendaciones no.

---

## Consecuencias para el producto

La neutralidad comercial pasa a ser un requisito permanente del diseño de PromoAR.

Como consecuencia de este ADR:

- El motor de recomendaciones deberá utilizar exclusivamente criterios definidos por el producto.
- Las reglas de priorización deberán ser independientes de cualquier relación comercial.
- Toda explicación de una recomendación deberá poder justificarse mediante datos objetivos.
- La confianza del usuario tendrá prioridad sobre cualquier beneficio económico de corto plazo.

Las decisiones comerciales nunca podrán modificar el comportamiento esperado del producto.

---

## Consecuencias para el negocio

Este ADR no impide monetizar PromoAR.

Define los límites dentro de los cuales esa monetización podrá desarrollarse.

El producto podrá incorporar, entre otros:

- Publicidad claramente identificada.
- Espacios patrocinados.
- Programas de afiliación.
- Suscripciones.
- Servicios premium.
- Acuerdos comerciales con bancos, billeteras, comercios u otras organizaciones.

Sin embargo, ninguno de esos mecanismos podrá alterar el funcionamiento del sistema de recomendaciones.

La monetización deberá construirse alrededor de la confianza del usuario y no a costa de ella.

---

## Riesgos asumidos

Adoptar una política estricta de neutralidad implica aceptar determinadas limitaciones.

Entre ellas:

- Renunciar a determinadas oportunidades comerciales de corto plazo.
- Limitar modelos publicitarios altamente rentables.
- Rechazar acuerdos que comprometan la independencia del producto.
- Exigir mayor transparencia frente a anunciantes y socios comerciales.

Estos riesgos fueron considerados aceptables porque preservar la credibilidad del producto representa una ventaja competitiva mucho más valiosa que cualquier ingreso inmediato.

---

## Casos permitidos

Los siguientes escenarios son compatibles con este ADR:

- Mostrar contenido patrocinado claramente identificado.
- Incorporar publicidad separada de las recomendaciones.
- Ofrecer suscripciones con funcionalidades adicionales.
- Celebrar acuerdos comerciales que no alteren el comportamiento del motor de recomendaciones.
- Permitir que un comercio amplíe su información institucional, siempre que ello no modifique su posición dentro de una recomendación.

---

## Casos no permitidos

Los siguientes escenarios contradicen este ADR:

- Alterar el orden de una recomendación porque un comercio realizó un pago.
- Favorecer un banco por encima de otro debido a un acuerdo comercial.
- Ocultar promociones más convenientes para beneficiar a un anunciante.
- Presentar contenido patrocinado simulando ser una recomendación del sistema.
- Modificar los criterios de ranking para favorecer intereses económicos externos.

Estas prácticas comprometerían la confianza del usuario y resultarían incompatibles con la filosofía de PromoAR.

---

## Decisiones derivadas

Como consecuencia de este ADR, se establecen las siguientes decisiones permanentes:

- Toda monetización deberá ser transparente para el usuario.
- Las recomendaciones permanecerán separadas de cualquier contenido patrocinado.
- La lógica del motor de recomendaciones no podrá modificarse por razones comerciales.
- Cualquier excepción a este principio requerirá un nuevo ADR que reemplace explícitamente esta decisión.

---

## Relación con otros documentos

Este ADR implementa principios definidos en la documentación fundacional de PromoAR.

Se encuentra directamente relacionado con:

- `docs/vision/product-vision.md`, donde se establece que el propósito del producto es ayudar a las personas a tomar mejores decisiones de consumo.
- `docs/vision/PRODUCT_PRINCIPLES.md`, especialmente con los principios **"La confianza vale más que cualquier funcionalidad"**, **"La decisión es el producto"** y **"Cada dato debe trabajar para el usuario"**.
- `docs/adr/ADR-001_PRODUCT_FIRST.md`, que establece que las recomendaciones constituyen el núcleo del producto y deben responder exclusivamente al beneficio del usuario.

---

## Vigencia

Este ADR permanecerá vigente mientras PromoAR mantenga como objetivo representar los intereses del usuario por encima de cualquier interés comercial.

Toda decisión futura que modifique esta política deberá registrarse mediante un nuevo ADR que sustituya explícitamente este documento.

---

## Cierre

La confianza no es una funcionalidad.

Es la condición necesaria para que todas las demás funcionalidades tengan valor.

Un usuario puede equivocarse siguiendo una recomendación.

Lo que no debería dudar nunca es de la honestidad con la que esa recomendación fue construida.

PromoAR podrá evolucionar.

Podrá incorporar nuevos modelos de negocio.

Podrá establecer alianzas comerciales.

Pero nunca deberá permitir que esas decisiones alteren aquello que constituye su principal activo:

La confianza de las personas.

Este ADR convierte esa convicción en una decisión permanente de producto.
