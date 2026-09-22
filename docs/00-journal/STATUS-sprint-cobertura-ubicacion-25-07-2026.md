# Status — Sprint Cobertura y Ubicación en Explorar

**Fecha**: 2026-07-25
**Rama**: `sprint/cobertura-ubicacion-explorar` (no mergeada a `main`)
**Autor**: Claude, en sesión con Daniel

## Resumen

El sprint estaba bloqueado desde su inicio por un problema de migraciones de Prisma
heredado de la migración de CockroachDB → Neon. Ese bloqueo quedó resuelto hoy. El
modelo de datos (ADR-001) ya está aplicado en una base de desarrollo dedicada, sin
tocar producción.

## Qué es ADR-001

Para poder filtrar promos por ubicación del usuario en "Explorar" sin ocultar
incorrectamente comercios online, nacionales o de servicio móvil (delivery,
ride-hailing), se definieron 3 enums ortogonales, todos con default `UNKNOWN`
(pass-through: si no hay dato, la promo se sigue mostrando, nunca se filtra de más):

- `Commerce.locationModel`: sucursales físicas / red distribuida / solo online /
  servicio móvil / sin ubicación fija / desconocido.
- `Promo.salesChannel`: online / físico / ambos / desconocido.
- `Promo.geographicScope` (campo nuevo): nacional / por provincias / por sucursal /
  área de servicio / sin restricción geográfica / desconocido.

## El bloqueo y cómo se resolvió

La base de Neon en uso hasta ahora era una sola (la de producción). No existía un
ambiente de desarrollo separado, y el archivo de configuración de Prisma todavía
apuntaba al proveedor viejo (CockroachDB) en vez de Postgres — cualquier intento de
generar o aplicar una migración fallaba.

Pasos ejecutados hoy, ya con una base de desarrollo (`ep-tiny-bread`) creada por
Daniel como clon de producción:

1. Se corrigió la configuración de Prisma para reflejar el proveedor real (Postgres).
2. Se reconciliaron las 8 migraciones históricas contra la base de desarrollo (sin
   ejecutar SQL de nuevo — las tablas ya existían por ser un clon).
3. Se generó la migración de ADR-001 (3 enums + 2 columnas nuevas).
4. **Hallazgo no relacionado**: la generación automática de Prisma incluía además
   instrucciones para borrar las tablas `shopping_lists`/`shopping_list_items` —
   tablas que existen en la base real pero nunca formaron parte del esquema
   versionado en git (drift previo, de origen desconocido, anterior a este sprint).
   Se excluyeron esas instrucciones a mano antes de aplicar nada; no se tocaron esas
   tablas ni se investigó su origen.
5. Se aplicó la migración limpia (solo ADR-001) a la base de desarrollo y se verificó
   que los 3 campos nuevos están disponibles con su valor default correcto, y que las
   tablas de `shopping_lists` siguen intactas.

## Estado actual

- Bloqueo de migración: **resuelto**.
- Producción: sin cambios, sin riesgo.
- Rama del sprint: lista para continuar con el resto del trabajo (carga de
  sucursales de ColorShop, adaptación de la UI de Explorar a los 4 estados de
  cobertura, métricas de distribución de promos por estado).

## Pendiente / fuera de alcance

- El drift de `shopping_lists`/`shopping_list_items` (tablas huérfanas del esquema
  versionado) sigue sin resolver. No es parte de este sprint — si se decide
  investigar su origen, es trabajo aparte.
- Falta mergear esta rama a `main` — no se hará hasta completar el resto del sprint.
