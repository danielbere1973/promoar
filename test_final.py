import sys, io
# NO envolver stdout aquí, el scraper ya lo hace bien
from cencosud_scraper import get_session, search_is_by_text, extract_product

session = get_session('https://www.jumbo.com.ar')

# Stella Artois 710ml x 4u
print("=== STELLA ARTOIS ===")
raw, source = search_is_by_text('https://www.jumbo.com.ar', session, 'stella artois 710ml')
for r in raw:
    if "4u" in r.get("productName", "").lower():
        p = extract_product(r, 'https://www.jumbo.com.ar', source)
        if p:
            print(f"{p['Producto']:<45} | Precio={p['Precio']:,.2f} | Final={p['Final']:,.2f}")
            print(f"  Oferta: {p['Oferta']}")

# Imperial Rubia 710cc
print("\n=== IMPERIAL RUBIA ===")
raw2, source2 = search_is_by_text('https://www.jumbo.com.ar', session, 'imperial rubia 710cc')
for r in raw2:
    if "710" in r.get("productName", "").lower():
        p = extract_product(r, 'https://www.jumbo.com.ar', source2)
        if p:
            print(f"{p['Producto']:<45} | Precio={p['Precio']:,.2f} | Final={p['Final']:,.2f}")
            print(f"  Oferta: {p['Oferta']}")
