import requests, sys, io, json

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = "https://www.jumbo.com.ar"
H = {'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Content-Type': 'application/json'}
session = requests.Session()
session.get(BASE, headers=H, timeout=15)

# Paso 1: buscar Corona por linkId en el catálogo (para tener el SKU ID correcto)
print("=== SKU de Corona via catálogo (linkId) ===")
r = session.get(f"{BASE}/api/catalog_system/pub/products/search",
    headers=H, params={"fq": "linkId:cerveza-rubia-330ml-corona-2"}, timeout=15)
data = r.json()
if isinstance(data, list) and data:
    p = data[0]
    print(f"Producto: {p.get('productName')}")
    for item in p.get("items", []):
        sku_id = item.get("itemId")
        offer = item.get("sellers",[{}])[0].get("commertialOffer",{})
        print(f"  SKU catálogo: {sku_id} | Price: ${offer.get('Price')} | Qty: {offer.get('AvailableQuantity')}")
        
        # Simular checkout con este SKU del catálogo
        print(f"\n=== Checkout simulation con SKU catálogo {sku_id} ===")
        body = {"items": [{"id": sku_id, "quantity": 1, "seller": "1"}], "country": "ARG"}
        r2 = session.post(f"{BASE}/api/checkout/pub/orderForms/simulation", headers=H, json=body, timeout=20)
        sim = r2.json()
        items_sim = sim.get("items", [])
        msgs = sim.get("messages", [])
        if msgs:
            print(f"  Mensajes: {msgs}")
        if items_sim:
            it = items_sim[0]
            price = it.get("price", 0) / 100
            lp = it.get("listPrice", 0) / 100
            sp = it.get("sellingPrice", 0) / 100
            print(f"  price:        ${price:,.2f}")
            print(f"  listPrice:    ${lp:,.2f}")
            print(f"  sellingPrice: ${sp:,.2f}")
            for tag in it.get("priceTags", []):
                val = tag.get("rawValue", 0) / 100
                print(f"  priceTag [{tag.get('name')}]: ${val:,.2f}")
        else:
            print("  Sin items en respuesta")

# Paso 2: batch de 10 cervezas usando IDs del catálogo
print("\n=== Batch simulation: 10 cervezas con IDs del catálogo ===")
r3 = session.get(f"{BASE}/api/catalog_system/pub/products/search",
    headers=H, params={"fq": "C:2/38/", "_from": 0, "_to": 9, "O": "OrderByTopSaleDESC"}, timeout=20)
catalog_prods = r3.json()
if isinstance(catalog_prods, list):
    batch_items = []
    batch_info = {}
    for p in catalog_prods:
        item = p.get("items", [{}])[0]
        sku = item.get("itemId", "")
        price = item.get("sellers",[{}])[0].get("commertialOffer",{}).get("Price", 0)
        batch_items.append({"id": sku, "quantity": 1, "seller": "1"})
        batch_info[str(sku)] = {"name": p.get("productName","?"), "price": price}
    
    r4 = session.post(f"{BASE}/api/checkout/pub/orderForms/simulation",
        headers=H, json={"items": batch_items, "country": "ARG"}, timeout=20)
    sim4 = r4.json()
    print(f"Status: {r4.status_code} | Items respuesta: {len(sim4.get('items',[]))}")
    for it in sim4.get("items", []):
        sku = str(it.get("id","?"))
        info = batch_info.get(sku, {})
        price_api = info.get("price", 0)
        sp = it.get("sellingPrice", 0) / 100
        lp_sim = it.get("listPrice", 0) / 100
        diff = price_api - sp
        pct = round(diff / price_api * 100) if price_api > 0 else 0
        flag = f"  ← {pct}% OFF" if pct >= 1 else ""
        tags = [t.get("name") for t in it.get("priceTags",[])]
        print(f"  SKU {sku}: {info.get('name','?')[:45]:<45} API=${price_api:>7,.0f} | Sim=${sp:>9,.2f}{flag}  tags={tags}")
