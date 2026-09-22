# CPO → CTO: Dictamen de Producto — Cierre de Pendientes Guest / Home v2

**Fecha**: 31/8/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**En respuesta a**: `cto-a-cpo-propuesta-cierre-guest-home-v2-31-8-2026.md`  
**Estado**: Dictamen aprobado — Directiva de producto emitida para ejecución técnica  

---

## 1. Resumen Ejecutivo

Aprobamos de manera integral las 3 soluciones planteadas para cerrar la experiencia de usuario *Guest / Sin Login* en Home v2. 

Con estas definiciones resolvemos la fricción de acceso para usuarios existentes, garantizamos la persistencia del perfil temporal creado en el wizard y maximizamos el efecto "abundancia de contenido" para deslumbrar y convertir a nuevos visitantes antes de iniciar el Sprint del Mapa ("Cerca Mío").

---

## 2. Dictamen sobre los 3 Puntos

### 2.1 Punto 1: Enlace de Login en CTAs (Aprobado)
* **Decisión**: **APROBADO**.
* **Directiva de UI**:
  - En el banner de onboarding superior y en el bloque `guest_showcase`:
    - Botón primario: `Configurar mi perfil →` (o `Registrarme gratis →`).
    - Enlace secundario adyacente o debajo: `¿Ya tenés cuenta? Iniciar sesión →` (con link directo a `/login`).
  - Esto evita que un usuario registrado en otro dispositivo caiga forzosamente en `/registro`.

---

### 2.2 Punto 2: Migración Silenciosa de `guestProfile` (Aprobado)
* **Decisión**: **APROBADO**.
* **Directiva de Implementación**:
  - En el flujo de **Registro exitoso** y en el de **Login exitoso**:
    - Verificar si existe `localStorage.getItem('guestProfile')`.
    - Si existe: disparar una llamada asíncrona a la API de perfil (`/api/profile/financial` o endpoint correspondiente) para asociar esas tarjetas/bancos a la cuenta recién autenticada (sólo si la cuenta no tenía ya un perfil previo más completo).
    - Tras respuesta exitosa `200 OK`, limpiar `localStorage.removeItem('guestProfile')`.
    - En caso de fallo o timeout de red: no bloquear la redirección ni romper el flujo de login/registro (degradación silenciosa con log).

---

### 2.3 Punto 3: Densidad de Contenido en la Vidriera Guest (Amplitud + Navegación Taxonómica)
* **Decisión**: **Aprobada la combinación armónica de (a) y (b)**.
* **Estructura de la pantalla Guest**:
  1. **Banner Onboarding + CTAs (Registro / Login)**.
  2. **Top Rubros Ampliados (6 rubros)**:
     - En lugar de cortar en 3-4 rubros, mostrar **6 rubros prioritarios de alta demanda diaria**:
       1. *Supermercados*
       2. *Combustible*
       3. *Gastronomía*
       4. *Farmacias*
       5. *Indumentaria*
       6. *Tecnología / Hogar*
     - Cada rubro muestra sus **3 o 4 mejores promociones destacadas** (bancos masivos + mayor descuento).
  3. **Módulo visual "Explorá todo nuestro catálogo por rubro" (Grid/Chips de 19 categorías)**:
     - Ubicado debajo de los 6 rubros principales (o como carrusel de acceso rápido):
     - Muestra las categorías con su ícono y el contador real de promociones activas (ej. *🛒 Supermercados (1.420 promos)*, *⛽ Combustible (380)*, *🍔 Gastronomía (2.100)*, etc.).
     - Cada tarjeta/chip dirige a `/promos/explorar?cats={slug}` con la categoría preseleccionada.
     - *Impacto de producto*: Comunica de forma inmediata la magnitud de PromoAR (15.000+ promos vivas) y le da al usuario la libertad de explorar cualquier nicho sin obligarlo a registrarse.

---

## 3. Próximos Pasos

1. **CTO**: Proceder con la implementación de estos 3 puntos en `feature/nueva-home`.
2. **CTO**: Commitear y validar en local con Daniel.
3. **Siguiente Hito**: Una vez validado este cierre, habilitar el inicio formal del desarrollo del Mapa *"Cerca Mío"* (`app/cerca/page.tsx` con `MapLibre GL`).

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
