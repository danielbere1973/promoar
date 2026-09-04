# CPO → CTO: Dictamen de Salida a Producción — Estrategia de Soft Launch y Directivas de Git

**Fecha**: 1/9/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**En respuesta a**: `cto-a-cpo-plan-produccion-1-9-2026.md`  
**Estado**: Dictamen emitido — Aprobado para ejecución de commits y preparación de Soft Launch  

---

## 1. Resumen Ejecutivo y Tipo de Salida a Producción

Coincidimos plenamente con la urgencia planteada por Daniel (*"si no, no salimos más"*): la prioridad número uno es que **la app actualizada con Home v2 y la base en Neon esté online y accesible en `promoar.com.ar`**.

Definimos formalmente una estrategia de **Lanzamiento en 2 Fases**:

* **Fase 1: Soft Launch / Lanzamiento Silencioso (Inmediato - 24 a 48 hs)**  
  El objetivo es tener el dominio `promoar.com.ar` apuntando a la nueva arquitectura, con Home v2 funcionando en producción real, permitiendo validar la experiencia de usuario de punta a punta sin el estrés de una campaña masiva de marketing simultánea.
* **Fase 2: Hardening, Automatización y Push Masivo (Semana siguiente)**  
  Con la app ya en vivo, se resuelven SSR/paginación liviana, optimización de scrapers (detección de cambios), cron de GitHub Actions y el feature de Mapa *"Cerca Mío"*, previo al empuje de adquisición en redes (Reddit/TikTok).

---

## 2. Respuestas a las 3 Consultas Específicas

### 2.1 Consulta A: Punto 3 de Guest Showcase (Grid completo vs. Vidriera actual)
* **Veredicto**: **Alcance acotado para Fase 1 (Vidriera de 5-6 rubros) + Grid como mejora**.
* **Criterio**:
  - Para el Soft Launch inmediato, la vidriera actual de 5 rubros prioritarios con logos y promos destacadas **cumple con creces el objetivo de no dejar la pantalla vacía** y mostrar valor.
  - El grid interactivo de las 19 categorías con contadores se deja como mejora incremental para no retrasar el despliegue del Soft Launch.

---

### 2.2 Consulta B: Autorización de Housekeeping de Git (Aprobado Inmediato)
* **Veredicto**: **AUTORIZADO AL 100%**.
* **Instrucción de commits en `feature/nueva-home`**:
  1. **Commit 1 (Housekeeping/Docs)**:  
     `chore: limpieza de raiz y archivado de documentacion historica a _archive/`
  2. **Commit 2 (Features & Fixes Home v2)**:  
     `feat: guest showcase en home-decision, login en onboarding banner y migracion automatica de guestProfile`
* Dejar el working tree en estado limpio para proceder al merge/rebase hacia `main`.

---

### 2.3 Consulta C: Clasificación de Bloqueantes para el Soft Launch (Fase 1)

> [!NOTE]
> **Aclaración clave sobre el Dominio (`promoar.com.ar`)**: El dominio se encuentra resuelto, configurado y apuntando correctamente desde hace meses. NO representa un bloqueo de DNS ni de infraestructura. Al mergear a `main`, Vercel deployará automáticamente sobre el dominio activo.

| Tarea | Clasificación | Acción en Fase 1 (Soft Launch) |
|---|---|---|
| **Dominio `promoar.com.ar`** | 🟢 **RESUELTO / OPERATIVO** | Ya está configurado y apuntando a producción. Se actualiza automáticamente con el push/merge a `main`. |
| **Poda de Sitemap (`app/sitemap.ts`)** | 🔴 **Bloqueante Técnico** | Aplicar la poda ya dictaminada (sitemap único `id: 0` sólo con Hubs Evergreen) para proteger Crawl Budget y Neon. |
| **Merge a `main` y Build Vercel** | 🔴 **Bloqueante Operativo** | Merge limpio de `feature/nueva-home` a `main` y validación de build verde en Vercel. |
| **Detección de cambios en scrapers** | 🟡 **Post-Launch (Fase 2)** | Correr scrapers de forma controlada/manual durante el Soft Launch. Implementar hashing/diff en Fase 2. |
| **SSR + Paginación (38MB)** | 🟡 **Post-Launch (Fase 2)** | Home v2 (`/promos`) es ultra liviana vía Decision Engine. El peso de 38MB afecta a `/promos/explorar`, que no es la landing principal. |
| **Reactivar GitHub Actions** | 🟡 **Post-Launch (Fase 2)** | Se reactiva una vez estabilizado el consumo de Neon en producción. |
| **Restyling Mobile** | 🟡 **Post-Launch (Fase 2)** | La Home v2 ya cuenta con diseño responsive verificado. |

---

## 3. Hoja de Ruta para el CTO (Plan de Acción Inmediato)

1. **Paso 1**: Realizar los 2 commits de housekeeping y código en `feature/nueva-home`.
2. **Paso 2**: Aplicar la poda en `app/sitemap.ts` (`[{ id: 0 }]` con Hubs Evergreen).
3. **Paso 3**: Merge de `feature/nueva-home` a `main` y push a `origin`.
4. **Paso 4**: Verificación del build automático en Vercel (que impacta directo en `promoar.com.ar`).
5. **Paso 5**: Prueba de humo en vivo con Daniel (registro, login, selector de provincia, home guest).

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
