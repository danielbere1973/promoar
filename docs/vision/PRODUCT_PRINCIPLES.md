---
title: Product Principles
subtitle: Reglas para diseñar y desarrollar PromoAR
version: 1.0
status: Approved
owner: Dani
authors:
  - Dani (Founder)
  - ChatGPT (Chief Product Officer)
technical_review:
  - Claude
last_updated: 2026-07-15
---

# PRODUCT PRINCIPLES

> Este documento traduce la visión de PromoAR en criterios concretos para construir el producto.

No explica por qué existe PromoAR.

Explica cómo deben tomarse las decisiones cuando existen varias alternativas posibles.

Cada nueva funcionalidad, pantalla, algoritmo o integración debería poder justificarse utilizando estos principios.

Cuando exista una duda de diseño, experiencia de usuario o arquitectura funcional, este documento prevalece sobre preferencias personales.

---

## Índice

1. [Cómo utilizar este documento](#cómo-utilizar-este-documento)
2. [Principio 1 — La decisión es el producto](#principio-1)
3. [Principio 2 — La simplicidad siempre gana](#principio-2)
4. [Principio 3 — Recomendar antes que listar](#principio-3)
5. [Principio 4 — Explorar seguirá siendo un derecho del usuario](#principio-4)
6. [Principio 5 — La confianza vale más que cualquier funcionalidad](#principio-5)
7. [Principio 6 — Todos los comercios merecen competir](#principio-6)
8. [Principio 7 — El contexto cambia la respuesta correcta](#principio-7)
9. [Principio 8 — Ahorrar debe convertirse en un hábito](#principio-8)
10. [Principio 9 — Cada dato debe trabajar para el usuario](#principio-9)
11. [Principio 10 — PromoAR nunca estará terminado](#principio-10)
12. [Aplicación de los principios](#aplicación-de-los-principios)
13. [Una regla para todo el equipo](#una-regla-para-todo-el-equipo)
14. [Cierre](#cierre)

---

## Cómo utilizar este documento

Cada principio responde cinco preguntas:

- ¿Qué significa?
- ¿Por qué existe?
- ¿Cómo impacta en la experiencia del usuario?
- ¿Cómo impacta en el desarrollo del producto?
- ¿Qué decisiones representa?

Los principios no son independientes.

Forman un único sistema.

En ocasiones podrán entrar en tensión entre sí.

Cuando eso ocurra, deberá privilegiarse siempre aquello que ayude al usuario a tomar una mejor decisión.

---

<a id="principio-1"></a>

# Principio 1
## La decisión es el producto

### Qué significa

PromoAR no existe para mostrar promociones.

Existe para ayudar a las personas a decidir mejor antes de realizar una compra.

Las promociones, los bancos, las tarjetas, las categorías y los comercios son únicamente información necesaria para producir una recomendación.

El verdadero producto es la decisión.

---

### Por qué existe

Las personas no quieren consumir información.

Quieren resolver un problema.

Cuando un usuario abre PromoAR generalmente ya tiene una intención.

Quiere cargar combustible.

Quiere comprar alimentos.

Quiere salir a comer.

Quiere comprar un electrodoméstico.

Quiere saber qué le conviene hacer.

Mientras más rápido llegue a esa respuesta, mayor será el valor entregado por el producto.

---

### Impacto en UX

Cada pantalla debe acercar al usuario a una decisión.

Toda interacción innecesaria aumenta el costo cognitivo.

Si una pantalla requiere demasiadas acciones antes de llegar a una recomendación, probablemente esté fallando.

La cantidad de información nunca debe anteponerse a la claridad.

---

### Impacto en el desarrollo

Antes de implementar cualquier funcionalidad el equipo debería preguntarse:

> ¿Esto ayuda al usuario a decidir mejor?

Si la respuesta es negativa, la funcionalidad debe ser reconsiderada.

---

### Decisiones correctas

✅ Recomendar automáticamente la mejor promoción según el contexto.

✅ Reducir la cantidad de pasos necesarios para llegar a una respuesta.

✅ Priorizar información relevante.

---

### Decisiones incorrectas

❌ Mostrar cientos de promociones sin ningún criterio.

❌ Agregar pantallas únicamente porque existe información disponible.

❌ Medir el éxito por cantidad de promociones visualizadas.

---

<a id="principio-2"></a>

# Principio 2
## La simplicidad siempre gana

### Qué significa

La simplicidad no implica ofrecer menos funcionalidades.

Implica reducir el esfuerzo necesario para utilizarlas.

Una funcionalidad poderosa puede seguir siendo simple si su comportamiento resulta evidente para el usuario.

---

### Por qué existe

El usuario consulta PromoAR generalmente mientras realiza otra actividad.

Está caminando.

Está dentro de un supermercado.

Está por pagar.

Está cargando combustible.

No dispone de tiempo para estudiar una interfaz compleja.

Cada segundo adicional disminuye el valor del producto.

---

### Impacto en UX

La interfaz debe minimizar la cantidad de decisiones innecesarias.

Los textos deben ser claros.

Las acciones deben resultar obvias.

Los flujos deben ser cortos.

El usuario nunca debería preguntarse cuál es el siguiente paso.

---

### Impacto en el desarrollo

Cuando existan dos soluciones técnicamente equivalentes, deberá priorizarse aquella que produzca una experiencia más simple.

La complejidad técnica pertenece al sistema.

Nunca al usuario.

---

### Decisiones correctas

✅ Un botón con una acción clara.

✅ Recomendaciones fáciles de interpretar.

✅ Información organizada según prioridad.

---

### Decisiones incorrectas

❌ Interfaces sobrecargadas.

❌ Exceso de filtros visibles.

❌ Configuraciones obligatorias para comenzar a utilizar la aplicación.

---

<a id="principio-3"></a>

# Principio 3
## Recomendar antes que listar

### Qué significa

La primera responsabilidad de PromoAR es ayudar al usuario a encontrar la mejor alternativa disponible según su contexto.

Mostrar un listado completo de promociones sigue siendo una funcionalidad valiosa, pero nunca debe convertirse en la experiencia principal.

El usuario debe sentir que PromoAR entiende lo que necesita antes de pedirle que analice cientos de opciones.

---

### Por qué existe

La sobrecarga de información produce el efecto contrario al esperado.

Cuantas más alternativas aparecen sin contexto, más difícil resulta decidir.

Las promociones son datos.

La recomendación es el valor.

---

### Impacto en UX

La pantalla inicial debe priorizar respuestas antes que listados.

Cuando exista suficiente contexto, PromoAR debería responder primero y explicar después.

El usuario siempre podrá acceder al detalle completo, pero no debería verse obligado a recorrerlo para descubrir la mejor opción.

---

### Impacto en el desarrollo

Las nuevas funcionalidades deberán privilegiar motores de recomendación antes que nuevas formas de visualización.

Cuando exista información suficiente para construir una recomendación personalizada, el sistema deberá utilizarla.

La exploración seguirá existiendo, pero será una decisión del usuario, no una obligación impuesta por la interfaz.

---

### Decisiones correctas

✅ Mostrar primero la mejor alternativa disponible.

✅ Explicar por qué esa recomendación fue elegida.

✅ Permitir explorar otras opciones si el usuario lo desea.

---

### Decisiones incorrectas

❌ Mostrar un listado de cientos de promociones sin ningún criterio.

❌ Obligar al usuario a aplicar múltiples filtros antes de obtener una respuesta.

❌ Priorizar cantidad de información sobre calidad de la recomendación.

---

<a id="principio-4"></a>

# Principio 4
## Explorar seguirá siendo un derecho del usuario

### Qué significa

La recomendación nunca debe reemplazar la libertad de explorar.

PromoAR ofrecerá una respuesta inteligente, pero el usuario conservará siempre la posibilidad de recorrer todas las promociones, comparar alternativas y tomar una decisión diferente.

La inteligencia artificial simplifica la decisión.

No limita las opciones.

---

### Por qué existe

Cada usuario posee criterios propios.

Algunas personas priorizan el mayor descuento.

Otras prefieren un comercio específico.

Algunas valoran la cercanía.

Otras acumulan millas, puntos o beneficios adicionales.

Ningún algoritmo puede conocer todas las motivaciones humanas.

Por ese motivo, el producto debe combinar asistencia con libertad.

---

### Impacto en UX

La navegación libre nunca desaparecerá.

Las recomendaciones deberán convivir naturalmente con herramientas de búsqueda, filtros y exploración.

El usuario nunca debe sentir que el sistema le impone una única respuesta.

---

### Impacto en el desarrollo

Toda funcionalidad basada en recomendaciones deberá mantener mecanismos que permitan acceder al conjunto completo de promociones disponibles.

La evolución del asistente nunca deberá eliminar capacidades existentes de exploración.

---

### Decisiones correctas

✅ Recomendar una opción y permitir ver las demás.

✅ Explicar claramente por qué una alternativa fue sugerida.

✅ Mantener disponibles filtros, búsquedas y navegación libre.

---

### Decisiones incorrectas

❌ Ocultar promociones únicamente porque el algoritmo considera mejores otras alternativas.

❌ Eliminar funcionalidades de exploración para simplificar la interfaz.

❌ Impedir que el usuario cuestione o compare una recomendación.

---

<a id="principio-5"></a>

# Principio 5
## La confianza vale más que cualquier funcionalidad

### Qué significa

La confianza constituye el activo más importante de PromoAR.

Una recomendación incorrecta puede generar frustración.

Una recomendación manipulada destruye la credibilidad del producto.

Toda decisión de diseño, negocio o desarrollo debe proteger la confianza del usuario.

---

### Por qué existe

Las personas utilizarán PromoAR para decidir cómo gastar su dinero.

Eso implica una responsabilidad.

Cada recomendación transmite implícitamente que el sistema realizó un análisis objetivo.

Si el usuario percibe que las recomendaciones responden a intereses ajenos, dejará de confiar en el producto.

Y sin confianza, PromoAR pierde su razón de existir.

---

### Impacto en UX

El usuario debe comprender por qué recibe una recomendación.

Siempre que resulte posible, el sistema deberá explicar los factores considerados para llegar a una conclusión.

La transparencia genera confianza.

---

### Impacto en el desarrollo

Los algoritmos deberán priorizar el beneficio del usuario por encima de cualquier interés comercial.

Las integraciones con terceros nunca deberán alterar artificialmente el orden o la calidad de las recomendaciones.

Cuando exista incertidumbre o información insuficiente, el sistema deberá reconocer sus limitaciones en lugar de ofrecer respuestas engañosas.

---

### Decisiones correctas

✅ Explicar los criterios utilizados para recomendar una promoción.

✅ Priorizar siempre el beneficio del usuario.

✅ Ser transparente cuando falte información.

---

### Decisiones incorrectas

❌ Alterar recomendaciones por acuerdos comerciales.

❌ Ocultar información relevante para favorecer un resultado.

❌ Presentar una recomendación como objetiva cuando responde a intereses externos.

---

<a id="principio-6"></a>

# Principio 6
## Todos los comercios merecen competir

### Qué significa

PromoAR no favorecerá a un comercio por su tamaño, reconocimiento de marca o capacidad de inversión.

Las recomendaciones deberán construirse sobre la calidad de la información disponible, el contexto del usuario y el valor real que cada promoción aporta.

Nuestro objetivo es que un comercio independiente pueda competir en igualdad de condiciones con una gran cadena cuando ofrece una mejor alternativa para ese usuario.

---

### Por qué existe

La utilidad de PromoAR depende de representar correctamente la realidad del mercado.

Si el producto sólo recomienda grandes cadenas porque son las únicas con información disponible o mayor presencia digital, dejará de reflejar las mejores oportunidades para el usuario.

La diversidad comercial es un activo del producto.

La equidad fortalece la confianza.

---

### Impacto en UX

El usuario debe percibir que las recomendaciones responden al valor de la promoción y no a la notoriedad de una marca.

Las recomendaciones podrán incluir tanto grandes cadenas como pequeños comercios siempre que cumplan mejor con las necesidades del usuario.

---

### Impacto en el desarrollo

Las fuentes de información deberán diseñarse para maximizar la cobertura del ecosistema comercial.

Las reglas de recomendación nunca deberán incorporar ventajas artificiales basadas en el tamaño del comercio.

Cuando existan limitaciones de datos, deberán identificarse como un problema de cobertura y no resolverse mediante sesgos deliberados.

---

### Decisiones correctas

✅ Recomendar un comercio independiente cuando ofrece la mejor alternativa.

✅ Ampliar continuamente la cobertura de comercios disponibles.

✅ Priorizar calidad de información antes que notoriedad de marca.

---

### Decisiones incorrectas

❌ Favorecer automáticamente cadenas nacionales.

❌ Utilizar el tamaño del comercio como criterio de recomendación.

❌ Ignorar pequeños comercios por limitaciones evitables de datos.

---

<a id="principio-7"></a>

# Principio 7
## El contexto cambia la respuesta correcta

### Qué significa

No existe una única mejor promoción.

Existe una mejor promoción para un usuario determinado, en un momento determinado y bajo determinadas condiciones.

La recomendación siempre será contextual.

---

### Por qué existe

Una promoción excelente para una persona puede resultar irrelevante para otra.

La ubicación, los medios de pago disponibles, los hábitos de consumo, las preferencias personales, el momento del día y numerosos factores adicionales modifican cuál es realmente la mejor decisión.

Por ese motivo, PromoAR no puede limitarse a ordenar promociones.

Debe interpretar contexto.

---

### Impacto en UX

La aplicación debe realizar cada vez menos preguntas y utilizar cada vez mejor el contexto disponible.

Las recomendaciones deben sentirse personales sin resultar invasivas.

Cuando una recomendación cambie debido a un nuevo contexto, el usuario debe poder comprender fácilmente el motivo.

---

### Impacto en el desarrollo

El contexto debe convertirse en una capacidad transversal del producto.

Cada nueva funcionalidad debería preguntarse qué información contextual puede utilizar para mejorar la calidad de sus recomendaciones.

La incorporación de nuevas variables deberá perseguir siempre un beneficio claro para el usuario.

---

### Decisiones correctas

✅ Considerar ubicación, perfil financiero y preferencias personales.

✅ Adaptar recomendaciones según el momento y la situación.

✅ Explicar cuando un cambio de contexto modifica la respuesta.

---

### Decisiones incorrectas

❌ Mostrar la misma recomendación para todos los usuarios.

❌ Ignorar información contextual ya disponible.

❌ Incorporar datos que no mejoran la calidad de la recomendación.

---

<a id="principio-8"></a>

# Principio 8
## Ahorrar debe convertirse en un hábito

### Qué significa

PromoAR no busca resolver una compra aislada.

Busca acompañar miles de decisiones cotidianas.

El verdadero éxito del producto llegará cuando consultar PromoAR antes de comprar se convierta en un comportamiento natural para sus usuarios.

---

### Por qué existe

Las promociones generan mayor valor cuando forman parte de una rutina.

El ahorro sostenido no depende de encontrar ocasionalmente una buena oportunidad.

Depende de tomar mejores decisiones una y otra vez.

PromoAR debe facilitar ese hábito.

---

### Impacto en UX

La aplicación debe reducir la fricción al máximo.

Consultar una recomendación debe requerir apenas unos segundos.

Las experiencias repetitivas deben simplificarse progresivamente gracias al aprendizaje del sistema.

---

### Impacto en el desarrollo

Las funcionalidades deberán priorizar la frecuencia de uso antes que la espectacularidad.

Pequeñas mejoras utilizadas todos los días generan más valor que grandes funciones utilizadas ocasionalmente.

El producto deberá evolucionar para integrarse naturalmente en la rutina diaria del usuario.

---

### Decisiones correctas

✅ Reducir el tiempo necesario para obtener una recomendación.

✅ Aprender de las preferencias del usuario para simplificar futuras consultas.

✅ Favorecer experiencias rápidas y repetibles.

---

### Decisiones incorrectas

❌ Diseñar procesos largos para consultas habituales.

❌ Obligar al usuario a reconfigurar información ya conocida.

❌ Priorizar funcionalidades llamativas sobre utilidad cotidiana.

---

<a id="principio-9"></a>

# Principio 9
## Cada dato debe trabajar para el usuario

### Qué significa

Los datos constituyen uno de los principales activos de PromoAR.

Sin embargo, acumular información por sí sola no genera valor.

Cada dato incorporado al producto debe contribuir de forma concreta a mejorar una recomendación, simplificar una decisión o enriquecer la experiencia del usuario.

Si un dato no cumple alguno de esos objetivos, su incorporación debe ser cuestionada.

---

### Por qué existe

Es natural que un producto basado en información tienda a acumular cada vez más datos.

Sin una disciplina clara, esa acumulación incrementa la complejidad, dificulta el mantenimiento y puede deteriorar la experiencia del usuario.

PromoAR debe priorizar siempre la utilidad por encima de la cantidad.

La calidad de los datos es más importante que su volumen.

---

### Impacto en UX

El usuario nunca debería percibir que la aplicación solicita información innecesaria.

Cada permiso solicitado, cada dato requerido y cada configuración adicional deben tener un beneficio evidente.

Cuando el sistema utilice información del usuario para mejorar una recomendación, ese beneficio debe resultar perceptible.

---

### Impacto en el desarrollo

Antes de incorporar una nueva fuente de información, el equipo deberá responder una pregunta fundamental:

> ¿Qué mejora concreta obtiene el usuario gracias a este dato?

Si esa respuesta no puede justificarse claramente, probablemente el dato no deba formar parte del producto.

Los modelos de datos deberán diseñarse pensando en la evolución futura, evitando almacenar información cuyo único propósito sea "por si algún día resulta útil".

---

### Decisiones correctas

✅ Incorporar información que mejore la precisión de las recomendaciones.

✅ Eliminar datos que dejaron de aportar valor.

✅ Priorizar calidad, consistencia y actualización antes que cantidad.

---

### Decisiones incorrectas

❌ Solicitar permisos sin un beneficio claro.

❌ Almacenar información únicamente porque está disponible.

❌ Incrementar la complejidad del producto sin mejorar la experiencia del usuario.

---

<a id="principio-10"></a>

# Principio 10
## PromoAR nunca estará terminado

### Qué significa

PromoAR debe entenderse como un producto en evolución permanente.

Cada nueva funcionalidad representa una oportunidad para aprender.

Cada interacción con los usuarios constituye información valiosa para mejorar el producto.

No existe una versión definitiva.

Existe una mejora continua guiada por evidencia.

---

### Por qué existe

Los hábitos de consumo cambian.

Las promociones cambian.

Las entidades financieras cambian.

La tecnología cambia.

Los usuarios cambian.

Pretender construir un producto terminado implicaría dejar de adaptarse a un entorno que evoluciona constantemente.

La capacidad de aprender será siempre una ventaja competitiva.

---

### Impacto en UX

La experiencia del usuario deberá evolucionar de manera incremental.

Las mejoras deberán introducirse procurando mantener la familiaridad de la interfaz.

Cada cambio deberá responder a un beneficio concreto y medible.

El usuario nunca debe sentir que aprende nuevamente a utilizar PromoAR después de una actualización.

---

### Impacto en el desarrollo

Las decisiones de arquitectura deberán favorecer la evolución del producto.

Los sistemas deberán diseñarse para admitir nuevas capacidades sin necesidad de reconstruir permanentemente la plataforma.

La experimentación deberá realizarse de forma responsable, validando hipótesis mediante evidencia antes de consolidar cambios permanentes.

---

### Decisiones correctas

✅ Medir el impacto real de las nuevas funcionalidades.

✅ Aprender del comportamiento de los usuarios.

✅ Mejorar continuamente sin perder coherencia.

---

### Decisiones incorrectas

❌ Considerar que una funcionalidad ya no necesita evolucionar.

❌ Incorporar cambios únicamente por seguir tendencias.

❌ Priorizar velocidad de desarrollo sobre calidad del producto.

---

## Aplicación de los principios

Este documento no pretende reemplazar el criterio profesional del equipo.

Su propósito es proporcionar un marco común para tomar decisiones consistentes a medida que PromoAR evolucione.

Cuando existan varias alternativas técnicamente válidas, deberá elegirse aquella que mejor represente estos principios.

Si una decisión entra en conflicto con alguno de ellos, el conflicto deberá hacerse explícito y justificarse.

La coherencia del producto no depende únicamente de la calidad del código.

Depende, sobre todo, de la calidad de las decisiones que se toman durante su construcción.

---

## Una regla para todo el equipo

Antes de diseñar una pantalla, desarrollar una funcionalidad o incorporar una nueva fuente de información, todo miembro del proyecto debería poder responder afirmativamente estas preguntas:

- ¿Ayuda al usuario a tomar una mejor decisión?
- ¿Reduce el esfuerzo necesario para utilizar PromoAR?
- ¿Aumenta la confianza en el producto?
- ¿Respeta la libertad del usuario para decidir?
- ¿Genera valor real utilizando los datos disponibles?
- ¿Contribuye a la evolución coherente del producto?

Si la mayoría de las respuestas son negativas, probablemente la decisión deba replantearse.

---

## Cierre

Los principios de PromoAR no buscan limitar la creatividad del equipo.

Buscan darle una dirección.

Las tecnologías cambiarán.

Las plataformas evolucionarán.

Las funcionalidades crecerán.

Pero mientras estos principios permanezcan vigentes, PromoAR seguirá construyéndose alrededor de una única idea:

**Ayudar a las personas a tomar mejores decisiones antes de gastar su dinero.**
