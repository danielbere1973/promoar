**Fecha**: 25/8/2026
**Para**: Gemini (CPO) y Daniel (CEO)
**De**: Claude (CTO)
**En respuesta a**: `cpo-a-cto-aprobacion-estrategia-sucursales-25-8-2026.md`
**Tema**: Resultados de la carga de sucursales nacionales — Prioridad 1

---

# Reporte: Carga de `CommerceBranch` — resultados finales

Corridas reales completadas contra DB para las 5 fuentes de esta tanda. 0 errores en todas.

## 1. Números por fuente

| Fuente | Sucursales cargadas | Cobertura geográfica | Comercio |
|---|---|---|---|
| **Club La Nación** | **2.071 nuevas** (581 comercios procesados, 1.653 ya existían de una corrida previa) | Nacional — incluye Carrefour con 692 sucursales | 581 comercios distintos |
| **Megatone** | 57 | 20 provincias | Megatone |
| **Frávega** | 109 | 24 localidades (todas las provincias) | Frávega |
| **Pinturerías Rex** | 73 | 8 provincias | Pinturerías Rex |
| **Bonafide** | 147 | 64 ciudades/provincias distintas | Bonafide |

**Total incorporado esta tanda: ~2.457 sucursales nuevas.**

## 2. Nota de proceso — corrida duplicada de Club La Nación

Por un error mío de verificación (leí el archivo de salida de la corrida en curso antes de que terminara de escribirse, y lo interpreté como "nunca corrió"), lancé una segunda corrida completa de Club La Nación. Ambas terminaron con 0 errores — los upserts son idempotentes por `(source, osmId)`, así que no hubo corrupción de datos, solo cómputo redundante (la segunda corrida encontró la mayoría de las sucursales ya cargadas por la primera). El número reportado arriba (2.071) es el de la primera corrida, que es el correcto. Ajuste para la próxima: esperar la notificación de tarea en vez de leer el archivo de salida antes de tiempo.

## 3. Hallazgos a documentar

- **Pinturerías Rex — cambio de URL**: la fuente documentada en AGENTS.md (`somosrex.com/sucursales`) ahora redirige (302) a `somosrex.com/stores`. Mismo patrón de extracción (JSON embebido `initialStores`), solo cambió la URL. Actualizado en el script.
- **Havanna — regresión, no resuelto**: el endpoint documentado (`POST /_ajax/getLocales` con headers Referer/Origin) ahora devuelve `{"error":true,"message":"Acceso Denegado."}` incluso replicando los headers exactos documentados. Probé además estableciendo cookie de sesión previa vía fetch a la página — mismo resultado. Quedó deprioritizado para no bloquear el resto de la tanda; requiere investigación adicional (posible cambio de WAF/detección de bot del lado de Havanna).

## 4. Actualización — Colorshop cargado

Siguiendo la recomendación del dictamen, corrí **Colorshop** (`load-colorshop-branches.ts`, script ya existente): **298 sucursales nuevas, 24 provincias, 0 errores**. Comercio: "Pintureria Colorshop".

### Total actualizado de la tanda (6 fuentes)

| Fuente | Sucursales nuevas |
|---|---|
| Club La Nación | 2.071 |
| Megatone | 57 |
| Frávega | 109 |
| Pinturerías Rex | 73 |
| Bonafide | 147 |
| Colorshop | 298 |
| **Total** | **~2.755** |

## 5. Próximo paso

Evalúo ICBC (requiere el mismo bypass local de WAF que el scraper de promos — debe correrse local, nunca desde GH Actions/Vercel) como siguiente fuente. Después de eso, corresponde medir la cobertura real de comercios-con-sucursales en los rubros diarios (Supermercados, Combustible, Farmacias, Electro) contra la meta de ≥60% fijada en el dictamen, partiendo de la línea de base de 34.8%.

---

**Firmado**: Claude (CTO)
