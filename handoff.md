# Handoff — Home v2 (rediseño de la Home cerrada)

## 1) Estado actual del proyecto

Estamos rediseñando la Home de PromoAR (`/promos`) siguiendo dirección del CPO: pasar de
"Home + catálogo en la misma pantalla" a una **experiencia cerrada de decisión** separada
del catálogo tradicional.

Estructura aprobada:

```
/promos            → Home personalizada ("¿qué me conviene hoy?")
                      Spotlight → recomendaciones #2 y #3 → señales útiles →
                      CTA "Explorar todas las promociones" → FIN

/promos/explorar    → catálogo tradicional completo
                      búsqueda, filtros, categorías, destacadas, cerca tuyo, listado
```

**Ya terminado (esta sesión):**
- 5 componentes nuevos en `app/components/`: `PaymentMethodBadge.tsx`,
  `RecommendationSpotlight.tsx`, `RecommendationSecondaryCard.tsx`, `SignalStrip.tsx`,
  `ExploreCatalogCta.tsx`.
- `app/promos/explorar/` — nueva ruta con el catálogo completo (copia íntegra del
  `PromosClient.tsx` original, con el bloque Home removido y el bug de rutas
  hardcodeadas corregido).
- `app/promos/page.tsx` y `app/promos/PromosClient.tsx` — reescritos desde cero como
  la nueva Home cerrada (de 2805 líneas de catálogo a ~165 líneas de Home pura).
- `npx tsc --noEmit` sin errores nuevos (los ~40 preexistentes son de archivos no
  tocados: `page_old.tsx`, scrapers, etc. — verificado contra HEAD).
- `npx next build` **exitoso**: `/promos` (7.89 kB) y `/promos/explorar` (22.9 kB)
  compilan como rutas independientes.

**Pendiente inmediato:** falta la prueba manual en browser (`npm run dev`) navegando
`/promos` ↔ `/promos/explorar` — ver sección 3.

**Todavía sin commitear.** Todo el trabajo de esta sesión está en el working tree,
sin `git add`/`git commit`. Rama actual: `main` (verificar antes de commitear si
correspondía trabajar en una rama de feature — no se creó ninguna en esta sesión).

## 2) Decisiones importantes

1. **Ruta separada (`/promos/explorar`) en vez de toggle de estado en la misma URL.**
   - Por qué: permite loggear "el usuario eligió explorar" como una transición real
     (evento de navegación), evita estados híbridos raros con el botón atrás o con
     links directos a la Home que "recuerdan" que el usuario ya había expandido el
     catálogo.
   - Alternativa descartada: mismo `/promos` con un estado `showCatalog` en React que
     revela el catálogo debajo del CTA sin cambiar de URL. Descartada explícitamente
     por el CPO ("No quiero eso" — el catálogo NO debe seguir debajo en la misma
     pantalla, ni siquiera vía toggle).

2. **Copiar el `PromosClient.tsx` monolítico entero a `/explorar` en vez de refactorizarlo
   quirúrgicamente in-place.**
   - Por qué: un agente de exploración mapeó el archivo original y encontró estado
     profundamente entrelazado entre Home y catálogo, con `Section`/`ProductSection`
     como componentes anidados dentro de un IIFE que cierran sobre variables locales
     (no extraíbles sin refactor grande). Copiar todo y solo remover la porción Home
     preserva 100% del comportamiento del catálogo sin riesgo de romperlo.
   - Alternativa descartada: extraer `Section`/`ProductSection` a componentes
     independientes reutilizables entre ambas rutas. Descartada por alto riesgo /
     bajo beneficio inmediato — se puede revisar más adelante si hace falta compartir
     código entre `/promos` y `/promos/explorar`.

3. **La nueva Home NO comparte estado/fetch con el catálogo** (arquitectura de
   componentes totalmente independiente, no un padre común con hijos condicionales).
   - Por qué: Home y catálogo ya no viven en el mismo árbol de render una vez separadas
     las rutas, así que compartir estado cross-route habría requerido Context/store
     global sin necesidad real. La Home hace su propio fetch liviano de perfil
     (`/api/perfil`) en vez de heredarlo del catálogo.
   - Alternativa descartada: layout compartido (`app/promos/layout.tsx`) con estado de
     provincia/perfil elevado y compartido entre `/promos` y `/promos/explorar`.
     Quedó identificada como posible mejora futura (el `layout.tsx` actual solo pone
     metadata canónica), pero no se implementó — no era necesaria para este alcance.

