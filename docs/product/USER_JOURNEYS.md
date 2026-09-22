---
title: User Journeys
subtitle: Recorridos de decisión de los usuarios de PromoAR
version: 1.0
status: Approved
owner: Dani
authors:
  - Dani (Founder)
  - ChatGPT (Chief Product Officer)
reviewers:
  - Claude
last_updated: 2026-07-15
---

# User Journeys

> Diseñamos recorridos para ayudar a decidir, no pantallas para navegar.

---

## Introducción

Las personas no utilizan PromoAR porque quieran explorar promociones.

Lo utilizan porque necesitan resolver una decisión.

Comprar carne.

Cargar combustible.

Pedir una pizza.

Comprar un medicamento.

Elegir un supermercado.

Cada interacción con el producto comienza con una necesidad concreta.

Este documento describe cómo PromoAR acompaña a los usuarios durante esos procesos de decisión.

No define interfaces.

No describe pantallas.

No constituye una especificación funcional.

Su propósito consiste en comprender la experiencia completa desde la perspectiva del usuario.

---

## Filosofía de los recorridos

Un recorrido exitoso no es aquel donde el usuario visita más pantallas.

Es aquel donde llega antes a una buena decisión.

Cada paso adicional representa una oportunidad para generar dudas, esfuerzo o abandono.

Por ese motivo, todos los recorridos definidos para PromoAR deberán perseguir un mismo objetivo.

Reducir la cantidad de decisiones que el usuario necesita tomar para resolver el problema que originó su consulta.

---

## Estructura de un User Journey

Todos los recorridos documentados seguirán la misma estructura.

### Situación inicial

¿Qué ocurre antes de abrir PromoAR?

¿Qué problema intenta resolver la persona?

¿Qué información posee?

¿Qué información le falta?

---

### Objetivo

¿Qué intenta conseguir?

No desde la perspectiva del sistema.

Desde la perspectiva del usuario.

---

### Contexto disponible

¿Qué información conoce PromoAR?

Ubicación.

Perfil.

Medios de pago.

Preferencias.

Historial.

Horario.

Contexto comercial.

Toda esa información podrá modificar la experiencia.

---

### Intervención del producto

¿Cómo ayuda PromoAR?

¿Qué preguntas evita?

¿Qué análisis realiza automáticamente?

¿Qué información sintetiza?

¿Qué decisión simplifica?

---

### Resultado esperado

¿Qué debería sentir el usuario al finalizar?

No únicamente qué hizo.

Sino cómo cambió su situación respecto del momento en que abrió la aplicación.

---

## Journey 1 — Necesito comprar carne hoy

### Situación inicial

El usuario sale del trabajo.

Quiere comprar carne para la cena.

Sabe aproximadamente qué necesita.

No sabe dónde le conviene comprar.

No recuerda qué promociones tiene disponibles.

No quiere recorrer supermercados comparando descuentos.

Quiere resolver la decisión rápidamente.

---

### Objetivo

Encontrar la alternativa más conveniente considerando su contexto.

No desea analizar veinte promociones.

Desea saber cuál representa la mejor decisión.

---

### Contexto disponible

PromoAR conoce:

- La ubicación actual.
- Los medios de pago disponibles.
- Los bancos asociados.
- Las billeteras registradas.
- Los comercios cercanos.
- Las promociones vigentes.
- El horario de cada sucursal.

Toda esa información permite reducir significativamente el análisis.

---

### Intervención del producto

PromoAR identifica los comercios cercanos que venden carne.

Descarta aquellos que se encuentran cerrados.

Analiza promociones compatibles con el perfil del usuario.

Considera restricciones y condiciones.

Evalúa cuál representa el mayor beneficio real.

Finalmente presenta una recomendación clara.

No una lista.

Una respuesta.

---

### Resultado esperado

El usuario decide dónde comprar en pocos segundos.

Siente que evitó una búsqueda innecesaria.

Confía en que la recomendación contempla información que probablemente habría olvidado analizar por su cuenta.

No necesita preguntarse si existía una opción mejor.

PromoAR ya realizó ese trabajo.

---

## Journey 2 — Quiero cargar combustible

### Situación inicial

El usuario necesita cargar combustible antes de continuar su viaje.

No tiene una estación de servicio preferida.

Sabe que existen promociones, pero no recuerda cuáles siguen vigentes ni con qué medio de pago puede utilizarlas.

