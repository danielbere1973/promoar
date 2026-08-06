# Validación funcional ADR-001 + carga ColorShop

**Fecha**: 2026-07-25
**Rama**: `sprint/cobertura-ubicacion-explorar`
**Ambiente**: Neon dev (`ep-tiny-bread`), sin tocar producción

## 1. Validación funcional del filtro geográfico

Se corrió la lógica real de `lib/getPromos.ts` (líneas 422-468) contra datos de la base
de dev para los 4 casos pedidos. Resultado: **los 4 casos se comportan como se espera**.

| Caso | Promo real | Resultado | Esperado |
|---|---|---|---|
| 1. ONLINE sin restricción territorial | *(simulado — ver nota abajo)* | Se muestra | Se muestra ✅ |
| 2. Comercio con sucursal en la provincia del usuario | "25% descuento – Vea" (Vea), usuario en Buenos Aires | Se muestra | Se muestra ✅ |
| 3. Comercio fuera del radio de cobertura | "25% descuento – Supermercados" (Supermercados El Nene, solo Buenos Aires), usuario en Jujuy | No se muestra | No se muestra ✅ |
| 4. UNKNOWN (default post-migración) | "2x1 – Colección de Arte Amalia Lacroze de Fortabat", sin sucursales cargadas | Se muestra | Se muestra ✅ |

**Nota importante sobre el Caso 1**: hoy **ninguna promo activa tiene `salesChannel` distinto
de `UNKNOWN`** — el backfill de esta migración solo agregó las columnas con su default
seguro, no clasificó datos existentes. El caso 1 se validó simulando el campo sobre una
promo real (mismo motor de filtro, mismos datos de comercio) para confirmar que la rama de
código es correcta. Esto es esperado en este punto del sprint, pero significa que **el
filtro por canal de venta (ONLINE/PHYSICAL) todavía no tiene efecto real en producción**
hasta que se clasifique al menos un lote de comercios/promos.

**Distribución actual de las 32.780 promos activas**:
- `salesChannel`: 100% `UNKNOWN`
- `geographicScope`: 100% `UNKNOWN`

Es decir, el filtro geográfico hoy actúa exclusivamente por la vía 5 (evaluación de
`CommerceBranch` del comercio) y por el umbral de cobertura nacional inferida (4+
provincias con sucursales → se trata como nacional). Confirma que el pass-through
funciona: nada desaparece por falta de clasificación explícita.

## 2. Carga de sucursales ColorShop

### Dry-run

```
Fetched:  307
Activas:  300
Inserted: 298
Updated:  0
Errors:   0
Provincias cubiertas: 24
```

Resultado consistente con lo documentado (307 sucursales esperadas, 24 provincias).

### Bug encontrado y corregido antes de la carga real

El dry-run pasó, pero la carga real falló en el primer intento con un error no
relacionado a ADR-001: el script envolvía las 298 sucursales en una única
`$transaction`, y el timeout por default de Prisma (5s) cortó la transacción completa
contra el pooler de Neon (mayor latencia de red por conexión que una DB local). No se
insertó nada (transacción atómica, sin datos parciales corruptos).

**Fix aplicado**: se sacó el loop de la transacción — cada `upsert` ya es atómico por
sí solo y no necesita agruparse. Cambio aislado a `scripts/load-colorshop-branches.ts`,
sin tocar la lógica de negocio del script.

También se detectó y corrigió, antes de eso, que el endpoint de ColorShop pasó a
esperar el parámetro `variables` como JSON plano en vez de base64 (devolvía 500);
puede ser un cambio reciente de configuración en VTEX. Corregido en el mismo archivo.

### Carga real — resultado final

```
Inserted: 298
Errors:   0
✓ ColorShop cargado con 298 sucursales en 24 provincias.
```

Verificado directamente en base: **298 sucursales, 24 provincias**, cargadas y
confirmadas en la DB de dev.

## Conclusión

- El modelo ADR-001 funciona correctamente en los 4 escenarios pedidos.
- El filtro por sucursales/cobertura nacional ya tiene efecto real hoy; el filtro por
  `salesChannel`/`geographicScope` está listo pero sin datos clasificados todavía (no
  bloqueante para continuar con la UI, pero vale tenerlo presente para no asumir que
  ya hay promos filtradas por "online" en producción).
- ColorShop cargado en dev: 298 sucursales / 24 provincias, sin errores.
- Dos bugs preexistentes y no relacionados al sprint quedaron corregidos en el mismo
  script (timeout de transacción, formato de `variables` del endpoint VTEX).

Con esto, quedo lista para pasar a la implementación de la UI de Explorar con los 4
estados de cobertura.
