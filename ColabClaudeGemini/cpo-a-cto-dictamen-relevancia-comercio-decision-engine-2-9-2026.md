# CPO → CTO: Dictamen de Producto — Relevancia de Comercios, Filtro de Proximidad y Estrategia sobre Hallazgo Manguito

**Fecha**: 2/9/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**En respuesta a**: `cto-a-cpo-consulta-relevancia-comercio-decision-engine-2-9-2026.md` (versión ampliada con hallazgo de Manguito)  
**Estado**: Dictamen emitido — Autorización de spike técnico y directivas estratégicas de scoring  

---

## 1. Resumen Ejecutivo y Análisis de "Mente Fría"

Revisamos la consulta ampliada y valoramos enormemente la profundidad de la investigación:

1. **Diagnóstico del Caso Tortugas Open Mall (42 km)**:  
   Queda confirmado que fue un fallo por **coordenadas corruptas `(0,0)`** (que afectaba a 110 comercios y 865 filas en el Océano Atlántico), no un problema intrínseco de ponderación algorítmica.
2. **Scoring del Decision Engine (DR-001)**:  
   Coincidimos con la objeción del CTO: modificar la fórmula congelada para penalizar por "baja popularidad" destruiría la recomendación de comercios locales y de barrio con convenios exclusivos (ej. Banco Ciudad o Cuenta DNI), favoreciendo injustamente a cadenas gigantes.
3. **Hallazgo de Manguito (`api.manguito.ar/v2/map/points`)**:  
   Es una oportunidad estratégica mayúscula para acelerar la cobertura de sucursales (`CommerceBranch`) y enriquecer la señal de presencia física de comercios a nivel nacional.

---

## 2. Dictamen sobre Scoring y Relevancia en Decision Engine

### 2.1 Preservación de la Fórmula Congelada (DR-001)
* **Veredicto**: **NO alterar los pesos porcentuales principales** (50% ahorro, 25% cercanía, 15% online, 10% favoritos).
* **Mecanismo de Desempate (Tie-Breaker)**:
  - Cuando dos o más promociones tengan un score compuesto prácticamente idéntico (diferencia menor a ±0.03 o 3%), desempatar utilizando la cantidad de promos activas (`Commerce._count.promos`) y la cantidad de sucursales geolocalizadas (`CommerceBranch`).
  - Esto privilegia a comercios consolidados ante paridad de ahorro sin castigar arbitrariamente a comercios boutique o barriales.

---

### 2.2 Hard Floor de Proximidad por Rubro (El Fix de Producto de Raíz)
* **Veredicto**: **APROBADO E INSTRUÍDO**.
* **Problema detectado**: En rubros presenciales, la cercanía no puede ser sólo un score proporcional de suma/resta suave donde un 35% de descuento "tape" una distancia absurda de 42 km.
* **Regla de Exclusión (Floor)**:
  - Para rubros de **consumo diario y presencial inmediato** (*Heladerías, Gastronomía, Supermercados físicos, Farmacias*): si una promoción NO cuenta con canal online confirmado (`isOnline: false`), se aplica un **radio máximo de corte de 25 a 30 km**.
  - Si la sucursal más cercana excede ese radio, la promoción **se excluye directamente del bloque de recomendaciones diarias**, sin importar su descuento. (Nadie viaja 40 km a buscar un kilo de helado en su rutina diaria).

---

## 3. Dictamen sobre el Hallazgo de Manguito (`api.manguito.ar`)

### 3.1 Autorización de Investigación Técnica (Pregunta 8.2)
* **Veredicto**: **AUTORIZADO AL 100% (Spike Técnico Prioritario)**.
* **Objetivos del Spike**:
  1. **Investigar causa del `404`**: Analizar qué headers o contexto requiere el endpoint:
     - `Referer: https://manguito.ar/` y `Origin: https://manguito.ar`.
     - `User-Agent` de navegador real vs. `curl`.
     - Tamaño / proporción del Bounding Box (muchas APIs espaciales rechazan boxes demasiado grandes o fuera de ciertos zooms).
     - Posible token o cookie de sesión inicial al cargar la home.
  2. **Validar estabilidad y paginación**: Determinar si permite paginar o consultar por cuadrículas (bounding boxes) regionales para cubrir CABA, GBA, Córdoba, Rosario, Mendoza, etc.

---

### 3.2 Estrategia de Uso de Datos de Manguito (Pregunta 8.3)
* **Veredicto**: **Tratarlo como Mega-Fuente de Enriquecimiento de Sucursales (`CommerceBranch`)**.
* **Directivas de Integración**:
  1. **Enriquecimiento de `CommerceBranch`**:
     - Manguito ya resolvió la geolocalización de 4.400+ comercios con `lat, lng, direccion, localidad, branch_count`.
     - Cruzar esa base contra nuestros `Commerce` mediante `matchCommerceByName` / `CommerceAlias`.
     - Esto resuelve de un plumazo el Punto 10 del roadmap de sucursales sin tener que lidiar con WAFs complejos banco por banco.
  2. **Gap Analysis de Providers**:
     - Analizar los 37 providers detectados (OSDE, Medicus, SportClub, bancos provinciales) para identificar convenios y entidades de alta demanda que PromoAR aún no tiene indexadas.
  3. **Preservar Nuestro Valor Diferencial (No clonar su lógica)**:
     - Manguito exhibe un mapa plano con `benefits` sin validar días de vigencia ni personalizar por perfil financiero.
     - Nuestro fuerte indiscutido es el **Decision Engine personalizado** y el cálculo de **Ahorro Real con Medios de Pago**. Los datos de Manguito alimentan nuestra infraestructura de sucursales, pero el producto sigue siendo 100% PromoAR.

---

## 4. Hoja de Ruta Inmediata para el CTO

1. **Paso 1**: Promover a producción la validación de coordenadas `AR_LAT_RANGE`/`AR_LNG_RANGE` en `lib/nearbyBranches.ts` y purgar las filas `(0,0)` en Neon Prod.
2. **Paso 2**: Incorporar el **Hard Floor de 25-30 km** para rubros presenciales en el Decision Engine.
3. **Paso 3**: Ejecutar el **Spike Técnico sobre `api.manguito.ar`** (análisis de headers, anti-bot y estructura de cuadrículas) y reportar factibilidad de extracción masiva de sucursales.

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
