---
title: Information Architecture
subtitle: Arquitectura de información de PromoAR
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

# Information Architecture

> Una buena arquitectura permite que el usuario piense menos.

---

## Introducción

La arquitectura de información define cómo se organiza el conocimiento dentro de PromoAR.

No describe pantallas.

No define componentes visuales.

No establece decisiones de diseño gráfico.

Su propósito consiste en organizar la información de forma coherente con la manera en que las personas piensan y toman decisiones.

Cada sección del producto deberá existir porque ayuda al usuario a resolver un problema.

No porque resulte conveniente desde el punto de vista técnico.

---

## Principios de arquitectura

Toda la arquitectura de PromoAR deberá respetar los siguientes principios.

### La decisión es el centro

El producto no gira alrededor de promociones.

Ni de bancos.

Ni de comercios.

Gira alrededor de decisiones.

Toda la información deberá organizarse para facilitar la decisión del usuario.

---

### La complejidad pertenece al sistema

Las promociones pueden tener condiciones complejas.

Los medios de pago pueden variar.

Los comercios pueden superponerse.

Las restricciones pueden ser numerosas.

Nada de esa complejidad debería trasladarse a la estructura del producto.

El usuario no tiene por qué comprender cómo funciona el sistema.

El sistema tiene la responsabilidad de comprender el contexto del usuario.

---

### Una sección, un propósito

Cada espacio del producto deberá responder claramente a una pregunta.

Si una sección intenta resolver demasiados problemas al mismo tiempo, probablemente deba dividirse.

Si dos secciones responden la misma pregunta, probablemente una de ellas no sea necesaria.

---

### La navegación debe reflejar la intención

Las personas no navegan pensando en entidades técnicas.

Piensan en acciones.

Necesito comprar.

Quiero explorar.

Quiero revisar mi perfil.

Quiero entender una recomendación.

La arquitectura deberá construirse siguiendo esa lógica.

---

## Modelo conceptual

Desde la perspectiva del usuario, PromoAR puede entenderse como cinco grandes espacios.

Cada uno cumple un propósito diferente.

Juntos conforman una única experiencia.

---

## 1. Asistente

El Asistente constituye el punto de entrada principal al producto.

Su función consiste en ayudar al usuario a resolver una decisión concreta.

No está diseñado para explorar.

Está diseñado para responder.

Aquí el usuario expresa una necesidad.

El producto interpreta el contexto.

El motor de recomendaciones analiza la información disponible.

Finalmente, presenta una recomendación.

El objetivo del Asistente no consiste en mostrar información.

Consiste en reducir el esfuerzo necesario para decidir.

---

## 2. Explorar

Explorar representa el espacio donde el usuario mantiene el control completo sobre la búsqueda.

Puede recorrer promociones.

Consultar comercios.

Descubrir beneficios.

Comparar alternativas.

Investigar categorías.

Este espacio no reemplaza al Asistente.

Lo complementa.

PromoAR reconoce que existen situaciones donde las personas prefieren explorar por sí mismas.

La exploración seguirá siendo un derecho del usuario.

Nunca una obligación.

---

## 3. Perfil

El Perfil reúne toda la información que permite personalizar la experiencia.

No constituye un formulario administrativo.

Representa el contexto que ayuda a comprender mejor al usuario.

Aquí se administran, entre otros elementos:

- Medios de pago.
- Bancos.
- Billeteras.
- Preferencias.
- Comercios favoritos.
- Configuración de notificaciones.
- Opciones de privacidad.

El propósito del Perfil consiste en mejorar las recomendaciones futuras.

No almacenar información innecesaria.

---

## 4. Comercios

Los comercios representan uno de los principales dominios de información del producto.

Sin embargo, no constituyen el centro de la experiencia.

Su función consiste en proporcionar el contexto necesario para construir mejores recomendaciones.

Cada comercio podrá contener información como:

- Sucursales.
- Horarios.
- Categorías.
- Promociones vigentes.
- Medios de pago aceptados.
- Servicios disponibles.
- Información geográfica.

Desde la perspectiva del usuario, un comercio nunca será únicamente un lugar.