4. **Tarjeta secundaria propia (`RecommendationSecondaryCard.tsx`) en vez de reutilizar
   el `PromoCard` genérico del catálogo.**
   - Por qué: `PromoCard` está pensado para el catálogo, con más metadata visible de
     la necesaria en la Home (chips de tope/mínimo, badges de guardado, etc.). La
     propuesta original de Home v2 ya había flaggeado esto como gap.
   - Alternativa descartada: seguir usando `PromoCard` en las recomendaciones #2/#3
     como hacía el viejo `RecommendationBlock.tsx`. Descartada porque el medio de
     pago no era protagonista ahí (requisito explícito del CPO) y la densidad visual
     no encajaba con la jerarquía reducida que pide la Home cerrada.

5. **Medio de pago como elemento protagonista vía componente compartido
   (`PaymentMethodBadge.tsx`)**, con prioridad de logo banco > billetera > red de
   tarjeta, en vez de texto plano dentro del "reason".
   - Por qué: requisito explícito del CPO en la revisión de la propuesta original
     (el medio de pago pasa de texto secundario a un badge visual con logo).
   - Alternativa descartada: mantenerlo como parte del string de "reason" (como en
     `HomeHero`/`RecommendationBlock` original) — insuficiente jerarquía visual.

6. **`SignalStrip.tsx` solo renderiza chips derivados de datos reales ya presentes en
   la respuesta de recomendaciones** (vencimiento próximo, disponible online, cerca
   tuyo si hay dato) y **no renderiza nada si no hay señales genuinas**.
   - Por qué: requisito explícito del CPO — "algunas señales adicionales si aportan
     valor real". Nunca texto promocional inventado.
   - Alternativa descartada: agregar señales "de relleno" (ej. contador de comercios
     totales, banner genérico de "hay más promos") para que la sección nunca esté
     vacía. Descartada por ir contra el principio de no fabricar valor percibido.

7. **`nearby` (sucursales cercanas) NO se implementó en la Home v1** — el prop existe
   en `SignalStrip` pero se deja sin poblar por ahora.
   - Por qué: en el catálogo, la cercanía se resuelve con un fetch por comercio
     (`/api/branches/nearby?lat&lng&radius`), no una sola llamada agregada. Replicar
     esa lógica en la Home habría inflado el alcance de esta sesión sin pedido
     explícito del CPO sobre esto.
   - Alternativa descartada: portar tal cual la lógica de `nearbyBranches` (fetch por
     comercio + estado `Record<string, NearbyBranches>`) a la nueva Home. Queda como
     mejora futura, no bloqueante — `SignalStrip` ya maneja el caso "sin dato" sin
     romperse (simplemente no muestra el chip "cerca tuyo").

8. **La página de detalle real (`app/promos/[slug]/page.tsx`, SSR/SEO) no se tocó ni
   se duplicó** — es independiente del `pushState` cosmético que abre `PromoDetailSheet`
   como overlay dentro de `/promos/explorar`.
   - Por qué: son dos mecanismos distintos (uno es navegación real de Next.js indexada
     por Google, el otro es solo UX de "compartir/atrás" sobre un overlay del cliente).
     No hay necesidad de que coincidan 1:1.
   - Alternativa descartada: mover o duplicar `[slug]/page.tsx` a `explorar/[slug]/`.
     Innecesaria — la SEO page sigue funcionando igual desde su ubicación original.

## 3) Próximo paso

**Tarea pendiente exacta:** levantar el servidor de desarrollo (`npm run dev`) y probar
manualmente en el browser la navegación `/promos` ↔ `/promos/explorar`:

- Verificar que `/promos` muestra Spotlight + recomendaciones secundarias + señales +
  CTA, sin ningún rastro de catálogo debajo.
