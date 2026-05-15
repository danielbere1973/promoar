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

