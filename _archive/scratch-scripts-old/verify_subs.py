import json

def get_sub_info(filename, parent_id_str, target_name):
    with open(filename, "r", encoding="utf-8") as f:
        tree = json.load(f)
    
    parent_ids = [int(x) for x in parent_id_str.split("/")]
    current = tree
    path_str = ""
    
    # Navigate to parent
    for pid in parent_ids:
        found = False
        for node in current:
            if node["id"] == pid:
                current = node.get("children", [])
                path_str = f"{path_str}/{pid}" if path_str else str(pid)
                found = True
                break
        if not found:
            return f"Parent {pid} not found in {path_str}"
            
    # Search in children
    for node in current:
        if target_name.lower() in node["name"].lower():
            return {"name": node["name"], "id_path": f"{path_str}/{node['id']}", "slug": node.get("url", "").split("/")[-1]}
    return "Not found in children"

print("--- CARREFOUR ---")
print(f"Gaseosas in Bebidas(255): {get_sub_info('carrefour_categories.json', '255', 'Gaseosas')}")
print(f"Aguas in Bebidas(255): {get_sub_info('carrefour_categories.json', '255', 'Aguas')}")
print(f"Jugos in Bebidas(255): {get_sub_info('carrefour_categories.json', '255', 'Jugos')}")
print(f"Con Alcohol in Bebidas(255): {get_sub_info('carrefour_categories.json', '255', 'Alcohol')}")
print(f"Vinos in Con Alcohol(255/256): {get_sub_info('carrefour_categories.json', '255/256', 'Vinos')}")
print(f"Cervezas in Con Alcohol(255/256): {get_sub_info('carrefour_categories.json', '255/256', 'Cervezas')}")
print(f"Infusiones in Desayuno(222): {get_sub_info('carrefour_categories.json', '222', 'Infusiones')}")
print(f"Leches in Lácteos(292): {get_sub_info('carrefour_categories.json', '292', 'Leches')}")
print(f"Quesos in Lácteos(292): {get_sub_info('carrefour_categories.json', '292', 'Quesos')}")
print(f"Lavado in Limpieza(359): {get_sub_info('carrefour_categories.json', '359', 'Lavado')}")

print("\n--- DIA ---")
print(f"Bebidas Sin Alcohol in Bebidas(164): {get_sub_info('dia_categories.json', '164', 'Sin Alcohol')}")
print(f"Bebidas Con Alcohol in Bebidas(164): {get_sub_info('dia_categories.json', '164', 'Con Alcohol')}")
print(f"Bodega in Bebidas(164): {get_sub_info('dia_categories.json', '164', 'Bodega')}")
print(f"Lácteos in Frescos(121): {get_sub_info('dia_categories.json', '121', 'Lácteos')}")