- Click en el CTA "Explorar todas las promociones" → confirma que navega a
  `/promos/explorar` y ahí sí aparece el catálogo completo (búsqueda, filtros,
  categorías, "Destacadas hoy", "Cerca tuyo", listado).
- Abrir el detalle de una promo desde el catálogo (`/promos/explorar`) y cerrarlo →
  confirmar que el usuario permanece en `/promos/explorar` (no se lo redirige a
  `/promos`) — este era el bug de `BASE_PATH` hardcodeado que se corrigió a ciegas
  (sin test manual todavía) durante la construcción.
- Abrir el detalle de una promo desde la Home (`/promos`, vía Spotlight o tarjeta
  secundaria) y cerrarlo → confirmar que el usuario permanece en `/promos`.
- Revisar el estado "sin perfil" (usuario invitado / logueado sin banco-billetera-tarjeta
  cargados): confirmar que el Spotlight muestra el teaser genérico + botón
  "Configurar mi perfil →" y que el copy nunca implica personalización falsa.
- Revisar `OnboardingBanner` en la nueva Home (props `isLoggedIn`/`hasProfile`/
  `profileReady`) — confirmar que aparece/desaparece según corresponda.
- Mobile: la nueva Home no fue revisada aún en viewport mobile — validar que el layout
  (grid de 2 columnas para las secundarias, spacing) se ve bien en pantallas chicas.

Una vez validado esto, marcar completo el todo "Home v2: validar build local y probar
navegación" y decidir junto al CPO si se commitea y en qué rama (no se creó rama de
feature en esta sesión — el trabajo está directamente en el working tree de `main`,
sin commitear).

## 4) Información útil

### Arquitectura del cambio
- **Antes**: `app/promos/page.tsx` (SSR con preview de 50 promos) + `app/promos/PromosClient.tsx`
  (2805 líneas, monolito Home+catálogo en un solo árbol de render).
- **Ahora**:
  - `app/promos/page.tsx` — server component mínimo, solo renderiza `<PromosClient />`
    sin SSR de catálogo (las recomendaciones se resuelven 100% client-side vía
    `useRecommendations`).
  - `app/promos/PromosClient.tsx` — nueva Home cerrada, ~165 líneas, independiente.
  - `app/promos/explorar/page.tsx` — copia exacta del viejo `page.tsx` (SSR con
    `getPromosData`, `PREVIEW_TAKE=50`, misma lógica `paginate`/`forMe`/`noFilters`
    que antes).
  - `app/promos/explorar/PromosClient.tsx` — copia del monolito original con la
    porción Home removida; contiene TODO el catálogo (2805 líneas menos el bloque Home).

### Componentes nuevos (`app/components/`)
- **`PaymentMethodBadge.tsx`** — pill con logo (banco > billetera > red de tarjeta) +
  nombre. Props: `{ req, size?: 'sm'|'md' }`. Usa `CARD_NETWORK_LOGOS` de
  `EntitiesSheet.tsx`.
- **`RecommendationSpotlight.tsx`** — reemplaza a `HomeHero.tsx` (que sigue existiendo,
  sin usar, huérfano — ver "problemas conocidos"). Misma máquina de 4 estados
  (loading / incomplete_profile con teaser / empty / ok), con `PaymentMethodBadge`
  como protagonista. Props: `{ data, loading, teaserPromos?, onOpenPromo, onGoToProfile }`.
  **Nota**: la nueva Home NO le pasa `teaserPromos` todavía (no hay fuente de datos
  genérica sin catálogo cargado) — el estado teaser hoy se muestra sin promos de
  ejemplo, solo el copy + botón. Posible mejora futura.
- **`RecommendationSecondaryCard.tsx`** — tarjeta compacta para recomendaciones #2/#3.
  Props: `{ promo, reasons, onClick }`.
- **`SignalStrip.tsx`** — chips funcionales (vencen pronto / disponibles online / cerca
  tuyo si hay dato) + CTA "Compartí tu ubicación" si `status === 'no_location'`. No
  renderiza nada si no hay señales reales. Props: `{ data, nearby?, onShareLocation }`.
