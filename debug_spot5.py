"""
debug_spot5.py - Usar salesChannel=32 en el orderForm (el canal online real de Jumbo)
"""
import requests, sys, io, json

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = "https://www.jumbo.com.ar"
H = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Content-Type': 'application/json',
}
session = requests.Session()
session.get(BASE, headers=H, timeout=15)

SKU = "22487"

# Intentar con salesChannel=32 explícito
print("=== OrderForm con sc=32 (canal online Jumbo) ===")
r_of = session.post(
    f"{BASE}/api/checkout/pub/orderForm?sc=32",
    headers=H,
    json={"expectedOrderFormSections": ["items", "totalizers", "ratesAndBenefitsData"]},
    timeout=20
)
of = r_of.json()
of_id = of.get("orderFormId", "")
sc = of.get("salesChannel", "?")
print(f"orderFormId: {of_id} | salesChannel: {sc}")

if of_id:
    r_add = session.post(
        f"{BASE}/api/checkout/pub/orderForm/{of_id}/items?sc=32",
        headers=H,
        json={"orderItems": [{"id": SKU, "quantity": 1, "seller": "1"}]},
        timeout=20
    )
    of2 = r_add.json()
    print(f"AddItem status: {r_add.status_code} | salesChannel: {of2.get('salesChannel')}")
    items = of2.get("items", [])
    msgs = of2.get("messages", [])
    if msgs:
        print(f"Mensajes: {[m.get('text') for m in msgs]}")
    print(f"Items en respuesta: {len(items)}")
    for it in items:
        price = it.get("price", 0) / 100
        lp = it.get("listPrice", 0) / 100
        sp = it.get("sellingPrice", 0) / 100
        print(f"  {it.get('name')} | price={price:.2f} | listPrice={lp:.2f} | sellingPrice={sp:.2f}")
        print(f"  priceTags: {it.get('priceTags', [])}")

# Simulación directa con sc=32
print("\n=== Simulation con sc=32 ===")
body = {
    "items": [{"id": SKU, "quantity": 1, "seller": "1"}],
    "country": "ARG",
    "salesChannel": "32",
}
r_sim = session.post(
    f"{BASE}/api/checkout/pub/orderForms/simulation?sc=32",
    headers=H,
    json=body,
    timeout=20
)
sim = r_sim.json()
print(f"Status: {r_sim.status_code} | salesChannel: {sim.get('salesChannel','?')}")
items_sim = sim.get("items", [])
print(f"Items: {len(items_sim)}")
for it in items_sim:
    sp = it.get("sellingPrice", 0) / 100
    print(f"  sellingPrice={sp:.2f} priceTags={it.get('priceTags')}")

# Probar también batch de 5 productos via IS + sc=32
print("\n=== Batch simulation sc=32: 5 cervezas ===")
r_is = session.get(
    f"{BASE}/_v/api/intelligent-search/product_search/",
    headers=H,
    params={"query": "cerveza", "page": 1, "count": 5},
    timeout=20
)
batch_prods = r_is.json().get("products", [])
batch_items = []
batch_info = {}
for prod in batch_prods:
    item = prod.get("items", [{}])[0]
    item_id = item.get("itemId", "")
    price_api = item.get("sellers", [{}])[0].get("commertialOffer", {}).get("Price", 0)
    if item_id:
        batch_items.append({"id": item_id, "quantity": 1, "seller": "1"})
        batch_info[str(item_id)] = {"name": prod.get("productName", "?"), "price": price_api}

r_batch = session.post(
    f"{BASE}/api/checkout/pub/orderForms/simulation?sc=32",
    headers=H,
    json={"items": batch_items, "country": "ARG", "salesChannel": "32"},
    timeout=30
)
sim_b = r_batch.json()
items_b = sim_b.get("items", [])
print(f"Status: {r_batch.status_code} | Items recibidos: {len(items_b)}")
for it in items_b:
    sku = str(it.get("id", "?"))
    info = batch_info.get(sku, {})
    sp = it.get("sellingPrice", 0) / 100
    price_api = info.get("price", 0)
    pct = round((price_api - sp) / price_api * 100) if price_api > 0 and sp < price_api else 0
    flag = f"  ← {pct}% OFF" if pct >= 1 else ""
    print(f"  {sku}: {info.get('name','?')[:45]:<45} API=${price_api:>7,.0f} | Sim=${sp:>9,.2f}{flag}")
