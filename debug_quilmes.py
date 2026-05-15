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

# Buscar el producto Quilmes 473 x 6
r = session.get(
    f"{BASE}/_v/api/intelligent-search/product_search/cerveza-473-ml-x-6-u-quilmes",
    headers=H,
    timeout=20
)

if r.status_code == 200:
    data = r.json()
    # Limpiamos el JSON para mostrar solo lo relevante al usuario
    item = data.get("items", [{}])[0]
    seller = item.get("sellers", [{}])[0]
    commertial = seller.get("commertialOffer", {})
    
    output = {
        "productName": data.get("productName"),
        "brand": data.get("brand"),
        "Price (Precio Base API)": commertial.get("Price"),
        "ListPrice (Tachado API)": commertial.get("ListPrice"),
        "spotPrice (Precio con Dcto Directo)": commertial.get("spotPrice"),
        "clusterHighlights (Promociones en etiquetas)": [c.get("name") for c in data.get("clusterHighlights", [])],
        "teasers (Promos de carrito)": commertial.get("teasers", []),
        "discountHighlights": commertial.get("discountHighlights", [])
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
else:
    print(f"Error: {r.status_code}")
