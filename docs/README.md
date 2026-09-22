# Documentación de PromoAR

## Objetivo de la documentación

Esta carpeta centraliza la documentación de producto, técnica, de marca y de negocio de PromoAR.
El objetivo es que cualquier persona (o IA) que se incorpore al proyecto pueda entender rápidamente
qué es PromoAR, hacia dónde va, cómo está construido y por qué se tomaron ciertas decisiones — sin
depender de leer el código o el historial de git para reconstruir el contexto.

## Descripción de cada carpeta

- **`vision/`** — Visión de producto, principios rectores y glosario de términos compartidos.
- **`product/`** — Roadmap de producto, casos de uso, personas de usuario y registro de decisiones de producto.
- **`brand/`** — Identidad de marca, tono de voz, storytelling y estrategia de redes (Instagram).
- **`technical/`** — Roadmap técnico, arquitectura, estrategia de geolocalización y motor de recomendación.
- **`business/`** — Modelo de negocio, monetización, partnerships y métricas.
- **`adr/`** — Architecture Decision Records: decisiones puntuales de arquitectura o producto, con su contexto, alternativas y consecuencias.

## Convenciones utilizadas

- Todo documento nuevo sigue la misma plantilla uniforme: Título, Estado, Fecha de creación,
  Última actualización, Objetivo del documento, Contenido e Historial de cambios.
- **Estado** puede ser `Draft`, `En revisión` o `Aprobado`. Un documento nace en `Draft`.
- Los documentos en `adr/` usan una variante de la plantilla con secciones fijas: Contexto,
  Decisión, Alternativas consideradas y Consecuencias (ver `adr/TEMPLATE.md`).
- Las fechas se escriben en formato `YYYY-MM-DD`.
- No se sobrescribe contenido existente al actualizar un documento: se edita el `Contenido` y se
  agrega una fila nueva en el `Historial de cambios`, preservando las anteriores.
- Los nombres de archivo usan `kebab-case`.

## Cómo agregar nuevos documentos

1. Elegir la carpeta correspondiente al tema (`vision/`, `product/`, `brand/`, `technical/`,
   `business/`). Si no encaja en ninguna, discutirlo antes de crear una carpeta nueva.
2. Copiar la plantilla estándar (ver cualquier documento existente como referencia) y completar
   Título y Objetivo del documento.
3. Dejar `Estado: Draft` hasta que el contenido esté validado.
4. Actualizar este `README.md` si se agrega una carpeta nueva.

## Cómo registrar decisiones importantes (ADR)

1. Crear un archivo en `adr/` con el siguiente número secuencial disponible:
   `ADR-00N-titulo-corto.md`.
2. Partir de `adr/TEMPLATE.md` y completar Contexto, Decisión, Alternativas consideradas y
   Consecuencias.
3. Un ADR no se borra ni se reescribe cuando la decisión cambia — se crea uno nuevo que referencia
   al anterior y explica el cambio. El historial de decisiones es tan valioso como la decisión actual.

## La documentación evoluciona junto con el código

Ningún cambio de arquitectura, de producto o de negocio se considera terminado hasta que la
documentación relevante refleja ese cambio. Si un PR modifica una decisión documentada, debe
actualizar el documento correspondiente (o crear un ADR nuevo) en el mismo ciclo de trabajo, no
como una tarea separada "para después".
