"""
debug_spot2.py - Obtener precio con descuento via IS + checkout simulation
El catalog_system usa itemId diferente al que necesita el checkout.
IS devuelve el itemId correcto (con formato distinto).
"""
import requests, sys, io, json

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = "https://www.jumbo.com.ar"
H = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
}
session = requests.Session()
session.get(BASE, headers=H, timeout=15)

# Paso 1: obtener la Corona via IS
print("=== Buscando Corona via Intelligent Search ===")
r_is = session.get(
    f"{BASE}/_v/api/intelligent-search/product_search/",
    headers=H,
    params={"query": "cerveza rubia 330ml corona", "page": 1, "count": 5},
    timeout=20
)
data_is = r_is.json()
prods_is = data_is.get("products", [])
print(f"Productos encontrados: {len(prods_is)}")

for prod in prods_is[:3]:
    name = prod.get("productName", "?")
    print(f"\nProducto: {name}")
    for item in prod.get("items", []):
        item_id = item.get("itemId", "?")
        for seller in item.get("sellers", []):
            seller_id = seller.get("sellerId", "1")
            offer = seller.get("commertialOffer", {})
            price = offer.get("Price", 0)
            spot = offer.get("spotPrice", 0)
            print(f"  itemId={item_id} | seller={seller_id} | Price=${price} | spotPrice=${spot}")

# Paso 2: usar el itemId de IS para checkout simulation
if prods_is:
    prod = prods_is[0]
    item = prod.get("items", [{}])[0]
    item_id = item.get("itemId", "")
    seller = item.get("sellers", [{}])[0].get("sellerId", "1")
    print(f"\n=== Checkout simulation con IS itemId={item_id} seller={seller} ===")
    body = {
        "items": [{"id": item_id, "quantity": 1, "seller": seller}],
        "country": "ARG"
    }
    r2 = session.post(f"{BASE}/api/checkout/pub/orderForms/simulation", headers=H, json=body, timeout=20)
    print(f"Status: {r2.status_code}")
    sim = r2.json()
    msgs = sim.get("messages", [])
    if msgs:
        print(f"Mensajes: {msgs}")
    items_sim = sim.get("items", [])
    print(f"Items en respuesta: {len(items_sim)}")
    for it in items_sim:
        price = it.get("price", 0) / 100
        lp = it.get("listPrice", 0) / 100
        sp = it.get("sellingPrice", 0) / 100
        print(f"  price={price:.2f} | listPrice={lp:.2f} | sellingPrice={sp:.2f}")
        for tag in it.get("priceTags", []):
            raw = tag.get("rawValue", 0) / 100
            print(f"  priceTag[{tag.get('name')}] = ${raw:.2f}")

# Paso 3: batch de 10 cervezas usando IDs de IS
print("\n=== Batch: 10 cervezas con IDs de IS ===")
r_batch = session.get(
    f"{BASE}/_v/api/intelligent-search/product_search/",
    headers=H,
    params={"query": "cerveza", "page": 1, "count": 10},
    timeout=20
)
batch_prods = r_batch.json().get("products", [])
batch_items = []
batch_info = {}

for prod in batch_prods:
    item = prod.get("items", [{}])[0]
    item_id = item.get("itemId", "")
    seller_id = item.get("sellers", [{}])[0].get("sellerId", "1") if item.get("sellers") else "1"
    price = item.get("sellers", [{}])[0].get("commertialOffer", {}).get("Price", 0)
    if item_id:
        batch_items.append({"id": item_id, "quantity": 1, "seller": seller_id})
        batch_info[str(item_id)] = {"name": prod.get("productName", "?"), "price": price}

print(f"Enviando {len(batch_items)} items al checkout simulation...")
r4 = session.post(
    f"{BASE}/api/checkout/pub/orderForms/simulation",
    headers=H,
    json={"items": batch_items, "country": "ARG"},
    timeout=30
)
sim4 = r4.json()
items_resp = sim4.get("items", [])
print(f"Status: {r4.status_code} | Items recibidos: {len(items_resp)}")

for it in items_resp:
    sku = str(it.get("id", "?"))
    info = batch_info.get(sku, {})
    price_api = info.get("price", 0)
    sp = it.get("sellingPrice", 0) / 100
    lp = it.get("listPrice", 0) / 100
    pct = round((price_api - sp) / price_api * 100) if price_api > 0 and sp < price_api else 0
    flag = f"  ← {pct}% OFF" if pct >= 1 else ""
    tags = [t.get("name") for t in it.get("priceTags", [])]
    print(f"  {sku}: {info.get('name','?')[:45]:<45} API=${price_api:>7,.0f} | Sim=${sp:>9,.2f}{flag}  tags={tags}")
