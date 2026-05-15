import requests

# Test with isAvailable filter
URL = "https://www.jumbo.com.ar/api/catalog_system/pub/products/search?ft=pepsi&fq=isAvailable:1"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

resp = requests.get(URL, headers=HEADERS)
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Count with isAvailable:1: {len(data)}")
if data:
    for p in data[:5]:
        offer = p['items'][0]['sellers'][0]['commertialOffer']
        print(f"- {p['productName']}: ${offer['Price']} (Qty: {offer['AvailableQuantity']})")
