---
title: Data Strategy
subtitle: Filosofía y estrategia de gestión de datos de PromoAR
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

# Data Strategy

> PromoAR no recopila datos porque puede. Recopila únicamente aquellos datos que ayudan al usuario a tomar mejores decisiones.

---

## Introducción

Los datos representan uno de los activos más importantes de PromoAR.

Sin embargo, su valor no depende de la cantidad.

Depende de su capacidad para mejorar una decisión.

Este documento define la filosofía que guiará la incorporación, utilización y evolución de los datos dentro del producto.

No describe tecnologías.

No define bases de datos.

No establece mecanismos de almacenamiento.

Su propósito consiste en responder una pregunta mucho más importante.

**¿Qué significa un dato para PromoAR?**

---

## Filosofía

PromoAR no construye una base de datos.

Construye conocimiento útil.

Cada dato incorporado al producto deberá justificar claramente el valor que aporta.

Si un dato no mejora una recomendación, una búsqueda, una explicación o la experiencia del usuario, probablemente no deba existir.

El objetivo nunca será almacenar más información.

Será comprender mejor el contexto de cada decisión.

---

## Qué representa un dato

Dentro de PromoAR, un dato representa una pieza de conocimiento que ayuda a interpretar una situación.

No todos los datos poseen el mismo valor.

Un dato aislado rara vez resulta útil.

Su verdadero significado aparece cuando puede relacionarse con otros datos dentro de un contexto determinado.

Por ese motivo, PromoAR prioriza las relaciones entre datos por encima de su volumen.

---

## Principios de la estrategia de datos

Toda incorporación de información al producto deberá respetar los siguientes principios.

### Cada dato debe tener un propósito

Todo dato almacenado deberá responder una pregunta concreta.

Por ejemplo:

- ¿Mejora una recomendación?
- ¿Facilita una búsqueda?
- ¿Reduce el esfuerzo del usuario?
- ¿Permite explicar una decisión?
- ¿Personaliza la experiencia de forma útil?

Si ninguna de estas respuestas es afirmativa, el dato probablemente no deba conservarse.

---

### La calidad vale más que la cantidad

Agregar información incorrecta resulta más perjudicial que no tener información.

Por ese motivo, PromoAR priorizará siempre:

- Exactitud.
- Consistencia.
- Actualización.
- Verificabilidad.

Antes que:

- Volumen.
- Cobertura artificial.
- Complejidad innecesaria.

La confianza del usuario depende directamente de la calidad de los datos utilizados.

---

### Los datos trabajan para el usuario

Los datos no representan un activo comercial independiente.

Representan una herramienta para ayudar al usuario.

Toda estrategia de recopilación deberá responder al interés del usuario antes que al interés de la empresa.

La existencia de un dato nunca justificará su utilización.

Su utilidad deberá demostrarse.

---

### El contexto transforma el significado

Un mismo dato puede producir resultados completamente diferentes según el contexto.

Por ejemplo:

Una promoción vigente posee un valor distinto según:

- La ubicación.
- La fecha.
- El horario.
- El medio de pago.
- El comercio.
- Las preferencias del usuario.

Los datos no deberán interpretarse de forma aislada.

Su significado surge de la relación con el contexto.

---

### Menos datos, mejores decisiones

Existe una tendencia natural a almacenar información "por si algún día resulta útil".

PromoAR evitará esa práctica.

Los datos innecesarios generan:

- Mayor complejidad.
- Más mantenimiento.
- Riesgos de privacidad.
- Mayor costo operativo.
- Mayor dificultad para interpretar resultados.

Eliminar información sin valor también representa una mejora del producto.

---

## Categorías de datos

Aunque técnicamente puedan almacenarse de múltiples maneras, conceptualmente los datos de PromoAR pueden agruparse en diferentes categorías.

### Datos del dominio

Representan los conceptos fundamentales del negocio.

Por ejemplo:

- Comercios.
- Sucursales.
- Promociones.
- Bancos.
- Medios de pago.
- Categorías.

Estos datos constituyen la base del conocimiento del producto.

---

### Datos del usuario

Representan el contexto personal utilizado para adaptar la experiencia.

Por ejemplo:

- Perfil.
- Preferencias.
- Medios de pago registrados.
- Comercios favoritos.
- Configuración personal.

Estos datos existen exclusivamente para beneficiar al usuario.

No para definir perfiles comerciales.

---

### Datos contextuales

Representan información dinámica que cambia constantemente.

Por ejemplo:

- Ubicación.
- Fecha.
- Hora.
- Día de la semana.
- Promociones vigentes.
- Disponibilidad de comercios.

Estos datos permiten interpretar correctamente cada situación.

No necesariamente requieren almacenamiento permanente.

---

### Datos derivados

No todos los datos son ingresados directamente.

Algunos representan conocimiento generado por el propio sistema.

Por ejemplo:

- Recomendaciones.
- Priorizaciones.
- Preferencias inferidas.
- Patrones de uso.
- Explicaciones generadas.

Estos datos deberán poder reconstruirse a partir de información verificable.

Nunca constituir la única fuente de verdad.

