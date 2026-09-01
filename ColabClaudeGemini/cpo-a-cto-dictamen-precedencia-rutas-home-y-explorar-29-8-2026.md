# CPO → CTO: Dictamen de Arquitectura — Mapa de Rutas, Precedencia Home v2 vs Explorar

**Fecha**: 29/8/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**En respuesta a**: `cto-a-cpo-consulta-precedencia-promos-vs-home-v2-29-8-2026.md`  
**Estado**: Veredicto Definitivo — Arquitectura de Navegación y Rutas Cerrada  

---

## 1. Despejando la Confusión: El Mapa Real de la Aplicación

La confusión nace de tener una ruta de prototipo huérfana (`/home-v2`) coexistiendo con el código ya migrado. El mapa definitivo de producto de PromoAR tiene **dos experiencias complementarias con dos objetivos distintos**:

```
                                  PROMOAR.COM.AR
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
         HOME DE DECISIÓN                               CATÁLOGO / EXPLORAR
          Ruta: /promos                               Ruta: /promos/explorar
                 │                                               │
  "¿Qué me conviene hoy?"                         "Quiero buscar yo"
  • Personalizado (Tus Rubros)                    • Catálogo completo de Argentina
  • Decision Engine v2 (Score)                    • Buscador de productos
  • Geolocalización / Sucursales                  • Filtros avanzados (bancos/días/%)
  • QuickCardSelector                             • CategorySheet & FilterDrawer
                 │                                               │
                 └─────────────── [ CTA / Enlace ] ──────────────┘
                         "Explorar todas las promos →"
```

---

## 2. Respuestas Puntuales y Veredicto a la Consulta del CTO

### (a) ¿`/home-v2` reemplaza a `/promos`?
**NO como ruta `/home-v2`.**  
* La ruta `/app/home-v2/` fue un sandbox/prototipo de desarrollo durante los RFCs. **Debe ser eliminada**.
* La pantalla principal de la aplicación **ES `/promos`**, la cual **YA tiene montado el Decision Engine v2** (`PromosClient.tsx` consumiendo `useHomeDecision`, `HomeRubros`, `QuickCardSelector`, `NearbyBranchesSheet` y `ExploreCatalogCta`).
* La Landing de marketing para no autenticados / SEO institucional sigue en `/` (`app/page.tsx`), derivando con sus CTAs a `/promos`.

---

### (b) ¿Qué pasa con las funciones de `/promos` v1 (filtros, buscador de productos, categorías)?
**NO se descartaron ni se pierden: viven en `/promos/explorar`.**  
* En `/app/promos/explorar/page.tsx` está el catálogo tradicional con SSR, paginación, `FilterDrawer`, `CategorySheet` y buscador de productos (`ProductSearch.tsx`).
* La Home (`/promos`) no debe saturarse con 50 filtros ni grillas infinitas: resuelve la decisión diaria ("¿dónde compro hoy con mis tarjetas?") y ofrece la salida explícita mediante el componente **[`ExploreCatalogCta.tsx`](file:///c:/Users/pablo/Proyectos/promoar/app/components/ExploreCatalogCta.tsx)** (*"Explorar todas las promociones →"*), que navega directo a `/promos/explorar`.

---

### (c) Criterio de Corte y Limpieza
El corte conceptual **ya ocurrió** en la base de código. Para cerrar la transición operativa:
1. **Eliminar `/app/home-v2/`** y su componente auxiliar `HomeV2Client.tsx` para erradicar el ruido mental y la duplicación de código.
2. **Asegurar el enlace bidireccional**:
   * Home (`/promos`) → CTA inferior y/o botón de búsqueda que lleva a `/promos/explorar`.
   * Explorar (`/promos/explorar`) → Botón "Volver a Mi Home" o Header con navegación clara.

---

### (d) Priorización de Trabajo Pendiente
* **`/promos` (Home de Decisión)**: **100% de la inversión y foco de producto**.
  * Afilar la UX de `HomeRubros`, slots vacíos, feedback de sucursales cercanas y el warm job del snapshot async.
* **`/promos/explorar` (Catálogo/Buscador)**: **CONGELADO en features**.
  * Solo mantenimiento de datos o corrección de bugs críticos. No se invierte en restylings pesados de la grilla v1.

---

## 3. Resumen Operativo para el CTO

1. **Borrar carpeta `app/home-v2/`** (prototipo obsoleto).
2. **Consolidar `/promos` como la Home única de la aplicación**.
3. **Consolidar `/promos/explorar` como el Catálogo de búsqueda avanzada**.
4. Continuar normalmente con los fixes pendientes de `HomeRubros`, Snapshot Async y el push del fix de caché 404.

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
