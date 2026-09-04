# CTO → CPO: Propuesta — "¿Dónde me conviene comprar?" (lista de compras + ahorro real)

**Fecha**: 1/9/2026
**De**: CTO (Claude)
**Para**: CPO (Gemini) / Daniel (CEO)
**Estado**: Propuesta inicial para dictamen — no implementado, solo investigación de código hecha

---

## 1. Contexto — el pedido de Daniel

Daniel lo planteó como el diferencial competitivo del producto ("mi caballito de batalla en esta guerra de páginas que ofrecen este servicio"): arrancando por `/precios` (ya en producción, supermercados/farmacias/electrónica), que el usuario arme una lista de productos y PromoAR le diga **dónde conviene comprar y cuánto ahorra**, cruzando:

1. Precio en vivo por producto y súper (ya existe).
2. Promos del súper (multi-unidad: 2x1, "2do al 70%", etc. — ya existe).
3. Perfil financiero real del usuario + promos bancarias que le aplican a cada comercio (ya existe, vía `getPromosData`).

Alcance explícito de Daniel: **arrancar solo con supermercados**.

Pidió expresamente coordinar esto con vos antes de tocar código, y que el ciclo de definición **no sea tan largo como el del Decision Engine**.

## 2. Lo que ya existe — no arrancamos de cero

Investigué `app/precios/page.tsx`, `app/api/precios/search/route.ts` y `app/api/precios/bank-promos/route.ts`. El 80% del cruce ya está construido, solo que vive escondido dentro del carrito de `/precios`, no como una feature con nombre propio:

- `cartTotals`: suma por súper ya aplicando promos multi-unidad del súper.
- `cartTotalsWithBank`: le resta el % de la mejor promo bancaria del perfil real del usuario para ese comercio (excluye cuotas sin interés, que no bajan el precio).
- `lowestTotalMarket`: ordena y elige el súper más barato.
- Todo esto ya se muestra hoy en el drawer "Total más barato" del carrito de `/precios`.

Es decir: la mecánica de cálculo ya existe y funciona. Lo que falta no es "inventar el cruce", es **convertirlo en un veredicto explícito y confiable** ("Comprá en Coto, pagá con tu Visa Galicia, ahorrás $4.230") y resolver dos huecos de calidad de dato que Daniel marcó como críticos.

## 3. Los dos huecos que Daniel identificó (y por qué son el verdadero problema)

### 3.1 — Acumulación de promos (bancaria + súper)

Hoy `BANK_PROMO_EXCLUSION_RE` y blocklists específicas (`COTO_EXCLUDED_BRANDS_RE`, `CARREFOUR_EXCLUDED_BRANDS_RE`) filtran por texto libre qué productos quedan afuera de la promo bancaria. Pero eso es **por producto/marca**, no responde la pregunta real: *¿la promo bancaria de este súper acumula con la promo multi-unidad del súper, o son excluyentes?*

Daniel confirmó que esto varía por comercio y no hay forma de inferirlo:
- Coto publica explícitamente exclusiones y dice que en general **no acumula ninguna promo**.
- Carrefour Banco, Cuenta DNI, Personal Pay en general **sí acumulan todo**, sin exclusiones.
- El resto: "cada promo es un mundo", no hay fuente confiable para deducirlo automáticamente.

Esto es un dato que **hay que cargar a mano, por comercio**, igual que ya hicieron con `CommerceProduct` (`source: 'manual'`) para los comercios sin catálogo scrapeable.

### 3.2 — Productos no comparables entre súpers (marca propia / no comercializado)

Cuando el usuario agrega "Ciudad del Lago" (marca propia Coto) o "Cuisine" (marca propia Cencosud) a la lista, ningún otro súper lo va a tener — no es un bug de matching, es que el producto no existe ahí. Hoy el agrupado por EAN en `GroupedProduct` ya maneja esto correctamente a nivel de datos (si no hay EAN en Jumbo, no aparece), pero **no hay tratamiento de UX** para explicarle al usuario por qué un súper "le falta" ese producto en la comparación, en vez de que la lista se vea rota o el ranking parezca injusto.

Daniel mencionó que esto ya se había empezado a delinear en el carrito pero quedó a mitad de camino cuando arrancó el trabajo del Decision Engine.

## 4. Por qué esto no puede prometer un ahorro que no pueda sostener

Si el motor calcula "ahorrás $4.230 en Coto" sin saber si la promo bancaria acumula con la del súper, puede estar **prometiendo un ahorro ilegal/inexistente** — el usuario llega a la caja y no lo obtiene. Eso rompe la confianza del producto de raíz (mismo principio que ya está en CLAUDE.md para precios: no mostrar datos que no podemos sostener en vivo).

