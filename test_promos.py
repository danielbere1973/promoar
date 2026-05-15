import sys, io
from cencosud_scraper import get_session, search_is_by_text, extract_product

session = get_session('https://www.jumbo.com.ar')
raw, source = search_is_by_text('https://www.jumbo.com.ar', session, 'cerveza rubia 330ml corona')
prods = [p for p in [extract_product(r, 'https://www.jumbo.com.ar', source) for r in raw[:5]] if p]
for p in prods:
    precio = p['Precio']
    final = p['Final']
    pct = round((1 - final/precio)*100) if precio > final > 0 else 0
    flag = f"  ({pct}% OFF)" if pct >= 1 else ""
    print(f"{p['Producto'][:45]:<45} | Precio={precio:,.2f} | Final={final:,.2f}{flag}")
    print(f"  Oferta: {p['Oferta'][:80]}")
