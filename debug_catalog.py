import requests, sys, io, json

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = "https://www.jumbo.com.ar"
H = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
}
session = requests.Session()
session.get(BASE, headers=H, timeout=15)

# Probar catalog_system pub/products/search para Stella (productId 21334)
# Esta API a veces tiene el Price y ListPrice correctos de promo
print("=== Catalog System Search (Stella) ===")
r = session.get(
    f"{BASE}/api/catalog_system/pub/products/search",
    headers=H,
    params={"fq": "productId:21334"},
    timeout=20
)
data = r.json()
if data:
    p = data[0]
    item = p.get("items", [{}])[0]
    offer = item.get("sellers", [{}])[0].get("commertialOffer", {})
    print(f"Price: {offer.get('Price')}")
    print(f"ListPrice: {offer.get('ListPrice')}")
    print(f"Teasers: {offer.get('Teasers')}")
    print(f"DiscountHighLight: {offer.get('DiscountHighLight')}")

# Probar Imperial (productId 3381)
print("\n=== Catalog System Search (Imperial) ===")
r2 = session.get(
    f"{BASE}/api/catalog_system/pub/products/search",
    headers=H,
    params={"fq": "productId:3381"},
    timeout=20
)
data2 = r2.json()
if data2:
    p2 = data2[0]
    item2 = p2.get("items", [{}])[0]
    offer2 = item2.get("sellers", [{}])[0].get("commertialOffer", {})
    print(f"Price: {offer2.get('Price')}")
    print(f"ListPrice: {offer2.get('ListPrice')}")
