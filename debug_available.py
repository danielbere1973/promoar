"""
debug_available.py - Buscar la forma de filtrar solo productos con stock en VTEX
"""
import requests, sys, io

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

def check(label, extra_params, use_fq_cat=True):
    """Chequea cuántos productos trae y cuántos son activos."""
    base_params = {"_from": 0, "_to": 49, "O": "OrderByTopSaleDESC"}
    if use_fq_cat:
        base_params["fq"] = "C:2/38/"
    else:
        base_params["ft"] = "cerveza"
    params = {**base_params, **extra_params}
    
    r = session.get(f"{BASE_URL}/api/catalog_system/pub/products/search", headers=HEADERS, params=params, timeout=20)
    resources = r.headers.get("resources", "?")
    
    try:
        data = r.json()
    except:
        print(f"[{label}] Status={r.status_code} | ERROR parse | raw: {r.text[:100]}")
        return
    
    if not isinstance(data, list):
        print(f"[{label}] Status={r.status_code} | ERROR: {str(data)[:100]}")
        return
    
    activos = sum(1 for p in data
        if p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("AvailableQuantity", 0) > 0
        or p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("IsAvailable", False))
    
    print(f"[{label}]")
    print(f"  Status={r.status_code} | En página={len(data)} | Activos_página={activos} | Total={resources}")
    return data

print("=" * 70)
print("CATEGORÍA cervezas (fq=C:2/38/)")
print("=" * 70)

# Sin filtros adicionales (baseline)
check("Base sin filtros", {})

# Filtrar solo disponibles con fq adicional
check("fq += availableforsale:1", {"fq": ["C:2/38/", "availableforsale:1"]})

# hideUnavailableItems no es un param REST pero probamos
check("hideUnavailableItems=true", {"hideUnavailableItems": "true"})

# filtrar por PriceFrom
check("priceFrom=1", {"priceFrom": "1"})

# Probar con map=c,c para path de categoría con map
check("map=c,c (path navegacion)", {"map": "c,c", "query": "bebidas/cervezas"})

print("\n" + "=" * 70)
print("ANÁLISIS: de los 1298 totales, cuántos SIN STOCK hay realmente?")
print("(descargando todas las páginas - esperar)")
print("=" * 70)

all_prods = []
for start in range(0, 1400, 50):
    params = {"fq": "C:2/38/", "_from": start, "_to": start+49, "O": "OrderByTopSaleDESC"}
    r = session.get(f"{BASE_URL}/api/catalog_system/pub/products/search", headers=HEADERS, params=params, timeout=25)
    resources = r.headers.get("resources", "")
    try:
        data = r.json()
    except:
        break
    if not isinstance(data, list) or not data:
        break
    all_prods.extend(data)
    total = int(resources.split("/")[-1]) if "/" in resources else "?"
    activos_pag = sum(1 for p in data
        if p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("AvailableQuantity", 0) > 0
        or p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("IsAvailable", False))
    print(f"  [{start}-{start+49}] total={len(all_prods)}/{total} | activos en página={activos_pag}/{len(data)}")
    if isinstance(total, int) and len(all_prods) >= total:
        break
    if len(data) < 50:
        break

total_activos = sum(1 for p in all_prods
    if p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("AvailableQuantity", 0) > 0
    or p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("IsAvailable", False))

print(f"\nTOTAL descargado: {len(all_prods)}")
print(f"  ACTIVOS: {total_activos}")
print(f"  SIN STOCK: {len(all_prods) - total_activos}")
print(f"  % activos: {100*total_activos//len(all_prods) if all_prods else 0}%")
print()

# Ver si los activos son los primeros (ordenados por ventas)
print("Posición de los productos ACTIVOS vs SIN STOCK (primeros 20):")
for i, p in enumerate(all_prods[:20]):
    offer = p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{})
    qty = offer.get("AvailableQuantity", 0)
    avail = offer.get("IsAvailable", False)
    estado = "✅" if (qty > 0 or avail) else "❌"
    print(f"  #{i+1:3} {estado} {p.get('productName','?')[:55]}")
