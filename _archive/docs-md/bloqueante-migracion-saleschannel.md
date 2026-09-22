# Hallazgo nuevo: tablas huérfanas `shopping_lists` en dev-promoar

## Contexto

Repar el bug del historial de migraciones (`salesChannel`) desbloqueó la
reproducción de la shadow database, pero `prisma migrate dev` sigue sin poder
correr en este entorno (falla por falta de TTY interactivo, error
"non-interactive environment"). Usé el comando alternativo
`prisma migrate diff` para generar el SQL de la migración nueva sin pasar por
ese paso interactivo — funciona, pero expuso algo que no tiene que ver con mi
feature.

## El hallazgo

El SQL generado por el diff no solo crea la tabla `recommendation_snapshots`
(lo esperado) — **también propone borrar dos tablas que no tienen nada que
ver con esto**: `shopping_lists` y `shopping_list_items`.

```sql
-- DropForeignKey
ALTER TABLE "shopping_list_items" DROP CONSTRAINT "shopping_list_items_shoppingListId_fkey";
-- DropForeignKey
ALTER TABLE "shopping_lists" DROP CONSTRAINT "shopping_lists_userId_fkey";
-- DropTable
DROP TABLE "shopping_list_items";
-- DropTable
DROP TABLE "shopping_lists";
```

Esto pasa porque el diff compara "lo que dice `schema.prisma`" contra "lo que
existe de verdad en dev-promoar", y esas dos tablas existen en la base real
pero no están declaradas en el `schema.prisma` de esta rama — Prisma
(correctamente, desde su lógica) concluye que "sobran" y las marca para
borrar.

## Lo que confirmé antes de tocar nada

- **Tienen datos reales**: `shopping_lists` tiene 1 fila, `shopping_list_items`
  tiene 3 filas. No están vacías.
- **No existen en el historial de git**: busqué en todos los commits de
  `prisma/schema.prisma`, en todas las ramas — nunca hubo un modelo
  `ShoppingList` en este repo.
- **No hay código que las use**: busqué `ShoppingList`/`shopping_list` en todo
  el código de la app (`.ts`, `.tsx`) — cero referencias. Ninguna ruta, ningún
  componente, ningún endpoint las toca hoy.

Conclusión: son tablas que llegaron a la base física de dev-promoar por fuera
de Prisma Migrate — igual que pasó con la columna `salesChannel` (probablemente
un `db push` de alguna prueba vieja, o un resabio de la migración manual
CockroachDB → Neon). Son huérfanas: existen en la base, no en el código ni en
el historial versionado.

## Por qué no lo resuelvo solo

Aunque el volumen de datos es mínimo (1 lista, 3 items) y nada del código
actual las usa, es una decisión que toca borrado de datos reales fuera del
alcance de "Recommendation Snapshot v1" — no es algo que se haya discutido ni
autorizado en ningún momento de esta feature.

## Las opciones

**Opción A — Excluir del alcance de esta migración.**
Escribo a mano el archivo de migración solo con las sentencias de
`recommendation_snapshots` (las que sí corresponden), omitiendo las 4
sentencias de `shopping_list*`. El diff generado automáticamente no se usa
tal cual — se recorta. Las tablas huérfanas quedan como están, sin tocarlas,
como un hallazgo aparte para revisar cuando haya tiempo (¿son de una prueba
vieja para desechar del todo, o hay que rescatar esas 4 filas y formalizar el
modelo en schema.prisma?).

**Opción B — Investigar primero, decidir después.**
Antes de generar cualquier migración, revisar qué son esas 4 filas (capaz
alcance con un query directo) para saber si vale la pena rescatarlas o si es
basura de prueba segura de ignorar. Mismo resultado final que la Opción A
(no se tocan en esta migración) pero con más contexto antes de decidir si
ameritan una tarea de limpieza separada.

## Recomendación

Opción A: no tiene sentido bloquear Recommendation Snapshot v1 por esto. Dejo
las tablas intactas, la migración nueva solo agrega lo que corresponde, y esto
queda anotado como pendiente separado (no se pierde el hallazgo, no se borra
nada sin decisión explícita).
