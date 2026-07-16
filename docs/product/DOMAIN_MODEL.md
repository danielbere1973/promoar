---
title: Domain Model
subtitle: Modelo conceptual del dominio de PromoAR
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

# Domain Model

> Un buen modelo de dominio describe cómo piensa el negocio, no cómo almacena los datos.

---

## Introducción

Todo producto posee un conjunto de conceptos fundamentales.

Usuarios.

Promociones.

Comercios.

Sucursales.

Medios de pago.

Bancos.

Beneficios.

Restricciones.

Estos conceptos constituyen el dominio de PromoAR.

Este documento define dichos conceptos, sus responsabilidades y las relaciones existentes entre ellos.

No representa un modelo de base de datos.

No constituye un diagrama de clases.

No describe la implementación técnica.

Su propósito consiste en construir un lenguaje común para todas las personas que participan en el desarrollo del producto.

---

## Principios del modelo de dominio

El modelo de dominio deberá respetar los siguientes principios.

### El dominio representa la realidad del negocio

Cada entidad deberá existir porque representa un concepto real.

Nunca porque facilite una implementación técnica.

Si un objeto no posee significado dentro del negocio, probablemente no deba formar parte del dominio.

---

### Las entidades deberán ser independientes

Cada entidad deberá tener identidad propia.

Las promociones no dependen de un usuario.

Los usuarios no dependen de un comercio.

Los comercios no dependen de un banco.

Las relaciones existirán entre entidades.

No dentro de ellas.

---

### El dominio deberá evolucionar

El modelo podrá incorporar nuevos conceptos.

Pero deberá hacerlo preservando la coherencia conceptual.

Agregar entidades será más sencillo que modificar las existentes.

---

## Entidades principales

El dominio de PromoAR se organiza alrededor de un conjunto reducido de entidades fundamentales.

Estas entidades representan los conceptos permanentes del negocio.

Toda nueva funcionalidad deberá construirse reutilizando estas entidades siempre que resulte posible.

---

## Usuario

### Definición

Representa a la persona que utiliza PromoAR para tomar decisiones de consumo.

Constituye el centro de toda la personalización del producto.

---

### Responsabilidades

El Usuario permite representar:

- Identidad.
- Preferencias.
- Medios de pago registrados.
- Bancos asociados.
- Billeteras digitales.
- Comercios favoritos.
- Configuración personal.
- Historial de interacción.

---

### Lo que no representa

El Usuario no almacena promociones.

No almacena recomendaciones.

No contiene lógica de negocio.

Representa únicamente el contexto necesario para personalizar la experiencia.

---

## Comercio

### Definición

Representa una organización que ofrece bienes o servicios.

Puede tratarse de una cadena nacional, un comercio independiente o cualquier establecimiento donde el usuario pueda realizar una compra.

---

### Responsabilidades

El Comercio permite agrupar:

- Sucursales.
- Promociones.
- Categorías.
- Información institucional.
- Servicios ofrecidos.

El Comercio representa la entidad comercial.

No una ubicación física.

---

## Sucursal

### Definición

Representa un punto físico donde un Comercio desarrolla su actividad.

Una misma empresa puede poseer múltiples sucursales.

Cada una podrá presentar características particulares.

---

### Responsabilidades

Una Sucursal podrá contener:

- Dirección.
- Ubicación geográfica.
- Horarios.
- Servicios disponibles.
- Información operativa.

Las promociones podrán aplicar al comercio completo o únicamente a determinadas sucursales.

Por ese motivo, la Sucursal constituye una entidad independiente.

---

## Promoción

### Definición

Representa un beneficio comercial ofrecido bajo determinadas condiciones.

La Promoción constituye la principal fuente de valor analizada por PromoAR.

No pertenece al usuario.

No constituye una recomendación.

Representa una oportunidad potencial que el sistema deberá evaluar según el contexto.

---

### Responsabilidades

Una Promoción podrá definir, entre otros elementos:

- Tipo de beneficio.
- Porcentaje o monto de descuento.
- Reintegro.
- Cuotas.
- Vigencia.
- Días aplicables.
- Horarios.
- Topes.
- Restricciones.
- Comercios participantes.
- Sucursales participantes.
- Medios de pago compatibles.

Cada promoción deberá existir independientemente de quién la utilice.

---

### Lo que no representa

La Promoción no determina automáticamente que una compra sea conveniente.

Representa únicamente una de las variables consideradas por el motor de recomendaciones.

Una promoción excelente puede dejar de ser la mejor alternativa dependiendo del contexto del usuario.

---

## Banco

### Definición

Representa una institución financiera asociada a uno o más medios de pago y programas de beneficios.

---

### Responsabilidades

