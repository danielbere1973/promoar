# Revisión de Scrapers — Issues y Pendientes

## Pendiente General — Post Scrapers

### Normalización de nombres de comercio
Después de correr todos los scrapers, revisar duplicados y variantes del mismo comercio:
- "Disco" vs "DISCO.COM.AR" vs "Disco Online"
- "Vea" vs "VEA.COM.AR"
- "The Food Market" vs "www.thefoodmarket.com.ar"
- Aplicar merge/rename desde el admin o via script

### Normalización de categorías por nombre de comercio
Implementar tabla de marcas conocidas en `detectCategoria` (bank-helpers.ts) para que aplique a todos los scrapers:
- Heladerías: Freddo, Chungo, Persicco, Un'Altra Volta, etc.
- Farmacias: Farmacity, Dr. Ahorro, Vantage, etc.
- Jugueterías: Imaginarium, Top Toys, etc.
- Completar lista con marcas conocidas del mercado AR

### Categorías vacías en la UI
Si una categoría tiene 0 promos para el perfil del usuario:
- Ocultarla de los filtros rápidos
- Mostrar sugerencia de categoría similar (Heladerías → Gastronomía, Farmacias → Salud y Belleza)

---

## Banco Galicia

### ✅ Resuelto
- `eminent` field en minúscula → corregido
- Tope no venía en el JSON → se parsea del texto de `promocion` con `extractCap`
- `haberes` mapeado a `accountType: 'HABERES'`
- Promos de categoría (`tipoPromocion: "Categoria"`, `idMarca: null`) eran descartadas → ahora se incluyen usando `subtitulo` como storeName
- `EMINENT` agregado al enum `CardTier` en Prisma + types.ts
- Promos próximamente: se guardan con sufijo "(Próximamente)" en el título

### ⚠️ Pendiente
- **Topes**: confirmado vía DB — 6591 requirements de Galicia, 0 con tope. El texto corto de `promocion` no incluye montos de tope. Están solo en los legales completos que la API no expone.
- **Legales completos**: la API solo devuelve el texto corto de `promocion`. No hay endpoint de detalle con texto legal completo.
- **Matching Eminent en perfil**: funciona vía `cardTier: 'EMINENT'` pero requiere que el usuario tenga el segmento Eminent configurado en su perfil.
- **Heladerías en Gastronomía**: Galicia no tiene categoría propia de Heladerías → depende de normalización global por nombre de comercio (pendiente general).
- **Farmacias en Salud y Belleza**: ídem anterior.

---

## DIA

### ✅ Resuelto
- Teasers `"2do al 70%"` con `effects.parameters[PercentualDiscount]` → precio unitario calculado correctamente
- `discountHighlights` cuando `PriceWithoutDiscount > Price` → precio ya descontado, no se vuelve a aplicar
- Cluster highlights ajenos al producto filtrados por categoría del producto
- `fetch_promotions` re-indexado por `ref_id` (no por promo ID)
- Paginación cortada → corregido usando raw count antes de filtrar
- Filtro de categoría exacta por slug para evitar mezcla de productos

### ⚠️ Pendiente
- Pocas promos (10-21). Algunas entradas del source HTML tienen formatos no estándar que pueden escapar al parser.

---

## Geolocalización (Extracción de Provincias)

### Estado Actual
* **Backend (`route.ts`)**: La lógica es robusta. Si una promo no trae provincias en la DB (el array está vacío), asume por defecto que aplica a **todo el país**. Si trae `["Todas"]` o coincide con la provincia del usuario, hace match correctamente.
* **Scrapers**: Actualmente **solo Coto** extrae provincias usando la función local `extractProvinces()`. El resto de los scrapers omiten este dato, enviando null/undefined. Al llegar vacío a la DB, el sistema asume cobertura nacional para todas, lo que genera falsos positivos en promociones regionales (ej. "Sólo válido en Mendoza").

### Plan de Acción (A implementar)

1. **Migrar y Mejorar el Helper**:
   - Sacar la función `extractProvinces` de `coto.ts` y moverla a un archivo compartido (`bank-helpers.ts` o un nuevo `location-helpers.ts`).
   - Agregar soporte para *exclusiones* mediante expresiones regulares (ej. si lee "Mendoza", asegurarse de que no esté precedido por "EXCEPTO", "NO VÁLIDO EN" o "EXCLUYE").

2. **Actualizar Scrapers basados en Texto Legal**:
   - Integrar la nueva función `extractProvinces(textoLegal)` en el armado del objeto `ScrapedPromo` para los scrapers del Grupo 2: `jumbo.ts`, `disco.ts`, `vea.ts`, `carrefour.ts`, `changomas.ts`, `diarco.ts` y `dia.ts`.

3. **Actualizar Cuenta DNI (Quick Win)**:
   - En `cuentadni.ts`, por la naturaleza regional del Banco Provincia, inyectar directamente por defecto `provinces: ['Buenos Aires', 'CABA']` al objeto de la promoción, a menos que el texto especifique lo contrario.

4. **Revisar APIs de Bancos**:
   - Scrapers como `galicia.ts`, `bbva.ts` y `modo.ts` consumen APIs que devuelven JSON. 
   - Tarea: Inspeccionar si dentro de esos payloads (ej. el nodo de detalles o de comercios adheridos) viaja información estructurada de "sucursales" o "coordenadas" para mapear la provincia directamente sin depender de parsear texto con Regex.

---
