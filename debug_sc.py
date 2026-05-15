"""
debug_sc.py - Probar el parámetro sc= (sales channel) en la API de Jumbo
El PriceToken JWT reveló salesChannel=32. ¿Cambia el stock con sc=32?
"""
import requests, json, sys, io, base64

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "https://www.jumbo.com.ar"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'es-AR,es;q=0.9',
}

session = requests.Session()
resp_home = session.get(BASE_URL, headers=HEADERS, timeout=15)

# Ver qué cookies setea el sitio (incluye el segment con salesChannel)
print("=== COOKIES después del home ===")
for name, val in session.cookies.items():
    print(f"  {name}: {val[:80]}...")

# Detectar el salesChannel del cookie vtex_segment
segment_cookie = session.cookies.get("vtex_segment", "")
if segment_cookie:
    try:
        # Es un JWT, decodear el payload (parte del medio)
        payload_b64 = segment_cookie.split(".")[1]
        # Agregar padding si falta
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        segment_data = json.loads(base64.urlsafe_b64decode(payload_b64))
        print(f"\n=== vtex_segment decoded ===")
        for k, v in segment_data.items():
            print(f"  {k}: {v}")
        sc = segment_data.get("channel", segment_data.get("salesChannel", "?"))
        print(f"\n  → Sales Channel detectado: {sc}")
    except Exception as e:
        print(f"  Error decodificando segment: {e}")

# -------------------------------------------------------
# Test: misma búsqueda SIN sc vs CON sc=32
# -------------------------------------------------------
print("\n" + "=" * 60)
print("TEST: ft=cerveza, primera página, SIN sc vs CON sc=32")
print("=" * 60)

def test_request(label, extra_params):
    params = {"ft": "cerveza", "_from": 0, "_to": 49, "O": "OrderByTopSaleDESC", **extra_params}
    r = session.get(f"{BASE_URL}/api/catalog_system/pub/products/search", headers=HEADERS, params=params, timeout=20)
    data = r.json()
    if not isinstance(data, list):
        print(f"[{label}] ERROR: {str(data)[:200]}")
        return
    activos = sum(1 for p in data
        if p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("AvailableQuantity", 0) > 0
        or p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("IsAvailable", False))
    resources = r.headers.get("resources", "?")
    print(f"[{label}] Status={r.status_code} | Productos={len(data)} | Activos={activos} | Total={resources}")

test_request("SIN sc", {})
test_request("CON sc=1", {"sc": "1"})
test_request("CON sc=2", {"sc": "2"})
test_request("CON sc=32", {"sc": "32"})

# -------------------------------------------------------
# Test con fq= (categoría cervezas = 2/38) también
# -------------------------------------------------------
print("\n" + "=" * 60)
print("TEST: fq=C:2/38/, primera página, SIN sc vs CON sc=32")
print("=" * 60)

def test_cat(label, extra_params):
    params = {"fq": "C:2/38/", "_from": 0, "_to": 49, "O": "OrderByTopSaleDESC", **extra_params}
    r = session.get(f"{BASE_URL}/api/catalog_system/pub/products/search", headers=HEADERS, params=params, timeout=20)
    data = r.json()
    if not isinstance(data, list):
        print(f"[{label}] ERROR: {str(data)[:200]}")
        return
    activos = sum(1 for p in data
        if p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("AvailableQuantity", 0) > 0
        or p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("IsAvailable", False))
    resources = r.headers.get("resources", "?")
    print(f"[{label}] Status={r.status_code} | Productos={len(data)} | Activos={activos} | Total={resources}")

test_cat("SIN sc", {})
test_cat("CON sc=32", {"sc": "32"})

# Mostrar detalle de los primeros 10 con sc=32
print("\n=== PRIMEROS 10 CON sc=32 ===")
params = {"fq": "C:2/38/", "_from": 0, "_to": 49, "O": "OrderByTopSaleDESC", "sc": "32"}
r = session.get(f"{BASE_URL}/api/catalog_system/pub/products/search", headers=HEADERS, params=params, timeout=20)
data = r.json()
if isinstance(data, list):
    for i, p in enumerate(data[:10]):
        offer = p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{})
        qty = offer.get("AvailableQuantity", "?")
        avail = offer.get("IsAvailable", "?")
        price = offer.get("Price", 0)
        estado = "ACTIVO" if (qty and qty != "?" and qty > 0) or avail == True else "SIN STOCK"
        print(f"  {i+1}. {p.get('productName','?')[:50]:<50} qty={qty} avail={avail} price={price:.0f} → {estado}")