El Banco permite agrupar:

- Tarjetas.
- Cuentas.
- Beneficios.
- Promociones.
- Programas comerciales.

El Banco no constituye una entidad central para el usuario.

Forma parte del contexto que permite interpretar correctamente las promociones disponibles.

---

## Medio de Pago

### Definición

Representa el instrumento mediante el cual el usuario realiza una compra.

Constituye uno de los elementos más importantes para determinar la aplicabilidad de una promoción.

---

### Responsabilidades

Un Medio de Pago podrá representar:

- Tarjeta de crédito.
- Tarjeta de débito.
- Tarjeta prepaga.
- Billetera digital.
- Transferencia.
- Otros medios compatibles.

Cada medio podrá encontrarse asociado a uno o varios bancos, programas comerciales o promociones.

---

### Lo que no representa

El Medio de Pago no almacena beneficios.

No contiene promociones.

Simplemente representa el mecanismo utilizado para concretar una operación.

---

## Billetera Digital

### Definición

Representa una plataforma utilizada para realizar pagos electrónicos.

Aunque técnicamente pueda funcionar como un medio de pago, dentro del dominio posee identidad propia debido a la importancia que adquiere en el ecosistema de promociones.

---

### Responsabilidades

Una Billetera Digital podrá:

- Participar en promociones.
- Estar asociada a determinados bancos.
- Ofrecer beneficios propios.
- Integrarse con distintos medios de pago.

Su comportamiento podrá evolucionar independientemente del resto del dominio.

---

## Categoría

### Definición

Representa una clasificación funcional utilizada para organizar comercios, promociones y búsquedas.

No describe productos específicos.

Describe grandes áreas de consumo.

---

### Ejemplos

- Supermercados.
- Combustible.
- Gastronomía.
- Farmacias.
- Indumentaria.
- Tecnología.
- Entretenimiento.

---

### Responsabilidades

La Categoría facilita:

- La exploración.
- La búsqueda.
- La organización del contenido.
- La generación de recomendaciones contextualizadas.

No modifica las reglas de negocio.

Únicamente organiza la información.

---

## Recomendación

### Definición

Representa la respuesta generada por PromoAR luego de analizar el contexto del usuario.

Constituye el verdadero producto.

No existe previamente almacenada.

Se construye dinámicamente cada vez que el usuario necesita tomar una decisión.

---

### Responsabilidades

Una Recomendación integra información proveniente de múltiples entidades:

- Usuario.
- Promociones.
- Comercios.
- Sucursales.
- Medios de pago.
- Bancos.
- Ubicación.
- Contexto temporal.

El resultado no consiste en mostrar información.

Consiste en sintetizarla para facilitar una decisión.

---

### Lo que no representa

La Recomendación no constituye una promoción.

No representa una búsqueda.

No equivale a un listado ordenado.

Representa una interpretación contextual realizada por el motor de recomendaciones.

---

## Perfil

### Definición

El Perfil representa la información persistente que permite personalizar la experiencia del usuario.

Mientras el Usuario representa a la persona, el Perfil representa el conocimiento acumulado que PromoAR utiliza para comprender mejor su contexto.

---

### Responsabilidades

El Perfil podrá incluir:

- Preferencias declaradas.
- Preferencias aprendidas.
- Medios de pago registrados.
- Bancos asociados.
- Comercios favoritos.
- Configuración de privacidad.
- Configuración de notificaciones.
- Historial relevante para personalización.

El Perfil deberá evolucionar junto con el usuario.

No permanecer estático.

---

## Contexto

### Definición

El Contexto representa el conjunto de circunstancias que influyen sobre una decisión en un momento determinado.

No constituye una entidad persistente.

Representa información dinámica utilizada durante el proceso de recomendación.

---

### Componentes del contexto

Entre otros factores, el Contexto podrá incluir:

- Ubicación actual.
- Fecha.
- Hora.
- Día de la semana.
- Promociones vigentes.
- Estado del perfil.
- Comercios cercanos.
- Necesidad expresada por el usuario.

El Contexto cambia constantemente.

Por ese motivo, una misma consulta podrá producir recomendaciones diferentes en momentos distintos.

---

## Relaciones entre entidades

El verdadero valor del modelo de dominio no reside únicamente en las entidades individuales.

Reside en la manera en que se relacionan.

Las principales relaciones conceptuales son:

- Un Usuario posee un Perfil.
- Un Usuario registra uno o más Medios de Pago.
- Un Medio de Pago puede encontrarse asociado a un Banco.
- Un Usuario puede utilizar una o más Billeteras Digitales.
- Un Comercio posee una o más Sucursales.
- Un Comercio participa en una o más Promociones.
- Una Promoción puede aplicar a uno o varios Comercios.
- Una Promoción puede limitarse a determinadas Sucursales.
- Una Promoción puede requerir determinados Medios de Pago.
- Una Recomendación utiliza información proveniente de todas las entidades anteriores.
- El Contexto influye sobre la generación de cada Recomendación.

