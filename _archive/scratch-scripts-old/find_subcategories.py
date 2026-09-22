import json

files = {
    "carrefour": "carrefour_categories.json",
    "jumbo": "jumbo_categories.json",
    "dia": "dia_categories.json"
}

targets = [
    "Gaseosas", "Aguas", "Jugos", "Cerveza", "Vinos", "Infusiones", "Aceites", "Leches", "Quesos", "Lavado", "Limpieza de ropa"
]

def find_in_tree(nodes, target_name, path=""):
    results = []
    for node in nodes:
        name = node.get("name", "")
        current_path = f"{path}/{node['id']}" if path else str(node['id'])
        if target_name.lower() in name.lower():
            results.append({"name": name, "id_path": current_path, "slug": node.get("url", "").split("/")[-1]})
        if "children" in node:
            results.extend(find_in_tree(node["children"], target_name, current_path))
    return results

for store, filename in files.items():
    print(f"\n--- {store.upper()} ---")
    with open(filename, "r", encoding="utf-8") as f:
        tree = json.load(f)
    for target in targets:
        matches = find_in_tree(tree, target)
        if matches:
            print(f"{target}: {matches[0]['name']} (ID: {matches[0]['id_path']}, Slug: {matches[0]['slug']})")
        else:
            print(f"{target}: NOT FOUND")
