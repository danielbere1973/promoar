# CPO → CTO: Aprobación del Plan Técnico — "¿Dónde me conviene comprar?" (MVP Supermercados)

**Fecha**: 1/9/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**En respuesta a**: `cto-a-cpo-plan-tecnico-lista-compras-ahorro-1-9-2026.md`  
**Estado**: Plan Técnico APROBADO 100% — Luz verde para iniciar desarrollo  

---

## 1. Validación del Plan Técnico

Revisamos detalladamente la propuesta técnica y aprobamos todos sus componentes:

1. **Eficiencia de Arquitectura**: El hallazgo de que `GroupedProduct` y `CartRow` ya resuelven la multi-cotización por supermercado simplifica drásticamente el desarrollo, manteniendo el ciclo corto que solicitó Daniel.
2. **Modelo de Datos (`BankPromoStacking`)**: La extensión en el modelo `Commerce` (`ALWAYS`, `NEVER`, `UNKNOWN`) es limpia, consistente con `LocationModel` y no introduce sobrecarga.
3. **Lógica de Cálculo y Veredicto (`StoreVerdict`)**: 
   - Las 3 estrategias (`stacked`, `best_of_two`, `unconfirmed`) y la regla de **Canasta Completa (`isCompleteBasket`)** garantizan total veracidad en el número final de ahorro.
4. **Experiencia de Usuario (UI)**: La evolución del drawer existente en `app/precios` (desktop y mobile) es el enfoque correcto para iterar rápido sin generar deuda técnica ni pantallas duplicadas.

---

## 2. Instrucciones para la Ejecución

Se autoriza el inicio inmediato del desarrollo en `feature/nueva-home` (o branch de trabajo correspondiente) con los siguientes pasos:

1. **Paso 1: Prisma Schema & Migración**:
   - Agregar enum `BankPromoStacking` y campo `stacksWithBankPromos` en `Commerce`.
   - Ejecutar script de seeding/carga manual inicial para los súpers clave:
     - `NEVER`: Coto.
     - `ALWAYS`: Carrefour, Cuenta DNI, Personal Pay, MODO.
     - `UNKNOWN`: Jumbo, Disco, Vea, Changomas, Dia.
2. **Paso 2: Endpoint / Lógica de Veredicto**:
   - Implementar el cálculo de `StoreVerdict` con desglose de góndola vs. banco y regla de canasta completa.
3. **Paso 3: UI del Drawer de Carrito (`app/precios`)**:
   - Integrar el bloque de veredicto con ganador, medio de pago recomendado, ahorro en $ y %, y badges de advertencia (`⚠️ No confirmado` / `⚠️ Canasta incompleta`).
4. **Paso 4: Validación y QA**:
   - Probar con canastas reales (ej. 3 a 5 productos variados con marcas líderes y propias).

---

## 3. Próximo Paso

* **CTO**: Proceder directamente con la codificación y reportar cuando el feature esté listo para prueba en local.

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
