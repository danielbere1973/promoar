"""
dia_scraper.py - Scraper para Supermercados DIA Argentina
Usa VTEX Intelligent Search (/_v/api/intelligent-search/product_search/)
Las promos vienen en commertialOffer.teasers y discountHighlights (no hay endpoint search-promotions).
"""
import sys, re, requests, csv, io
from datetime import datetime

if sys.platform == "win32" and not isinstance(sys.stdout, io.TextIOWrapper):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    except:
        pass

BASE_URL    = "https://diaonline.supermercadosdia.com.ar"
IS_PAGE_SIZE = 20

HEADERS_BASE = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "es-AR,es;q=0.9",
}

_re = re

# ─── Sesión ───────────────────────────────────────────────────────────────────

def get_session():
    session = requests.Session()
    try:
        session.get(BASE_URL, headers=HEADERS_BASE, timeout=15)
    except:
        pass
    return session

# ─── Árbol de categorías ──────────────────────────────────────────────────────

def fetch_category_tree(session):
    try:
        print("[*] Obteniendo árbol de categorías...")
        resp = session.get(
            f"{BASE_URL}/api/catalog_system/pub/category/tree/5",
            headers=HEADERS_BASE, timeout=15
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[!] Error al obtener categorías: {e}")
        return []

# ─── VTEX IS ──────────────────────────────────────────────────────────────────

def _is_request(session, params):
    url = f"{BASE_URL}/_v/api/intelligent-search/product_search/"
    try:
        resp = session.get(url, headers=HEADERS_BASE, params=params, timeout=20)
        if resp.status_code != 200:
            return [], -1
        data = resp.json()
        return data.get("products", []), data.get("recordsFiltered", data.get("total", 0))
    except:
        return [], -1

def _in_cat_slug(product, slug):
    """Verifica que el producto tenga el slug como segmento exacto del path."""
    slug_norm = slug.lower().replace(" ", "-")
    for cat_path in (product.get("categories") or []):
        for seg in cat_path.strip("/").split("/"):
            if seg.lower().replace(" ", "-") == slug_norm:
                return True
    return False

# ─── Extracción de producto ───────────────────────────────────────────────────

def _parse_teaser(t, price_list):
    """Parsea un teaser de DIA y retorna (qty, precio_unitario, label).

    Soporta dos formatos:
    1. name = "Llevando N a $X c/u"  → precio unitario directo
    2. name = "2do al 70%" + effects.parameters[PercentualDiscount=70]  → calcular
    """
    name = (t.get("name") or "") if isinstance(t, dict) else str(t)
    name = name.strip()

    # Formato 1: precio ya calculado en el nombre
    m = _re.search(r'[Ll]levando\s+(\d+)\s+a\s+\$\s*([\d.,]+)', name)
    if m:
        qty = int(m.group(1))
        pu  = float(m.group(2).replace('.', '').replace(',', '.'))
        return qty, pu, name

    # Formato 2: efectos con PercentualDiscount + minimumQuantity
    if isinstance(t, dict) and price_list > 0:
        cond        = t.get("conditions") or {}
        min_qty     = cond.get("minimumQuantity", 0)
        effects_p   = (t.get("effects") or {}).get("parameters") or []
        for ep in effects_p:
            if ep.get("name") == "PercentualDiscount":
                disc_pct = float(ep.get("value", 0))
                if disc_pct > 0 and min_qty >= 2:
                    # N-1 unidades al precio lleno + 1 unidad con desc
                    total = (min_qty - 1) * price_list + price_list * (1 - disc_pct / 100)
                    pu    = round(total / min_qty, 2)
                    label = f"{name} (Llevando {min_qty}, c/u ${pu:,.2f})"
                    return min_qty, pu, label

    return 0, 0, name

def extract_product(p):
    try:
        name  = p.get("productName", "Sin nombre")
        brand = p.get("brand", "-")
        item  = p.get("items", [{}])[0]
        offer = item.get("sellers", [{}])[0].get("commertialOffer", {})

        price      = offer.get("Price", 0)
        without_d  = offer.get("PriceWithoutDiscount", 0)  # precio original
        spot       = offer.get("spotPrice", 0)
        qty_stock  = offer.get("AvailableQuantity", 0)
        is_avail   = offer.get("IsAvailable", None)

        if price <= 0:
            return None

        precio_lista = without_d if without_d > price else price
        precio_final = price
        promos = []

        # ── 1. Teasers ──
        # Formato A: "Llevando N a $X c/u" → precio directo
        # Formato B: name="2do al 70%" + effects.parameters[PercentualDiscount=70] → calcular
        best_pu = 0
        for t in (offer.get("teasers") or []):
            qty_req, pu, label = _parse_teaser(t, price)
            if label:
                promos.append(label)
            if pu > 0 and (best_pu == 0 or pu < best_pu):
                best_pu = pu

        # ── 2. discountHighlights: "15%", "25%", etc. ──
        # Cuando PriceWithoutDiscount > Price el descuento ya está en Price,
        # así que solo sirven como etiqueta (no volver a aplicar).
        disc_pcts = []
        for dh in (offer.get("discountHighlights") or []):
            dh_name = (dh.get("name") or "") if isinstance(dh, dict) else str(dh)
            dh_name = dh_name.strip()
            if not dh_name:
                continue
            m = _re.search(r'(\d+)\s*%', dh_name)
            if m:
                disc_pcts.append(int(m.group(1)))
            else:
                promos.append(dh_name)

        # ── 3. clusterHighlights: filtrar los ajenos al producto ──
        product_cats = " ".join(p.get("categories") or []).lower()
        for ch in (p.get("clusterHighlights") or []):
            ch_name = (ch.get("name") or "") if isinstance(ch, dict) else str(ch)
            ch_name = ch_name.strip()
            if not ch_name or ch_name == "Exclusivo Online":
                continue
            m = _re.search(r'hasta\s+\d+%?\s+en\s+(.+)', ch_name, _re.I)
            if m:
                words = [w for w in _re.split(r'\s+y\s+|\s+', m.group(1).lower()) if len(w) > 3]
                if not any(w in product_cats for w in words):
                    continue
            if _re.search(r'\d|%|off|x[1-9]|[1-9]x|descuento', ch_name, _re.I):
                promos.append(ch_name)

        # ── Precio final ──
        if best_pu > 0 and best_pu < price:
            precio_final = best_pu
        elif without_d > price:
            # Price ya viene descontado — discountHighlights son solo etiqueta
            precio_final = price
            if disc_pcts:
                max_pct = max(disc_pcts)
                if not any(str(max_pct) in pr for pr in promos):
                    promos.insert(0, f"{max_pct}% OFF")
        elif spot > 0 and spot < price:
            precio_final = spot
        elif disc_pcts:
            max_pct = max(disc_pcts)
            precio_final = round(price * (1 - max_pct / 100), 2)
            promos.insert(0, f"{max_pct}% OFF")

        # Agregar % calculado si hay diferencia y no está expresado
        if not any("Llevando" in pr for pr in promos) and precio_lista > precio_final > 0:
            pct = round((1 - precio_final / precio_lista) * 100)
            if pct >= 1 and not any(str(pct) in pr for pr in promos):
                promos.insert(0, f"{pct}% OFF")

        estado = "ACTIVO" if (qty_stock > 0 or is_avail is True) else "SIN STOCK"

        slug = p.get("linkText", "")
        url  = f"{BASE_URL}/{slug}/p" if slug else BASE_URL

        return {
            "SKU":      item.get("itemId", ""),
            "Producto": name,
            "Marca":    brand,
            "Precio":   precio_lista,
            "Final":    precio_final,
            "Stock":    qty_stock,
            "Estado":   estado,
            "Oferta":   " | ".join(promos) if promos else "-",
            "URL":      url,
        }
    except Exception:
        return None

# ─── Búsqueda por categoría ───────────────────────────────────────────────────

def search_by_category(session, cat_info):
    slug  = cat_info["slug"]
    level = cat_info.get("level", "category-1")
    print(f"[*] Buscando categoría '{slug}' via IS ({level})...")
    all_products = []
    for page in range(1, 500):
        params = {
            "query": slug,
            "map":   level,
            "page":  page,
            "count": IS_PAGE_SIZE,
            "sort":  "orders:desc",
            "hideUnavailableItems": "true",
        }
        prods, total = _is_request(session, params)
        if not prods:
            break
        raw_count = len(prods)
        prods = [p for p in prods if _in_cat_slug(p, slug)]
        if len(prods) < raw_count:
            print(f"    [i] Filtrados {raw_count - len(prods)} productos fuera de '{slug}'")
        all_products.extend(prods)
        print(f"    - Página {page}: {len(prods)} productos | acumulado: {len(all_products)}/{total or '?'}")
        if raw_count < IS_PAGE_SIZE:
            break
    return all_products

# ─── Búsqueda por texto ───────────────────────────────────────────────────────

def search_by_text(session, query):
    print(f"[*] Buscando '{query}'...")
    all_products = []
    dominant_cat = None

    for page in range(1, 500):
        params = {
            "query": query,
            "page":  page,
            "count": IS_PAGE_SIZE,
            "sort":  "orders:desc",
            "hideUnavailableItems": "false",
        }
        prods, total = _is_request(session, params)
        if not prods:
            break

        if page == 1:
            cats: dict[str, int] = {}
            for p in prods[:20]:
                for cat in (p.get("categories") or [""]):
                    parts = [s for s in cat.strip("/").split("/") if s]
                    if parts:
                        key = "/".join(parts[:2]) if len(parts) >= 2 else parts[0]
                        cats[key] = cats.get(key, 0) + 1
            if cats:
                query_words = [w.lower() for w in re.split(r'\s+', query) if len(w) > 3]
                dominant_cat = next(
                    (c for c in sorted(cats, key=cats.get, reverse=True)
                     if any(w in c.lower() for w in query_words)),
                    max(cats, key=cats.get)
                )
                print(f"    [i] Categoría dominante: '{dominant_cat}'")

        if dominant_cat:
            dom_count = sum(
                1 for p in prods
                if any(dominant_cat in (c or "") for c in (p.get("categories") or []))
            )
            if dom_count < len(prods) * 0.4:
                print(f"    [i] Categoría '{dominant_cat}' bajó a {dom_count}/{len(prods)} — deteniendo.")
                break
            prods = [p for p in prods if any(dominant_cat in (c or "") for c in (p.get("categories") or []))]
            if not prods:
                break

        all_products.extend(prods)
        print(f"    - Página {page}: {len(prods)} productos | acumulado: {len(all_products)}")
        if len(prods) < IS_PAGE_SIZE:
            break

    return all_products

# ─── Presentación ─────────────────────────────────────────────────────────────

def mostrar_tabla(productos, solo_activos=False):
    if not productos:
        print("\n[!] No se encontraron productos.")
        return
    productos = sorted(productos, key=lambda p: 0 if p["Estado"] == "ACTIVO" else 1)
    if solo_activos:
        productos = [p for p in productos if p["Estado"] == "ACTIVO"]
    activos = sum(1 for p in productos if p["Estado"] == "ACTIVO")
    print(f"\n[i] Total: {len(productos)} | Activos: {activos} | Sin stock: {len(productos)-activos}")
    print("\n" + "=" * 130)
    print(f"{'#':<3} | {'PRODUCTO':<40} | {'PRECIO':<12} | {'FINAL':<12} | {'STOCK':<7} | {'ESTADO':<10} | {'PROMO':<30}")
    print("-" * 130)
    for i, p in enumerate(productos):
        print(f"{i+1:<3} | {p['Producto'][:38]:<40} | ${p['Precio']:>10,.2f} | ${p['Final']:>10,.2f} | {p['Stock']:<7} | {p['Estado']:<10} | {p['Oferta'][:29]}")
    print("=" * 130)

# ─── Menú de categorías ───────────────────────────────────────────────────────

def _cat_slug(url):
    return url.rstrip("/").split("/")[-1] if url else ""

def _cat_level(depth):
    return f"category-{depth}"

def menu_categorias(tree, p_names="", depth=1, cur=None):
    while True:
        print()
        print("  📍 " + (" › ".join(p_names.split(" > ")) if p_names else "Inicio"))
        print("  " + "─" * 40)
        if cur:
            print(f"  [0] ✔  SELECCIONAR '{cur['name']}'")
        for i, cat in enumerate(tree):
            arrow = "▶" if cat.get("children") else "  "
            print(f"  [{i+1}] {arrow} {cat['name']}")
        print("  [v]    Volver")
        opc = input("\n  Opción: ").strip().lower()
        if opc == "v":
            return None
        try:
            if opc == "0" and cur:
                slug = _cat_slug(cur.get("url", ""))
                return {"name": cur["name"], "slug": slug, "level": _cat_level(depth - 1)}
            idx = int(opc) - 1
            sel = tree[idx]
            new_n = (p_names + " > " if p_names else "") + sel["name"]
            if sel.get("children"):
                res = menu_categorias(sel["children"], new_n, depth + 1, sel)
                if res:
                    return res
            else:
                slug = _cat_slug(sel.get("url", ""))
                return {"name": sel["name"], "slug": slug, "level": _cat_level(depth)}
        except (ValueError, IndexError):
            print("[!] Opción no válida.")

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 44)
    print(" SUPERMERCADOS DIA SCRAPER (AR) ".center(44))
    print("=" * 44)
    print("[*] Iniciando sesión...")
    session = get_session()
    tree    = fetch_category_tree(session)

    while True:
        print("\n>>> SUPERMERCADOS DIA <<<")
        print("[1] Navegar Categorías\n[2] Buscar Texto\n[q] Salir")
        op = input("\nSelección: ").strip().lower()
        if op == "q":
            break

        raw, target_name = [], ""

        if op == "1":
            target = menu_categorias(tree)
            if not target:
                continue
            target_name = target["name"]
            raw = search_by_category(session, target)
        elif op == "2":
            q = input("¿Qué buscamos?: ").strip()
            if not q:
                continue
            target_name = q
            raw = search_by_text(session, q)
        else:
            continue

        prods = [p for p in [extract_product(r) for r in raw] if p]
        activos_count = sum(1 for p in prods if p["Estado"] == "ACTIVO")

        if activos_count < len(prods):
            filtro = input(f"\n[a] Ver solo activos ({activos_count}) | [Enter] Ver todos ({len(prods)}): ").strip().lower()
            mostrar_tabla(prods, solo_activos=(filtro == "a"))
        else:
            mostrar_tabla(prods)

        if prods:
            exp = input("\n[e] Exportar CSV todos | [a] Exportar solo activos | [Enter] Continuar: ").strip().lower()
            if exp in ("e", "a"):
                exportar = [p for p in prods if p["Estado"] == "ACTIVO"] if exp == "a" else prods
                exportar = sorted(exportar, key=lambda p: 0 if p["Estado"] == "ACTIVO" else 1)
                suffix = "_activos" if exp == "a" else ""
                fn = f"DIA_{target_name.replace(' ','_')}{suffix}_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
                with open(fn, "w", newline="", encoding="utf-8-sig") as f:
                    dw = csv.DictWriter(f, fieldnames=exportar[0].keys())
                    dw.writeheader()
                    dw.writerows(exportar)
                print(f"\n[+] Exportado: {fn} ({len(exportar)} productos)")

if __name__ == "__main__":
    main()
