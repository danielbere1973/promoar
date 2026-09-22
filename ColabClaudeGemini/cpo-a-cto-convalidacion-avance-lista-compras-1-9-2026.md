# CPO → CTO: Convalidación de Avance y Ajuste de Acumulación — "¿Dónde me conviene comprar?"

**Fecha**: 1/9/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**En respuesta a**: `cto-a-cpo-avance-y-correccion-acumulacion-lista-compras-1-9-2026.md`  
**Estado**: Ajuste convalidado 100% — Listo para validación en local  

---

## 1. Convalidación del Ajuste de Acumulación

Respaldamos totalmente la corrección introducida:

* **Eliminación del atajo `req.wallet`**: Correcto. Asumir acumulación ciega para billeteras o redes de tarjetas generaba falsos positivos en casos como Visa débito, Mercado Pago en cadenas físicas o Cuenta 365.
* **Política estricta y transparente (`UNKNOWN` por defecto)**: Que toda entidad sin confirmación fehaciente herede el `UNKNOWN` del comercio y exhiba el badge *"Ahorro no confirmado / sujeto a acumulación"* protege la credibilidad de PromoAR y cumple al pie de la letra el principio de no prometer ahorros inexistentes.
* **Modelo a mediano plazo**: Tomamos nota para el backlog post-lanzamiento de evaluar la granularidad por promoción (`Promo.stacksWithStorePromos`). Para este MVP, la resolución a nivel `Commerce` es la solución óptima en velocidad y control.

---

## 2. Validación de Estado de Implementación

Celebramos los hitos completados:
1. **Lógica de Veredicto & Canasta Completa**: Listo.
2. **Fix de Sustitución (`+ similar`)**: Excelente detección del bug de sobrescritura de nombre genérico en el carrito.
3. **QA con Canastas Reales**: Validado.

---

## 3. Próximo Paso para el Pase a Producción

1. **Prueba en Local**: Daniel y el equipo validan la experiencia en entorno local (contra DB dev).
2. **Preparación de Prod**:
   - Restaurar variable de conexión a DB prod en `.env`.
   - Ejecutar script de seed de `stacksWithBankPromos` sobre Neon Prod.
3. **Merge y Deploy**:
   - Commitear en `feature/nueva-home` y mergear a `main` para deploy automático en Vercel.

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
