import requests

URL = "https://www.jumbo.com.ar/api/catalog_system/pub/products/search?ft=cerveza&sc=1"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

resp = requests.get(URL, headers=HEADERS)
print(f"Status: {resp.status_code}")
print(f"Content-Type: {resp.headers.get('Content-Type')}")
print(f"Response: {resp.text[:500]}")
