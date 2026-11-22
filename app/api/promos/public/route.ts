import { NextRequest, NextResponse } from 'next/server'
import { getPromosData } from '@/lib/getPromos'

export const dynamic = 'force-dynamic'

// Ruta pública cacheable por CDN (Cache-Control: s-maxage), separada de
// /api/promos — pedido explícito de Pablo (22/11/2026). Por diseño:
// - NO lee sesión, cookies ni headers de usuario (x-user-email, Authorization):
//   cualquier dato por-usuario volvería esta respuesta no-compartible entre
//   visitantes y la CDN no debe cachearla.
// - NO setea cookies en la response (una Set-Cookie hace que la CDN de Vercel
//   descarte el cacheo de esa respuesta).
// - Solo sirve el caso invitado sin filtros manuales (whitelist abajo);
//   cualquier otro caso sigue yendo por /api/promos sin cache HTTP.
//
// Invalidación: NO por purga de CDN ni por revalidateTag — la URL incluye
// `v={catalogVersion}` (leído de getCachedCatalogVersion, con el mismo tag
// PROMOS_PUBLIC_TAG que getPublicPromosPage). Cuando el catálogo cambia,
// invalidatePublicPromosCache() bumpea catalogVersion → la próxima vez que el
// cliente pida esta ruta, pide una URL con `v` distinto → cache-key distinta
// para la CDN → MISS natural, sin tocar nada de Vercel. Mientras `v` no
// cambie, s-maxage/stale-while-revalidate sirven la misma respuesta cacheada.
const VALID_CATEGORY_SLUGS = new Set<string>([
  'supermercados', 'combustible', 'gastronomia', 'farmacias', 'indumentaria',
  'tecnologia', 'mascotas', 'transporte', 'heladerias', 'hogar',
  'entretenimiento', 'salud-y-belleza', 'deportes', 'jugueterias', 'librerias',
  'viajes-y-turismo', 'shoppings', 'automotores', 'otros', 'sin-categoria',
])

// Mismo criterio que isPublicCacheableView/paginate en getPromosData — provincias
// con volumen real de promos geo-acotadas. Cualquier provincia fuera de esta
// whitelist cae a 'ALL' (sin filtro geográfico fino), nunca se pasa el valor
// crudo del query param a la cache-key / a Prisma.
const VALID_PROVINCES = new Set<string>([
  'CABA', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
])

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const viewParam = searchParams.get('view')
    const view = viewParam === 'week' ? 'week' : 'today'

    const rawCategory = searchParams.get('category')
      ?.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') ?? null
    const categorySlug = rawCategory && VALID_CATEGORY_SLUGS.has(rawCategory) ? rawCategory : null

    const rawProvince = searchParams.get('province')
    const province = rawProvince && VALID_PROVINCES.has(rawProvince) ? rawProvince : null

    const page = 1
    const pageSize = view === 'week' ? 3000 : 1500

    const result = await getPromosData(
      {
        forMe: false,
        view,
        categorySlug,
        categorySlugs: categorySlug ? [categorySlug] : [],
        paginate: true,
        page,
        pageSize,
        province,
        useCandidateQuery: true,
      },
      null,
      false,
    )

    const serialized = JSON.stringify(result)

    const bytes = Buffer.byteLength(serialized, 'utf8')
    const SIZE_WARN_THRESHOLD = 3_800_000
    if (bytes > SIZE_WARN_THRESHOLD) {
      console.warn(
        `[promos-size-warning] /api/promos/public devolvió ${(bytes / 1_000_000).toFixed(2)}MB ` +
        `(${result.promos?.length ?? 0} promos) — supera el umbral de alerta de ` +
        `${(SIZE_WARN_THRESHOLD / 1_000_000).toFixed(1)}MB. Límite de riesgo real: ~4.5MB.`
      )
    }

    return new NextResponse(serialized, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=7200, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('[GET /api/promos/public]', error)
    return NextResponse.json({ error: 'Error al obtener promos' }, { status: 500 })
  }
}
