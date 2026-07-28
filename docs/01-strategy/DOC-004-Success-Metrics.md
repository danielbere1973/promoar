---
title: DOC-004 – Success Metrics
version: "2.1"
status: Approved
owner: CPO
last_updated: "2026-07-23"
domain: Product
knowledge_type: Normative
authority: Yes
---

# DOC-004 — Métricas de Éxito

| Campo | Valor |
|--------|--------|
| Código | DOC-004 |
| Nombre | Success Metrics |
| Estado | Approved |
| Versión | 2.1 |
| Owner | CPO |
| Knowledge Type | Normative |
| Authority | Yes |

---

# 1. Propósito

Este documento define cómo PromoAR medirá el éxito del producto.

Las métricas aquí establecidas tienen como objetivo asegurar que todas las decisiones de producto se orienten a generar valor para los usuarios y no únicamente a entregar nuevas funcionalidades.

Este documento establece:

- La **North Star Metric** del producto.
- Las métricas de resultado (**Outcome Metrics**).
- Las métricas operativas (**Operational Metrics**).
- Las métricas de protección (**Guardrail Metrics**).
- La trazabilidad entre las métricas y los Principios del Producto.

---

# 2. Filosofía de Medición

PromoAR medirá su éxito utilizando tres niveles complementarios de métricas.

## 2.1 North Star Metric

Representa el principal indicador de valor entregado por PromoAR.

Toda decisión relevante de producto deberá contribuir, de forma directa o indirecta, a mejorar esta métrica.

La North Star Metric debe cumplir tres condiciones:

- Representar el valor generado para el usuario.
- Ser objetivamente medible.
- Poder calcularse utilizando eventos observables del producto.

---

## 2.2 Outcome Metrics

Miden los resultados obtenidos por el producto desde la perspectiva del negocio y de los usuarios.

Permiten responder si PromoAR está cumpliendo su propósito.

---

## 2.3 Operational Metrics

Miden la salud operativa del producto.

Su objetivo es garantizar que la plataforma funcione correctamente y sostenga los resultados de negocio.

Estas métricas no constituyen objetivos del producto por sí mismas.

---

# 3. North Star Metric

## Usuarios que Descubren Oportunidades de Ahorro

### Definición

Cantidad de usuarios activos que interactúan con una promoción considerada relevante durante un período determinado.

En la versión actual del producto esta métrica se calculará exclusivamente mediante eventos observables registrados por PromoAR.

Ejemplos de eventos válidos:

- Apertura del detalle de una promoción.
- Guardado de una promoción.
- Compartir una promoción.
- Cualquier otra interacción que el equipo de Producto defina como indicador válido de descubrimiento de valor.

### Evolución

Esta métrica representa la mejor aproximación disponible al valor generado utilizando los datos que actualmente captura el producto.

En futuras versiones, cuando PromoAR incorpore mecanismos confiables para confirmar la utilización efectiva de una promoción, la North Star Metric podrá evolucionar hacia una métrica basada en el ahorro real obtenido por los usuarios.

Asimismo, la incorporación, modificación o eliminación de los eventos observables utilizados para calcular esta métrica deberá seguir el proceso de gobernanza definido en la Sección 8 de este documento, a fin de garantizar la estabilidad y comparabilidad histórica de la métrica.

---

# 4. Métricas de Resultado (Outcome Metrics)

## 4.1 Usuarios Activos Mensuales (MAU)

Cantidad de usuarios únicos activos durante los últimos 30 días.

**Objetivo**

Medir la adopción del producto.

---

## 4.2 Usuarios Activos Semanales (WAU)

Cantidad de usuarios únicos activos durante los últimos siete días.

**Objetivo**

Medir el uso recurrente.

---

## 4.3 Retención de Usuarios

Se medirá la retención a:

- 7 días.
- 30 días.
- 90 días.

La retención constituye uno de los principales indicadores de Product-Market Fit.

---

## 4.4 Descubrimiento de Promociones

Cantidad de promociones con las que los usuarios interactúan de manera significativa.

Se calculará utilizando únicamente eventos observables definidos por el producto.

Esta métrica no implica que la promoción haya sido utilizada en un comercio.