Además del ahorro, le interesa evitar desvíos innecesarios.

---

### Objetivo

Encontrar la estación de servicio que represente la mejor combinación entre ahorro, cercanía y disponibilidad.

No busca simplemente el mayor descuento.

Busca la mejor decisión para ese momento.

---

### Contexto disponible

PromoAR conoce:

- La ubicación actual del usuario.
- Las estaciones cercanas.
- Los bancos y billeteras disponibles.
- Los medios de pago registrados.
- Las promociones compatibles.
- Los horarios de atención.
- El día y la hora de la consulta.

Toda esa información modifica la recomendación.

---

### Intervención del producto

PromoAR identifica las estaciones disponibles dentro de una distancia razonable.

Descarta aquellas cuya promoción no resulta compatible con el usuario.

Evalúa el beneficio potencial.

Considera el desvío necesario para llegar.

Prioriza la alternativa que ofrece el mejor equilibrio entre ahorro y conveniencia.

La recomendación explica por qué esa opción aparece primero.

---

### Resultado esperado

El usuario continúa su viaje con la tranquilidad de haber tomado una buena decisión sin realizar comparaciones manuales.

La aplicación desaparece rápidamente de la escena.

El objetivo nunca fue permanecer utilizándola.

Fue resolver el problema.

---

## Journey 3 — Estoy por pedir comida

### Situación inicial

El usuario quiere pedir comida desde su casa.

Existen múltiples aplicaciones y comercios disponibles.

También existen distintas promociones según el medio de pago utilizado.

Recordar todas esas combinaciones resulta prácticamente imposible.

---

### Objetivo

Elegir la opción más conveniente considerando el comercio, el medio de pago y el beneficio disponible.

---

### Contexto disponible

PromoAR conoce:

- La ubicación del usuario.
- Los comercios que realizan envíos en la zona.
- Las promociones compatibles.
- Los medios de pago registrados.
- Las preferencias previamente observadas.
- El horario de funcionamiento.

---

### Intervención del producto

PromoAR analiza las alternativas disponibles.

Prioriza aquellas que realmente representan un beneficio para el usuario.

Cuando existan varias opciones similares, explica los factores que justifican la recomendación.

La decisión continúa perteneciendo al usuario.

El análisis pertenece al producto.

---

### Resultado esperado

El usuario realiza su pedido con confianza.

No necesita recorrer múltiples aplicaciones buscando descuentos.

No siente que ganó una promoción.

Siente que tomó una buena decisión.

---

## Journey 4 — Estoy haciendo las compras del supermercado

### Situación inicial

El usuario se encuentra dentro del supermercado.

Tiene un carrito parcialmente completo.

Recuerda que probablemente exista alguna promoción.

No sabe si aplica ese día.

No recuerda con qué tarjeta.

No sabe si existe un tope de reintegro.

---

### Objetivo

Aprovechar los beneficios disponibles sin detener la compra para investigar condiciones complejas.

---

### Contexto disponible

PromoAR conoce:

- El comercio donde se encuentra el usuario.
- La fecha y el horario.
- Los medios de pago disponibles.
- Las promociones vigentes.
- Las restricciones conocidas.
- El perfil del usuario.

---

### Intervención del producto

PromoAR identifica automáticamente las promociones aplicables.

Prioriza aquellas que generan mayor beneficio.

Cuando existan límites o condiciones importantes, las comunica de forma simple y visible.

El usuario recibe una recomendación práctica antes de pasar por la caja.

---

### Resultado esperado

La compra finaliza sin incertidumbre.

El usuario tiene la sensación de haber aprovechado correctamente las promociones disponibles.

El beneficio no consiste únicamente en ahorrar.

Consiste en evitar el esfuerzo de recordar reglas complejas mientras compra.

---

## Journey 5 — Estoy planificando una compra importante

### Situación inicial

El usuario está evaluando una compra de mayor valor.

Puede tratarse de un electrodoméstico, un teléfono, una computadora, un televisor o cualquier producto cuyo importe justifique dedicar más tiempo a decidir.

Sabe que una buena promoción puede representar una diferencia significativa.

No necesita comprar inmediatamente.

Necesita saber cuándo conviene hacerlo.

---

### Objetivo

Tomar la mejor decisión posible considerando el contexto disponible y el momento más conveniente para realizar la compra.

---

### Contexto disponible

PromoAR conoce:

