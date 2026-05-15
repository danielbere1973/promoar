"""
cencosud_scraper.py - Master Scraper para Jumbo, Disco y Vea
Usa VTEX Intelligent Search (/_v/api/intelligent-search/product_search/)
que es el mismo endpoint que usa el sitio web — devuelve solo productos
con stock real y precios actualizados.
"""
import sys, re, requests, csv, io, json
from datetime import datetime

# Forzar UTF-8 en Windows solo si no está ya configurado
if sys.platform == "win32" and not isinstance(sys.stdout, io.TextIOWrapper):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    except:
        pass

# -------------------------------------------------------------------------
# Configuración
# -------------------------------------------------------------------------
STORES = {
    "1": {"name": "Jumbo", "url": "https://www.jumbo.com.ar"},
    "2": {"name": "Disco", "url": "https://www.disco.com.ar"},
    "3": {"name": "Vea",   "url": "https://www.vea.com.ar"},
}

HEADERS_BASE = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "es-AR,es;q=0.9",
}

# Seller ID de Cencosud Argentina — funciona para Jumbo, Disco y Vea
CENCOSUD_SELLER = "jumboargentinaj5202martinez"

# vtex_segment fijo: canal 32, moneda ARS, país ARG — no requiere login
VTEX_SEGMENT = "eyJjYW1wYWlnbnMiOm51bGwsImNoYW5uZWwiOiIzMiIsInByaWNlVGFibGVzIjpudWxsLCJyZWdpb25JZCI6bnVsbCwidXRtX2NhbXBhaWduIjpudWxsLCJ1dG1fc291cmNlIjpudWxsLCJ1dG1pX2NhbXBhaWduIjpudWxsLCJjdXJyZW5jeUNvZGUiOiJBUlMiLCJjdXJyZW5jeVN5bWJvbCI6IiQiLCJjb3VudHJ5Q29kZSI6IkFSRyIsImN1bHR1cmVJbmZvIjoiZXMtQVIiLCJjaGFubmVsUHJpdmFjeSI6InB1YmxpYyJ9"

IS_PAGE_SIZE = 20   # IS usa páginas de 20 (igual que la web)

# -------------------------------------------------------------------------
# Sesión y categorías
# -------------------------------------------------------------------------
def get_session(base_url):
    """Crea una sesión con cookies y vtex_segment para activar search-promotions."""
    session = requests.Session()
    session.cookies.set("vtex_segment", VTEX_SEGMENT, domain=base_url.split("//")[1])
    session.cookies.set("VtexWorkspace", "master%3A-", domain=base_url.split("//")[1])
    try:
        session.get(base_url, headers=HEADERS_BASE, timeout=15)
    except:
        pass
    return session


def fetch_promotions(base_url, session, skus: list[str]) -> dict[str, dict]:
    """Llama a /_v/search-promotions y retorna {sku: promo_data} para los que tienen promo.
    promo_data tiene keys: name, code, effectiveDiscount (float 0-1), categoryType.
    """
    if not skus:
        return {}
    try:
        r = session.post(
            f"{base_url}/_v/search-promotions",
            headers={**HEADERS_BASE, "Content-Type": "application/json",
                     "Origin": base_url, "Referer": base_url + "/"},
            json={"skus": skus, "seller": CENCOSUD_SELLER},
            timeout=15,
        )
        if not r.ok:
            return {}
        generic = r.json().get("promotions", {}).get("generic", {}).get("promotions", {})
        # Excluir promos exclusivas de segmentos específicos (Prime, CPay, VIP, etc.)
        # que no aplican al público general
        _SEGMENT_EXCL = re.compile(r'prime|cpay|vip|premium|black|select|club', re.I)
        # Las claves del response son IDs de promo (ej: "347751"), no SKUs.
        # Re-indexar por ref_id que sí es el SKU del producto.
        result = {}
        for promo in generic.values():
            if not promo:
                continue
            if _SEGMENT_EXCL.search(promo.get("name", "") + promo.get("code", "")):
                continue
            ref = promo.get("ref_id", "")
            if ref:
                result[ref] = promo
        return result
    except:
        return {}