---

## 4.5 Eficiencia de Descubrimiento

Mide el esfuerzo requerido para que un usuario encuentre una promoción útil.

Podrá evaluarse mediante indicadores como:

- Tiempo hasta visualizar la primera promoción relevante.
- Cantidad de interacciones necesarias hasta encontrar una promoción útil.
- Tasa de abandono durante el proceso de búsqueda.

Su objetivo es reducir la fricción para encontrar oportunidades de ahorro.

---

## 4.6 Tasa de Éxito de las Búsquedas

Porcentaje de búsquedas que generan resultados relevantes para el usuario.

Las búsquedas sin resultados útiles representan oportunidades de mejora del producto.

---

## 4.7 Satisfacción del Usuario

Se medirá mediante:

- Net Promoter Score (NPS).
- Customer Satisfaction Score (CSAT).
- Feedback cualitativo.

---

# 5. Métricas Operativas

## Disponibilidad

Objetivo inicial:

- 99,9 %.

---

## Rendimiento

Objetivos iniciales:

- Carga inicial inferior a 2 segundos.
- Consultas posteriores inferiores a 1 segundo.

---

## Actualización de Promociones

Tiempo promedio transcurrido entre un cambio en una promoción y su disponibilidad dentro de PromoAR.

El objetivo es minimizar la existencia de promociones desactualizadas.

---

## Calidad de los Datos

Se monitorearán, entre otros:

- Promociones duplicadas.
- Promociones vencidas.
- Promociones inválidas.
- Errores de categorización.

---

## Tasa de Errores

Incluye:

- Errores de aplicación.
- Errores de API.
- Errores de sincronización.

Los umbrales aceptables serán definidos por el equipo de Ingeniería.

---

# 6. Métricas de Protección (Guardrail Metrics)

Las métricas de protección garantizan que la optimización de determinados indicadores no degrade la experiencia del usuario ni viole los principios fundamentales del producto.

## 6.1 Guardrails Operativos

Se monitorearán continuamente:

- Promociones inválidas.
- Promociones vencidas.
- Calidad de los datos.
- Tiempos de respuesta.
- Errores de aplicación.
- Errores de sincronización.

---

## 6.2 Guardrails de Experiencia

Se monitorearán periódicamente:

- Net Promoter Score (NPS).
- Customer Satisfaction Score (CSAT).
- Confianza del usuario.
- Retención de usuarios.

---

## 6.3 Guardrail de Neutralidad Comercial

PromoAR deberá garantizar que las recomendaciones permanezcan alineadas con el **Principio de Independencia Comercial** definido en el DOC-003.

Para ello se monitorearán indicadores como:

- Distribución de impresiones por comercio.
- Distribución de recomendaciones por categoría.
- Distribución entre comercios con y sin acuerdos comerciales.
- Desviaciones significativas respecto del comportamiento esperado del algoritmo.

Ningún acuerdo comercial podrá modificar por sí mismo la visibilidad de una promoción.

---

# 7. Alineación con los Principios del Producto

Toda iniciativa de producto deberá demostrar un impacto medible sobre al menos uno de los siguientes objetivos:

- Incrementar el descubrimiento de oportunidades de ahorro.
- Reducir el esfuerzo necesario para encontrar promociones.
- Mejorar la confianza en la información presentada.
- Incrementar el uso recurrente del producto.

La medición de estos objetivos deberá sustentarse en las métricas definidas en la Sección 4 de este documento.

Las iniciativas que no contribuyan a ninguno de estos objetivos deberán contar con una justificación explícita.

---

# 8. Gobernanza

Este documento forma parte del **Product Knowledge Base (PKB)** de PromoAR.

Las métricas de éxito podrán evolucionar conforme madure el producto.

Toda modificación deberá seguir el proceso de gobernanza del PKB:

1. Redacción de la propuesta por el CPO.
2. Revisión y aprobación del CEO.
3. Revisión crítica del CTO.
4. Incorporación de las observaciones aceptadas.
5. Aprobación del documento.
6. Sincronización del PKB.
7. Registro en el Product Journal.

---

**Fin del documento**
