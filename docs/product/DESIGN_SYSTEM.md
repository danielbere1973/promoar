---
title: Design System
subtitle: Principios de diseño para la experiencia de usuario de PromoAR
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

# Design System

> Una buena interfaz desaparece cuando el usuario toma una buena decisión.

---

## Introducción

El Design System de PromoAR no comienza definiendo componentes visuales.

Comienza definiendo principios.

Antes de decidir colores, botones, iconografía o tipografías, es necesario comprender qué experiencia queremos construir.

Este documento establece los principios que deberán guiar cualquier decisión relacionada con la experiencia de usuario.

No constituye un catálogo de componentes.

No define una biblioteca visual.

No describe tecnologías de frontend.

Su propósito consiste en garantizar que toda interfaz diseñada para PromoAR transmita la misma filosofía del producto.

---

## Filosofía de diseño

PromoAR no busca impresionar al usuario.

Busca ayudarlo.

La interfaz no constituye el producto.

La decisión constituye el producto.

Toda decisión de diseño deberá contribuir a reducir el esfuerzo cognitivo necesario para llegar a una buena decisión.

Cuando exista un conflicto entre una interfaz llamativa y una interfaz clara, siempre deberá prevalecer la claridad.

---

## Principios del diseño

### La decisión es protagonista

Toda pantalla deberá responder una pregunta simple.

**¿Qué decisión ayuda a tomar?**

Si una pantalla no contribuye directamente a resolver una decisión, probablemente no deba existir.

La interfaz nunca deberá competir con el objetivo del usuario.

---

### La simplicidad siempre gana

La simplicidad no consiste en mostrar menos información.

Consiste en mostrar únicamente la información necesaria en el momento adecuado.

Cada elemento adicional introduce una carga cognitiva.

Cada decisión visual debe justificarse por el valor que aporta.

Eliminar complejidad representa una mejora de la experiencia.

No una limitación.

---

### El contexto vale más que la cantidad

Mostrar más promociones no significa ayudar más.

Mostrar más filtros no significa ofrecer mayor control.

La calidad de la experiencia dependerá de la capacidad del producto para comprender el contexto del usuario.

La interfaz deberá reflejar esa inteligencia.

No esconderla detrás de múltiples opciones.

---

### El usuario conserva el control

PromoAR recomienda.

Nunca decide.

La interfaz deberá transmitir permanentemente que la decisión final pertenece al usuario.

Las recomendaciones deberán sentirse como una ayuda.

Nunca como una imposición.

---

### La confianza se diseña

La confianza no depende únicamente de la precisión de una recomendación.

También depende de cómo se comunica.

Cuando el producto recomiende una alternativa importante, deberá explicar de forma sencilla por qué lo hace.

Una explicación breve y comprensible genera más confianza que una respuesta aparentemente perfecta sin contexto.

---

## Qué debe sentir el usuario

Al utilizar PromoAR, la experiencia debería transmitir las siguientes sensaciones.

### Claridad

El usuario debe comprender rápidamente qué está ocurriendo.

Nunca debería preguntarse qué debe hacer a continuación.

---

### Tranquilidad

El producto debe reducir incertidumbre.

No aumentarla.

Cada interacción debería transmitir la sensación de que existe una lógica detrás de la recomendación presentada.

---

### Rapidez

La velocidad no depende únicamente del rendimiento técnico.

También depende de la facilidad para comprender la información.

Una interfaz sencilla suele sentirse más rápida que una compleja, incluso cuando ambas tardan exactamente lo mismo.

---

### Confianza

Cada pantalla debe reforzar la credibilidad del producto.

La información importante deberá resultar verificable.

Las condiciones relevantes deberán comunicarse claramente.

Las limitaciones nunca deberán ocultarse.

La transparencia forma parte del diseño.

No únicamente del contenido.

---

## Qué debe evitar la interfaz

Existen patrones de diseño incompatibles con la filosofía de PromoAR.

Entre ellos:

- Sobrecargar la pantalla con información.
- Mostrar promociones únicamente porque existen.
- Priorizar elementos patrocinados sobre recomendaciones objetivas.
- Ocultar información relevante para simplificar artificialmente la experiencia.
- Obligar al usuario a navegar múltiples pantallas para resolver una decisión sencilla.
- Utilizar mecanismos diseñados exclusivamente para aumentar el tiempo de permanencia en la aplicación.

La experiencia deberá optimizar decisiones.

No métricas de interacción.

---

## Jerarquía de información

No toda la información posee el mismo valor.

La interfaz deberá comunicar esa diferencia de forma evidente.

