"""
debug_cencosud.py - Diagnóstico exhaustivo de la API de Jumbo
Queremos entender:
  1. Cuántos productos devuelve la API en total
  2. Cómo funciona la paginación
  3. Qué valores tienen Price, ListPrice, AvailableQuantity, IsAvailable
  4. Cuántos son "sin stock" según la API y por qué
"""
import requests, json, sys, io

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "https://www.jumbo.com.ar"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'es-AR,es;q=0.9',
}

session = requests.Session()
session.get(BASE_URL, headers=HEADERS, timeout=15)

# -------------------------------------------------------
# PASO 1: Ver cuántos productos devuelve en total la búsqueda
# -------------------------------------------------------
print("=" * 70)
print("PASO 1: Primera página (0-49) — ver header 'resources'")
print("=" * 70)

resp = session.get(
    f"{BASE_URL}/api/catalog_system/pub/products/search",
    headers=HEADERS,
    params={"ft": "cerveza", "_from": 0, "_to": 49},
    timeout=20
)
print(f"Status: {resp.status_code}")
print(f"Header 'resources': {resp.headers.get('resources', 'NO ENCONTRADO')}")
print(f"Header 'X-Total-Count': {resp.headers.get('X-Total-Count', 'NO ENCONTRADO')}")
print(f"Todos los headers relevantes:")
for k, v in resp.headers.items():
    if any(x in k.lower() for x in ['resource', 'total', 'count', 'page']):
        print(f"  {k}: {v}")

data = resp.json()
print(f"\nProductos en esta página: {len(data)}")

# -------------------------------------------------------
# PASO 2: Descarga todas las páginas y analiza cada producto
# -------------------------------------------------------
print("\n" + "=" * 70)
print("PASO 2: Descarga paginada completa + análisis de stock")
print("=" * 70)

all_products = []
page_size = 50

for start in range(0, 500, page_size):
    end = start + page_size - 1
    resp = session.get(
        f"{BASE_URL}/api/catalog_system/pub/products/search",
        headers=HEADERS,
        params={"ft": "cerveza", "_from": start, "_to": end},
        timeout=20
    )
    
    resources_hdr = resp.headers.get("resources", "")
    total_api = int(resources_hdr.split("/")[-1]) if "/" in resources_hdr else "?"
    
    try:
        page_data = resp.json()
    except:
        print(f"  [{start}-{end}] ERROR al parsear JSON")
        break
    
    if not isinstance(page_data, list) or len(page_data) == 0:
        print(f"  [{start}-{end}] Respuesta vacía o no es lista — FIN")
        break
    
    print(f"  [{start}-{end}] Status={resp.status_code} | Productos={len(page_data)} | Total API={total_api}")
    all_products.extend(page_data)
    
    if isinstance(total_api, int) and len(all_products) >= total_api:
        print(f"  → Alcanzamos el total ({total_api}), deteniendo.")
        break
    
    if len(page_data) < page_size:
        print(f"  → Menos de {page_size} resultados, es la última página.")
        break

print(f"\nTotal descargado: {len(all_products)} productos")

# -------------------------------------------------------
# PASO 3: Análisis detallado de cada producto
# -------------------------------------------------------
print("\n" + "=" * 70)
print("PASO 3: Análisis de campos de stock / precio")
print("=" * 70)

stats = {
    "sin_precio": [],
    "qty_cero_isavail_true": [],
    "qty_cero_isavail_false": [],
    "qty_mayor_isavail_false": [],
    "activos": [],
}

print(f"\n{'#':<4} {'PRODUCTO':<40} {'PRICE':>10} {'LIST':>10} {'QTY':>8} {'ISAVAIL':>8} {'ESTADO'}")
print("-" * 95)

