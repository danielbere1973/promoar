"""
coto_scraper.py - Scraper avanzado para Coto Digital
=====================================================
Integración completa con Constructor.io y el árbol de categorías local.
"""

import sys
import json
import requests
import csv
from urllib.parse import quote
import os
from datetime import datetime

# -------------------------------------------------------------------------
# Configuración
# -------------------------------------------------------------------------
CIO_BASE    = "https://ac.cnstrc.com"
CIO_KEY     = "key_r6xzz4IAoTWcipni"
CIO_CLIENT  = "cio-ui-autocomplete-1.29.3"
CIO_SESSION = "1"
CIO_USER_ID = "ab39cd4d-0baa-4e07-9604-086a764cf683"

COTO_BASE   = "https://www.cotodigital.com.ar"
CATEGORIES_FILE = "CotoconstructorCategories.json"

def cio_params(extra=None):
    p = {
        "c":   CIO_CLIENT,
        "key": CIO_KEY,
        "i":   CIO_USER_ID,
        "s":   CIO_SESSION,
        "section": "Products",
    }
    if extra: p.update(extra)
    return p

def fetch_cio(endpoint, params):
    try:
        url = f"{CIO_BASE}{endpoint}"
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[!] Error: {e}")
        return None

def search_products(query, num_results=100):
    """Búsqueda por texto libre usando autocomplete."""
    params = cio_params({"num_results": num_results})
    data = fetch_cio(f"/autocomplete/{quote(query)}", params)
    if not data: return []
    return data.get("sections", {}).get("Products", [])

def browse_category(cat_id, num_results=100):
    """Obtención de todos los productos de una categoría usando browse."""
    params = cio_params({"num_results_per_page": num_results})
    data = fetch_cio(f"/browse/group_id/{cat_id}", params)
    if not data: return []
    return data.get("response", {}).get("results", [])

def extract_product_info(item):
    data = item.get("data", {})
    nombre = item.get("value", data.get("sku_display_name", "Sin nombre"))
    marca  = data.get("product_brand", "-")
    
    # Precio base
    p_list = data.get("product_list_price", 0)
    
    # Promos
    discounts = data.get("discounts", [])
    promo_txt = "-"
    p_final   = p_list
    
    if discounts:
        d = discounts[0]
        # Ej: "50% 2da" o "30% Dto"
        taking = d.get('takingText', '')
        dtype  = d.get('discountText', '')
        promo_txt = f"{taking} {dtype}".strip()
        
        # Intentar sacar el precio de oferta
        try:
            dp = d.get('discountPrice', '').replace('$','').replace(',','')
            if dp: p_final = float(dp)
        except: pass

    # Categoría (breadcrumb)
    groups = data.get("groups", [])
    cat_path = " > ".join([g.get('display_name','') for g in groups[-2:]]) if groups else "-"

    url_path = data.get("url", "")
    full_url = f"{COTO_BASE}/sitios/cdigi/productos/detalle/{url_path}" if url_path else ""

    return {
        "SKU":       data.get("sku_plu", ""),
        "Producto":  nombre,
        "Marca":     marca,
        "Categoría": cat_path,
        "Precio":    p_list,
        "Final":     p_final,
        "Oferta":    promo_txt,
        "URL":       full_url
    }

def export_to_csv(productos, query):
    filename = f"coto_{query.replace(' ','_')}_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
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
    if not productos: return
    print("\n" + "=" * 115)
    header = f"{'#':<3} | {'PRODUCTO':<45} | {'PRECIO':<10} | {'FINAL':<10} | {'PROMO':<20} | CATEGORÍA"
    print(header)
    print("-" * 115)
    for i, p in enumerate(productos):
        name  = p['Producto'][:43]
        price = f"${p['Precio']:,.0f}"
        final = f"${p['Final']:,.0f}"
        promo = p['Oferta'][:19]
        cat   = p['Categoría'][:20]
        print(f"{i+1:<3} | {name:<45} | {price:<10} | {final:<10} | {promo:<20} | {cat}")
    print("=" * 115)

def menu_categorias(cats, path=""):
    while True:
        print(f"\n--- {path if path else 'COTO DIGITAL - EXPLORAR'} ---")
        for i, c in enumerate(cats):
            name = c.get("topLevelCategory", {}).get("displayName") if "topLevelCategory" in c else c.get("displayName")
            print(f"  [{i+1}] {name}")
        print("  [v] Volver")
        
        opc = input("\nOpción: ").strip().lower()
        if opc == 'v': return None
        
        try:
            idx = int(opc) - 1
            sel = cats[idx]
            node = sel.get("topLevelCategory", sel)
            subs = node.get("subCategories", []) or node.get("subCategories2", [])
            
            if subs:
                res = menu_categorias(subs, path + " > " + node['displayName'] if path else node['displayName'])
                if res: return res
            else:
                return node
        except:
            return {"displayName": opc, "search": True}

def load_categories():
    if not os.path.exists(CATEGORIES_FILE): return []
    try:
        with open(CATEGORIES_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get("output", [])
    except: return []

def main():
    cats_tree = load_categories()
    
    while True:
        print("\n" + "╔" + "═"*40 + "╗")
        print("║" + " COTO DIGITAL - MASTER SCRAPER ".center(40) + "║")
        print("╚" + "═"*40 + "╝")
        print("[1] Navegar Categorías (desde el JSON)")
        print("[2] Búsqueda por Texto (ej: 'cerveza artesanal')")
        print("[q] Salir")
        
        op = input("\nSelección: ").strip().lower()
        if op == 'q': break
        
        target_name = ""
        if op == '1':
            target = menu_categorias(cats_tree)
            if not target: continue
            
            # Extraer info de forma segura
            target_name = target.get('displayName', 'Búsqueda')
            
            if target.get('search'):
                print(f"\n>> Buscando '{target_name}'...")
                raw = search_products(target_name)
            else:
                cat_id = target.get('categoryId')
                if not cat_id: continue
                print(f"\n>> Cargando categoría '{target_name}' (ID: {cat_id})...")
                raw = browse_category(cat_id)
        elif op == '2':
            target_name = input("¿Qué buscamos?: ").strip()
            if not target_name: continue
            print(f"\n>> Buscando '{target_name}'...")
            raw = search_products(target_name)
        else: continue

        prods = [extract_product_info(item) for item in raw]


        mostrar_tabla(prods)
        
        if prods:
            action = input("\n[e] Exportar CSV | [Enter] Continuar: ").strip().lower()
            if action == 'e':
                export_to_csv(prods, target_name)

if __name__ == "__main__":
    main()
