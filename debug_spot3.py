"""
debug_spot3.py - Intentar varios enfoques para obtener el precio con descuento de la Corona
"""
import requests, sys, io, json

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = "https://www.jumbo.com.ar"
H = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Referer': 'https://www.jumbo.com.ar/',
}
session = requests.Session()
r_home = session.get(BASE, headers=H, timeout=15)
print(f"Sesión iniciada | Cookies: {dict(session.cookies)}")

SKU = "22487"

# Intento 1: product price endpoint
print("\n=== Intento 1: /api/catalog_system/pub/products/price/{sku} ===")
r = session.get(f"{BASE}/api/catalog_system/pub/products/price/{SKU}", headers=H, timeout=15)
print(f"Status: {r.status_code} | {r.text[:500]}")

# Intento 2: sku price
print("\n=== Intento 2: /api/pricing/prices/{sku} ===")
r = session.get(f"{BASE}/api/pricing/prices/{SKU}", headers=H, timeout=15)
print(f"Status: {r.status_code} | {r.text[:500]}")

# Intento 3: checkout simulation con sc=32
print("\n=== Intento 3: checkout simulation con sc=32 ===")
body = {"items": [{"id": SKU, "quantity": 1, "seller": "1"}], "country": "ARG", "salesChannel": "32"}
r = session.post(f"{BASE}/api/checkout/pub/orderForms/simulation?sc=32", headers=H, json=body, timeout=20)
print(f"Status: {r.status_code}")
sim = r.json()
print(f"Items: {len(sim.get('items',[]))} | msgs: {sim.get('messages',[])}")
for it in sim.get("items", []):
    print(f"  sellingPrice={it.get('sellingPrice',0)/100:.2f} | priceTags={it.get('priceTags')}")

# Intento 4: ver el orderForm cookie
print("\n=== Intento 4: crear orderForm y añadir item ===")
r_of = session.post(
    f"{BASE}/api/checkout/pub/orderForm",
    headers={**H, "Content-Type": "application/json"},
    json={"expectedOrderFormSections": ["items", "totalizers"]},
    timeout=20
)
print(f"OrderForm status: {r_of.status_code}")
of_data = r_of.json()
of_id = of_data.get("orderFormId", "")
print(f"orderFormId: {of_id}")
if of_id:
    r_add = session.post(
        f"{BASE}/api/checkout/pub/orderForm/{of_id}/items",
        headers={**H, "Content-Type": "application/json"},
        json={"orderItems": [{"id": SKU, "quantity": 1, "seller": "1"}]},
        timeout=20
    )
    print(f"AddItem status: {r_add.status_code}")
    add_data = r_add.json()
    for it in add_data.get("items", []):
        sp = it.get("sellingPrice", 0) / 100
        lp = it.get("listPrice", 0) / 100
        price = it.get("price", 0) / 100
        print(f"  name={it.get('name')} | price={price:.2f} | listPrice={lp:.2f} | sellingPrice={sp:.2f}")
        for tag in it.get("priceTags", []):
            print(f"  priceTag[{tag.get('name')}]={tag.get('rawValue',0)/100:.2f}")
    # Totalizers
    for total in add_data.get("totalizers", []):
        print(f"  totalizer[{total.get('id')}] = ${total.get('value',0)/100:.2f}")

# Intento 5: IS con el campo priceRange
print("\n=== Intento 5: IS con query Corona — ver priceRange ===")
r_is = session.get(
    f"{BASE}/_v/api/intelligent-search/product_search/",
    headers=H,
    params={"query": "cerveza rubia 330ml corona", "page": 1, "count": 1},
    timeout=20
)
prod = r_is.json().get("products", [{}])[0]
print("priceRange:", json.dumps(prod.get("priceRange", {}), indent=2))
print("offers:", json.dumps(prod.get("offers", {}), indent=2))
# ver si hay un campo bestSellerPrice o similar
print("Todos los keys del producto:", list(prod.keys()))
if prod.get("items"):
    item = prod["items"][0]
    offer = item.get("sellers", [{}])[0].get("commertialOffer", {})
    print("\nTodos los keys de commertialOffer:", list(offer.keys()))
    for k, v in offer.items():
        if v != 0 and v is not None and v != [] and v != {}:
            print(f"  {k}: {v}")
