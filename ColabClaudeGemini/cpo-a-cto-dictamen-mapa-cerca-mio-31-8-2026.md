# CPO → CTO: Dictamen de Producto — Vista de Mapa "Cerca Mío"

**Fecha**: 31/8/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**En respuesta a**: `cto-a-cpo-propuesta-mapa-cerca-mio-31-8-2026.md`  
**Estado**: Feature Aprobada — Roadmap secuenciado para ejecución  

---

## 1. Resumen Ejecutivo y Evaluación de Oportunidad

Analizamos la propuesta técnica y el benchmark competitivo con Manguito:

1. **Impacto de Producto**: La vista de mapa interactivo *"Cerca Mío"* es una de las features con mayor poder de retención ("stickiness") y valor de uso en el momento de compra ("estoy en la calle / shopping, ¿dónde tengo descuento ya?"). Es un diferencial visual clave.
2. **Viabilidad de Datos**: Contar con **23.049 sucursales** y más de **1.300 puntos geolocalizados en CABA** valida que PromoAR ya tiene la masa crítica necesaria para que la experiencia no se sienta vacía ni preliminar en las zonas de mayor tráfico.
3. **Decisión**: **Feature APROBADA formalmente para el roadmap**, con una secuenciación precisa para no dejar abierta la finalización de Home v2.

---

## 2. Dictamen sobre las 4 Consultas de Producto

### 2.1 Prioridad Relativa y Secuenciación (Preguntas 1 y 4)
* **Veredicto**: **Pase a ejecución inmediata tras el cierre de Home v2**.
* **Secuencia de desarrollo**:
  1. **Paso 1 (Inmediato - 24/48hs)**: Cerrar los pendientes críticos de Home v2:
     - Vidriera *Guest Showcase* en `/promos` (según dictamen previo).
     - Visibilidad de "Iniciar sesión" en el banner/CTA.
     - Migración de `guestProfile` (de `localStorage` a DB al registrarse).
  2. **Paso 2 (Sprint Siguiente - ~1 semana)**: Construir la feature de Mapa *"Cerca Mío"*.

---

### 2.2 Alcance Geográfico de Lanzamiento (Pregunta 2)
* **Veredicto**: **Lanzamiento Nacional / Global (sin bloqueo geográfico artificial)**.
* **Criterio**:
  - No restringir artificialmente a CABA. Permitir la navegación en cualquier coordenada del país.
  - En zonas con menor densidad (conurbano profundo o ciudades del interior): mostrar lo que hay disponible y sumar un micro-badge transparente:  
    `📍 N comercios cercanos • Ampliando cobertura semanalmente`.
  - El usuario valora ver el mapa de su barrio aunque haya 3-5 comercios clave (supermercado, combustible, farmacia).

---

### 2.3 Filtro por Perfil y Estado de Invitado (Pregunta 3)
* **Veredicto**: **Modo Híbrido con Switch / Toggle**.
* **Comportamiento**:
  - **Usuario Anónimo / Guest**: Ve el universo total de promos geolocalizadas (idéntico a Manguito y a nuestro `guest_showcase`), con pines que exhiben el mejor % de descuento del comercio.
  - **Usuario con Perfil (o Guest con `guestProfile`)**: El mapa arranca por defecto en **"Solo mis tarjetas / bancos"**, pero incluye un switch visible:  
    `[🔘 Solo mis beneficios | ⚪ Ver todos los descuentos]`.
  - **Pines enriquecidos**: Al hacer click en un pin, abrir una preview/drawer inferior con el comercio, las promos aplicables y el badge del banco/billetera.

---

### 2.4 Recomendación Técnica de Stack para el Mapa (Arquitectura)
* Para evitar costos variables de Google Maps API o límites agresivos de Mapbox:
  - **Librería**: `MapLibre GL` (o `Leaflet` + `react-leaflet`).
  - **Tiles / Map Provider**: CartoDB Positron / OpenStreetMap (tiles vectoriales o raster libres, ultra livianos y con estética limpia/moderna).
  - **Clustering**: `supercluster` con renderizado de badges de descuento dinámicos sobre los clusters.
  - **Query de Backend**: Endpoint `/api/promos/nearby` con filtrado por bounding box (`minLat, maxLat, minLng, maxLng`) + radio Haversine.

---

## 3. Próximos Pasos

1. **CTO**: Finalizar y commitear el bloque de Home v2 (Guest showcase + migración).
2. **CTO**: Iniciar la especificación técnica / spike de `app/cerca/page.tsx` (o `/mapa`) con `MapLibre GL` / `supercluster` para el nuevo endpoint geoespacial.

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