Representará una posible solución para una necesidad concreta.

---

## 5. Promociones

Las promociones constituyen la materia prima del producto.

No representan el producto en sí mismo.

Cada promoción deberá existir como un objeto independiente, reutilizable y verificable.

Entre otros elementos, podrá incluir:

- Beneficio.
- Condiciones.
- Restricciones.
- Vigencia.
- Medio de pago.
- Banco.
- Billetera.
- Categoría.
- Comercio.
- Sucursales participantes.

La complejidad de cada promoción deberá permanecer oculta siempre que resulte posible.

El usuario necesita comprender si una promoción le sirve.

No necesita interpretar su estructura interna.

---

## Relaciones entre los espacios

Los cinco espacios no funcionan de manera independiente.

Conforman un único ecosistema.

El Asistente utiliza información proveniente del Perfil.

El Perfil mejora el funcionamiento del motor de recomendaciones.

Las recomendaciones utilizan Comercios y Promociones como fuentes de información.

Explorar permite acceder manualmente a esos mismos datos cuando el usuario desea analizarlos por sí mismo.

Desde la perspectiva técnica podrán existir múltiples módulos.

Desde la perspectiva del usuario existe un único producto.

---

## Jerarquía de información

No toda la información posee la misma importancia.

La arquitectura deberá establecer una jerarquía clara.

### Nivel 1 — La respuesta

Lo primero que el usuario debería encontrar.

Una recomendación.

Una decisión.

Una acción sugerida.

---

### Nivel 2 — La explicación

¿Por qué PromoAR recomienda esa alternativa?

¿Qué factores tuvo en cuenta?

¿Qué beneficio genera?

La explicación fortalece la confianza.

Nunca debería competir visualmente con la respuesta principal.

---

### Nivel 3 — El detalle

Toda la información adicional.

Condiciones.

Restricciones.

Vigencias.

Topes.

Sucursales.

Excepciones.

El detalle deberá permanecer disponible.

Pero únicamente cuando el usuario quiera consultarlo.

---

## Arquitectura orientada al contexto

La arquitectura de PromoAR no deberá organizarse únicamente mediante categorías.

También deberá organizarse utilizando contexto.

El mismo usuario puede necesitar experiencias diferentes según la situación.

Por ejemplo:

- Comprar cerca de casa.
- Comprar cerca del trabajo.
- Aprovechar una promoción antes de que finalice.
- Resolver una compra urgente.
- Planificar una compra futura.

La arquitectura deberá permitir que el contexto reorganice la información presentada sin modificar la identidad del producto.

El objetivo consiste en adaptar la experiencia.

No en multiplicar pantallas.

---

## El papel del motor de recomendaciones

El motor de recomendaciones no constituye una sección visible.

Representa una capacidad transversal.

Se encuentra presente en toda la arquitectura.

Influye sobre:

- El Asistente.
- Explorar.
- Las notificaciones.
- El Perfil.
- Las recomendaciones futuras.

El usuario no necesita comprender cómo funciona.

Únicamente necesita confiar en los resultados que produce.

La inteligencia del producto deberá sentirse en toda la experiencia, aunque permanezca invisible.

---

## Evolución de la arquitectura

La arquitectura definida en este documento representa el estado objetivo de PromoAR.

No implica que todas las capacidades deban implementarse desde el primer día.

A medida que el producto evolucione, podrán incorporarse nuevos espacios, siempre que respondan a una necesidad real del usuario y respeten los principios establecidos.

Toda nueva sección deberá responder afirmativamente las siguientes preguntas:

- ¿Ayuda al usuario a tomar una mejor decisión?
- ¿Reduce esfuerzo en lugar de aumentarlo?
- ¿Evita duplicar información existente?
- ¿Puede integrarse naturalmente con el resto del producto?

Si la respuesta a alguna de estas preguntas es negativa, la incorporación deberá ser reconsiderada.

La arquitectura deberá crecer mediante simplificación.

Nunca mediante acumulación.

---

## Lo que deliberadamente no existe

