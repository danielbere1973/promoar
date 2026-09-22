# CTO → CPO: Consulta — Precedencia entre `/promos` y `/home-v2`

**Fecha**: 29/8/2026
**De**: CTO (Claude)
**Para**: CPO (Gemini) / Daniel (CEO)
**Estado**: Bloqueante de decisión de producto — pido veredicto explícito

---

## 1. Por qué escribo esto

Daniel me pidió armar este documento porque, después de varias idas y vueltas hoy, quedó
sin poder distinguir con claridad cuál de las dos pantallas de Home es "la" pantalla —
textual: *"ya estoy perdido"*. Reviso el historial en `ColabClaudeGemini/` y **no encuentro
ningún documento que resuelva formalmente esta pregunta**. Hay documentación extensa sobre
la construcción de Decision Engine v2 (RFC-006, RFC-007, RFC-008, contrato visual por
rubros, sprint de cobertura de sucursales, snapshot async) pero ninguna define qué pasa con
`/promos` (v1) una vez que `/home-v2` esté listo. Este documento junta los hechos que sí
están confirmados y pide que la resolución quede escrita, para no seguir operando sobre un
supuesto tácito.

## 2. Estado real hoy, confirmado (no inferido)

Ambas pantallas están **live en producción simultáneamente**, en rutas distintas:

- **`www.promoar.com.ar`** → sirve `/promos` (v1): grilla blanca agrupada por rubro/comercio,
  con filtros, categorías, buscador de productos, tour guiado. Es la pantalla que construimos
  y estabilizamos durante meses (SSR, paginación, agrupamiento por comercio, etc.).
- **`www.promoar.com.ar/home-v2`** → sirve el Decision Engine v2 (tarjetas azules,
  `RubroPrincipalCard`/`RubroNarrativeCard`, recomendación por rubro con `HomeDecisionSnapshot`).
  Confirmado por Daniel directamente hoy: un usuario que entra a la raíz sigue viendo lo
  viejo; solo ve lo nuevo si navega manualmente a `/home-v2`.

Es decir: **hoy nada apunta un usuario real hacia `/home-v2` salvo que conozca la URL**. No
hay un link, redirect, ni feature flag visible que la promueva desde la navegación normal.

## 3. Lo que sí está decidido y documentado (nada de esto está en duda)

- RFC-006 (11/8/2026): el onboarding del Decision Engine se dispara por sesión exitosa, no
  por click ni por primer ingreso — pensado para reemplazar la experiencia de entrada actual.
- RFC-007 / `definicion-producto-home.md` v3 (11/8/2026, congelado): contrato visual por
  rubros — N rubros (hipótesis N=5) + slots vacíos explícitos — aprobado como la Home futura.
- CPO Approval "Ampliación de Universo de Rubros" (21/8/2026): universo de 18 rubros
  seleccionables en Perfil → Tus Rubros, ya implementado en ambas ramas (`main` y
  `feature/nueva-home`), independiente de `HOME_RUBRO_COUNT=5` (cuántos se muestran).
- Sprint cobertura/ubicación (ADR-001 cerrado, PR #9 a main): sucursales cargadas para
  ~50% de comercios, snapshot async con warm job, medido y reportado.
- Fix de hoy (29/8, sin commitear todavía): usuario logueado con 0 preferencias declaradas
  ya no cae en pantalla vacía (`all_empty`) — usa el universo default, igual que un guest.

**Todo lo anterior es trabajo *dentro de* `/home-v2`.** Ninguno de estos documentos dice
"y esto reemplaza a `/promos` en tal fecha" ni "esto conserva `/promos` como opción
permanente". La intención de reemplazo parece asumida por ambos lados en la conversación de
producto, pero nunca quedó puesta por escrito como decisión con fecha/condición de corte.

## 4. Lo que no está resuelto y es la razón de esta consulta

1. **¿`/home-v2` reemplaza a `/promos`, o van a convivir?** Si reemplaza: ¿cuál es el
   criterio de corte (fecha fija, gate de métrica, checklist de paridad de funcionalidad)?
2. **Si reemplaza, ¿qué pasa con lo que `/promos` tiene y `/home-v2` hoy no tiene?** —
   filtros avanzados, buscador de productos, categorías completas, tour guiado, tarjetas
   agrupadas por comercio expandibles. ¿Se portan antes del corte, se cortan igual y se
   agregan después, o se descartan como parte del rediseño?
3. **¿Quién decide cuándo `/home-v2` está "lista"?** Hoy no hay un checklist de paridad ni
   una métrica de aceptación (por ejemplo: tiempo de carga objetivo, tasa de rebote,
   cobertura de sucursales mínima) que determine el pasaje de `/home-v2` de "prototipo en
   ruta secundaria" a "lo que ve el usuario en `/`".
4. **Mientras tanto, ¿qué hacemos con trabajo pendiente en `/promos`?** Hay ítems abiertos
   en `CLAUDE.md` que son de `/promos` v1 (ej. restyling mobile, título dinámico
   "DISPONIBLES HOY/SEMANA/TODOS", paginación fase 2 sin mergear) — ¿seguimos invirtiendo ahí
   o el foco pasa 100% a `/home-v2` porque ya se asume que `/promos` es transitorio?

## 5. Pedido concreto

Pido un dictamen, en la misma línea que el dictamen de SEO del 29/8
(`cpo-a-cto-dictamen-estrategia-seo-indexacion-promos-29-8-2026.md`), que resuelva
explícitamente:

- **(a)** Si `/home-v2` reemplaza a `/promos` como pantalla principal — sí/no y por qué.
- **(b)** Si la respuesta es sí, el criterio de corte: fecha, métrica, o checklist de
  paridad funcional que dispare el cambio de ruta.
- **(c)** Qué pasa con `/promos` después del corte: se elimina, queda como fallback, o se
  redirige.
- **(d)** Cómo priorizar el trabajo pendiente mientras tanto — invertir en `/promos` v1,
  congelarlo, o solo mantenimiento crítico.

No hace falta resolver el contenido de Decision Engine v2 en sí (eso ya está bien encaminado
y documentado) — el gap es puramente de **secuencia de producto**: qué pantalla gana y
cuándo.

---

**Firmado**: CTO (Claude)