El usuario nunca debería invertir tiempo descubriendo qué es lo importante.

El diseño tiene la responsabilidad de hacerlo evidente.

---

### Nivel 1 — La decisión

Es el elemento principal de cada pantalla.

Responde a la pregunta que originó la interacción.

Ejemplos:

- Dónde conviene comprar.
- Qué promoción utilizar.
- Qué medio de pago elegir.
- Si conviene esperar o comprar ahora.

La decisión deberá ocupar siempre el lugar de mayor relevancia visual.

---

### Nivel 2 — La explicación

Toda recomendación importante deberá poder explicarse.

No mediante reglas complejas.

Mediante razones comprensibles.

Por ejemplo:

- "Obtendrás un reintegro mayor."
- "Este comercio está más cerca."
- "La promoción vence hoy."
- "Tu tarjeta es compatible."

La explicación fortalece la confianza.

Nunca debe competir visualmente con la recomendación.

La acompaña.

---

### Nivel 3 — El detalle

Las condiciones completas, restricciones y excepciones continúan siendo importantes.

Pero no deberían dominar la experiencia.

La interfaz deberá permitir acceder fácilmente a esa información cuando el usuario lo necesite.

No antes.

---

## Divulgación progresiva

Uno de los principios fundamentales del diseño será la divulgación progresiva.

El usuario no necesita conocer toda la información desde el primer momento.

Necesita conocer únicamente aquello que le permite avanzar.

A medida que aumente su interés, podrá acceder a niveles crecientes de detalle.

Este principio reduce la carga cognitiva sin ocultar información.

La transparencia no depende de mostrar todo al mismo tiempo.

Depende de permitir que todo pueda encontrarse cuando resulte necesario.

---

## Diseño orientado al contexto

La misma pantalla podrá comportarse de forma diferente según el contexto.

No porque cambie su identidad.

Sino porque cambia la necesidad del usuario.

Por ejemplo:

Una persona que consulta una estación de servicio mientras conduce necesita una respuesta inmediata.

Otra persona planificando un viaje probablemente quiera comparar alternativas.

La arquitectura permanece estable.

La presentación se adapta.

---

## Presentación de las recomendaciones

Las recomendaciones constituyen el elemento más importante del producto.

Por ese motivo deberán respetar reglas específicas.

### Una recomendación principal

Cuando exista una alternativa claramente superior, la interfaz deberá destacarla.

El usuario no debería tener que descubrir cuál es la mejor opción.

El producto ya realizó ese análisis.

---

### Alternativas visibles

Recomendar no significa ocultar.

Las demás alternativas deberán permanecer disponibles.

El usuario conserva siempre la posibilidad de compararlas.

La recomendación simplifica.

Nunca restringe.

---

### Explicaciones breves

Toda recomendación importante deberá responder una pregunta implícita.

**¿Por qué?**

La explicación deberá ocupar pocas palabras.

No intentar demostrar inteligencia.

Intentar generar confianza.

---

## Navegación

La navegación constituye un medio.

Nunca un objetivo.

Cada transición entre pantallas deberá acercar al usuario a una decisión.

Si navegar se convierte en una tarea en sí misma, la arquitectura deberá revisarse.

---

### Reducir pasos

Toda interacción innecesaria representa una oportunidad para generar abandono.

Siempre que resulte posible:

- Menos pantallas.
- Menos confirmaciones.
- Menos formularios.
- Menos decisiones intermedias.

La mejor interacción suele ser aquella que nunca fue necesaria.

---

### Continuidad

El usuario no debería sentir que cambia de aplicación al navegar.

Todas las secciones deberán compartir una misma lógica.

La consistencia genera familiaridad.

Y la familiaridad reduce esfuerzo.

---

## Lenguaje visual

El lenguaje visual deberá comunicar serenidad.

No urgencia.

PromoAR ayuda a tomar decisiones.

No intenta llamar la atención constantemente.

Por ese motivo:

- El color deberá utilizarse para comunicar significado.
- El movimiento deberá utilizarse únicamente cuando aporte comprensión.
- Los íconos deberán complementar el texto.
- La tipografía deberá priorizar legibilidad sobre personalidad.

La identidad visual deberá reforzar la confianza.

Nunca competir con la información.

---

## Accesibilidad

La experiencia deberá resultar comprensible para la mayor cantidad posible de personas.

Las decisiones importantes nunca deberán depender exclusivamente de:

- Un color.
- Un ícono.
- Una animación.
- Un gesto.

Toda información crítica deberá comunicarse mediante múltiples recursos.

Diseñar para la accesibilidad no representa una funcionalidad adicional.

