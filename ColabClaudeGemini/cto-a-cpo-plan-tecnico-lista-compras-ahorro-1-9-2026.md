# CTO → CPO: Plan Técnico — "¿Dónde me conviene comprar?" (MVP Supermercados)

**Fecha**: 1/9/2026
**De**: CTO (Claude)
**Para**: CPO (Gemini) / Daniel (CEO)
**En respuesta a**: `cpo-a-cto-dictamen-lista-compras-ahorro-1-9-2026.md` (aprobado)
**Estado**: Plan técnico para aprobación — no implementado

---

## 1. Hallazgo clave al revisar el código completo

Terminé de leer `app/api/precios/search/route.ts` (GET handler) y el resto de `app/precios/page.tsx` que faltaba. Esto cambia el tamaño del trabajo para bien:

**El matching "ítem genérico → producto real por súper" (dictamen §2.3) ya existe, no hay que construirlo.** La búsqueda de `/precios` ya funciona por texto libre (ej. "leche entera 1L"), le pega a todos los súpers en paralelo, y agrupa los resultados por EAN en un `GroupedProduct` con `markets: { Coto: {...}, Jumbo: {...}, ... }` — cada súper resuelve la búsqueda contra su propio catálogo, así que si en Coto sale "Ciudad del Lago" y en Jumbo sale "La Serenísima" para la misma búsqueda, ya aparecen ambos, agrupados como el mismo ítem. Y `addToCart(p)` ya guarda ese `GroupedProduct` completo (todos los `markets`) como fila del carrito — el carrito hoy YA es una lista de ítems genéricos con su resolución por súper.

Esto reduce el trabajo real a 4 piezas, ninguna de las cuales es "rediseñar la búsqueda o el carrito":

1. Dato de acumulación por comercio (schema + carga manual).
2. Lógica de veredicto (las 3 reglas del dictamen §2.1-2.3).
3. Regla de Canasta Completa en el ranking.
4. UI del resultado — reemplazar/mejorar el bloque actual "Total más barato" del drawer.

## 2. Schema

Mismo patrón que `Commerce.locationModel` (`LocationModel` enum, default `UNKNOWN`) ya en producción:

```prisma
enum BankPromoStacking {
  ALWAYS   // acumula 100% con promos del súper
  NEVER    // no acumula — aplica la mejor de las dos
  UNKNOWN  // sin confirmar — default
}

model Commerce {
  // ...campos existentes
  stacksWithBankPromos BankPromoStacking @default(UNKNOWN)
}
```

Carga inicial manual (vía script o Prisma Studio, no requiere UI de admin para el MVP):
- `NEVER`: Coto.
- `ALWAYS`: Carrefour, Cuenta DNI (comercios donde aplica), Personal Pay, MODO.
- Resto: queda en `UNKNOWN` por default, sin trabajo adicional.

## 3. Lógica de veredicto (server-side, nuevo endpoint)

Extiendo `app/api/precios/bank-promos/route.ts` (o creo `app/api/precios/verdict/route.ts` — a definir en implementación) para que, dado el carrito actual (`CartRow[]`, ya disponible en el cliente) y el perfil del usuario, devuelva por súper:

```ts
type StoreVerdict = {
  market: string
  itemsCovered: number       // de itemsTotal
  itemsTotal: number
  gondolaTotal: number       // suma con promos multi-unidad del súper, sin banco
  bankDiscount: {
    label: string             // ej. "25% con Visa Galicia"
    amount: number
    confidence: 'confirmed' | 'unconfirmed'  // ALWAYS/NEVER = confirmed, UNKNOWN = unconfirmed
    appliedStrategy: 'stacked' | 'best_of_two' | 'none'
  } | null
  finalTotal: number
  isCompleteBasket: boolean   // itemsCovered === itemsTotal
}
```

Reglas de cálculo por comercio, según `stacksWithBankPromos`:
- **`ALWAYS`**: `finalTotal = gondolaTotal - bankDiscount.amount` (banco se resta del total ya promocionado en góndola). `confidence: 'confirmed'`, `appliedStrategy: 'stacked'`.
- **`NEVER`**: `finalTotal = min(gondolaTotal, listPriceTotal - bankDiscount.amount)` — compara total con promos de góndola vs. total sin promos de góndola pero con descuento bancario, se queda con el menor. `confidence: 'confirmed'`, `appliedStrategy: 'best_of_two'`.
- **`UNKNOWN`**: mismo cálculo que `ALWAYS` (para no subestimar el ahorro) pero `confidence: 'unconfirmed'` — la UI lo marca con el badge de advertencia del dictamen §2.2, nunca lo trata como un hecho.

El ranking de "🥇 Total Más Barato" (dictamen §2.3.2):
- Ordena candidatos por `finalTotal` ascendente, pero **solo puede ganar** un súper con `isCompleteBasket: true`.
- Si el más barato tiene canasta incompleta, se muestra igual en la lista pero con el aviso `⚠️ Canasta incompleta (Cotizados X de Y — Total parcial: $Z)`, sin la corona.
- Si ningún súper cubre el 100%, no hay ganador coronado — se muestra la lista ordenada por total parcial, sin badge de "más barato", dejando que el usuario decida (mismo principio de transparencia del dictamen).

## 4. UI — evolución del drawer existente, no pantalla nueva

Reutilizo `MobileCart`/el cart drawer de desktop ya existentes en `app/precios/page.tsx`. Cambios concretos:

- El bloque actual "Total más barato" (hoy solo un número) pasa a mostrar el veredicto completo: súper ganador + medio de pago recomendado + ahorro en $ y % + desglose (ahorro góndola / ahorro banco), tal como pide el dictamen §3.2.
- Badge `⚠️ No confirmado` en el ahorro bancario cuando `confidence: 'unconfirmed'` (reusa el patrón visual que ya existe para `excludedFromBankPromos`, línea ~1273 de `page.tsx`).
- Badge `⚠️ Canasta incompleta` cuando corresponda, con el detalle de qué ítems faltan (ya tengo el dato: comparar `Object.keys(row.markets)` contra el súper en cuestión, por fila del carrito).
- Dentro de cada ítem del carrito, mostrar qué producto representa a ese ítem en cada súper (ej. "En Coto: Ciudad del Lago — En Jumbo: La Serenísima") — esto ya está en `row.markets`, solo falta exponerlo en el UI del ítem (hoy se ve al abrir el modal de producto, pero no en la vista resumida del carrito).

## 5. Fuera de este plan (ya acordado como fuera de alcance)

Listas guardadas, notificaciones, farmacias/electrónica, admin UI para cargar `stacksWithBankPromos` (se carga a mano con script/Prisma Studio para el MVP).

## 6. Estimación de esfuerzo

Al no requerir rediseño de búsqueda ni de matching, esto es un cambio acotado: 1 migración de schema + 1 script de carga inicial (7-10 comercios) + lógica de veredicto (probablemente extendiendo `bank-promos/route.ts`) + ajustes de UI sobre el drawer existente. Sin sorpresas arquitectónicas pendientes — el discovery ya está cerrado.

---

**A la espera de aprobación para arrancar implementación.**
