"""
carrefour_scraper.py - Scraper para Carrefour Argentina (VTEX API)
==================================================================
"""

import sys
import json
import requests
import csv
from datetime import datetime
import os
import io

# Forzar UTF-8 en la consola para evitar errores en Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# -------------------------------------------------------------------------
# Configuración
# -------------------------------------------------------------------------
BASE_URL = "https://www.carrefour.com.ar"
SEARCH_API = f"{BASE_URL}/api/catalog_system/pub/products/search"
TREE_API = f"{BASE_URL}/api/catalog_system/pub/category/tree/5"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

def fetch_category_tree():
    """Obtiene el árbol de categorías de Carrefour."""
    try:
        print("[*] Obteniendo árbol de categorías...")
        resp = requests.get(TREE_API, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[!] Error al obtener categorías: {e}")
        return []

def get_products_by_category(cat_path, limit=50):
    """
    Obtiene productos usando la ruta completa de categorías (ej: 161/162/).
    """
    all_products = []
    start = 0
    end = limit - 1
    
    # Asegurar que la ruta termine en /
    if not str(cat_path).endswith("/"):
        cat_path = str(cat_path) + "/"
        
    print(f"[*] Buscando productos para ruta: {cat_path}...")
    
    while True:
        params = {
            "fq": f"C:{cat_path}",
            "_from": start,
            "_to": end
        }
        
        try:
            resp = requests.get(SEARCH_API, headers=HEADERS, params=params, timeout=15)
            if resp.status_code not in [200, 206]:
                break
                
            data = resp.json()
            if not isinstance(data, list) or not data:
                break
            
            all_products.extend(data)
            
            resources = resp.headers.get("resources", "")
            if "/" in resources:
                total = int(resources.split("/")[-1])
            else:
                total = len(all_products)
                
            print(f"    - Descargados: {len(all_products)} / {total}")
            
            if len(all_products) >= total:
                break
                
            start += limit
            end += limit
            
            if start > 5000: break
                
        except Exception as e:
            print(f"[!] Error en la descarga: {e}")
            break
            
    return all_products

def search_products_by_text(query, limit=50):
    """Búsqueda por texto libre."""
    all_products = []
    start = 0
    end = limit - 1
    
    print(f"[*] Buscando '{query}'...")
    
    params = {
        "ft": query,
        "_from": start,
        "_to": end
    }
    
    try:
        resp = requests.get(SEARCH_API, headers=HEADERS, params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[!] Error en la búsqueda: {e}")
        return []

def extract_info(p):
    """Extrae la información relevante de un objeto de producto VTEX."""
    try:
        name = p.get("productName", "Sin nombre")
        brand = p.get("brand", "-")
        item = p.get("items", [{}])[0]
        seller = item.get("sellers", [{}])[0]
        offer = seller.get("commertialOffer", {})
        
        list_price = offer.get("ListPrice", 0)
        price = offer.get("Price", 0)
        
        # Promociones
        highlights = [h for h in offer.get("DiscountHighLight", []) if h]
        teasers = [t.get("Name", "") for t in offer.get("Teasers", []) if t.get("Name")]
        
        # Calcular descuento porcentual si el precio es menor al de lista y no hay highlights
        if list_price > price:
            pct = round((1 - (price / list_price)) * 100)
            if pct > 0:
                discount_tag = f"{pct}% OFF"
                if discount_tag not in highlights:
                    highlights.insert(0, discount_tag)

        promo_list = highlights + teasers
        promo_txt = " | ".join(promo_list) if promo_list else "-"

        link = BASE_URL + p.get("link", "")
        
        return {
            "SKU": item.get("itemId", ""),
            "Producto": name,
            "Marca": brand,
            "Precio": list_price,
            "Final": price,
            "Oferta": promo_txt,
            "URL": link
        }
    except Exception:
        return None

def export_to_csv(productos, filename_base):
    if not productos: return
    
    filename = f"carrefour_{filename_base.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    keys = productos[0].keys()
    
    try:
        with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
            dict_writer = csv.DictWriter(f, fieldnames=keys)
            dict_writer.writeheader()
            dict_writer.writerows(productos)
        print(f"\n[+] Exportado con éxito a: {filename}")
    except Exception as e:
        print(f"[!] Error al exportar: {e}")

def mostrar_tabla(productos):
    if not productos:
        print("\n[!] No se encontraron productos.")
        return
        
    print("\n" + "=" * 115)
    header = f"{'#':<3} | {'PRODUCTO':<45} | {'PRECIO':<10} | {'FINAL':<10} | {'PROMO':<20}"
    print(header)
    print("-" * 115)
    for i, p in enumerate(productos[:50]): # Mostrar solo los primeros 50 en pantalla
        name = p['Producto'][:43]
        price = f"${p['Precio']:,.2f}"
        final = f"${p['Final']:,.2f}"
        promo = p['Oferta'][:19]
        print(f"{i+1:<3} | {name:<45} | {price:<10} | {final:<10} | {promo:<20}")
    
    if len(productos) > 50:
        print(f"... y {len(productos) - 50} más.")
    print("=" * 115)

def menu_categorias(tree, path_names="", path_ids="", current_cat=None):
    while True:
        print(f"\n--- {path_names if path_names else 'CARREFOUR - EXPLORAR'} ---")
        if current_cat:
            print(f"  [0] SELECCIONAR ESTA CATEGORÍA ({current_cat['name']})")
        
        for i, cat in enumerate(tree):
            print(f"  [{i+1}] {cat['name']}")
        print("  [v] Volver")
        
        opc = input("\nOpción: ").strip().lower()
        if opc == 'v': return None
        
        try:
            if opc == '0' and current_cat:
                return {"name": current_cat['name'], "id_path": path_ids}
                
            idx = int(opc) - 1
            sel = tree[idx]
            subs = sel.get("children", [])
            
            new_path_names = (path_names + " > " if path_names else "") + sel['name']
            new_path_ids = (path_ids + "/" if path_ids else "") + str(sel['id'])
            
            if subs:
                res = menu_categorias(subs, new_path_names, new_path_ids, sel)
                if res: return res
            else:
                return {"name": sel['name'], "id_path": new_path_ids}
        except (ValueError, IndexError):
            print("[!] Opción no válida.")

def main():
    tree = fetch_category_tree()
    
    while True:
        print("\n" + "="*42)
        print(" CARREFOUR - PRODUCT SCRAPER ".center(42))
        print("="*42)
        print("[1] Navegar Categorías")
        print("[2] Búsqueda por Texto (ej: 'leche')")
        print("[q] Salir")
        
        op = input("\nSelección: ").strip().lower()
        if op == 'q': break
        
        raw = []
        target_name = ""
        
        if op == '1':
            target = menu_categorias(tree)
            if not target: continue
            target_name = target['name']
            raw = get_products_by_category(target['id_path'])
        elif op == '2':
            query = input("¿Qué buscamos?: ").strip()
            if not query: continue
            target_name = query
            raw = search_products_by_text(query)
        else:
            continue
            
        prods = [extract_info(p) for p in raw if p]
        prods = [p for p in prods if p] # Limpiar Nones
        
        mostrar_tabla(prods)
        
        if prods:
            action = input("\n[e] Exportar CSV | [Enter] Continuar: ").strip().lower()
            if action == 'e':
                export_to_csv(prods, target_name)

if __name__ == "__main__":
    main()
