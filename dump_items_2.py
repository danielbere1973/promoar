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

# Stella Artois 710ml x 4u
r = session.get(
    f"{BASE}/_v/api/intelligent-search/product_search/",
    headers=H,
    params={"query": "stella artois 710ml", "page": 1, "count": 10},
    timeout=20
)
print("=== Stella Artois ===")
prods = r.json().get("products", [])
for p in prods:
    if "4u" in p.get("productName", "").lower() or "pack" in p.get("productName", "").lower():
        print(json.dumps(p, indent=2, ensure_ascii=False))
        break

# Imperial Rubia 710cc
r2 = session.get(
    f"{BASE}/_v/api/intelligent-search/product_search/",
    headers=H,
    params={"query": "imperial rubia 710cc", "page": 1, "count": 5},
    timeout=20
)
print("\n=== Imperial Rubia ===")
prods2 = r2.json().get("products", [])
if prods2:
    print(json.dumps(prods2[0], indent=2, ensure_ascii=False))
