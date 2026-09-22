import requests
import json

STORES = {
    "carrefour": "https://www.carrefour.com.ar",
    "jumbo": "https://www.jumbo.com.ar",
    "dia": "https://diaonline.supermercadosdia.com.ar"
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

def fetch_vtex_tree(base_url):
    url = f"{base_url}/api/catalog_system/pub/category/tree/5"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"Error fetching {base_url}: {e}")
        return None

results = {}
for name, url in STORES.items():
    print(f"Fetching {name}...")
    tree = fetch_vtex_tree(url)
    if tree:
        with open(f"{name}_categories.json", "w", encoding="utf-8") as f:
            json.dump(tree, f, indent=2, ensure_ascii=False)
        print(f"Saved {name}_categories.json")
