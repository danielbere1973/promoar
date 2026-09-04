# CPO → CTO: Dictamen de Producto — "¿Dónde me conviene comprar?" (Lista de Compras + Ahorro Real en Supermercados)

**Fecha**: 1/9/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**En respuesta a**: `cto-a-cpo-propuesta-lista-compras-ahorro-1-9-2026.md`  
**Estado**: Dictamen emitido — Aprobado para diseño e implementación del MVP  

---

## 1. Resumen Ejecutivo y Visión de Producto

Coincidimos plenamente con Daniel y con la investigación técnica: **el veredicto de compra inteligente ("¿Dónde me conviene hacer mi compra hoy y con qué medio de pago?") es la propuesta de valor cumbre de PromoAR.**

La ventaja fundamental es que **el 80% de la infraestructura ya está desarrollada en `/precios`** (`cartTotals`, `cartTotalsWithBank`, `lowestTotalMarket`, `getPromosData`). Nuestro foco ahora es convertir esa información dispersa en un **veredicto certero, confiable y accionable** para el usuario.

Aprobamos la propuesta de mantener un ciclo de definición ágil y acotado, enfocado exclusivamente en **Supermercados (MVP)**.

---

## 2. Dictamen sobre los 3 Puntos de Decisión (§5)

### 2.1 Modelo de Datos de Acumulación (Punto 5.1)
* **Decisión**: **APROBADO**.
* **Esquema**: Campo a nivel comercio en base de datos (o metadata):  
  `stacksWithBankPromos: 'ALWAYS' | 'NEVER' | 'UNKNOWN'`.
* **Carga Inicial Inmediata**:
  - `NEVER`: Coto (exclusiones taxativas y no acumulable por defecto).
  - `ALWAYS`: Carrefour Banco, Cuenta DNI, Personal Pay, MODO (reintegros bancarios / billeteras que procesan por fuera de la caja del comercio y acumulan 100% con las promos del súper).
  - `UNKNOWN`: Resto de los comercios hasta su validación manual.

---

### 2.2 Tratamiento de Comercios en Estado `UNKNOWN` (Punto 5.2)
* **Decisión**: **APROBADO con Transparencia Total de Ahorro**.
* **Comportamiento en UI y Ranking**:
  - Los comercios `UNKNOWN` **sí participan del ranking** de comparación.
  - El precio base se calcula con el total del súper (incluyendo promos multi-unidad 2x1, 70% en la 2da, etc.).
  - Si el usuario tiene una promo bancaria aplicable en ese súper, se muestra desglosada con un badge de advertencia amigable:  
    > `Ahorro bancario estimado: -$X (Sujeto a acumulación con ofertas en góndola)`.
  - En comercios `ALWAYS`, el ahorro bancario se suma al 100% como ahorro confirmado.
  - En comercios `NEVER`, se aplica la mejor de las dos opciones (descuento del súper vs. descuento del banco) y se aclara: *"Aplica la mejor promo (no acumulable)"*.

---

### 2.3 Tratamiento de Productos No Comparables / Marcas Propias (Punto 5.3)
* **Decisión**: **APROBADO con Regla de "Canasta Completa"**.
* **Criterio de Experiencia de Usuario**:
  1. **Matching por Equivalencia**: Cuando el usuario busca un producto o tipo genérico (ej. "Leche entera 1L"), el motor selecciona el ítem equivalente más conveniente en cada súper (marca líder o propia según disponibilidad). En el desglose se muestra explícito qué producto se cotizó en cada lugar (*"En Coto: Ciudad del Lago $1.200 vs En Jumbo: La Serenísima $1.450"*).
  2. **Regla de Canasta Completa para el Veredicto**:
     - Para coronar a un súper como **"🥇 Total Más Barato"**, debe cubrir el **100% de los ítems** del changuito.
     - Si a un súper le falta 1 producto de la lista, su total no puede competir de forma desleal; debe mostrarse con el aviso:  
       `⚠️ Canasta incompleta (Cotizados 4 de 5 productos - Total parcial: $X)`.
     - Esto evita la frustración del usuario que elige un súper porque "da menos total" cuando en realidad le faltaba un producto clave.

---

## 3. Alcance del MVP (Fase 1)

1. **Rubro**: Exclusivamente **Supermercados** (Coto, Carrefour, Jumbo, Disco, Vea, Changomas, Dia).
2. **Ubicación**: Optimización del drawer/módulo de veredicto en `app/precios` para presentar la conclusión de forma cristalina:
   - **Supermercado Ganador**
   - **Medio de pago recomendado** (banco/tarjeta/billetera del perfil del usuario)
   - **Ahorro total en pesos ($) y en porcentaje (%)**
   - **Desglose transparente** (Ahorro góndola + Ahorro banco)
3. **Fuera de alcance para este pase**: Listas guardadas en perfil, alertas de precio por push y rubros de farmacia/electrónica (quedan para Fase 2).

---

## 4. Próximos Pasos para el CTO

1. **CTO**: Proceder a armar el plan técnico de implementación acotado (ajuste de schema `stacksWithBankPromos`, lógica de cálculo de veredicto y UI del drawer de resultados).
2. **CPO / CEO**: Revisión y aprobación del plan técnico para inicio de desarrollo.

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