---

## La información como conocimiento

PromoAR no busca responder preguntas mediante grandes cantidades de datos.

Busca responderlas utilizando la información adecuada.

El objetivo nunca será construir el mayor repositorio de promociones.

Será construir el conocimiento suficiente para ayudar a una persona a decidir mejor.

Ese principio deberá orientar cualquier decisión relacionada con los datos del producto.

---

## Ciclo de vida del dato

Todo dato dentro de PromoAR atraviesa un ciclo de vida.

Su valor no depende únicamente de existir.

Depende de mantenerse útil.

La estrategia de datos deberá contemplar todas las etapas de ese recorrido.

Desde su incorporación hasta su eventual eliminación.

---

## Origen de los datos

Los datos podrán provenir de múltiples fuentes.

Cada una deberá evaluarse según su confiabilidad y utilidad.

Entre ellas:

- Información proporcionada por el usuario.
- Información publicada por comercios.
- Información publicada por bancos.
- Información publicada por billeteras digitales.
- Información obtenida mediante integraciones.
- Información pública verificable.
- Información derivada del propio funcionamiento del producto.

El origen de un dato deberá ser siempre identificable.

La trazabilidad constituye un requisito de calidad.

---

## Verificación

La incorporación de un dato no implica asumir que sea correcto.

Todo dato relevante deberá poder verificarse.

La estrategia priorizará fuentes que ofrezcan:

- Consistencia.
- Actualización.
- Estabilidad.
- Transparencia.

Cuando existan discrepancias entre distintas fuentes, PromoAR deberá privilegiar aquella que ofrezca mayor confiabilidad para el usuario.

La precisión constituye un requisito del producto.

No una optimización técnica.

---

## Actualización

Los datos pierden valor cuando dejan de representar la realidad.

Una promoción vencida.

Un comercio cerrado.

Un horario incorrecto.

Una sucursal inexistente.

Todos ellos deterioran la confianza del usuario.

Por ese motivo, la estrategia de datos deberá contemplar mecanismos que permitan mantener la información vigente.

La actualización no deberá perseguir únicamente velocidad.

Deberá perseguir precisión.

---

## Obsolescencia

No toda información merece conservarse indefinidamente.

Existen datos cuyo valor desaparece con el tiempo.

Por ejemplo:

- Promociones vencidas.
- Campañas finalizadas.
- Restricciones temporales.
- Eventos excepcionales.

La estrategia deberá definir cuándo un dato deja de aportar valor.

Eliminar información obsoleta también representa una forma de mantener la calidad del producto.

---

## Datos del usuario

Los datos personales representan un caso particular.

Su existencia deberá justificarse exclusivamente por el beneficio que generan para el usuario.

PromoAR evitará recopilar información personal cuya única utilidad sea futura o hipotética.

Cada dato solicitado deberá responder claramente a la pregunta:

**¿Cómo mejora la experiencia del usuario?**

Si la respuesta no resulta evidente, ese dato probablemente no deba solicitarse.

---

## Personalización responsable

La personalización constituye uno de los principales beneficios derivados del uso de datos.

Sin embargo, deberá aplicarse con responsabilidad.

La información del usuario deberá utilizarse para:

- Reducir esfuerzo.
- Priorizar alternativas.
- Mejorar recomendaciones.
- Adaptar explicaciones.
- Facilitar decisiones.

Nunca para limitar artificialmente las opciones disponibles.

La personalización deberá ampliar posibilidades.

No restringirlas.

---

## Privacidad por diseño

La privacidad no representa una funcionalidad adicional.

Forma parte de la estrategia de datos.

Toda nueva funcionalidad deberá considerar desde su diseño:

- Qué información necesita.
- Durante cuánto tiempo.
- Con qué propósito.
- Quién puede acceder.
- Cómo puede eliminarse.

La estrategia de datos deberá minimizar la recopilación de información sin comprometer la calidad de la experiencia.

---

## Gobierno del dato

Todo dato deberá poseer un responsable conceptual.

Aunque técnicamente pueda encontrarse distribuido entre distintos servicios, siempre deberá existir claridad respecto de:

- Qué representa.
- Quién lo mantiene.
- Cómo se actualiza.
- Cuándo deja de ser válido.
- Cómo impacta en otras partes del producto.

El gobierno del dato no busca aumentar burocracia.

Busca preservar coherencia.

---

## Coherencia entre los datos

Los datos de PromoAR forman un único ecosistema.

No deberán evolucionar de manera aislada.

Una modificación en una entidad podrá afectar:

- Recomendaciones.
- Búsquedas.
- Perfil del usuario.
- Notificaciones.
- Explicaciones.

Por ese motivo, toda evolución del modelo deberá considerar el impacto sobre el conjunto del producto.

La consistencia representa una propiedad del sistema completo.

No únicamente de cada dato individual.

---

## El dato como infraestructura invisible

El usuario no utiliza PromoAR para consultar bases de datos.

Utiliza PromoAR para resolver decisiones.

Los datos constituyen la infraestructura invisible que permite que esa experiencia exista.

