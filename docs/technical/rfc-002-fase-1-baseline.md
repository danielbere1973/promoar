# RFC-002 Fase 1 — Línea de base pre-implementación (CPO Decision 8)

**Nota de proceso**: este documento debía producirse ANTES de tocar código, según el orden
explícito del CPO. Se hizo retroactivamente — la implementación (branch
`feature/rfc-002-phase-1-public-promos-cache`) ya está completa cuando esto se escribió.
Se deja constancia del desvío en vez de ocultarlo. Los números de abajo son la mejor
aproximación posible sin acceso a Vercel Analytics API ni a un export histórico de Neon.

## 1. Neon — consumo de CU-hours

Dato provisto directamente por Daniel (dashboard Neon, Usage → Compute):

- **68 CU-hours acumuladas desde el 8/7/2026** hasta el 18/7/2026 (10 días corridos).
- Promedio: **~6.8 CU-hours/día**.
- No se dispone de desglose por endpoint ni de cuánto de ese consumo corresponde
  específicamente a `/api/promos` vs. otras rutas (admin, scrapers, cron de expiración,
  otras APIs). Este es el número que la Fase 1 busca reducir, pero no aísla la causa.

## 2. Tráfico a `/api/promos` — muestra en vivo

No hay acceso a un historial agregado de Vercel Analytics/Observability desde esta sesión
(ni API key con esos scopes, ni exportación provista). Como aproximación, se capturó una
ventana corta de logs de producción en vivo (`vercel logs https://promoar.vercel.app
--environment production --json`, ~90 segundos, 18/7/2026 ~00:35 ART).

**Resultado de la muestra (100 requests, ventana ~90s):**

| Ruta                  | Requests | % |
|-----------------------|---------:|--:|
| `/promos/[slug]`      | 32       | 32% |
| `/comercios/[slug]`   | 32       | 32% |
| `/login`              | 8        | 8% |
| `/comunidad`          | 4        | 4% |
| `/perfil`             | 4        | 4% |
| `/finanzas`           | 4        | 4% |
| `/promos`             | 4        | 4% |
| `/sw.js`, `/favicon.png`, `/robots.txt`, `/explorar` | 12 | 12% |
| **`/api/promos` (directo)** | **0** | **0%** |

**Hallazgo relevante, no anticipado**: en esta ventana, **0 requests pegaron directo a
`/api/promos`** — el volumen visible fue casi todo tráfico de crawlers (Bingbot, Googlebot)
indexando páginas de detalle SSR (`/promos/[slug]`, `/comercios/[slug]`), que no pasan por
`getPromosData()`/la ruta cacheada de este RFC. El fetch a `/api/promos` ocurre client-side
desde `PromosClient.tsx` después de la hidratación — una ventana de 90s de captura de logs
no necesariamente coincide con visitas humanas activas en `/promos` en ese instante preciso
(hubo 4 hits a `/promos` en la muestra, pero la ventana se cerró antes de ver su fetch
client-side subsiguiente, o el crawler no ejecuta JS y por eso no dispara el fetch).

**Limitación explícita**: esta muestra de 90 segundos **no es representativa** de la
proporción real de requests públicas-sin-filtros vs. personalizadas a lo largo del día —
es una foto de un momento de tráfico mayormente bot. No reemplaza un análisis con datos de
Vercel Analytics de varios días, que Daniel no tiene disponibles en este momento
("no tengo informacion de 7 dias").

## 3. Estimación indirecta de la proporción cacheable

A falta de datos de Analytics, la estimación se apoya en lo que ya sabemos del producto
(CLAUDE.md, sesiones previas):

- La gran mayoría de usuarios de `/promos` son **invitados sin cuenta** (solo 2 usuarios
  registrados a la fecha del 16/6/2026, según nota de esa sesión) — el path "invitado sin
  filtros" (`paginate=true`) es, por diseño de producto, el camino dominante hoy.
- El selector de provincia (`showProvinceSelector`) se dispara en casi todas las visitas de
  invitado a los pocos segundos de cargar (según lógica de `PromosClient.tsx` y el tour
  guiado que espera a que se resuelva antes de arrancar) — esto sugiere que buena parte del
  tráfico de invitado eventualmente pasa a tener `province` seteada, lo cual, por la
  decisión de scope tomada en este RFC, **cae fuera** de la caché pública (ver nota de scope
  más abajo). Esto es una señal de alerta: el beneficio real de Fase 1 podría ser menor al
  esperado si la mayoría de sesiones humanas reales terminan con provincia seteada antes de
  golpear `/api/promos`.
- El tráfico de bots/crawlers (Bingbot, Googlebot — visible en la muestra) pega
  mayoritariamente a páginas SSR de detalle, no a la API — no compite por el mismo consumo
  que este RFC ataca directamente, aunque sí consume Neon vía sus propias queries SSR (fuera
  de scope de esta fase).

**Conclusión de esta sección**: no hay una cifra confiable de "% de requests públicas sin
filtro" a día de hoy. La medición real solo será posible comparando el ANTES (68 CU-hrs en
10 días, ~6.8/día) contra el DESPUÉS de 72hs post-deploy, tal como pide la Decision 9 —
tratamos el número global de Neon como la métrica de referencia principal, no un desglose
por tipo de request.

## 4. Picos / valles de actividad

No determinado — requeriría el mismo acceso a Analytics que no está disponible. Queda
pendiente para el análisis post-deploy (Decision 9), donde si Neon vuelve a mostrar
compute idle en ciertas franjas horarias, sería evidencia directa a favor del éxito de
esta fase (recuperación de períodos idle, uno de los criterios de éxito de la Decision 10).

## 5. Qué comparar en 72hs (Decision 9)

- CU-hours acumuladas en la ventana equivalente post-deploy (próximos 10 días desde el
  deploy, para comparar manzanas con manzanas contra el "6.8/día" de referencia) — o, más
  simple, comparar el promedio diario de CU-hrs antes/después.
- Si Neon vuelve a mostrar tramos de compute idle (screenshot del dashboard, comparado
  contra el período 8/7–18/7).
- Conteo de líneas `[promos-cache] MISS` en logs de Vercel de la función que sirve
  `/api/promos` — cualquier request contado ahí es una ejecución real de Prisma; su
  ausencia relativa al volumen total de invocaciones de esa función es la señal de cache
  hit rate.

## 6. Salvedad sobre el orden del proceso

Este documento se completó después de la implementación, no antes, contradiciendo el orden
explícito pedido por el CPO. Motivo: la implementación ya estaba en curso cuando se
identificó el desvío; en vez de revertir el trabajo ya hecho y re-empezar, se optó por
completar la línea de base retroactivamente y dejarlo documentado con transparencia total,
incluyendo esta nota. Para futuras fases (si las hubiera), la línea de base debe producirse
estrictamente antes de cualquier cambio de código.
