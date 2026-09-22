# CPO → CTO / CEO: Lanzamiento de la Herramienta Interactiva — Simulador de Combustible

**Fecha**: 3/9/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**Ruta implementada**: `app/ahorro_interactivo/combustible/` y `app/ahorro-interactivo/combustible/`  
**Estado**: Feature implementada y lista para validación local / producción  

---

## 1. Justificación Estratégica (Product-Led Content)

A raíz de la conversación con Daniel sobre la estrategia de difusión en redes sociales (Instagram, X, Facebook, Reddit), validamos un cambio de paradigma fundamental:

* **El problema de las imágenes estáticas**: Compartir una tabla o infografía estática en redes tiene baja conversión porque nadie tiene todos los bancos ("yo no tengo Santander, esto no me sirve") y se desactualiza en días.
* **La solución construida**: Transformar el contenido en una **herramienta interactiva dentro de PromoAR**. En redes se comparte el gancho ("¿Con qué tarjeta te conviene cargar nafta hoy?"), y el enlace dirige a una landing interactiva donde el usuario personaliza sus tarjetas y ve su podio en tiempo real.

---

## 2. Lo que se Construyó

### 2.1 Rutas y Arquitectura
* **Ruta Principal**: `app/ahorro_interactivo/combustible/page.tsx` (y alias `app/ahorro-interactivo/combustible/page.tsx`).
* **Server Component**:
  - Metadata OpenGraph completa para previews enriquecidas en WhatsApp, X e Instagram.
  - Query optimizada a Prisma que recupera todas las promociones activas de combustible (186 promociones en base) y las normaliza a las 4 marcas líderes: **YPF, Axion, Shell y Puma**.
  - Cálculo de tope de reintegro y decodificación de bitmask de días válidos.
* **Client Component (`CombustibleSimulator.tsx`)**:
  - **Selector Táctil de Medios de Pago**: Botonera con chips interactivos de los 13 bancos y billeteras clave de combustible en Argentina (Galicia, Santander, BNA, BBVA, Macro, Ciudad, Credicoop, Cuenta DNI, MODO, Personal Pay, App YPF, Shell Box, Ualá).
  - **Pre-carga inteligente**: Si el usuario ya cargó sus tarjetas en el onboarding o `guestProfile`, se auto-seleccionan automáticamente.
  - **Selector de Consumo Mensual**: Presets ($40k, $80k, $120k, $160k, $200k) y slider interactivo para calcular el ahorro exacto en pesos (`-$X`).
  - **Podio de las 4 Estaciones (YPF vs. Axion vs. Shell vs. Puma)**:
    - Ordenadas dinámicamente de #1 a #4 por mayor ahorro en pesos.
    - Estética visual con acentos de marca (azul YPF, violeta/magenta Axion, amarillo/rojo Shell, verde Puma).
    - Muestra descuento %, días válidos, tope mensual y forma de pago.
    - Si para una estación el usuario no tiene tarjeta: muestra una sugerencia elegante ("Si tuvieras tarjeta X tendrías hasta Y%").
  - **Banner del Ganador**: Trofeo dorado destacando la mejor jugada del mes.
  - **Viral Loops**:
    - Botón para compartir en WhatsApp con texto precargado y URL con parámetros dinámicos (`?cards=...&gasto=...`).
    - Botón para copiar enlace.
    - Botón para guardar las tarjetas seleccionadas en el perfil de PromoAR (`localStorage.guestProfile`) y navegar a la Home diaria.
* **Middleware**: Se incorporó `/ahorro_interactivo` y `/ahorro-interactivo` a `PUBLIC_PATHS` para acceso público irrestricto desde redes sociales.

---

## 3. Impacto en Git y Convivencia con el Trabajo de Claude

* **Aislamiento 100% garantizado**: Todo el desarrollo se realizó en carpetas nuevas dedicadas (`app/ahorro_interactivo/` y `app/ahorro-interactivo/`), sin tocar `app/precios/`, `decisionEngine.ts` ni los archivos que Claude tiene modificados en su working tree.
* El único archivo compartido modificado fue `middleware.ts` para habilitar las dos rutas en `PUBLIC_PATHS`.

---

## 4. Próximos Pasos

1. Probar la ruta en local: `http://localhost:3000/ahorro_interactivo/combustible`.
2. Una vez validada, commitear y pushear a producción para comenzar a utilizarla como enlace de destino en los testeos de Instagram y X.

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
