# CTO → CPO: Propuesta — Vista de mapa "Cerca mío" (comercios con promo cercanos)

**Fecha**: 31/8/2026
**De**: CTO (Claude)
**Para**: CPO (Gemini) / Daniel (CEO)
**Estado**: Propuesta para dictamen — no implementado

---

## 1. Origen de la consulta

Daniel vio una pantalla de un sitio competidor (`manguito.ar/cerca?lat=...&lng=...&z=15`, propuesta "Manguito") con una vista de mapa "Cerca mío": pines con clusters numéricos, badges de % de descuento sobre cada pin, sidebar con lista de comercios ordenada por distancia, filtros por rubro y por tarjeta, buscador de comercio/zona. Preguntó si algo así es viable para PromoAR ("eso se puede hacer? / es mucho lío?").

Antes de responder con una estimación, chequeamos qué tan poblado está realmente ese mapa de referencia (sin asumir nada — la primera vez que contesté esto asumí densidad alta solo por lo que se veía en la captura, sin dato real, y Daniel lo marcó correctamente). Con una segunda captura de Manguito sin login sobre Ramos Mejía/Villa Madero (GBA Oeste), mostrando "Mostrando 400 de 4444" y clusters de 80-92 por zona, confirmamos además que **Manguito no filtra por perfil financiero en el estado sin login** — muestra el universo completo de comercios con promo, de cualquier banco/tarjeta. Esto es coherente con el criterio que ya adoptamos para la Home v2 guest (`guest_showcase`, vidriera genérica sin personalizar).

## 2. Qué tenemos hoy en PromoAR (dato real, no estimado)

Consultamos la tabla `CommerceBranch` en producción (Neon):

- **23.049 sucursales** geolocalizadas (lat/lng obligatorios en el schema, sin nulls).
- **6.363 comercios distintos** con al menos una sucursal cargada.
- Por fuente: BBVA 7.743, Galicia 4.946, OSM 4.978, Banco Ciudad 2.277, BNA 1.460, Santander 1.212, Tiendeo 223, CaféMartínez 210.

### Prueba de densidad por zona (comparable a las capturas de Manguito)

| Zona | Radio | Sucursales PromoAR | Comercios distintos |
|---|---|---|---|
| Belgrano/Villa Urquiza (CABA) | 3 km | **1.348** | 583 |
| Ramos Mejía/Villa Madero (GBA Oeste) | 5 km | **285** | 135 |

**Lectura**: en CABA/zonas céntricas la densidad ya es alta — comparable o superior a lo que se ve en la captura de Manguito para esa zona. En conurbano profundo la cobertura es notoriamente más floja que la competencia (Manguito muestra clusters de 80-92 en Ramos Mejía; nosotros tenemos 285 sucursales en un radio bastante más grande ahí). Es el patrón esperable de fuentes basadas en bancos nacionales (BBVA, Galicia, Banco Ciudad, BNA, Santander) vs. una fuente con más comercios de barrio chicos en el conurbano.

## 3. Qué ya existe en el código (reutilizable, no arrancamos de cero)

- `CommerceBranch` (`commerceId, lat, lng, address, city, province, source`) ya poblado desde 7 fuentes distintas — infraestructura de scraping/carga ya construida y documentada (CLAUDE.md punto 10).
- Geolocalización del usuario ya integrada (`ProvinceSelector`, lat/lng ya viajan a `home-decision` para calcular "cercanía").
- `NearbyBranchesSheet.tsx` + botón "📍 N sucursales" en las cards: ya resuelven "sucursales de UN comercio cerca mío" — es la mitad del problema.

## 4. Qué falta construir (esfuerzo real)

1. **Librería de mapa**: no hay ninguna integrada (Google Maps JS API o Mapbox GL). Requiere API key + billing. Estimado: 1-2 días.
2. **Clustering de pines**: librería tipo `supercluster` (o clustering nativo de Google Maps). Medio día.
3. **Query espacial inversa**: hoy el matching es "sucursales de un comercio dado". Falta la inversa — "todas las sucursales (de cualquier comercio con promo activa) dentro de un radio de lat/lng del usuario", unida a sus promos. Es una query nueva, factible con índice espacial o Haversine + bounding box (como usamos en esta misma investigación). 1-2 días con índice.
4. **UI de mapa + sidebar + filtros + buscador**: día y medio a 2 días, apoyándonos en el sistema visual ya existente.
5. **Cobertura de datos en conurbano/interior**: no es bloqueante para lanzar en CABA, pero si el objetivo es paridad nacional con Manguito, va a requerir seguir cargando `CommerceBranch` (mismo trabajo scraper-por-scraper del punto 10, no una tarea nueva).

**Estimado total (CABA/zonas densas)**: ~1 semana de desarrollo, con los datos actuales ya alcanza para un mapa que no se vea vacío.

## 5. Preguntas para el dictamen

1. **¿Aprobamos avanzar con esta feature ahora, o queda en backlog priorizado detrás de lo que ya está en curso** (guest showcase Home v2, login/migración de guestProfile pendientes)?
2. **Alcance geográfico de lanzamiento**: ¿lanzamos primero solo en CABA/zonas de alta densidad y comunicamos "cobertura en expansión", o esperamos a nivelar cobertura en conurbano/interior antes de exponer el mapa?
3. **Filtro por perfil en el mapa**: ¿replicamos el mismo criterio que Home v2 (sin login = vidriera genérica sin filtrar por banco/tarjeta, con opción de cargar perfil sin cuenta vía el mismo mecanismo de `guestProfile`)?
4. **Prioridad relativa**: ¿esto entra antes o después de cerrar los pendientes ya identificados en la sesión de Home v2 (login visible en el CTA, migración de `guestProfile` al registrarse, revisión de cuántos rubros mostrar en la vidriera guest)?

---

**Fin de la propuesta — a la espera de dictamen antes de tocar código.**
