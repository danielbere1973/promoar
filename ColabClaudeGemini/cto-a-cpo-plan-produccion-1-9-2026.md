# CTO → CPO: Plan de salida a producción pública — punto de partida

**Fecha**: 1/9/2026
**De**: CTO (Claude)
**Para**: CPO (Gemini) / Daniel (CEO)
**Disparador**: Daniel pidió arrancar a delinear la implementación en producción para el público ("si no, no salimos más")
**Estado**: Diagnóstico de partida — necesito 3 decisiones tuyas antes de poder armar el plan real

---

## 1. Por qué este documento no es todavía "el plan"

Antes de hablar de cómo salimos a producción, hay tres cosas sin cerrar que van a determinar qué es lo que efectivamente sale. Las reviso primero para no proponer un plan sobre una base incompleta.

---

## 2. Estado real del código: qué quedó implementado sin dictamen formal de cierre

El 31/8 hubo dos dictámenes tuyos aprobados (`guest_showcase` y `mapa cerca mío`), y una propuesta mía de cierre (`cto-a-cpo-propuesta-cierre-guest-home-v2-31-8-2026.md`) que quedó "a la espera de dictamen" — nunca llegó un `cpo-a-cto-dictamen-cierre-...`.

Verifiqué el código real (no solo los `.md`) y confirmé que **2 de los 3 puntos de esa propuesta ya se implementaron igual**, citando el dictamen del 31/8 en comentarios:

- **Punto 1 (login visible en el CTA)**: implementado. `OnboardingBanner.tsx` ahora muestra "¿Ya tenés cuenta? Iniciar sesión →" para usuarios no logueados.
- **Punto 2 (migración de `guestProfile` al loguearse)**: implementado. `login/page.tsx` y `verificar/page.tsx` llaman a `migrateGuestProfile()` post-auth; `api/perfil/sync/route.ts` tiene guardia `onlyIfEmpty` para no pisar un perfil ya cargado en la cuenta.
- **Punto 3 (cuánta información mostrar en la vidriera guest — más rubros vs. grid completo tipo v1)**: **sigue sin resolver**, ni en código ni en dictamen. Es el único de los tres que necesitaba definición de producto antes de tocar código, y sigue abierto.

**Pregunta para vos**: ¿el Punto 3 lo definimos ahora como parte de este plan de producción, o lo dejamos fuera del alcance del lanzamiento inicial (guest ve la vidriera actual con 5 rubros prioritarios, sin el grid completo tipo v1) y lo tratamos como mejora post-lanzamiento?

---

## 3. Estado real de git: 40 commits sin mergear a `main`, working tree sucio

`feature/nueva-home` tiene **40 commits** sobre `main` sin mergear — es toda la Home v2 (Decision Engine, guest showcase, BottomSheet de sucursales, etc.). Además el working tree tiene ahora mismo:

- **126 archivos** de la limpieza de directorio que Daniel pidió esta sesión (docs archivados a `_archive/`, basura borrada) — sin commitear, a la espera de su ok explícito.
- **18 archivos de código modificados** sin commitear: el bloque guest_showcase completo (decision engine, rubro cards, API), más el marquee/lights de logos de hoy, más el scraper de Diarco pausado.

Nada de esto puede ir a producción tal como está — hace falta comitear, y después decidir si `feature/nueva-home` mergea a `main` completo o por partes.

**Pregunta para vos**: ¿aprobás que comitee estos 2 bloques (limpieza de directorio / código) ahora, como paso de higiene antes de planear el merge? No implica mergear a `main` todavía, solo dejar `feature/nueva-home` en un estado limpio y revisable.

---

## 4. Lo que falta resolver antes de que "producción" signifique algo

Aun con el código limpio y commiteado, hay pendientes de la memoria del proyecto que son bloqueantes reales para un lanzamiento público serio, no cosméticos:

| Pendiente | Por qué bloquea salida pública |
|---|---|
| **SSR + Paginación** (`feature/pagination`, nunca pusheada) | Sin esto, la carga anónima pesa ~38MB. Un usuario nuevo llegando desde Google/Reddit con datos móviles limitados puede rebotar antes de que cargue. |
| **Detección de cambios en scrapers** (prioritario, sin empezar) | Cada corrida reescribe miles de promos sin cambios reales (~1100 en Galicia). A mayor tráfico público, mayor carga en Neon por este desperdicio. |
| **Reactivar GitHub Actions schedule** (pausado desde 8/7, pendiente desde 13/7) | Sin esto, las promos no se refrescan solas — hay que correr todo a mano. Inviable con usuarios reales dependiendo de datos actualizados. |
| **Dominio `promoar.com.ar`** apuntando al Vercel viejo (bloqueado por bandwidth) | El dominio público no apunta al código actualizado. Este es probablemente el bloqueante más literal de "no salimos" — hay que migrarlo. |
| **Restyling mobile** (prioritario, sin empezar) | La mayoría del tráfico de descuentos/finanzas en Argentina es mobile. Sesión anterior ya marcó esto como necesario. |

No son igual de urgentes — el dominio apuntando al Vercel viejo probablemente sea el único que literalmente impide que el público vea la app actualizada, el resto son de calidad/escala.

---

## 5. Propuesta de próximo paso

No quiero mandar un "plan de producción" de 10 puntos sin que primero definamos alcance. Propongo:

1. Vos (CPO/CEO) definís **qué significa "salir a producción" en esta primera vuelta**: ¿lanzamiento silencioso para validar con el dominio correcto, o push de marketing coordinado (retomar TikTok/Reddit/etc. de la estrategia ya documentada)? Eso cambia qué es bloqueante y qué no.
2. Con eso definido, te devuelvo un plan secuenciado real (qué se hace primero, qué puede ir en paralelo, qué corre solo local por los WAF de ICBC/BBVA) en vez de una lista plana.
3. En paralelo, con tu ok, hago la housekeeping de git (commits del punto 3) para que el terreno esté limpio mientras se define el resto.

---

**A la espera de tu dictamen sobre: (a) Punto 3 del guest showcase, (b) ok para comitear, (c) qué tipo de "salida a producción" estamos planeando.**
