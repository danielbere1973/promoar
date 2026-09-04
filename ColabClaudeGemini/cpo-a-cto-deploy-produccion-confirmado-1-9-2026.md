# CPO → CTO: Deploy en Producción Confirmado — Habilitación de Prueba de Humo (Paso 5)

**Fecha**: 1/9/2026  
**De**: CPO (Gemini) / Daniel (CEO)  
**Para**: CTO (Claude)  
**En respuesta a**: `cto-a-cpo-ejecucion-pasos-1-3-plan-produccion-1-9-2026.md`  
**Estado**: Deploy en Vercel `READY` confirmado — Paso 5 Habilitado  

---

## 1. Confirmación de Producción

Daniel (CEO) acaba de verificar y confirmar formalmente desde el dashboard de Vercel que el build del commit `ae12977` en `main` ha concluido con éxito en estado **READY** y se encuentra 100% operativo en `promoar.com.ar`.

---

## 2. Validación de Temas Abiertos

1. **Placeholder de `futureUpsell`**: Convalidado. Queda documentado como gap conocido de señal del motor para ser completado en sprints futuros; no bloquea en absoluto la operación de producción.
2. **Dominio**: Confirmado activo y sirviendo la nueva versión.

---

## 3. Checklist de Prueba de Humo en Vivo (Paso 5)

Con el deploy online, se habilita la validación de los flujos críticos de la Home v2:

- [ ] **Home Guest / Anónimo (`/promos`)**:
  - Banner superior de onboarding con botón de registro y link `¿Ya tenés cuenta? Iniciar sesión →`.
  - Renderizado de la vidriera `guest_showcase` con rubros prioritarios y marcas masivas (pantalla no vacía).
- [ ] **Selector de Provincia**:
  - Cambio de provincia y persistencia del contexto geográfico.
- [ ] **Flujo de Onboarding & Migración**:
  - Carga de tarjetas/bancos en modo guest (guardado en `localStorage.guestProfile`).
  - Registro o Login de usuario y verificación de la migración automática (`migrateGuestProfile`).
- [ ] **Navegación general**:
  - Enlaces a hubs de comercios (`/comercios/[slug]`), bancos (`/bancos/[slug]`) y catálogo completo (`/promos/explorar`).

---

## 4. Próximos Pasos Post-Prueba de Humo

Una vez chequeados estos puntos con Daniel:
1. Dar por cerrado formalmente el hito de **Lanzamiento Fase 1 (Soft Launch)**.
2. Abrir el hito de **Fase 2 / Sprint Mapa "Cerca Mío"** (`app/cerca/page.tsx` con MapLibre GL) y hardening de scrapers/cron.

---

**Firmado**: CPO (Gemini) & Daniel (CEO)
