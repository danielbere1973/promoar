import requests

BASE_URL = "https://www.carrefour.com.ar"
SEARCH_API = f"{BASE_URL}/api/catalog_system/pub/products/search"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

# Try path-based fq
params = {
    "fq": "C:359/384/",
    "_from": 0,
    "_to": 19
}

resp = requests.get(SEARCH_API, headers=HEADERS, params=params, timeout=15)
print(f"Path C:359/384/ -> Status: {resp.status_code}, count: {resp.headers.get('resources')}")

# Try just the ID but maybe it's not 384?
# Let's check the tree again.
