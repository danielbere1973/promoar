# CPO → CTO: Dictamen de Producto — Estado "Sin Perfil" / Guest en Home v2

**Fecha**: 31/8/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**En respuesta a**: `cto-a-cpo-propuesta-guest-state-home-v2-31-8-2026.md`  
**Estado**: Dictamen aprobado — Directiva de producto emitida para ejecución técnica  

---

## 1. Resumen Ejecutivo y Validación de Diagnóstico

Compartimos plenamente la urgencia y el diagnóstico: **una Home vacía para usuarios anónimos o no personalizados es inaceptable para la retención y adquisición.** 

El tráfico orgánico (SEO, Reddit, boca a boca) llega sin sesión iniciada. Si en los primeros 3 segundos solo ve un formulario de registro y cero promociones, la tasa de rebote se dispara. El valor central de PromoAR debe ser evidente *antes* de solicitar la creación de una cuenta o configuración de perfil.

Validamos el enfoque técnico: la infraestructura para resolver esto ya existe en el codebase (`getPromos.ts` con guardrails y la lógica de "Destacadas hoy" de v1). No hay que reinventar la rueda, sino conectar el endpoint `/api/promos/home-decision` y la vista cliente para poblar la pantalla de forma inmediata.

---

## 2. Dictamen sobre los 4 Puntos de Consulta

### 2.1 Aprobación de Composición de Pantalla (Approach General)
* **Veredicto**: **APROBADO**.
* **Estructura jerárquica de arriba hacia abajo**:
  1. **Banner de Onboarding / Registro**: Se mantiene en la parte superior con mensaje persuasivo sobre las ventajas de personalizar (ver sólo tus bancos/tarjetas).
  2. **Selector Geográfico**: Visible para que el usuario pueda adaptar la vidriera a su provincia si lo desea.
  3. **Vidriera Destacada ("⭐ Destacadas de hoy")**: Grilla de promociones de alta demanda agrupadas por rubros prioritarios.
  4. **CTA Secundario / Exploración**: Acceso directo al catálogo completo (`/promos/explorar`).

---

### 2.2 Criterio de Selección de Promos para la Vidriera Guest
* **Veredicto**: **Criterio Híbrido (Destacadas + Reconocimiento de Marca Masivo)**.
* **Regla de ordenamiento / selección**:
  - Rubros prioritarios a mostrar (3 a 5 rubros clave): **Supermercados, Combustible, Gastronomía, Farmacias, Indumentaria**.
  - **Filtro de Entidades Masivas**: Para el estado Guest, priorizar aquellas promociones que pertenezcan al ecosistema de alta penetración:
    - **Bancos**: Galicia, Santander, Banco Nación, BBVA, Banco Ciudad, Macro.
    - **Billeteras / Redes**: MODO, Mercado Pago, Cuenta DNI, Personal Pay, Ualá.
    - **Comercios**: Coto, Jumbo, Carrefour, YPF, Shell, Farmacity, Disco, Vea, Changomas.
  - **Desempate**: Mayor descuento (`%`) y flag `isFeatured: true`.
  - *Razón de producto*: Un 50% de descuento en un banco regional o cooperativo de baja penetración no genera la conexión *"yo tengo esa tarjeta"* que buscamos en el primer contacto. Preferimos mostrar un 30% de Santander/Galicia o reintegro de MODO/Cuenta DNI.

---

### 2.3 Filtro Geográfico y Ubicación
* **Veredicto**: **Nacional / AMBA por defecto + Reactivo a selección del usuario**.
* **Comportamiento**:
  - **Carga inicial**: Muestra las promociones nacionales y de cobertura general (AMBA/Nacional).
  - **Interacción con Selector de Provincia**: Si el usuario cambia la provincia en el selector superior, la vidriera debe recalcular y filtrar/ordenar priorizando sucursales y vigencia en la provincia elegida (reutilizando la lógica de sucursales ya construida).

---

### 2.4 Naming, Copywriting y Jerarquía
* **Título de la sección**: `⭐ Destacadas de hoy` (o `🔥 Promociones destacadas`).
* **Subtítulo / Micro-copy explicativo**:  
  > *"Las mejores oportunidades de ahorro del día en comercios y bancos principales. Configurá tus medios de pago para filtrar solo lo que te sirve a vos."*
* **Diferenciación con usuario logueado**:  
  - Para usuarios con perfil configurado: `Tus mejores opciones para hoy` (sección personalizada por Decision Engine).
  - Para usuarios sin perfil / guest: `⭐ Destacadas de hoy` con el badge contextual *"Vista general"*.

---

## 3. Directivas Técnicas de Implementación para el CTO

1. **Ajuste en `app/api/promos/home-decision/route.ts`**:
   - En el bloque de corte temprano donde no hay usuario ni `guest_profile`, **no retornar `rubros: []`**.
   - Invocar el camino fallback (`getPromos` o selector de destacadas por rubro prioritario con las entidades clave) y devolver los rubros poblados con `status: 'incomplete_profile'` (o `status: 'guest_showcase'`).
2. **Ajuste en `app/promos/PromosClient.tsx`**:
   - Asegurar que `HomeRubros` se renderice tanto si el perfil está completo como si está en modo showcase / sin perfil.
   - El banner de onboarding debe coexistir de manera limpia sobre la grilla de rubros sin bloquearla ni ocultarla.
3. **Validación visual (`frontend-design`)**:
   - Verificar que la transición visual, espaciados y estados de carga (skeletons) mantengan el estándar premium de diseño establecido.

---

## 4. Estado y Próximos Pasos

* **CTO**: Proceder con la implementación técnica en `feature/nueva-home` siguiendo estas directivas.
* **CPO / CEO**: Revisión visual en entorno local / staging una vez integrado.

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
