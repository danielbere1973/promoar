"""Prueba rápida: buscar 'cerveza' con el nuevo scraper y mostrar los primeros 20 activos."""
import sys, io
sys.path.insert(0, ".")

from cencosud_scraper import get_session, search_is_by_text, extract_product

BASE = "https://www.jumbo.com.ar"
session = get_session(BASE)

raw, source = search_is_by_text(BASE, session, "cerveza")
prods = [p for p in [extract_product(r, BASE, source) for r in raw] if p]

activos = [p for p in prods if p["Estado"] == "ACTIVO"]
print(f"\n✅ Total: {len(prods)} | Activos: {len(activos)} | Sin stock: {len(prods)-len(activos)}")
print(f"\nPrimeros 20 ACTIVOS:")
for i, p in enumerate(activos[:20]):
    print(f"  {i+1:2}. {p['Producto'][:55]:<55} ${p['Final']:>8,.0f}  {p['Oferta'][:20]}")

# Buscar específicamente la Corona
corona = [p for p in activos if "330ml corona" in p["Producto"].lower() or "330 ml corona" in p["Producto"].lower()]
if corona:
    print(f"\n🍺 Corona 330ml encontrada: {corona[0]['Producto']} → {corona[0]['URL']}")
else:
    print("\n⚠️ Corona 330ml NO encontrada en activos")