for i, p in enumerate(all_products):
    name = p.get("productName", "?")[:38]
    item = p.get("items", [{}])[0]
    offer = item.get("sellers", [{}])[0].get("commertialOffer", {})
    
    price = offer.get("Price", 0)
    lp = offer.get("ListPrice", 0)
    qty = offer.get("AvailableQuantity", -1)
    is_avail = offer.get("IsAvailable", "N/A")
    
    if price <= 0:
        estado = "SIN PRECIO"
        stats["sin_precio"].append(name)
    elif qty > 0 or is_avail == True:
        estado = "ACTIVO"
        stats["activos"].append(name)
    else:
        estado = "SIN STOCK"
        if qty == 0 and is_avail == True:
            stats["qty_cero_isavail_true"].append(name)
        elif qty == 0:
            stats["qty_cero_isavail_false"].append(name)
        elif qty > 0:
            stats["qty_mayor_isavail_false"].append(name)

    print(f"{i+1:<4} {name:<40} {price:>10,.0f} {lp:>10,.0f} {qty:>8} {str(is_avail):>8} {estado}")

# -------------------------------------------------------
# PASO 4: Resumen
# -------------------------------------------------------
print("\n" + "=" * 70)
print("PASO 4: RESUMEN")
print("=" * 70)
print(f"  Total productos descargados: {len(all_products)}")
print(f"  ACTIVOS:      {len(stats['activos'])}")
print(f"  SIN PRECIO:   {len(stats['sin_precio'])}")
sin_stock = len(all_products) - len(stats['activos']) - len(stats['sin_precio'])
print(f"  SIN STOCK:    {sin_stock}")
print()
print(f"  De los SIN STOCK...")
print(f"    qty=0 + IsAvailable=True:  {len(stats['qty_cero_isavail_true'])}")
print(f"    qty=0 + IsAvailable=False: {len(stats['qty_cero_isavail_false'])}")
print(f"    qty>0 + IsAvailable=False: {len(stats['qty_mayor_isavail_false'])}")

# -------------------------------------------------------
# PASO 5: Ver un producto "sin stock" en detalle
# -------------------------------------------------------
print("\n" + "=" * 70)
print("PASO 5: DETALLE RAW de los primeros 3 productos SIN STOCK")
print("=" * 70)

sin_stock_prods = [p for p in all_products if (
    p.get("items", [{}])[0].get("sellers", [{}])[0].get("commertialOffer", {}).get("Price", 0) > 0
    and p.get("items", [{}])[0].get("sellers", [{}])[0].get("commertialOffer", {}).get("AvailableQuantity", 0) <= 0
    and not p.get("items", [{}])[0].get("sellers", [{}])[0].get("commertialOffer", {}).get("IsAvailable", False)
)]

for p in sin_stock_prods[:3]:
    print(f"\n>>> {p.get('productName')}")
    item = p.get("items", [{}])[0]
    print(f"  itemId: {item.get('itemId')}")
    offer = item.get("sellers", [{}])[0].get("commertialOffer", {})
    print(f"  commertialOffer completo:")
    for k, v in offer.items():
        print(f"    {k}: {v}")
    # Ver si hay más sellers
    sellers = item.get("sellers", [])
    if len(sellers) > 1:
        print(f"  TIENE {len(sellers)} sellers!")
        for s in sellers[1:]:
            o2 = s.get("commertialOffer", {})
            print(f"    Seller alternativo => Price:{o2.get('Price')} Qty:{o2.get('AvailableQuantity')} IsAvail:{o2.get('IsAvailable')}")

# -------------------------------------------------------
# PASO 6: Probar con hideUnavailableItems=false via URL
# -------------------------------------------------------
print("\n" + "=" * 70)
print("PASO 6: Probar hideUnavailableItems=false en URL")
print("=" * 70)

resp2 = session.get(
    f"{BASE_URL}/api/catalog_system/pub/products/search",
    headers=HEADERS,
    params={"ft": "cerveza", "_from": 0, "_to": 49, "O": "OrderByTopSaleDESC"},
    timeout=20
)
print(f"Status: {resp2.status_code}")
print(f"Header resources: {resp2.headers.get('resources', 'N/A')}")
data2 = resp2.json()
print(f"Productos: {len(data2)}")
if data2:
    activos2 = sum(1 for p in data2 
                   if p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("AvailableQuantity",0) > 0
                   or p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("IsAvailable", False))
    print(f"Activos en esta página: {activos2}")