La arquitectura de PromoAR también se define por aquello que decide no incorporar.

Por ese motivo, el producto evitará crear espacios cuya existencia responda únicamente a necesidades técnicas o comerciales.

Entre ellos:

- Secciones dedicadas exclusivamente a bancos.
- Secciones dedicadas exclusivamente a tarjetas.
- Pantallas separadas para cada tipo de promoción.
- Catálogos organizados según la estructura interna de los datos.
- Módulos cuyo único propósito sea aumentar el tiempo de permanencia dentro de la aplicación.

Todos esos elementos podrán existir como información.

No necesariamente como espacios de navegación.

La arquitectura deberá organizarse según las necesidades del usuario.

No según la estructura de la base de datos.

---

## Escalabilidad

La arquitectura fue diseñada para permitir la incorporación de nuevas capacidades sin modificar su estructura conceptual.

Por ejemplo, en el futuro podrán incorporarse:

- Nuevas categorías de consumo.
- Alertas inteligentes.
- Planificación de compras.
- Comparación entre alternativas.
- Historial de decisiones.
- Compras recurrentes.
- Recomendaciones anticipadas.
- Integraciones con nuevos servicios.

Estas funcionalidades deberán integrarse dentro de los espacios existentes siempre que resulte posible.

Crear una nueva sección será siempre la última alternativa.

La mejor arquitectura no es la que posee más módulos.

Es la que necesita menos.

---

## Criterios para futuras decisiones de UX

Este documento no define interfaces.

Sin embargo, establece criterios que deberán orientar todas las decisiones de experiencia de usuario.

Toda pantalla diseñada para PromoAR deberá responder una única pregunta principal.

Toda acción importante deberá encontrarse donde el usuario espera encontrarla.

Toda información secundaria deberá permanecer accesible sin competir con la principal.

La navegación deberá transmitir sensación de continuidad.

Nunca de fragmentación.

Cada interacción deberá acercar al usuario a una decisión.

Nunca alejarlo de ella.

---

## Relación con otros documentos

La arquitectura de información implementa decisiones establecidas en la documentación estratégica del proyecto.

Se encuentra directamente relacionada con:

- `docs/vision/product-vision.md`, que define el propósito general del producto.
- `docs/vision/PRODUCT_PRINCIPLES.md`, especialmente los principios **"La decisión es el producto"**, **"La simplicidad siempre gana"** y **"Recomendar antes que listar"**.
- `docs/product/USER_PERSONAS.md`, que describe quiénes utilizarán el producto.
- `docs/product/USER_JOURNEYS.md`, que explica cómo esas personas recorren la experiencia.
- `docs/adr/ADR-001_PRODUCT_FIRST.md`, donde se establece que la decisión constituye el verdadero producto.
- `docs/adr/ADR-002_ASSISTANT_AND_EXPLORATION.md`, que define la coexistencia entre el Modo Asistente y el Modo Exploración.
- `docs/adr/ADR-006-Recommendation_Engine.md`, cuyo motor de recomendaciones actúa como capacidad transversal de toda la arquitectura.
- `docs/adr/ADR-007-User_Profile.md`, que aporta el contexto necesario para personalizar la experiencia.

---

## Vigencia

Esta arquitectura permanecerá vigente mientras PromoAR mantenga una organización centrada en la toma de decisiones del usuario.

Podrán incorporarse nuevas funcionalidades, categorías o tecnologías sin modificar este documento, siempre que respeten los principios aquí definidos.

Únicamente un cambio en la estructura conceptual del producto justificará una nueva versión de esta arquitectura.

---

## Cierre

Una buena arquitectura pasa desapercibida.

El usuario no debería pensar dónde buscar una función.

Debería encontrarla naturalmente.

No debería preguntarse cómo está organizado el producto.

Debería concentrarse únicamente en resolver su necesidad.

Ese es el verdadero objetivo de la arquitectura de información de PromoAR.

Organizar el conocimiento para que las personas tengan que pensar menos.

Porque cuando la información está bien organizada, decidir deja de ser un problema.

Y ese es, desde el primer día, el propósito de PromoAR.