Estas relaciones representan conocimiento del negocio.

No dependencias técnicas.

---

## Entidades derivadas

Además de las entidades principales, el dominio podrá incorporar entidades complementarias cuya responsabilidad sea enriquecer el modelo sin alterar su estructura fundamental.

Entre ellas podrán existir:

- Marca.
- Producto.
- Programa de Beneficios.
- Campaña Comercial.
- Restricción.
- Condición.
- Tope de Reintegro.
- Calendario Comercial.
- Historial de Recomendaciones.
- Favorito.
- Alerta.

Estas entidades deberán surgir únicamente cuando representen conceptos estables del negocio.

No como respuesta a necesidades temporales de implementación.

---

## Lo que deliberadamente no forma parte del dominio

El modelo de dominio describe conceptos del negocio.

No componentes tecnológicos.

Por ese motivo, deliberadamente no incluye:

- APIs externas.
- Proveedores de mapas.
- Motores de búsqueda.
- Algoritmos específicos.
- Bases de datos.
- Cachés.
- Frameworks.
- Servicios de autenticación.
- Infraestructura.
- Interfaces de usuario.

Todos esos elementos pertenecen a la arquitectura técnica.

No al dominio del negocio.

---

## Evolución del modelo

El dominio de PromoAR deberá evolucionar junto con el producto.

Sin embargo, la incorporación de nuevas entidades deberá respetar una regla fundamental.

Cada nueva entidad deberá responder claramente a estas preguntas:

- ¿Representa un concepto real del negocio?
- ¿Posee identidad propia?
- ¿Tiene responsabilidades claramente definidas?
- ¿Aporta claridad al modelo?

Si la respuesta es negativa, probablemente esa información deba formar parte de una entidad existente.

Un modelo de dominio crece incorporando conceptos.

No fragmentando innecesariamente los existentes.

---

## Lenguaje ubicuo

Este documento establece el lenguaje común que deberá utilizar todo el equipo de trabajo.

Los mismos términos deberán emplearse en:

- Documentación.
- Código.
- Diagramas.
- Conversaciones funcionales.
- Diseño de producto.
- Arquitectura.
- Casos de uso.

Por ejemplo:

Siempre hablaremos de **Promoción**.

Nunca de "descuento", "beneficio" o "oferta" cuando el concepto del negocio sea exactamente el mismo.

Siempre hablaremos de **Sucursal**.

Nunca de "local", "punto de venta" o "negocio" si representan la misma entidad.

Compartir un lenguaje reduce errores.

Y también reduce complejidad.

---

## Relación con otros documentos

El modelo de dominio implementa los conceptos definidos en la documentación estratégica de PromoAR.

Se encuentra directamente relacionado con:

- `docs/vision/product-vision.md`, que establece el propósito general del producto.
- `docs/vision/PRODUCT_PRINCIPLES.md`, especialmente el principio **"Cada dato debe trabajar para el usuario"**.
- `docs/product/INFORMATION_ARCHITECTURE.md`, que organiza estos conceptos desde la perspectiva del usuario.
- `docs/product/USER_PERSONAS.md`, que define quién interactúa con el dominio.
- `docs/adr/ADR-005-Search_Strategy.md`, que utiliza las entidades para construir búsquedas relevantes.
- `docs/adr/ADR-006-Recommendation_Engine.md`, donde las entidades del dominio constituyen los insumos del motor de recomendaciones.
- `docs/adr/ADR-007-User_Profile.md`, que desarrolla la evolución del Perfil como entidad central de personalización.

---

## Vigencia

Este modelo de dominio permanecerá vigente mientras PromoAR continúe organizando su producto alrededor de decisiones de consumo.

La incorporación de nuevas funcionalidades deberá enriquecer el dominio sin modificar innecesariamente los conceptos fundamentales definidos en este documento.

Únicamente una redefinición del negocio justificaría una nueva versión del modelo.

---

## Cierre

El dominio constituye el lenguaje del producto.

Antes de escribir una línea de código.

Antes de diseñar una pantalla.

Antes de construir una API.

Es necesario comprender cuáles son los conceptos que realmente existen.

Cuando el dominio es claro, la arquitectura resulta más simple.

El desarrollo se vuelve más consistente.

Y las decisiones de producto pueden mantenerse coherentes a medida que PromoAR evoluciona.

Porque la tecnología cambiará.

El lenguaje del negocio deberá permanecer estable.
