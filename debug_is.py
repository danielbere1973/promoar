"""
debug_is.py - Testear VTEX Intelligent Search API
El sitio de Jumbo usa /_v/api/intelligent-search/product_search/ que
tiene stock en tiempo real y hideUnavailableItems funciona.
"""
import requests, sys, io, json

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
# PASO 1: Verificar que el producto existe en IS
# -------------------------------------------------------
print("=" * 70)
print("PASO 1: Buscar 'cerveza rubia 330ml corona' en IS API")
print("=" * 70)

url_is = f"{BASE_URL}/_v/api/intelligent-search/product_search/"
params = {
    "query": "cerveza rubia 330ml corona",
    "page": 1,
    "count": 5,
    "sort": "orders:desc",
    "hideUnavailableItems": "true",
}
r = session.get(url_is, headers=HEADERS, params=params, timeout=20)
print(f"Status: {r.status_code}")
try:
    data = r.json()
    print(f"Total: {data.get('total', '?')}")
    for p in data.get("products", [])[:3]:
        print(f"  - {p.get('productName')} | link: {p.get('linkText')}")
        items = p.get("items", [{}])
        if items:
            offer = items[0].get("sellers", [{}])[0].get("commertialOffer", {})
            print(f"    Price={offer.get('Price')} Qty={offer.get('AvailableQuantity')} IsAvail={offer.get('IsAvailable')}")
except Exception as e:
    print(f"Error: {e} | raw: {r.text[:300]}")

# -------------------------------------------------------
# PASO 2: Cervezas por categoría en IS con hideUnavailableItems
# -------------------------------------------------------
print("\n" + "=" * 70)
print("PASO 2: IS API - categoría cervezas (map=c), hideUnavailableItems=true")
print("=" * 70)

# VTEX IS usa path de slug, no IDs
paths_to_try = [
    "cervezas",
    "bebidas/cervezas",
    "bebidas-gaseosas-y-aguas/cervezas",
]

for path in paths_to_try:
    params = {
        "page": 1,
        "count": 20,
        "sort": "orders:desc",
        "hideUnavailableItems": "true",
        "map": "c",
    }
    r = session.get(f"{BASE_URL}/_v/api/intelligent-search/product_search/{path}", headers=HEADERS, params=params, timeout=20)
    try:
        data = r.json()
        total = data.get("total", 0)
        prods = data.get("products", [])
        if total > 0:
            print(f"  ✅ [{path}] Status={r.status_code} | Total={total} | En página={len(prods)}")
            for p in prods[:5]:
                items = p.get("items", [{}])
                offer = items[0].get("sellers", [{}])[0].get("commertialOffer", {}) if items else {}
                print(f"     - {p.get('productName','?')[:50]} | qty={offer.get('AvailableQuantity')} | price={offer.get('Price')}")
            break
        else:
            print(f"  ❌ [{path}] Status={r.status_code} | total=0 | raw: {r.text[:100]}")
    except Exception as e:
        print(f"  ❌ [{path}] Error: {e} | raw: {r.text[:100]}")

# -------------------------------------------------------
# PASO 3: Probar IS por query de texto (comparar con catalog)
# -------------------------------------------------------
print("\n" + "=" * 70)
print("PASO 3: IS API - búsqueda por texto 'cerveza', hideUnavailableItems=true")
print("=" * 70)

params = {
    "query": "cerveza",
    "page": 1,
    "count": 20,
    "sort": "orders:desc",
    "hideUnavailableItems": "true",
}
r = session.get(url_is, headers=HEADERS, params=params, timeout=20)
print(f"Status: {r.status_code}")
try:
    data = r.json()
    total = data.get("total", 0)
    prods = data.get("products", [])
    print(f"Total disponibles: {total} | En página: {len(prods)}")
    for p in prods[:10]:
        items = p.get("items", [{}])
        offer = items[0].get("sellers", [{}])[0].get("commertialOffer", {}) if items else {}
        qty = offer.get("AvailableQuantity", "?")
        avail = offer.get("IsAvailable", "?")
        price = offer.get("Price", 0)
        print(f"  ✅ {p.get('productName','?')[:55]:<55} qty={qty} price={price:.0f}")
except Exception as e:
    print(f"Error: {e} | raw: {r.text[:300]}")

# -------------------------------------------------------
# PASO 4: Inspeccionar estructura completa del primer producto IS
# -------------------------------------------------------
print("\n" + "=" * 70)
print("PASO 4: Estructura del primer producto de IS (para adaptar el extractor)")
print("=" * 70)

params = {"query": "cerveza", "page": 1, "count": 2, "sort": "orders:desc", "hideUnavailableItems": "true"}
r = session.get(url_is, headers=HEADERS, params=params, timeout=20)
try:
    data = r.json()
    prods = data.get("products", [])
    if prods:
        p = prods[0]
        print(f"Claves del producto: {list(p.keys())}")
        print(f"productName: {p.get('productName')}")
        print(f"brand: {p.get('brand')}")
        print(f"linkText: {p.get('linkText')}")
        print(f"clusterHighlights: {p.get('clusterHighlights', {})}")
        item = p.get("items", [{}])[0]
        print(f"Claves del item: {list(item.keys())}")
        offer = item.get("sellers", [{}])[0].get("commertialOffer", {})
        print(f"commertialOffer keys: {list(offer.keys())}")
        print(f"Price: {offer.get('Price')}")
        print(f"ListPrice: {offer.get('ListPrice')}")
        print(f"AvailableQuantity: {offer.get('AvailableQuantity')}")
        print(f"IsAvailable: {offer.get('IsAvailable')}")
        print(f"Teasers: {offer.get('Teasers', [])[:2]}")
        print(f"DiscountHighLight: {offer.get('DiscountHighLight', [])}")
except Exception as e:
    print(f"Error: {e}")

# -------------------------------------------------------
# PASO 5: Ver cuántas páginas de cervezas hay en IS (total real)
# -------------------------------------------------------
print("\n" + "=" * 70)
print("PASO 5: Paginación IS - cuántos productos de cerveza con stock")
print("=" * 70)

total_is = 0
for page in range(1, 15):
    params = {"query": "cerveza", "page": page, "count": 20, "sort": "orders:desc", "hideUnavailableItems": "true"}
    r = session.get(url_is, headers=HEADERS, params=params, timeout=20)
    try:
        data = r.json()
        prods = data.get("products", [])
        total = data.get("total", 0)
        total_is = total
        print(f"  Página {page}: {len(prods)} productos | total API={total}")
        if not prods:
            break
    except:
        break

print(f"\n  → Total real con stock en IS: {total_is}")
print(f"  → Páginas de 20: {(total_is // 20) + 1}")