- Las promociones vigentes.
- Los medios de pago del usuario.
- Las restricciones aplicables.
- Los comercios disponibles.
- El historial de consultas relacionadas.
- Las preferencias registradas.

Con el tiempo, el producto podrá incorporar nueva información que permita enriquecer aún más este tipo de recomendaciones.

---

### Intervención del producto

PromoAR analiza las alternativas disponibles.

Si existe una buena oportunidad, la recomienda.

Si considera que probablemente aparezca una mejor alternativa en el corto plazo, podrá sugerir esperar.

El objetivo no consiste únicamente en encontrar una promoción.

Consiste en ayudar a decidir cuál es el mejor momento para comprar.

---

### Resultado esperado

El usuario siente que tomó una decisión informada.

No porque analizó más información.

Sino porque el producto realizó ese análisis por él.

---

## Journey 6 — Descubrir oportunidades sin una necesidad inmediata

### Situación inicial

El usuario no necesita realizar una compra específica.

Simplemente desea conocer oportunidades relevantes para su perfil.

No quiere recorrer cientos de promociones.

Quiere descubrir aquellas que realmente podrían resultarle útiles.

---

### Objetivo

Encontrar recomendaciones relevantes sin partir de una búsqueda concreta.

---

### Contexto disponible

PromoAR utiliza:

- El perfil del usuario.
- Sus hábitos de consumo.
- Los medios de pago registrados.
- Las promociones vigentes.
- El contexto geográfico.
- El momento de la consulta.

---

### Intervención del producto

El sistema prioriza oportunidades compatibles con el perfil del usuario.

No intenta mostrar todo.

Intenta mostrar aquello que probablemente tenga valor.

La exploración continúa existiendo.

Pero deja de depender exclusivamente de la iniciativa del usuario.

---

### Resultado esperado

El usuario descubre oportunidades que probablemente no habría encontrado por sí mismo.

La experiencia transmite la sensación de que PromoAR comprende sus necesidades sin resultar invasivo.

---

## Qué tienen en común todos los recorridos

Aunque cada Journey describe una situación distinta, todos responden a los mismos principios.

El usuario llega con una necesidad.

No con una pregunta técnica.

PromoAR interpreta el contexto.

Reduce la complejidad.

Analiza múltiples variables.

Presenta una recomendación.

El usuario conserva siempre la decisión final.

La cantidad de pantallas nunca constituye un indicador de éxito.

El tiempo necesario para llegar a una buena decisión, sí.

---

## Evolución de los User Journeys

Los recorridos definidos en este documento representan los escenarios fundamentales para la primera etapa de PromoAR.

Con la evolución del producto aparecerán nuevos Journey relacionados con:

- Planificación de compras.
- Comparación entre alternativas.
- Alertas personalizadas.
- Recomendaciones anticipadas.
- Compras recurrentes.
- Decisiones familiares o compartidas.
- Integración con nuevos servicios y categorías.

La incorporación de nuevos recorridos no modificará la filosofía establecida en este documento.

Todos deberán responder a una misma pregunta:

**¿Cómo puede PromoAR reducir el esfuerzo necesario para tomar una mejor decisión?**

---

## Relación con otros documentos

Este documento desarrolla la experiencia definida en:

- `docs/vision/product-vision.md`
- `docs/vision/PRODUCT_PRINCIPLES.md`
- `docs/product/USER_PERSONAS.md`
- `docs/roadmap/ROADMAP.md`
- `docs/adr/ADR-001_PRODUCT_FIRST.md`
- `docs/adr/ADR-002_ASSISTANT_AND_EXPLORATION.md`
- `docs/adr/ADR-006-Recommendation_Engine.md`
- `docs/adr/ADR-007-User_Profile.md`

Los User Journeys constituyen el puente entre la visión estratégica del producto y el diseño de la experiencia de usuario.

---

## Cierre

Las personas no descargan PromoAR porque quieran explorar promociones.

Lo hacen porque necesitan resolver una decisión.

Cada recorrido descrito en este documento comienza con una necesidad concreta y termina cuando esa necesidad deja de ser un problema.

Ese es el verdadero objetivo del producto.

No aumentar el tiempo de uso.

No incrementar la cantidad de pantallas visitadas.

No mostrar más información.

Ayudar a decidir mejor.

Si cada Journey logra reducir el esfuerzo necesario para tomar una buena decisión, entonces PromoAR estará cumpliendo el propósito para el cual fue creado.
