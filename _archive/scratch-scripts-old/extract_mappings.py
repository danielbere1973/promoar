import json

with open('CotoconstructorCategories.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

mappings = {}

def process_category(cat, parent_name=""):
    display_name = cat.get('displayName', '')
    category_id = cat.get('categoryId', '')
    
    if display_name:
        key = f"{parent_name} > {display_name}" if parent_name else display_name
        mappings[key] = category_id
        # Also keep a simple mapping for quick lookup, but prioritizing paths
        if display_name not in mappings or len(key) > len(display_name):
             mappings[display_name] = category_id
        
    for sub_key in ['subCategories', 'subCategories2']:
        if sub_key in cat:
            for sub in cat[sub_key]:
                process_category(sub, key if display_name else "")

for item in data['output']:
    if 'topLevelCategory' in item:
        process_category(item['topLevelCategory'])

# Target categories to find
targets = [
    "Bebidas", "Bebidas > Bebidas Sin Alcohol", "Bebidas > Bebidas Sin Alcohol > Gaseosas", "Bebidas > Bebidas Sin Alcohol > Aguas", "Bebidas > Bebidas Sin Alcohol > Jugos",
    "Bebidas > Bebidas Con Alcohol", "Bebidas > Bebidas Con Alcohol > Cerveza", "Bebidas > Bebidas Con Alcohol > Vinos",
    "Almacén", "Almacén > Infusiones", "Almacén > Aceites Y Condimentos > Aceites",
    "Frescos", "Frescos > Lácteos", "Frescos > Lácteos > Leches", "Frescos > Quesos",
    "Limpieza", "Limpieza > Lavado",
    "Frescos > Carniceria", "Frescos > Frutas Y Verduras", "Almacén > Panaderia",
    "Mascotas", "Almacén > Alimento De Bebés Y Niños"
]

print("Category Mappings found:")
for target in mappings:
    if any(t in target for t in ["Beb", "Mascot", "Limpieza", "Almac", "Fresc", "Bebidas"]):
        print(f"{target}: {mappings[target]}")
