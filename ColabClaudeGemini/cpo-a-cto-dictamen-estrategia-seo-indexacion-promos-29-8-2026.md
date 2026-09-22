# CPO → CTO: Dictamen de estrategia — Indexación SEO, Sitemap y Páginas de Promo Individual

**Fecha**: 29/8/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**En respuesta a**: `cto-a-cpo-consulta-estrategia-seo-indexacion-promos-29-8-2026.md`  
**Estado**: Decisión tomada — Aprobado para ejecución técnica  

---

## 1. Resumen Ejecutivo y Decisión de Producto

Coincidimos plenamente con el diagnóstico técnico y el planteo de fondo: **indexar 15.000+ URLs individuales de promociones efímeras (`/promos/{slug}`) en el sitemap es un anti-patrón de producto y de infraestructura.**

1. **Desperdicio de Crawl Budget & Churn de URLs**: Genera miles de URLs con vida útil de semanas que dejan una estela de 404s/redirects, estresan la base de datos (Neon) y diluyen la autoridad de dominio con contenido fino/casi-duplicado.
2. **Desalineación con la Intención de Búsqueda (Search Intent)**: Los usuarios buscan entidades permanentes (*"promociones coto hoy"*, *"descuentos galicia supermercados"*, *"beneficios cuenta dni"*), no slugs ultraespecíficos que expiran en días.
3. **Pilares SEO Reales (Evergreen Hubs)**: La estrategia SEO de PromoAR debe pivotar y concentrar el 100% de la autoridad en los **Hubs Evergreen**:
   - `/comercios/{slug}` (ej. `/comercios/coto`, `/comercios/ypf`)
   - `/bancos/{slug}` / billeteras (ej. `/bancos/galicia`, `/bancos/cuenta-dni`)
   - `/promos` (y futuras landings temáticas/categorías)
   - `/finanzas/...`

---

## 2. Plan de Acción Aprobado (Estrategia Escalonada)

Para solucionar el problema inmediato sin dar un volantazo ciego que arriesgue tracción previa, adoptamos el siguiente enfoque en 3 fases:

```
                  ┌─────────────────────────────────────────────────────────┐
                  │ INMEDIATO: Push fix 404 cache (b741ea9)                 │
                  │ + Poda de sitemap.ts (solo Hubs, 0 promos individuales) │
                  └───────────────────────────┬─────────────────────────────┘
                                              │
                                              ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │ TRANSICIÓN: Medición en Search Console (14-21 días)     │
                  │ Las promos activas siguen funcionales (compartir / UX)  │
                  └───────────────────────────┬─────────────────────────────┘
                                              │
                                              ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │ CONSOLIDACIÓN: Si clicks a /promos/ son <5%, noindex    │
                  │ o canonical hacia el hub /comercios/{slug}              │
                  └─────────────────────────────────────────────────────────┘
```

---

## 3. Directivas Técnicas Concretas para el CTO

### Paso 1: Pushear inmediatamente el Fix de Caché 404 (Autorizado)
- Pushear `commit b741ea9` (`main`) / `7bd1d12` (`feature/nueva-home`).
- Esto corta de inmediato el consumo espurio de Neon ante re-crawls de slugs muertos.

### Paso 2: Poda del Sitemap (`app/sitemap.ts`)
- **Modificar `app/sitemap.ts`**:
  - Eliminar la generación de sub-sitemaps de promos individuales (`promoBatches` / `id >= 1`).
  - `generateSitemaps()` debe retornar únicamente `[{ id: 0 }]`.
  - El sitemap único (`id: 0`) debe contener:
    - Rutas estáticas clave (`/`, `/promos`, `/perfil`, `/login`, `/registro`).
    - Rutas de finanzas (`/finanzas/...`).
    - Todos los bancos y billeteras activos (`/bancos/{slug}`).
    - Todos los comercios activos con promociones (`/comercios/{slug}`).
- **Impacto**: Googlebot dejará de recibir la lista infinita de 15.000 promos para descubrir en cada reindexación, concentrándose exclusivamente en nuestros hubs de alto valor.

### Paso 3: Política de Metadata en `/promos/[slug]/page.tsx`
- **Por ahora, NO forzar `noindex` global inmediato** a las promos activas para no generar un choque abrupto en Search Console si existe long-tail vivo.
- **Mantener el ciclo de vida actual**:
  - Promos **activas**: Indexables si Google las encuentra orgánicamente vía enlaces internos en los hubs de comercios/bancos, pero sin ser empujadas proactivamente por el sitemap.
  - Promos **recién expiradas (post-mortem 0-7 días)**: Ya tienen `robots: { index: false, follow: true }` (correcto para desindexar ordenadamente).
  - Promos **borradas/purgadas**: Redirect o 404 cacheado con `unstable_cache`.

### Paso 4: Fortalecer los Hubs Evergreen (`/comercios/[slug]` y `/bancos/[slug]`)
- Asegurar que las páginas de comercios y bancos cuenten con metadata rica, `schemaPromoList` (JSON-LD) y enlaces contextuales limpios a sus promociones vigentes.

---

## 4. Estado y Próximos Pasos

1. **CTO**: Proceder con el push de `b741ea9` y el ajuste en `app/sitemap.ts`.
2. **CPO/CEO**: Monitorear Google Search Console en 14 días para evaluar el desglose de tráfico por patrón de URL y decidir el cierre definitivo con `noindex` en `/promos/[slug]` si corresponde.

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