def fetch_category_tree(base_url, session):
    try:
        print("[*] Obteniendo árbol de categorías...")
        resp = session.get(
            f"{base_url}/api/catalog_system/pub/category/tree/5",
            headers=HEADERS_BASE, timeout=15
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[!] Error al obtener categorías: {e}")
        return []

# -------------------------------------------------------------------------
# VTEX Intelligent Search — fuente principal
# -------------------------------------------------------------------------
def _is_request(base_url, session, params):
    """Llama al endpoint de IS. Retorna lista de productos o []."""
    url = f"{base_url}/_v/api/intelligent-search/product_search/"
    try:
        resp = session.get(url, headers=HEADERS_BASE, params=params, timeout=20)
        if resp.status_code != 200:
            return [], -1
        data = resp.json()
        products = data.get("products", [])
        # IS no siempre devuelve "total" correctamente — usar recordsFiltered si existe
        total = data.get("recordsFiltered", data.get("total", 0))
        return products, total
    except Exception as e:
        return [], -1

def _dominant_category(products: list, query: str = "") -> str | None:
    """Retorna la categoría más frecuente en los primeros resultados.
    Usa hasta 2 niveles del path (ej: 'Cuidado Personal/Cabello') para
    evitar que categorías homónimas (ej: Electrodomésticos vs Cuidado Personal)
    colapsen en el mismo top-level.
    Si hay varias categorías, prioriza la que contenga palabras del query.
    """
    if not products:
        return None
    cats: dict[str, int] = {}
    for p in products[:20]:
        for cat in (p.get("categories") or [""]):
            parts = [s for s in cat.strip("/").split("/") if s]
            if not parts:
                continue
            # Usar hasta 2 niveles para mayor especificidad
            key = "/".join(parts[:2]) if len(parts) >= 2 else parts[0]
            cats[key] = cats.get(key, 0) + 1

    if not cats:
        return None

    # Si hay palabras del query, preferir la categoría que las contenga
    if query:
        query_words = [w.lower() for w in re.split(r'\s+', query) if len(w) > 3]
        for cat in sorted(cats, key=cats.get, reverse=True):
            cat_lower = cat.lower()
            if any(w in cat_lower for w in query_words):
                return cat

    return max(cats, key=cats.get)


def search_is_by_text(base_url, session, query):
    """Búsqueda por texto usando IS.
    Detecta la categoría dominante en la primera página y filtra las siguientes
    para evitar mezcla de categorías no relacionadas.
    """
    print(f"[*] Buscando '{query}' via Intelligent Search...")
    all_products = []
    dominant_cat = None

    for page in range(1, 200):
        params = {
            "query": query,
            "page": page,
            "count": IS_PAGE_SIZE,
            "sort": "orders:desc",
            "hideUnavailableItems": "true",
        }
        prods, total = _is_request(base_url, session, params)
        if not prods:
            break

        if page == 1:
            dominant_cat = _dominant_category(prods, query)

        # Filtrar por categoría dominante en TODAS las páginas (incluso la 1)
        if dominant_cat:
            dom_count = sum(
                1 for p in prods
                if any(dominant_cat in (c or "") for c in (p.get("categories") or []))
            )
            # Si la dominante cae por debajo del 40%, la IS se desvió — parar
            if dom_count < len(prods) * 0.4:
                print(f"    [i] Categoría '{dominant_cat}' bajó a {dom_count}/{len(prods)} — deteniendo.")
                break
            prods = [
                p for p in prods
                if any(dominant_cat in (c or "") for c in (p.get("categories") or []))
            ]
            if not prods:
                break

        all_products.extend(prods)
        print(f"    - Página {page}: {len(prods)} productos | total acumulado: {len(all_products)}")
        if len(prods) < IS_PAGE_SIZE:
            break  # última página

    return all_products, "IS"

def _in_cat_slug(product: dict, slug: str) -> bool:
    """Verifica que el producto tenga el slug como segmento exacto en su path de categoría.
    Evita que 'acondicionadores' matchee 'aires-acondicionados' o 'ventiladores'.
    """
    slug_norm = slug.lower().replace(" ", "-")
    for cat_path in (product.get("categories") or []):
        for seg in cat_path.strip("/").split("/"):
            if seg.lower().replace(" ", "-") == slug_norm:
                return True
    return False


def search_is_by_category(base_url, session, cat_info):
    """Búsqueda por categoría usando Intelligent Search (IS).
    cat_info puede ser:
      - dict con keys 'slug' y 'level' (ej: {'slug': 'cervezas', 'level': 'category-2'})
      - str con el id_path numérico (legado, fallback a catalog_system)
    """
    # ── Modo IS (nuevo) ──
    if isinstance(cat_info, dict) and "slug" in cat_info:
        slug  = cat_info["slug"]
        level = cat_info.get("level", "category-1")
        print(f"[*] Buscando categoría '{slug}' via IS ({level})...")
        all_products = []
        for page in range(1, 200):
            params = {
                "query": slug,
                "map": level,
                "page": page,
                "count": IS_PAGE_SIZE,
                "sort": "orders:desc",
                "hideUnavailableItems": "true",
            }
            prods, total = _is_request(base_url, session, params)
            if not prods:
                break
            # Filtrar productos que realmente pertenecen a la categoría seleccionada.
            # IS hace match textual del slug y puede devolver categorías homónimas
            # (ej: "acondicionador" devuelve también "Aires Acondicionados", Shampoos, etc.).
            raw_count = len(prods)
            prods = [p for p in prods if _in_cat_slug(p, slug)]
            if len(prods) < raw_count:
                print(f"    [i] Filtrados {raw_count - len(prods)} productos fuera de '{slug}'")
            all_products.extend(prods)
            print(f"    - Página {page}: {len(prods)} productos | acumulado: {len(all_products)}/{total or '?'}")
            if raw_count < IS_PAGE_SIZE:  # cortar por el count ANTES de filtrar
                break
        return all_products, "IS"

    # ── Fallback: id_path numérico (legado) ──
    full_path = str(cat_info).strip("/") + "/"
    print(f"[*] Buscando categoría {full_path} via catalog_system (legado)...")
    all_products = []
    empty_pages = 0
    start = 0
    page_size = 50
    while True:
        params = {"fq": f"C:{full_path}", "_from": start,
                  "_to": start + page_size - 1, "O": "OrderByTopSaleDESC"}
        try:
            resp = session.get(f"{base_url}/api/catalog_system/pub/products/search",
                headers=HEADERS_BASE, params=params, timeout=20)
            if resp.status_code not in [200, 206]:
                break
            data = resp.json()
            if not isinstance(data, list) or not data:
                break
            all_products.extend(data)
            res = resp.headers.get("resources", "")
            total = int(res.split("/")[-1]) if "/" in res else None
            activos = sum(
                1 for p in data
                if p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("AvailableQuantity", 0) > 0
                or p.get("items",[{}])[0].get("sellers",[{}])[0].get("commertialOffer",{}).get("IsAvailable", False)
            )
            print(f"    - [{start}-{start+page_size-1}] total={len(all_products)}/{total or '?'} | activos={activos}/{len(data)}")
            if activos == 0:
                empty_pages += 1
                if empty_pages >= 2:
                    break
            else:
                empty_pages = 0
            if total and len(all_products) >= total: break
            if len(data) < page_size: break
            start += page_size
            if start > 2450: break
        except Exception as e:
            print(f"    [!] Error: {e}")
            break
    return all_products, "classic"

# -------------------------------------------------------------------------
# Extracción de datos
# -------------------------------------------------------------------------
def _clean_list_price(lp, pr):
    """Descarta ListPrice basura (VTEX a veces la infla x80)."""
    if pr <= 0:
        return lp
    if lp > pr * 15:
        return pr
    return lp

_re = re

def _decode_vt(raw, price_unit=0):
    """Convierte un nombre V_T: en texto legible y calcula precio_por_unidad si aplica.
    Retorna (texto, precio_unitario) o (None, 0).

    Patrones soportados:
      V_T:008,944,114_3x980_3 x $980 en Cervezas  → ('3 x $980 en Cervezas', 980)
      V_T:SEGUNDA_UNIDAD_AL_70                     → ('2da unidad 70% OFF', 0)
      V_T:3X2_GALLETITAS                           → ('3x2 Galletitas', 0)
      V_T:PRECIO_LISTA_30_OFF                      → ('30% OFF', 0)
    """
    s = raw[4:] if raw.upper().startswith("V_T:") else raw

    # ── Patrón con precio embebido: "...NxPRECIO_texto legible"
    # Ej: "008,944,114_3x980_3 x $980 en Cervezas"
    m = _re.search(r'_(\d+)x([\d,.]+)_(.+)$', s)
    if m:
        qty   = int(m.group(1))
        price = float(m.group(2).replace(',', '.'))
        label = m.group(3).strip()
        return label, price   # ya tiene texto legible y precio por unidad

    s = s.replace("_", " ").strip()

    # NxM literal (3x2, 2x1...)
    m = _re.match(r'^(\d)[xX](\d)\b', s)
    if m:
        resto = s[3:].strip().title()
        return f"{m.group(1)}x{m.group(2)}" + (f" {resto}" if resto else ""), 0

    # Segunda/tercera unidad con %
    m = _re.search(r'SEGUNDA\s+UNIDAD\s+(?:AL\s+)?(\d+)', s, _re.I)
    if m: return f"2da unidad {m.group(1)}% OFF", 0

    m = _re.search(r'TERCERA\s+UNIDAD\s+(?:AL\s+)?(\d+)', s, _re.I)
    if m: return f"3ra unidad {m.group(1)}% OFF", 0

    # % OFF / descuento
    m = _re.search(r'(\d+)\s*%\s*OFF', s, _re.I)
    if m: return f"{m.group(1)}% OFF", 0

    m = _re.search(r'(\d+)\s*%\s*(?:DE\s+)?DESCUENTO', s, _re.I)
    if m: return f"{m.group(1)}% Descuento", 0

    # Texto genérico con algún número
    if _re.search(r'\d', s) and len(s) > 3:
        return s.title(), 0

    return None, 0


def _parse_promo_cantidad(text, price):
    """Detecta promos de cantidad y devuelve (qty_necesaria, precio_por_unidad, etiqueta).
    Retorna (0, 0, None) si no aplica.

    Patrones:
      "2do al 70%"  → qty=2, pu=price*0.65,   "Llevando 2, c/u $X"
      "3ro al 50%"  → qty=3, pu=price*0.833,  "Llevando 3, c/u $X"
      "3x2"         → qty=3, pu=price*2/3,    "Llevando 3, c/u $X"
      "6x4"         → qty=6, pu=price*4/6,    "Llevando 6, c/u $X"
      "2x1"         → qty=2, pu=price/2,      "Llevando 2, c/u $X"
    """
    # Quitar "Hasta " del inicio — la promo aplica en serio
    t = _re.sub(r'^HASTA\s+', '', text.upper().strip())

    # "Ndo/Nra/Nvo unidad al X%"
    m = _re.search(r'(\d+)\s*(?:DO|DA|RA|VO|TO)\s+(?:UNIDAD\s+)?(?:AL|A)\s+(\d+)\s*%', t)
    if m:
        n    = int(m.group(1))       # qué unidad tiene el descuento
        desc = int(m.group(2)) / 100
        total = (n - 1) * price + price * (1 - desc)
        pu = round(total / n, 2)
        return n, pu, f"Llevando {n}, c/u ${pu:,.2f}"

    # "NxM" (ej: 3x2, 6x4, 2x1)
    m = _re.search(r'\b(\d+)\s*[Xx]\s*(\d+)\b', t)
    if m:
        llevas = int(m.group(1))
        pagas  = int(m.group(2))
        if llevas > pagas > 0:
            pu = round(price * pagas / llevas, 2)
            return llevas, pu, f"Llevando {llevas}, c/u ${pu:,.2f}"

    return 0, 0, None


def _precio_efectivo(text, price):
    """Compatibilidad — retorna solo el precio unitario."""
    _, pu, _ = _parse_promo_cantidad(text, price)
    if pu > 0:
        return pu
    # % OFF directo (sin cantidad)
    t = text.upper()
    if not _re.search(r'HASTA|UP\s*TO', t):
        m = _re.search(r'(\d+)\s*%\s*OFF', t)
        if m:
            return round(price * (1 - int(m.group(1)) / 100), 2)
    return 0


def _promo_tipo(text: str) -> str:
    """Clasifica el tipo de promo de cantidad.
    'ndo_al_x' (ej: 2do al 70%) tiene mayor prioridad que 'nxm' (ej: 3x2).
    """
    t = _re.sub(r'^HASTA\s+', '', text.upper().strip())
    if _re.search(r'\d\s*(?:DO|DA|RA|VO|TO)\s+(?:UNIDAD\s+)?(?:AL|A)\s+\d+\s*%', t):
        return 'ndo_al_x'
    return 'nxm'


def _extract_clusters(p, price_list=0):
    """Lee clusterHighlights en cualquier formato, decodifica V_T:.
    Retorna (lista_promos, dcto_fijo_pct, precio_unitario_promo).
    Prioridad por cantidad: 'Ndo al X%' > 'NxM'.
    """
    promos, fijo_pct = [], 0
    # qty → (precio_unitario, tipo) para resolver conflictos
    by_qty: dict[int, tuple[float, str]] = {}

    clusters = p.get("clusterHighlights", {})
    items = clusters.values() if isinstance(clusters, dict) else clusters

    for c in items:
        raw = (c.get("Name") or c.get("name") or "") if isinstance(c, dict) else str(c)
        if not raw: continue

        if raw.upper().startswith("V_T:"):
            decoded, pu = _decode_vt(raw)
            if not decoded: continue
            promos.append(decoded)
            if pu > 0:
                existing = by_qty.get(0, (0, ''))
                if existing[0] == 0 or pu < existing[0]:
                    by_qty[0] = (pu, 'vt')
            m = _re.search(r'(\d+)%', decoded)
            if m: fijo_pct = max(fijo_pct, int(m.group(1)))
        else:
            if _re.match(r'^[A-Za-z]{3,10}_\S{5,}$', raw):
                continue
            if not _re.search(r'\d|%|off|x[1-9]|[1-9]x|cuota|descuento|reintegro|unidad', raw, _re.I):
                continue
            if price_list > 0 and not _re.search(r'selecci[oó]nado', raw, _re.I):
                qty, pu, etiqueta = _parse_promo_cantidad(raw, price_list)
                if etiqueta and qty > 0:
                    tipo = _promo_tipo(raw)
                    existing = by_qty.get(qty)
                    # Actualizar si: no hay nada, o el nuevo tipo es mejor, o mismo tipo y mejor precio
                    if (existing is None
                            or (tipo == 'ndo_al_x' and existing[1] != 'ndo_al_x')
                            or (tipo == existing[1] and pu < existing[0])):
                        by_qty[qty] = (pu, tipo)
                    promos.append(etiqueta)
                    continue
            promos.append(raw)
            if not _re.search(r'hasta|up\s*to', raw, _re.I):
                m = _re.search(r'(\d+)\s*%\s*(?:off|de descuento)', raw, _re.I)
                if m: fijo_pct = max(fijo_pct, int(m.group(1)))

    # Precio unitario = el mejor entre todos los qty ganadores
    precio_unitario = 0
    for qty, (pu, _) in by_qty.items():
        if pu > 0 and (precio_unitario == 0 or pu < precio_unitario):
            precio_unitario = pu

    return promos, fijo_pct, precio_unitario


def _extract_promos_is(p, offer):
    """Retorna (lista_promos, dcto_fijo_pct, precio_unitario_promo)."""
    price_list = offer.get("Price", 0)
    promos, fijo_pct, precio_unitario = _extract_clusters(p, price_list)

    for h in offer.get("discountHighlights", []):
        n = h.get("name") if isinstance(h, dict) else h
        if n:
            promos.append(n)
            m = _re.search(r'(\d+)\s*%\s*(?:off|de descuento)', n, _re.I)
            if m: fijo_pct = max(fijo_pct, int(m.group(1)))

    for t in offer.get("teasers", []):
        n = (t.get("name") or t.get("Name")) if isinstance(t, dict) else t
        if n: promos.append(n)

    return list(dict.fromkeys(promos)), fijo_pct, precio_unitario


def _extract_promos_classic(p, offer):
    """Retorna (lista_promos, precio_unitario_promo)."""
    price_list = offer.get("Price", 0)
    promos, _, precio_unitario = _extract_clusters(p, price_list)
    promos += [h for h in offer.get("DiscountHighLight", []) if h]
    promos += [t.get("Name","") for t in offer.get("Teasers", []) if isinstance(t, dict) and t.get("Name")]
    return list(dict.fromkeys(promos)), precio_unitario

def extract_product(p, base_url, source="IS", promo_data=None):
    """Extrae datos de un producto, soportando formato IS y catalog_system.

    En VTEX IS:
      - Price      = precio de lista normal
      - clusters V_T: = promos de carrito con precio unitario real (ej: 3x$980)
      - spotPrice  = precio con descuento si aplica directamente
      - ListPrice  = precio histórico tachado (suele venir inflado x80, ignorar)

    Lógica de precio final (de menor a mayor prioridad):
      1. Si hay promo V_T: con precio por unidad < Price → usamos ese
      2. Si spotPrice < Price → usamos spotPrice
      3. Si no, usamos Price como precio final
    """
    try:
        name = p.get("productName", "Sin nombre")
        brand = p.get("brand", "-")
        item = p.get("items", [{}])[0]
        offer = item.get("sellers", [{}])[0].get("commertialOffer", {})

        price_list  = offer.get("Price", 0)      # precio de venta normal
        spot        = offer.get("spotPrice", 0)  # precio con descuento aplicado
        lp_raw      = offer.get("ListPrice", 0)  # suele ser basura
        qty         = offer.get("AvailableQuantity", 0)
        is_avail    = offer.get("IsAvailable", None)

        if price_list <= 0:
            return None

        # Promos
        dcto_pct, precio_unitario_promo = 0, 0
        if source == "IS":
            promos, dcto_pct, precio_unitario_promo = _extract_promos_is(p, offer)
        else:
            promos, precio_unitario_promo = _extract_promos_classic(p, offer)

        # Filtrar cluster highlights con categoría ajena al producto.
        # VTEX inyecta promos genéricas como "Hasta 35% en Frescos y Congelados"
        # en productos de otras secciones. Filtramos si la categoría mencionada
        # no aparece en el path real del producto.
        product_cats = " ".join(p.get("categories") or []).lower()
        def _is_relevant_promo(text: str) -> bool:
            m = _re.search(r'hasta\s+\d+%?\s+en\s+(.+)', text, _re.I)
            if not m:
                return True
            words = [w for w in _re.split(r'\s+y\s+|\s+', m.group(1).lower()) if len(w) > 3]
            return any(w in product_cats for w in words)
        promos = [pr for pr in promos if _is_relevant_promo(pr)]

        # Precio final
        precio_lista = price_list
        precio_final = price_list

        # 0. search-promotions: fuente más precisa — promo exacta con effectiveDiscount
        if promo_data:
            eff       = float(promo_data.get("effectiveDiscount", 0))
            p_code    = promo_data.get("code", "")
            p_name    = promo_data.get("name", "").split("|")[0].strip()
            if eff > 0:
                qty_req, pu_calc, etiqueta = _parse_promo_cantidad(p_code, price_list)
                if etiqueta:
                    pu_exact = round(price_list * (1 - eff), 2)
                    etiqueta_exacta = f"Llevando {qty_req}, c/u ${pu_exact:,.2f}"
                    promos = [etiqueta_exacta] + [pr for pr in promos if "Llevando" not in pr]
                    precio_final = pu_exact
                else:
                    precio_final = round(price_list * (1 - eff), 2)
                    promos.insert(0, f"{round(eff*100)}% OFF ({p_name})")
        # 1. V_T: precio embebido (3x$980)
        elif precio_unitario_promo > 0 and precio_unitario_promo < price_list and precio_unitario_promo >= price_list * 0.25:
            precio_final = precio_unitario_promo
        # 2. spotPrice
        elif spot and 0 < spot < price_list:
            precio_final = spot
        # 3. Descuento porcentual explícito sin "Hasta"
        elif dcto_pct > 0:
            precio_final = round(price_list * (1 - dcto_pct/100), 2)
        # 4. Classic: ListPrice como referencia
        elif source != "IS":
            lp_clean = _clean_list_price(lp_raw, price_list)
            if lp_clean > price_list:
                precio_lista = lp_clean

        # Estado
        if qty > 0:
            estado = "ACTIVO"
        else:
            estado = "SIN STOCK"

        # Deduplicar "Llevando N" — para cada N quedarse con el más barato
        llevando = {}
        promos_limpias = []
        for promo in promos:
            m = _re.match(r'Llevando\s+(\d+),\s+c/u\s+\$([0-9,.]+)', promo)
            if m:
                n  = int(m.group(1))
                pu = float(m.group(2).replace(',', ''))
                if n not in llevando or pu < llevando[n][0]:
                    llevando[n] = (pu, promo)
            else:
                promos_limpias.append(promo)
        # Agregar "Llevando" deduplicados al final, ordenados por cantidad
        promos_limpias += [v[1] for _, v in sorted(llevando.items())]

        # Agregar % OFF calculado solo si no hay "Llevando" que ya lo exprese
        hay_llevando = bool(llevando)
        if not hay_llevando and precio_lista > precio_final > 0:
            pct = round((1 - precio_final / precio_lista) * 100)
            if pct >= 1 and not any(str(pct) in p for p in promos_limpias):
                promos_limpias.insert(0, f"{pct}% OFF")

        promos = promos_limpias

        # URL: IS usa linkText, catalog_system usa link
        if source == "IS":
            slug = p.get("linkText", "")
            url = f"{base_url}/{slug}/p" if slug else base_url
        else:
            url = base_url + p.get("link", "")

        return {
            "SKU":      item.get("itemId", ""),
            "Producto": name,
            "Marca":    brand,
            "Precio":   precio_lista,
            "Final":    precio_final,
            "Stock":    qty,
            "Estado":   estado,
            "Oferta":   " | ".join(promos) if promos else "-",
            "URL":      url,
        }
    except Exception:
        return None

# -------------------------------------------------------------------------
# Presentación
# -------------------------------------------------------------------------
def mostrar_tabla(productos, solo_activos=False):
    if not productos:
        print("\n[!] No se encontraron productos.")
        return

    # Ordenar: ACTIVO primero
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

# -------------------------------------------------------------------------
# Menú de categorías
# -------------------------------------------------------------------------
def _cat_slug(url: str) -> str:
    """Extrae el slug del último segmento de la URL de categoría."""
    return url.rstrip("/").split("/")[-1] if url else ""

def _cat_level(depth: int) -> str:
    """Retorna 'category-1', 'category-2', etc. según profundidad (1-based)."""
    return f"category-{depth}"

def menu_categorias(tree, p_names="", depth=1, cur=None):
    while True:
        # Breadcrumb
        print()
        if p_names:
            crumbs = p_names.split(" > ")
            print("  📍 " + " › ".join(crumbs))
        else:
            print("  📍 Inicio")
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
            print(f"\n  ✓ Entrando en: {new_n}")
            if sel.get("children"):
                res = menu_categorias(sel["children"], new_n, depth + 1, sel)
                if res:
                    return res
            else:
                slug = _cat_slug(sel.get("url", ""))
                return {"name": sel["name"], "slug": slug, "level": _cat_level(depth)}
        except (ValueError, IndexError):
            print("[!] Opción no válida.")

# -------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------
def main():
    print("\n" + "="*44)
    print(" CENCOSUD MASTER SCRAPER (AR) ".center(44))
    print("="*44)
    for k, v in STORES.items():
        print(f"  [{k}] {v['name']}")

    s_idx = input("\nSeleccione la tienda: ").strip()
    if s_idx not in STORES:
        return

    store = STORES[s_idx]
    base_url = store["url"]

    print(f"[*] Iniciando sesión en {store['name']}...")
    session = get_session(base_url)
    tree = fetch_category_tree(base_url, session)

    while True:
        print(f"\n>>> TIENDA: {store['name']} <<<")
        print("[1] Navegar Categorías\n[2] Buscar Texto\n[q] Salir")
        op = input("\nSelección: ").strip().lower()
        if op == "q":
            break

        raw, source, target_name = [], "IS", ""

        if op == "1":
            target = menu_categorias(tree)
            if not target:
                continue
            target_name = target["name"]
            raw, source = search_is_by_category(base_url, session, target)

        elif op == "2":
            q = input("¿Qué buscamos?: ").strip()
            if not q:
                continue
            target_name = q
            raw, source = search_is_by_text(base_url, session, q)

        else:
            continue

        # Obtener promos exactas via search-promotions (batch, máx 50 SKUs por request)
        all_skus = [r["items"][0]["itemId"] for r in raw if r.get("items")]
        all_promos: dict = {}
        for i in range(0, len(all_skus), 50):
            batch = all_skus[i:i+50]
            all_promos.update(fetch_promotions(base_url, session, batch))
        if all_promos:
            print(f"[*] search-promotions: {len(all_promos)} promos encontradas de {len(all_skus)} SKUs")

        prods = [p for p in [
            extract_product(r, base_url, source,
                promo_data=all_promos.get(r["items"][0]["itemId"]) if r.get("items") else None)
            for r in raw
        ] if p]
        activos_count = sum(1 for p in prods if p["Estado"] == "ACTIVO")

        # Preguntar si mostrar todos o solo activos
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
                fn = f"{store['name']}_{target_name.replace(' ','_')}{suffix}_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
                with open(fn, "w", newline="", encoding="utf-8-sig") as f:
                    dw = csv.DictWriter(f, fieldnames=exportar[0].keys())
                    dw.writeheader()
                    dw.writerows(exportar)
                print(f"\n[+] Exportado: {fn} ({len(exportar)} productos)")

if __name__ == "__main__":
    main()
