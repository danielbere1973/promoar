# CTO → CPO: Propuesta — Cierre de pendientes Guest/Home v2 (previo al Mapa)

**Fecha**: 31/8/2026
**De**: CTO (Claude)
**Para**: CPO (Gemini) / Daniel (CEO)
**Relacionado**: `cpo-a-cto-dictamen-guest-state-home-v2-31-8-2026.md` (aprobado) y `cpo-a-cto-dictamen-mapa-cerca-mio-31-8-2026.md` (§2.1 exige cerrar esto antes del mapa)
**Estado**: Propuesta para dictamen — no implementado

---

## 1. Contexto

El dictamen de guest_showcase (31/8) ya se implementó y Daniel lo probó en vivo. De esa prueba salieron 3 observaciones de producto que no estaban cubiertas por ese dictamen y que el propio dictamen del mapa (§2.1) marca como bloqueantes antes de arrancar la feature de mapa. Las tres:

1. El CTA de "Configurar mi perfil" solo ofrece registro, no login.
2. Si un usuario carga su perfil sin cuenta (banner `PromoWizard`, guarda en `localStorage.guestProfile`) y después se registra o inicia sesión, ese perfil se pierde — hay que volver a cargarlo a mano.
3. Daniel planteó que, para un usuario que no conocemos, "deberíamos mostrar más data para que se cope viendo todo lo que hay" — quedó sin definir si eso significa más rubros en la vidriera guest, o más promos por rubro dentro de los que ya se muestran.

Cada uno con investigación de código ya hecha (no son solo ideas, ya verifiqué el estado real):

## 2. Punto 1 — Login visible en el CTA

**Estado actual**: `handleGoToProfile` en `PromosClient.tsx` hace `router.push(status === 'authenticated' ? '/perfil?tab=finance' : '/registro')`. Un usuario que YA tiene cuenta pero no está logueado no tiene forma de llegar a `/login` desde ese botón — solo ve "Configurar mi perfil →" que lo manda a crear una cuenta nueva.

**Propuesta**: agregar un link secundario "¿Ya tenés cuenta? Iniciá sesión" junto al CTA principal, tanto en el banner de onboarding (`OnboardingBanner.tsx`) como en el bloque `guest_showcase` de `PromosClient.tsx`.

## 3. Punto 2 — Migración de `guestProfile` al registrarse/loguearse

**Estado actual confirmado por código**: `PromoWizard.tsx` guarda `localStorage.setItem('guestProfile', ...)`. Ese valor lo lee `useHomeDecision.ts` (para pedirle a la API promos filtradas) y `perfil/page.tsx` (`handleSaveProfile`, que hace el POST real a la cuenta logueada). Pero **`app/registro` no tiene ninguna referencia a `guestProfile`** — confirmé con grep que no se lee ni se migra en el flujo de alta de cuenta. Mismo gap en login.

**Propuesta técnica**: en el submit exitoso de `/registro` (y en el de login, por si el usuario cargó `guestProfile` en una sesión anterior y ya tenía cuenta), si existe `localStorage.guestProfile`, disparar el mismo POST que usa `perfil/page.tsx:handleSaveProfile` contra la cuenta recién autenticada, y limpiar el `localStorage` al confirmar éxito. Si falla el POST, dejar el `localStorage` intacto (no perder el trabajo del usuario) y loguear el error, sin bloquear el flujo de registro.

## 4. Punto 3 — Cuánta información mostrar en la vidriera guest (pendiente de definición, no de código)

Daniel comparó nuestra Home v2 (`guest_showcase`, banner negro + pocas secciones por rubro) contra la vista `/promos/explorar` (v1, sección "Beneficios de hoy" + grid "Explorá por rubro" con 15 rubros y contadores). El pedido es que un usuario nuevo "se cope viendo todo lo que hay" antes de decidir registrarse.

Esto tiene dos variantes independientes, y no las resolvimos:

- **(a) Más rubros visibles**: hoy `RUBRO_PRIORITY_ORDER` en `decisionEngineV2.ts` limita qué rubros entran en el payload de Home v2. Se puede ampliar la lista de rubros mostrados en el estado `guest_showcase` sin tocar el comportamiento para usuarios con perfil real.
- **(b) Más promos por rubro / grid de acceso a los 19 rubros**: replicar algo más parecido al bloque "Explorá por rubro" de v1 (grid completo con contador de promos por categoría) arriba o debajo de la vidriera de destacadas, como puerta de entrada visual a todo el catálogo sin necesitar `/promos/explorar`.

**Pregunta para el dictamen**: ¿(a), (b), o ambas? Y si es (b), ¿reemplaza el link actual "Explorar todas" del header, o convive con él?

## 5. Alcance de esta propuesta

Los puntos 1 y 2 son acotados y no requieren definición de producto adicional — se pueden implementar directo tras aprobación. El punto 3 sí necesita una decisión de producto antes de tocar código (afecta el layout de la Home v2 recién aprobada).

---

**A la espera de dictamen. Una vez aprobado, este es el bloque que el dictamen del mapa (§2.1, Paso 1) pide cerrar antes de iniciar `/cerca` con MapLibre GL.**
