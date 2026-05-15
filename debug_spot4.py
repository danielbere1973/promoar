"""
debug_spot4.py - Verificar orderForm real + teasers de la Corona
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

# Revisar teasers de la Corona via IS
print("=== Teasers de la Corona via IS ===")
r_is = session.get(
    f"{BASE}/_v/api/intelligent-search/product_search/",
    headers=H,
    params={"query": "cerveza rubia 330ml corona", "page": 1, "count": 1},
    timeout=20
)
prod = r_is.json().get("products", [{}])[0]
item = prod.get("items", [{}])[0]
offer = item.get("sellers", [{}])[0].get("commertialOffer", {})
teasers = offer.get("teasers", [])
clusters = prod.get("clusterHighlights", [])
print(f"Teasers ({len(teasers)}): {json.dumps(teasers, indent=2, ensure_ascii=False)}")
print(f"clusterHighlights ({len(clusters)}): {json.dumps(clusters[:5], indent=2, ensure_ascii=False)}")

# Revisar el orderForm real con el item agregado
print("\n=== OrderForm con item agregado ===")
r_of = session.post(
    f"{BASE}/api/checkout/pub/orderForm",
    headers=H,
    json={"expectedOrderFormSections": ["items", "totalizers", "ratesAndBenefitsData"]},
    timeout=20
)
of = r_of.json()
of_id = of.get("orderFormId", "")
print(f"orderFormId: {of_id}")

if of_id:
    r_add = session.post(
        f"{BASE}/api/checkout/pub/orderForm/{of_id}/items",
        headers=H,
        json={"orderItems": [{"id": SKU, "quantity": 1, "seller": "1"}],
              "expectedOrderFormSections": ["items", "totalizers", "ratesAndBenefitsData"]},
        timeout=20
    )
    of2 = r_add.json()
    print(f"AddItem status: {r_add.status_code}")
    items = of2.get("items", [])
    print(f"Items: {len(items)}")
    for it in items:
        price = it.get("price", 0) / 100
        lp = it.get("listPrice", 0) / 100
        sp = it.get("sellingPrice", 0) / 100
        print(f"  name: {it.get('name')}")
        print(f"  price={price:.2f} | listPrice={lp:.2f} | sellingPrice={sp:.2f}")
        print(f"  priceTags: {json.dumps(it.get('priceTags', []), indent=2)}")

    # Ver ratesAndBenefitsData
    rab = of2.get("ratesAndBenefitsData", {})
    print(f"\nratesAndBenefitsData: {json.dumps(rab, indent=2, ensure_ascii=False)}")

    # Ver totalizers
    tots = of2.get("totalizers", [])
    for t in tots:
        print(f"  totalizer[{t.get('id')}] = ${t.get('value',0)/100:.2f}")

    # Respuesta cruda parcial
    print("\nRespuesta cruda (primeros 2000 chars):")
    print(r_add.text[:2000])

print("\n=== Intentar API de precio del producto directamente ===")
# VTEX tiene un endpoint de precio por sku
r_price = session.get(f"{BASE}/api/catalog_system/pub/products/price/{SKU}", headers=H, timeout=15)
print(f"Status: {r_price.status_code} | {r_price.text[:300]}")
