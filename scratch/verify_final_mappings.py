import json
import re

# Load JSONs
with open('CotoconstructorCategories.json', 'r', encoding='utf-8') as f:
    coto = json.load(f)
with open('carrefour_categories.json', 'r', encoding='utf-8') as f:
    carrefour = json.load(f)
with open('jumbo_categories.json', 'r', encoding='utf-8') as f:
    jumbo = json.load(f)
with open('dia_categories.json', 'r', encoding='utf-8') as f:
    dia = json.load(f)

def check_coto(target_id):
    def search(cat):
        if cat.get('categoryId') == target_id: return True
        for k in ['subCategories', 'subCategories2']:
            if k in cat:
                for sub in cat[k]:
                    if search(sub): return True
        return False
    for item in coto['output']:
        if 'topLevelCategory' in item:
            if search(item['topLevelCategory']): return True
    return False

def check_vtex(tree, target_path_or_slug):
    if '/' in str(target_path_or_slug) or str(target_path_or_slug).isdigit():
        # Path numeric check
        ids = [int(x) for x in str(target_path_or_slug).split('/')]
        curr = tree
        for tid in ids:
            found = next((n for n in curr if n['id'] == tid), None)
            if not found: return False
            curr = found.get('children', [])
        return True
    else:
        # Slug check
        def search(nodes):
            for n in nodes:
                if n.get('url', '').split('/')[-1] == target_path_or_slug: return True
                if search(n.get('children', [])): return True
            return False
        return search(tree)

# The categories I just added
mappings = [
    {"name": "Bebidas", "coto": "catv00001256", "carr": "255", "cenco": "bebidas", "dia": "bebidas"},
    {"name": "Gaseosas", "coto": "catv00001540", "carr": "255/277", "cenco": "gaseosas", "dia": "gaseosas"},
    {"name": "Aguas", "coto": "catv00004086", "carr": "255/283", "cenco": "aguas", "dia": "aguas"},
    {"name": "Jugos", "coto": "catv00001542", "carr": "255/286", "cenco": "jugos", "dia": "jugos-e-isotonicas"},
    {"name": "Cervezas", "coto": "catv00001527", "carr": "255/256", "cenco": "cervezas", "dia": "cervezas"},
    {"name": "Vinos", "coto": "catv00001532", "carr": "255/257", "cenco": "vinos", "dia": "bodega"},
    {"name": "Almacén", "coto": "catv00001254", "carr": "161", "cenco": "almacen", "dia": "almacen"},
    {"name": "Infusiones", "coto": "catv00001275", "carr": "222/238", "cenco": "infusiones", "dia": "desayuno"},
    {"name": "Lácteos", "coto": "catv00001255", "carr": "292", "cenco": "lacteos", "dia": "frescos"},
    {"name": "Limpieza", "coto": "catv00001258", "carr": "359", "cenco": "limpieza", "dia": "limpieza"},
    {"name": "Mascotas", "coto": "catv00006878", "carr": "471", "cenco": "mascotas", "dia": "mascotas"}
]

print(f"{'Category':<15} | Coto | Carr | Cenco | Dia")
print("-" * 50)
for m in mappings:
    c = "OK" if check_coto(m['coto']) else "FAIL"
    cr = "OK" if check_vtex(carrefour, m['carr']) else "FAIL"
    cn = "OK" if check_vtex(jumbo, m['cenco']) else "FAIL"
    di = "OK" if check_vtex(dia, m['dia']) else "FAIL"
    print(f"{m['name']:<15} | {c:<4} | {cr:<4} | {cn:<5} | {di:<3}")
