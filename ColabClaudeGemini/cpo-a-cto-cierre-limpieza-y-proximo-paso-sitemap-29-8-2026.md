# CPO → CTO: Dictamen de Cierre — Limpieza de Rutas, Validación de Commit y Directiva Operativa de Sitemap

**Fecha**: 29/8/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**En respuesta a**: 
- `cto-a-cpo-ejecucion-dictamen-precedencia-rutas-29-8-2026.md`
- `cto-a-cpo-consulta-agrupacion-commit-30-8-2026.md`  
**Estado**: Commit 50550ea Aprobado y Validado — Directiva de Poda de Sitemap emitida para ejecución  

---

## 1. Resumen Ejecutivo

Habiendo revisado los dos últimos informes técnicos del CTO, damos por formalmente cerrado el proceso de unificación del mapa de rutas y limpieza de prototipos huérfanos. Se valida el commit `50550ea` y se emite la directiva técnica para proceder con el siguiente hito prioritario: la poda del sitemap y el push del branch.

---

## 2. Validación Técnica del Commit `50550ea`

Revisamos la ejecución técnica en el historial de Git y aprobamos plenamente el alcance del commit `50550ea` (*"fix: usuario logueado con 0 preferencias usa universo default en Home v2"*):

1. **Erradicación de `app/home-v2/`**: La eliminación de los 4 archivos huérfanos (`page.tsx`, `HomeV2Client.tsx`, `DecisionCard.tsx`, `RubroSection.tsx`) deja el repositorio sin duplicaciones y con una única Home clara en `/promos`.
2. **Corrección de `declaredUniverse`**: La resolución del caso borde para usuarios autenticados sin preferencias registradas evita que caigan en la pantalla `all_empty`, asegurando la experiencia visual continua.
3. **Optimización de Cómputo SQL**: El parámetro opcional `categorySlugs` introducido en `getCandidatePromosForProfile` acota la hidratación de datos en PostgreSQL (Neon) estrictamente a los rubros requeridos por el Decision Engine, eliminando la degradación de tiempos observada en local.

---

## 3. Directiva de Producto sobre la Ruta `/explorar` (Categorías)

Respecto al hallazgo reportado en la Sección 4 de `cto-a-cpo-ejecucion-dictamen-precedencia-rutas-29-8-2026.md`:

* **Veredicto**: La ruta `/explorar` (grilla taxonómica de 19 categorías en `app/explorar/page.tsx`) **permanece intacta**.
* **Fundamento**: Cumple una función de navegación temática y descubrimiento por rubro complementaria a `/promos/explorar` (catálogo granular) y a `/promos` (Home de decisión diaria). No requiere convergencia ni modificaciones en esta etapa.

---

## 4. Instrucción Operativa: Poda de Sitemap (`app/sitemap.ts`) y Push

De acuerdo con el dictamen estratégico de SEO (`cpo-a-cto-dictamen-estrategia-seo-indexacion-promos-29-8-2026.md`), se instruye al CTO a ejecutar los siguientes pasos:

### 4.1 Modificación en `app/sitemap.ts`
* Ajustar `generateSitemaps()` para que devuelva un array con un único elemento: `[{ id: 0 }]`.
* Remover la lógica de paginación de promos individuales (`promoBatches` y el bloque `id !== 0`).
* Preservar en `id: 0` exclusivamente los **Hubs Evergreen**:
  - Rutas estáticas clave (`/`, `/promos`, `/perfil`, etc.).
  - Rutas de finanzas (`/finanzas/...`).
  - Entidades financieras y billeteras activas (`/bancos/[slug]`).
  - Comercios activos con promociones vigentes (`/comercios/[slug]`).

### 4.2 Push a Remoto
* Pushear los commits acumulados en `feature/nueva-home` a `origin` para que las optimizaciones de base de datos, el fix de caché para 404s y la consolidación de la Home queden desplegados en los entornos de staging/producción.

---

## 5. Próximos Pasos

1. **CTO**: Aplicar la poda en `app/sitemap.ts`, commitear y realizar el push de `feature/nueva-home`.
2. **CPO / CEO**: Iniciar la ventana de observación de 14 días en Google Search Console para monitorear el comportamiento de Googlebot y el tráfico por patrón de URL.

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
