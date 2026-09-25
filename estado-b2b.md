# Estado y Plan: Módulo B2B / Promociones Directas (Retail Promos)

Este documento detalla el estado actual del ecosistema B2B en PromoAR y los próximos pasos para implementar el módulo de "Promociones Directas" (Retail Promos), para que los dueños de comercios puedan cargar sus propias ofertas de góndola (independientes de las bancarias).

## 1. Estado Actual (Lo que ya está implementado)

El andamiaje base para que los comercios operen en la plataforma ya está listo y funcional:

- **Modelo de Base de Datos (UserCommerce)**: 
  Relaciona a un User con un Commerce asignándole un ole (ADMIN, EDITOR, VIEWER) y un status (PENDING, APPROVED, REJECTED).
- **Flujo de Reclamo (Onboarding)**: 
  Ruta /comercios/registro donde un usuario puede buscar un comercio existente (o sugerir uno nuevo) y reclamarlo. Crea el registro en estado PENDING.
- **Aprobación del Admin**: 
  En el panel general de Admin (/admin), el componente UserCommercesView.tsx lista los reclamos pendientes y permite aprobarlos o rechazarlos.
- **Dashboard del Comercio (/comercios/dashboard)**:
  - **Overview (page.tsx)**: Muestra métricas mockeadas de vistas y clics, y links a los módulos.
  - **Perfil (/perfil)**: El dueño puede actualizar los datos básicos del comercio.
  - **Sucursales (/sucursales)**: ABM completo para gestionar el mapa de locales (CommerceBranch). Muy importante para la geolocalización.

## 2. Lo que Falta: El Módulo de Promociones Directas

En el dashboard del comercio existe un banner que invita a usar el módulo de "Promociones Directas" (linkeando a /comercios/dashboard/promos), pero **esta ruta aún no existe**.

### Objetivos del módulo:
1. Permitir al comercio cargar promociones propias (ej: "2x1 en Cervezas", "2da unidad al 50%", "15% off pago en efectivo").
2. Estas promos no dependen de un banco o tarjeta (o pueden depender de un medio de pago genérico como "Efectivo" o "Transferencia").
3. Deben integrarse limpiamente con el motor actual de matcheo y mostrarse en la App junto a (o destacadas sobre) las promos bancarias.

### Tareas de Implementación para Claude:

#### A. Modelo de Datos (Prisma)
- Verificar cómo identificar estas promos. Actualmente Promo tiene source (String). Se recomienda usar source = "B2B" o source = "DIRECT".
- PromoRequirement permite ankId nulo y walletId nulo. Se debe agregar o validar la existencia de paymentChannel tipo CASH o ANY para representar promociones en efectivo/general.
- Revisar si hace falta un flag isDirect en Promo para facilitar filtrados en las queries de Home.

#### B. Interfaz del Comercio (CRUD)
- Crear el ABM en pp/comercios/dashboard/promos/page.tsx:
  - **Listado**: Grilla con las promos activas, pausadas o vencidas del comercio.
  - **Creación/Edición**: Formulario para cargar Título, Descripción, Tipo de Descuento (Porcentaje, 2x1, Monto Fijo), Días de vigencia (alidDays), Fecha de fin (alidUntil), y Condiciones (ej. "Sólo efectivo").
- Crear las API routes correspondientes (pp/api/comercios/promos/route.ts), asegurando validar que el usuario tenga el rol de ADMIN/EDITOR en ese comercio vía UserCommerce.

#### C. Integración en el Decision Engine
- Modificar /api/promos/home-decision/route.ts (y helpers asociados) para que las promos "Directas" también pasen el filtro de *Financial Profile*.
- Como no requieren un banco específico, estas promos **deberían matchear siempre** (siempre que el usuario cumpla con la condición de geolocalización y los días de vigencia).
- **UI de la App**: Definir un diseño de *Chip* o *Badge* para estas promos en la tarjeta (ej. en vez de mostrar un logo de banco, mostrar un iconito de tienda o un badge que diga "Promo del Local").

---
**Nota para Claude:** El flujo B2B fundacional está sólido. El foco exclusivo ahora es levantar el CRUD de Promos en el Dashboard de Comercio, ajustar la API para guardar esas promos con ankId = null y asegurar que el motor de la Home las renderice correctamente.
