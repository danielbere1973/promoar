import requests

BASE_URL = "https://www.carrefour.com.ar"
SEARCH_API = f"{BASE_URL}/api/catalog_system/pub/products/search"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

params = {
    "fq": "C:384",
    "_from": 0,
    "_to": 19
}

resp = requests.get(SEARCH_API, headers=HEADERS, params=params, timeout=15)
print(f"Status: {resp.status_code}")
print(f"Headers resources: {resp.headers.get('resources')}")
try:
    data = resp.json()
    print(f"Products found: {len(data)}")
    if data:
        print(f"First product: {data[0].get('productName')}")
    else:
        print("Empty list returned.")
except Exception as e:
    print(f"Error parsing JSON: {e}")