Cuando la estrategia de datos funciona correctamente, el usuario no la percibe.

Simplemente recibe respuestas más útiles, más precisas y más confiables.

Ese es el verdadero objetivo de la gestión de datos dentro de PromoAR.

---

## Evolución de la estrategia de datos

La estrategia de datos deberá evolucionar junto con PromoAR.

Sin embargo, esa evolución no consistirá en recopilar cada vez más información.

Consistirá en comprender mejor qué información aporta valor y cuál genera complejidad innecesaria.

Cada nueva fuente de datos deberá justificar claramente su incorporación.

El crecimiento del conocimiento no depende del volumen de información.

Depende de la calidad de las relaciones que pueden establecerse entre los datos existentes.

---

## Escalabilidad

El crecimiento del producto implicará incorporar:

- Nuevos comercios.
- Nuevas promociones.
- Nuevos bancos.
- Nuevas billeteras digitales.
- Nuevas categorías.
- Nuevas regiones geográficas.
- Nuevos perfiles de usuario.

La estrategia de datos deberá permitir esa expansión sin modificar los principios fundamentales definidos en este documento.

La escalabilidad no consiste únicamente en soportar más información.

Consiste en mantener la misma claridad a medida que el conocimiento aumenta.

---

## Relación con la Inteligencia Artificial

La Inteligencia Artificial no reemplaza la estrategia de datos.

Depende de ella.

La calidad de cualquier recomendación estará directamente condicionada por:

- La calidad de los datos.
- Su actualización.
- Su consistencia.
- Su contexto.
- Su trazabilidad.

La IA interpreta.

Los datos representan la realidad sobre la cual interpreta.

Por ese motivo, mejorar los datos suele producir un mayor impacto que incorporar modelos más complejos.

La estrategia de datos constituye el fundamento sobre el cual se construye la inteligencia del producto.

---

## Relación con el modelo de dominio

Los datos no existen de forma aislada.

Representan las entidades definidas en el Modelo de Dominio.

Usuario.

Perfil.

Comercio.

Sucursal.

Promoción.

Banco.

Medio de Pago.

Categoría.

Recomendación.

Contexto.

La estrategia de datos deberá preservar el significado de cada una de estas entidades.

Nunca modificarlo para adaptarse a limitaciones técnicas.

El dominio define qué representa un dato.

La estrategia define cómo ese dato genera valor.

---

## Datos y confianza

La confianza del usuario constituye una consecuencia directa de la calidad de los datos.

Una única recomendación basada en información incorrecta puede deteriorar la credibilidad construida durante meses.

Por ese motivo, PromoAR priorizará:

- Exactitud antes que cobertura.
- Consistencia antes que velocidad.
- Transparencia antes que complejidad.
- Calidad antes que volumen.

La estrategia de datos no busca acumular información.

Busca construir confianza.

---

## Relación con otros documentos

La estrategia de datos implementa principios definidos en toda la documentación estratégica de PromoAR.

Se encuentra directamente relacionada con:

- `docs/vision/product-vision.md`, que establece que el propósito del producto consiste en ayudar a tomar mejores decisiones.
- `docs/vision/PRODUCT_PRINCIPLES.md`, especialmente el principio **"Cada dato debe trabajar para el usuario"**.
- `docs/product/DOMAIN_MODEL.md`, que define las entidades sobre las cuales se organiza el conocimiento.
- `docs/product/AI_STRATEGY.md`, que establece cómo la Inteligencia Artificial interpreta esos datos.
- `docs/adr/ADR-003-Data_Location_Strategy.md`, que describe el origen y la localización conceptual de la información.
- `docs/adr/ADR-006-Recommendation_Engine.md`, donde los datos constituyen el insumo principal del motor de recomendaciones.
- `docs/adr/ADR-007-User_Profile.md`, que desarrolla la utilización responsable de los datos del usuario.
- `docs/business/Business_Strategy.md`, que garantiza que los datos se utilicen para crear valor para el usuario y no como un producto comercial independiente.

---

## Vigencia

Esta estrategia permanecerá vigente mientras PromoAR continúe considerando a los datos como un medio para mejorar decisiones y no como un fin en sí mismo.

Podrán cambiar las tecnologías de almacenamiento.

Podrán incorporarse nuevas fuentes.

Podrán evolucionar los mecanismos de procesamiento.

Lo que no debería modificarse es el principio fundamental que guía toda la estrategia.

Cada dato deberá existir porque mejora la experiencia del usuario.

No simplemente porque resulta posible almacenarlo.

---

## Cierre

Toda empresa tecnológica utiliza datos.

La diferencia entre ellas no reside en cuánto almacenan.

Reside en para qué los utilizan.

PromoAR no busca construir el repositorio más grande.

Busca construir el conocimiento más útil.

Cada dato deberá responder a un propósito.

Cada relación deberá aportar comprensión.

Cada recomendación deberá surgir de información confiable.

Porque los datos, por sí solos, no generan valor.

El valor aparece cuando permiten que una persona tome una mejor decisión.

Ese es, desde el primer día, el verdadero propósito de la estrategia de datos de PromoAR.