- **`ExploreCatalogCta.tsx`** — único punto de salida de la Home hacia
  `/promos/explorar`, dispara `recommendation_cta_clicked` (`cta: 'explorar_catalogo'`).

### Hooks/libs reutilizados sin modificar
- `lib/useRecommendations.ts` — fetch a `/api/promos/recommended`, lee `guestProfile`
  y `userLocation` cacheados de `localStorage`. Diseñado para llamarse UNA VEZ por
  pantalla (comentario en el propio código lo advierte) — la nueva Home lo llama una
  sola vez, no hay duplicación.
- `lib/recommendationEvents.ts` — `trackRecommendationEvent(eventType, payload)`, POST
  a `/api/events`. Eventos usados en la nueva Home: `recommendation_block_shown`,
  `recommendation_clicked`, `recommendation_cta_clicked`.
- `app/components/OnboardingBanner.tsx`, `SplashScreen.tsx`, `BottomNav.tsx`,
  `ThemeToggle.tsx`, `PromoDetailSheet.tsx` (`{ promo, nearbyBranch?, onClose }`),
  `ProvinceSelector.tsx` (`{ onSelect, onDismiss, currentProvince? }`) — todos
  reutilizados sin cambios, solo verificadas sus firmas de props antes de integrarlos.

### Convenciones del proyecto (recordatorio, no específico de esta sesión)
- Comunicación siempre en español.
- `.env` apunta a Neon de **producción** (`ep-fragrant-bird-am3uvyq5`) — nunca tocar
  directo. `.env.local` apunta a `dev-promoar` (`ep-cool-lake-ammkwaug`) — usar para
  testing local.
- Merge a `main` siempre requiere aprobación explícita separada del CPO/CEO — nunca
  unilateral.
- Nunca commitear archivos de scratch/análisis.
- Roles: Daniel = CEO+CPO (emite decisiones/RFCs), Claude = CTO (implementa y
  documenta).

### Problemas conocidos / deuda técnica
- **`app/components/HomeHero.tsx` y `RecommendationBlock.tsx` quedaron huérfanos** —
  ya no los usa nadie (la Home vieja que los usaba fue reemplazada). No se borraron
  esta sesión por si hace falta comparar/revertir. Candidatos a eliminar una vez
  confirmada la validación manual.
- **`BASE_PATH` hardcodeado corregido "a ciegas"** en
  `app/promos/explorar/PromosClient.tsx` (constante `BASE_PATH = '/promos/explorar'`
  reemplazando 3 usos de `/promos` hardcodeado en `openPromoDetail`/`closePromoDetail`/
  popstate listener) — identificado proactivamente por un agente de exploración antes
  de que causara un bug real, pero **todavía sin probar en browser** (ver sección 3).
- El `tsc --noEmit` completo del proyecto tiene ~40 errores preexistentes en archivos
  no relacionados (`app/page_old.tsx`, `app/page_WITH_TOOLTIPS.tsx`, varios
  `lib/scrapers/*.ts`, `app/api/og/daily/route.tsx`, etc.) — no introducidos por esta
  sesión, no se tocaron.
- `npm run build` (con `prisma generate` incluido) falló por `EPERM` en Windows
  (probablemente `npm run dev` corriendo en paralelo bloqueando el `.dll.node` de
  Prisma) — se usó `npx next build` directo como workaround, que sí compiló limpio.
  Si se vuelve a correr build completo, cerrar cualquier `next dev` activo primero.
- Trabajo de esta sesión **sin commitear** — vive en el working tree de `main`.

### Contexto no relacionado a Home v2, pero abierto en paralelo (no tocar sin pedido explícito)
- Recommendation Snapshot v1: 8 validaciones pendientes, la #8 requiere medición
  manual del CPO en Preview (no relacionado a Home v2 directamente, pero comparte
  varios de los mismos componentes de recomendaciones).
- Password temporal + `TrustedDevice` de prueba para `nerocketpin@gmail.com` en
  dev-promoar — pendiente de revertir una vez cerrada la Validación 8.
- Token de Vercel Protection Bypass — pendiente de revocar una vez cerradas todas las
  validaciones del Recommendation Snapshot.
