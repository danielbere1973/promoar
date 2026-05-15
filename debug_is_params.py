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

# Probar Intelligent Search con simulación (parámetro simulation=true)
print("=== Intelligent Search with Simulation (Stella) ===")
r = session.get(
    f"{BASE}/_v/api/intelligent-search/product_search/cerveza-rubia-710ml-x-4u-stella-artois",
    headers=H,
    params={"simulation": "true"},
    timeout=20
)
p = r.json()
offer = p.get("items", [{}])[0].get("sellers", [{}])[0].get("commertialOffer", {})
print(f"Price: {offer.get('Price')}")
print(f"spotPrice: {offer.get('spotPrice')}")
print(f"teasers: {offer.get('teasers')}")

# Probar con otro canal de ventas en el query si existe
print("\n=== Intelligent Search with sc=32 (Stella) ===")
r2 = session.get(
    f"{BASE}/_v/api/intelligent-search/product_search/cerveza-rubia-710ml-x-4u-stella-artois",
    headers=H,
    params={"sc": "32"},
    timeout=20
)
p2 = r2.json()
offer2 = p2.get("items", [{}])[0].get("sellers", [{}])[0].get("commertialOffer", {})
print(f"Price: {offer2.get('Price')}")
print(f"spotPrice: {offer2.get('spotPrice')}")
