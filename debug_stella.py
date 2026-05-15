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

# Buscar por SKU o nombre exacto
r = session.get(
    f"{BASE}/_v/api/intelligent-search/product_search/",
    headers=H,
    params={"query": "stella artois 710ml", "page": 1, "count": 10},
    timeout=20
)
prods = r.json().get("products", [])
for p in prods:
    if "4u" in p.get("productName", "").lower():
        print(f"Producto: {p.get('productName')}")
        print(f"linkText: {p.get('linkText')}")
        offer = p.get("items", [{}])[0].get("sellers", [{}])[0].get("commertialOffer", {})
        print(f"Price: {offer.get('Price')}")
        print(f"spotPrice: {offer.get('spotPrice')}")
        print(f"ListPrice: {offer.get('ListPrice')}")
        print(f"teasers: {offer.get('teasers')}")
        print(f"clusterHighlights: {[c.get('name') for c in p.get('clusterHighlights', [])]}")
        break
