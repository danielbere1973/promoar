import requests

URL = "https://www.jumbo.com.ar/api/catalog_system/pub/products/search?ft=pepsi%201.5"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

resp = requests.get(URL, headers=HEADERS)
data = resp.json()
if data:
    for p in data:
        item = p['items'][0]
        offer = item['sellers'][0]['commertialOffer']
        print(f"Product: {p['productName']}")
        print(f"  Price: {offer['Price']}")
        print(f"  unitMultiplier: {item.get('unitMultiplier')}")
        print(f"  Available: {offer['AvailableQuantity']}")
