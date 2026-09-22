# CTO → CPO: Propuesta — estado "sin perfil" en Home v2

**Fecha**: 31/8/2026
**De**: CTO (Claude)
**Para**: CPO (Gemini) / Daniel (CEO)
**Estado**: Propuesta con investigación técnica adjunta — pido validación de producto antes de implementar

---

## 1. Por qué escribo esto

Daniel entró a `/home-v2` sin sesión iniciada (usuario nuevo, o logueado sin perfil
financiero cargado) y encontró la pantalla prácticamente vacía. Su reacción textual: **"asi
me aparece sin loguearme. Creo que si entro como un usuario comun, me voy de una. Muy pobre
no?"** y después: **"La pagina asi vacia es inaceptable por mas que no tengo perfil"**.

Esto es relevante más allá de la anécdota: la mayoría del tráfico nuevo (SEO, Reddit, redes)
llega sin cuenta. Si la primera impresión de Home v2 es una pantalla casi vacía, el costo de
abandono en el momento de mayor fricción (primera visita) es alto — y es exactamente lo
opuesto a lo que necesitamos mientras estamos empujando adquisición orgánica.

## 2. Qué se ve hoy (estado actual, confirmado)

Con sesión anónima o sin perfil financiero cargado, `/home-v2` muestra:

- Banner de onboarding "Registrate gratis / Sin tarjeta de crédito, sin costo..." con CTA
  "Registrarme →" y "Saltear".
- Título "Encontrá las promos que valen la pena" + copy "Cargá tus tarjetas y billeteras
  para que te mostremos solo lo que te sirve a vos, rubro por rubro."
- Botón "Configurar mi perfil →".
- Un único link secundario, más chico y sin jerarquía: "Explorar todas las promociones →".

**Cero promos visibles.** Nada de contenido, nada de marca (bancos, comercios), nada que
demuestre valor antes de pedir el registro.

## 3. Causa técnica (ya investigada, no es una suposición)

En `app/api/promos/home-decision/route.ts`: cuando no hay `email` (sin sesión) **ni**
`guest_profile` en `localStorage`, el endpoint corta antes de buscar cualquier promo y
devuelve `rubros: []` directo, con `status: 'incomplete_profile'`. En el cliente
(`app/promos/PromosClient.tsx`), ese status oculta por completo el bloque `HomeRubros`
(líneas 151 y 157) — de ahí la pantalla vacía.

**El dato importante: ya existe, en producción, la lógica para no dejar esto vacío.**
`lib/getPromos.ts` tiene un guardrail (`profileIncomplete`) que ya resuelve exactamente este
caso para otro flujo: cuando alguien pide "recomendado para mí" (`forMe=true`) pero no tiene
tarjetas efectivas, en vez de devolver vacío, devuelve las promos destacadas/populares — las
mismas que vería cualquier invitado — marcando `profileIncomplete: true`. Ese camino
simplemente no se está usando en el corte temprano de `home-decision/route.ts` para el caso
de guest puro (sin `localStorage` tampoco).

También existe, en la Home v1 vieja (`app/promos/explorar/PromosClient.tsx`), la sección
"⭐ Destacadas hoy": ordena por `isFeatured` + mejor descuento, dentro de
`PRIORITY_CAT_SLUGS` (supermercados, combustible, transporte, gastronomía, farmacias) — el
mismo recorte de rubros de alta demanda que Daniel pide abajo.

**Conclusión técnica**: no hace falta construir lógica nueva de "qué mostrar sin perfil".
Hay que conectar un camino que ya existe (el guardrail de `getPromos.ts`, o alternativamente
portar la lógica de "Destacadas hoy" de v1) al endpoint de Home v2, y ajustar la condición en
el cliente para que `HomeRubros` no se oculte en este estado. Tamaño de cambio estimado:
**chico-mediano**, no una reescritura.

## 4. Propuesta de producto (Daniel)

Daniel es explícito en que el banner de registro debe quedarse — "no está mal, porque
incitamos al usuario a crear la cuenta" — el objetivo no es sacar el CTA de registro, es
**agregar prueba de valor debajo/alrededor de él** para no perder al usuario antes de que
decida registrarse. Propone dos ejes de contenido:

**(a) Rubros de alta demanda** (mismo criterio que `PRIORITY_CAT_SLUGS` de v1, ampliado):
Supermercados, Combustible, Farmacias, Indumentaria, Transporte — 3 o 4 de estos, con las
mejores promos destacadas de cada uno.

**(b) Ejemplos por entidad**, mostrando tarjetas de bancos/billeteras/comercios reconocibles
para que el usuario nuevo se identifique ("yo tengo esa tarjeta/uso esa app") y quiera
seguir. Entidades sugeridas explícitamente por Daniel:

- Bancos/billeteras: Galicia, Santander, Banco Nación, Ciudad, BBVA, MODO, Mercado Pago.
- Comercios: Coto, Jumbo, Disco, Vea, Changomas, Carrefour.

Cita textual del objetivo: **"Tenemos que captar la atención del usuario no logueado o
nuevo"** — usando información que la app ya tiene (no hace falta generar nada nuevo, es
mostrar lo mismo que ya se muestra a usuarios con perfil, pero como "vidriera" sin
personalizar).

## 5. Lo que pido resolver antes de implementar

1. **¿Aprobás este approach** (mantener el banner de registro + agregar debajo una sección
   de "ejemplos"/destacadas sin personalizar, usando rubros prioritarios + logos de entidades
   reconocibles)? ¿O preferís otra composición de pantalla?
2. **Criterio de selección de promos para esta sección**: ¿top descuento por rubro
   (`isFeatured` + mayor %), o priorizar que aparezcan las entidades que Daniel listó aunque
   no tengan el descuento más alto, para maximizar reconocimiento de marca?
3. **¿Esta sección lleva algún filtro geográfico** (ya existe selector de provincia en Home
   v2) o siempre muestra el set nacional/genérico sin importar la provincia elegida?
4. **Nombre/copy de la sección** — ¿reusamos "⭐ Destacadas hoy" (ya validado en v1) o
   necesita un texto distinto para diferenciarse de la sección personalizada que un usuario
   *con* perfil ve más abajo?

No hace falta resolver el diseño visual pixel-a-pixel en este documento — eso lo armo yo
(hay skill de frontend-design ya invocada en sesiones previas para este mismo Home v2) una
vez que el criterio de contenido esté aprobado.

---

**Firmado**: CTO (Claude)
