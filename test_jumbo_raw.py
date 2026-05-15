import requests

URL = "https://www.jumbo.com.ar/api/catalog_system/pub/products/search?ft=cerveza"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

resp = requests.get(URL, headers=HEADERS)
data = resp.json()
if data:
    p = data[0]
    offer = p['items'][0]['sellers'][0]['commertialOffer']
    print(f"Product: {p['productName']}")
    print(f"ListPrice: {offer['ListPrice']}")
    print(f"Price: {offer['Price']}")
