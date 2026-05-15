import requests, json, sys, io

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json'
}

print("=== TEST API CLASICA JUMBO ===")
resp = requests.get(
    'https://www.jumbo.com.ar/api/catalog_system/pub/products/search?ft=cerveza&_from=0&_to=4',
    headers=HEADERS, timeout=20
)
print(f"Status: {resp.status_code}")

try:
    data = resp.json()
    if isinstance(data, list):
        print(f"Productos recibidos: {len(data)}")
        for p in data[:3]:
            offer = p['items'][0]['sellers'][0]['commertialOffer']
            print(f"\nProducto: {p['productName']}")
            print(f"  Price:              {offer.get('Price')}")
            print(f"  ListPrice:          {offer.get('ListPrice')}")
            print(f"  AvailableQuantity:  {offer.get('AvailableQuantity')}")
            print(f"  IsAvailable:        {offer.get('IsAvailable')}")
    else:
        print("Respuesta NO es lista:", str(data)[:300])
except Exception as e:
    print(f"Error: {e}")
    print("Raw:", resp.text[:500])

# -------------------------------------------------------
print("\n=== TEST GRAPHQL JUMBO ===")
GRAPHQL_QUERY = """
query SearchProducts($query: String, $from: Int, $to: Int) {
  productSearch(
    query: $query
    from: $from
    to: $to
    hideUnavailableItems: false
    orderBy: "OrderByTopSaleDESC"
  ) {
    products {
      productId
      productName
      items {
        itemId
        sellers {
          commertialOffer {
            Price
            ListPrice
            AvailableQuantity
            IsAvailable
          }
        }
      }
    }
    recordsFiltered
  }
}
"""

payload = {
    "query": GRAPHQL_QUERY,
    "variables": {"query": "cerveza", "from": 0, "to": 4}
}

session = requests.Session()
session.get("https://www.jumbo.com.ar", headers=HEADERS, timeout=10)

resp2 = session.post(
    "https://www.jumbo.com.ar/_v/segment/graphql/v1",
    headers={**HEADERS, "Content-Type": "application/json", "Referer": "https://www.jumbo.com.ar/"},
    json=payload, timeout=20
)
print(f"Status: {resp2.status_code}")
try:
    data2 = resp2.json()
    ps = data2.get("data", {}).get("productSearch", {})
    products = ps.get("products", [])
    print(f"Productos recibidos: {len(products)}")
    for p in products[:3]:
        item = p.get("items", [{}])[0]
        offer = item.get("sellers", [{}])[0].get("commertialOffer", {})
        print(f"\nProducto: {p['productName']}")
        print(f"  Price:              {offer.get('Price')}")
        print(f"  ListPrice:          {offer.get('ListPrice')}")
        print(f"  AvailableQuantity:  {offer.get('AvailableQuantity')}")
        print(f"  IsAvailable:        {offer.get('IsAvailable')}")
except Exception as e:
    print(f"Error: {e}")
    print("Raw:", resp2.text[:500])