Representa una responsabilidad del producto.

---

## Consistencia

La consistencia representa uno de los pilares del Design System.

No significa que todas las pantallas sean iguales.

Significa que todas responden a las mismas reglas.

Cuando el usuario aprende cómo funciona una parte de PromoAR, ese aprendizaje deberá servirle para comprender el resto del producto.

La consistencia reduce la necesidad de aprender.

Y, por lo tanto, reduce el esfuerzo.

---

### Consistencia visual

Los elementos equivalentes deberán verse equivalentes.

Una recomendación siempre deberá presentarse de la misma manera.

Una advertencia deberá conservar el mismo significado en cualquier pantalla.

Una acción primaria deberá resultar inmediatamente reconocible.

El usuario nunca debería tener que reinterpretar la interfaz.

---

### Consistencia funcional

La misma acción deberá producir el mismo resultado.

Si una interacción cambia su comportamiento según la pantalla, deberá existir una razón muy clara para hacerlo.

Las excepciones representan un costo cognitivo.

Por ese motivo deberán ser mínimas.

---

### Consistencia conceptual

Los conceptos del dominio deberán mantenerse estables.

Si el producto habla de "Promoción", ese término deberá utilizarse en toda la aplicación.

Si habla de "Recomendación", deberá evitar sinónimos innecesarios.

Compartir el mismo lenguaje fortalece la comprensión.

---

## Diseño orientado a la confianza

Toda decisión visual deberá reforzar la credibilidad del producto.

La interfaz nunca deberá intentar manipular al usuario.

Por ese motivo se evitarán patrones como:

- Confirmaciones engañosas.
- Botones con jerarquías confusas.
- Información importante oculta.
- Publicidad disfrazada de contenido.
- Recomendaciones cuya justificación no pueda comprenderse.

La confianza no constituye una funcionalidad.

Constituye una propiedad emergente del diseño.

---

## Evolución del Design System

Este documento define principios permanentes.

No reglas visuales inmutables.

Los componentes podrán cambiar.

Los colores podrán evolucionar.

Las tecnologías podrán reemplazarse.

Incluso la identidad visual podrá renovarse.

Lo que no debería modificarse es la filosofía que orienta esas decisiones.

Cada nueva incorporación al sistema deberá respetar los principios definidos aquí.

---

## Relación con los componentes

En una etapa futura podrá desarrollarse una biblioteca de componentes.

Botones.

Tarjetas.

Campos de entrada.

Iconografía.

Espaciados.

Tipografía.

Animaciones.

Esa documentación deberá construirse sobre este documento.

Nunca al revés.

Los componentes representan una implementación.

El Design System representa la filosofía que los guía.

---

## Relación con otros documentos

Este documento implementa los principios de experiencia definidos en el resto de la documentación estratégica de PromoAR.

Se encuentra directamente relacionado con:

- `docs/vision/product-vision.md`, donde se define el propósito del producto.
- `docs/vision/PRODUCT_PRINCIPLES.md`, especialmente los principios de simplicidad, confianza y recomendación.
- `docs/product/INFORMATION_ARCHITECTURE.md`, que organiza la información desde la perspectiva del usuario.
- `docs/product/USER_JOURNEYS.md`, que describe cómo las personas recorren la experiencia.
- `docs/adr/ADR-001_PRODUCT_FIRST.md`, que establece que la decisión constituye el verdadero producto.
- `docs/adr/ADR-002_ASSISTANT_AND_EXPLORATION.md`, que define la convivencia entre recomendación y exploración.

Toda decisión de UX deberá poder justificarse utilizando alguno de estos documentos.

---

## Vigencia

El Design System deberá evolucionar junto con PromoAR.

Sin embargo, cualquier cambio deberá preservar los principios fundamentales definidos en este documento.

La incorporación de nuevos componentes no implica modificar la filosofía.

La incorporación de nuevas tecnologías tampoco.

Mientras PromoAR continúe ayudando a las personas a tomar mejores decisiones, este documento seguirá representando la base del diseño del producto.

---

## Cierre

El mejor diseño no es el que recibe más elogios.

Es el que permite que el usuario deje de pensar en la interfaz.

Cuando una persona recuerda la recomendación que recibió, y no el botón que presionó para obtenerla, el diseño cumplió su propósito.

PromoAR no busca construir una aplicación llamativa.

Busca construir una herramienta confiable.

Una interfaz clara reduce errores.

Una interfaz consistente genera confianza.

Una interfaz sencilla desaparece detrás de una buena decisión.

Ese es el estándar que deberá perseguir cualquier experiencia diseñada para PromoAR.