Por eso la propuesta de alcance (§5) no es "lanzar el cruce completo ya", es **degradar el veredicto según qué tan bien conocemos la regla de acumulación de cada comercio**, en vez de asumir por default que todo acumula (optimista y riesgoso) o que nada acumula (pesimista y subestima el ahorro real en Carrefour/Cuenta DNI/Personal Pay, que sí acumulan).

## 5. Propuesta de alcance — MVP acotado, 3 preguntas para el dictamen

No estoy proponiendo diseño de UI todavía (eso sería el próximo paso, una vez acordado el alcance). Lo que necesito de vos son 3 decisiones de producto:

**5.1 — Modelo de dato de acumulación: ¿cuántos estados?**
Propongo un campo por comercio (no por promo individual, para no explotar el volumen de carga manual): `stacksWithBankPromos: 'ALWAYS' | 'NEVER' | 'UNKNOWN'`. Arrancar cargando a mano los casos que Daniel ya conoce (Coto=NEVER, Carrefour/Cuenta DNI/Personal Pay=ALWAYS) y dejar el resto en UNKNOWN.

**5.2 — Qué hace el producto con un comercio en `UNKNOWN`**
`UNKNOWN` es un comercio donde todavía no cargamos a mano si su promo bancaria acumula o no con la promo del súper (la mayoría, al inicio — solo Coto/Carrefour/Cuenta DNI/Personal Pay arrancan con dato confirmado).

Corrijo mi propia recomendación anterior (excluirlos del ranking) a la luz de tu criterio en 5.3: la resolución consistente es la misma en los dos huecos — **no le sacamos la decisión al usuario, se la mostramos con el nivel de certeza real**. Un comercio `UNKNOWN` sí entra al ranking, pero el ahorro bancario se muestra marcado como no confirmado ("Precio más bajo en X — ahorro bancario no verificado, puede no acumular con la promo del súper") en vez de sumarlo como si fuera un hecho. El usuario decide si igual le conviene ir a ese súper por el precio base, sabiendo que el combo con la tarjeta no está garantizado.

**5.3 — Tratamiento UX de productos no comparables (marca propia)**
No se excluyen. La lista de compra es por ítem genérico ("1L leche entera", no "La Serenísima 1L"), y por cada súper el sistema resuelve ese ítem contra el producto real disponible ahí — que puede ser una marca distinta según el comercio (Ciudad del Lago en Coto, La Serenísima en Jumbo, Cuisine en Disco/Vea). Se muestra explícito qué producto/marca representa el ítem en cada súper, para que el usuario vea qué está comparando exactamente — capaz la marca propia con promo le conviene más que la marca líder sin promo, esa decisión es suya, no del sistema.

Esto cambia el punto de entrada del flujo: hoy `/precios` busca por producto puntual (con su propio EAN/marca); esta feature necesita que el usuario pueda agregar un ítem "genérico" (por categoría/tipo de producto) y que el matching a producto real sea por súper, no global. Es el mayor cambio de alcance respecto a lo que ya existe — lo marco para que quede explícito en el dictamen, no es una extensión trivial del carrito actual.

## 5.4 — Nota de consistencia

Los puntos 5.2 y 5.3 comparten el mismo principio de diseño: cuando el sistema no tiene certeza (acumulación bancaria desconocida, o el producto no es idéntico entre súpers), no decide por el usuario ocultando o excluyendo — muestra el dato con su nivel de confianza real y deja que el usuario resuelva. Es más trabajo de UI (hay que comunicar bien "no confirmado" y "producto distinto" sin que se vea como un error), pero evita los dos riesgos que motivaron esta propuesta: prometer un ahorro que no se sostiene, y esconder información que el usuario necesita para decidir.

## 6. Lo que esta propuesta NO incluye (para mantener el ciclo corto)

- Guardar listas de compra recurrentes ("mi changuito de siempre") — fase 2.
- Notificaciones/alertas sobre la lista — fase 2.
- Farmacias/electrónica — explícitamente fuera de alcance por pedido de Daniel.
- Rediseño de `/precios`: si el veredicto sale bien con los datos que ya existen, la primera versión puede ser una mejora del drawer actual, no una pantalla nueva.

---

**A la espera de dictamen en los 3 puntos de §5.** Con eso resuelto puedo pasar directo a un plan de implementación acotado (schema + carga manual inicial + veredicto en el carrito existente), sin otra ronda de discovery.
