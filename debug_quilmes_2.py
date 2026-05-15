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

# Buscar por nombre
r = session.get(
    f"{BASE}/_v/api/intelligent-search/product_search/",
    headers=H,
    params={"query": "quilmes 473 x 6", "page": 1, "count": 5},
    timeout=20
)

data = r.json()
prods = data.get("products", [])
if prods:
    p = prods[0]
    item = p.get("items", [{}])[0]
    seller = item.get("sellers", [{}])[0]
    commertial = seller.get("commertialOffer", {})
    
    output = {
        "productName": p.get("productName"),
        "brand": p.get("brand"),
        "Price (Precio Base API)": commertial.get("Price"),
        "ListPrice (Tachado API)": commertial.get("ListPrice"),
        "spotPrice (Precio con Dcto Directo)": commertial.get("spotPrice"),
        "clusterHighlights (Etiquetas de marketing)": [c.get("name") for c in p.get("clusterHighlights", [])],
        "teasers (Promos complejas)": commertial.get("teasers", []),
        "discountHighlights": commertial.get("discountHighlights", [])
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
else:
    print("No se encontró el producto.")
