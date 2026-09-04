import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import CombustibleSimulator, { CombustiblePromoItem } from './CombustibleSimulator'

export const revalidate = 3600 // Cache por 1 hora

export const metadata: Metadata = {
  title: 'Simulador de Ahorro en Combustible | PromoAR',
  description: '¿Con qué tarjeta te conviene cargar nafta hoy? Seleccioná tus bancos y calculá tu ahorro real en YPF, Axion, Shell y Puma con reintegros y topes actualizados.',
  openGraph: {
    title: 'Simulador de Ahorro en Combustible | PromoAR',
    description: 'Calculá en qué estación de servicio pagás menos hoy según tus tarjetas y billeteras. YPF vs Axion vs Shell vs Puma.',
    url: 'https://promoar.com.ar/ahorro_interactivo/combustible',
    siteName: 'PromoAR',
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Simulador de Ahorro en Combustible | PromoAR',
    description: '¿Con qué pagar nafta hoy para ahorrar hasta $25.000? Elegí tus tarjetas y mirá el podio en vivo.',
  },
}

// Regex para descartar promociones de rubros secundarios (lubricentro, boxes, cafetería, indumentaria, vinos, etc.)
const NON_FUEL_REGEX = /\b(lubricant|lubricentro|aceite|boxes|vino|vinos|espumante|espumantes|vinoteca|tienda\s+full|tiendas\s+ypf\s+full|ypf\s+full|tienda\s+spot|spot!|cafeter[ií]a|lavado|indumentaria|zapatilla|zapatillas|calzado|remera|pantal[oó]n|moda|colch[oó]n|armer[ií]a|growler)\b/i

function isFuelValid(title: string, desc: string | null, commerceName: string, catSlug?: string | null): boolean {
  const full = `${commerceName || ''} ${title || ''} ${desc || ''}`
  if (NON_FUEL_REGEX.test(full)) return false

  // Si la categoría en DB es ropa, deportes, gastronomía o tecnología, solo permitir si explícitamente es estación/combustible
  if (catSlug && ['indumentaria', 'deportes', 'hogar', 'tecnologia', 'gastronomia', 'automotores', 'otros'].includes(catSlug)) {
    const isExplicitFuel = /\b(puma\s+energy|combustible|combustibles|nafta|estaci[oó]n\s+de\s+servicio|estaciones\s+de\s+servicio)\b/i.test(full)
    if (!isExplicitFuel) return false
  }

  return true
}

// Mapeo canónico a las 4 marcas principales de combustible (puede aplicar a varias o a todas si es genérica)
function resolveFuelBrands(commerceName: string, title: string, desc: string | null): FuelBrand[] {
  const full = `${commerceName || ''} ${title || ''} ${desc || ''}`.toLowerCase()
  const brands: FuelBrand[] = []

  if (/\bypf\b/i.test(full)) brands.push('YPF')
  if (/\baxion\b/i.test(full)) brands.push('Axion')
  if (/\bshell\b/i.test(full)) brands.push('Shell')

  // Para Puma: requerir límite de palabra y contexto de estación de servicio (evita 'esPUMAntes' o tiendas deportivas)
  if (/\b(?:puma\s+energy|puma)\b/i.test(full)) {
    if (
      /\b(?:energy|combustible|combustibles|nafta|estaci|estaciones)\b/i.test(full) ||
      commerceName.toLowerCase().includes('puma')
    ) {
      brands.push('Puma')
    }
  }

  // Si no especificó marca pero es genérica de combustible o estaciones de servicio
  if (brands.length === 0) {
    const c = (commerceName || '').toLowerCase()
    const t = (title || '').toLowerCase()
    if (
      c.includes('combustible') ||
      c.includes('estaciones de servicio') ||
      t.includes('combustible') ||
      t.includes('nafta')
    ) {
      return ['YPF', 'Axion', 'Shell', 'Puma']
    }
  }

  return brands
}

// Extracción de tope de reintegro en pesos a partir del texto o descripción
function extractCap(title: string, desc: string | null): number | null {
  const full = `${title} ${desc || ''}`
  const match = full.match(/tope(?:\s+de(?:\s+reintegro)?)?[:\s]*\$?\s*([0-9]+(?:\.[0-9]{3})*)/i)
  if (match && match[1]) {
    const num = parseInt(match[1].replace(/\./g, ''), 10)
    if (!isNaN(num) && num > 500 && num < 100000) return num
  }
  return null
}

// Días de la semana desde bitmask (1 = Dom, 2 = Lun, 4 = Mar, 8 = Mié, 16 = Jue, 32 = Vie, 64 = Sáb)
function bitmaskToDayNames(bitmask: number): string[] {
  if (bitmask >= 127) return ['Todos los días']
  const map: [number, string][] = [
    [2, 'Lunes'],
    [4, 'Martes'],
    [8, 'Miércoles'],
    [16, 'Jueves'],
    [32, 'Viernes'],
    [64, 'Sábados'],
    [1, 'Domingos'],
  ]
  const res: string[] = []
  for (const [bit, name] of map) {
    if ((bitmask & bit) !== 0) res.push(name)
  }
  return res.length ? res : ['Todos los días']
}

export default async function CombustibleSimulatorPage() {
  // Obtenemos todas las promociones activas del rubro combustible (incluyendo cadenas y genéricas)
  const rawPromos = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { category: { slug: 'combustible' } },
        {
          commerce: {
            slug: {
              in: [
                'ypf',
                'shell',
                'axion',
                'axion-energy',
                'puma-energy',
                'app-ypf',
                'combustibles',
                'estaciones-de-servicio-adheridas',
                'estaciones-de-servicio-que-acepten-modo',
              ],
            },
          },
        },
        { title: { contains: 'combustible', mode: 'insensitive' } },
        { title: { contains: 'nafta', mode: 'insensitive' } },
        { title: { contains: 'puma energy', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      sourceUrl: true,
      maxDiscountPct: true,
      validDays: true,
      isFeatured: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
      commerce: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
        },
      },
      requirements: {
        select: {
          cap: true,
          bank: { select: { id: true, name: true, slug: true, logoUrl: true } },
          wallet: { select: { id: true, name: true, slug: true, logoUrl: true } },
          cardNetwork: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: [
      { maxDiscountPct: { sort: 'desc', nulls: 'last' } },
    ],
  })

  // Normalizamos a las 4 marcas oficiales
  const promos: CombustiblePromoItem[] = []

  for (const p of rawPromos) {
    // Descartamos promos no relacionadas directamente a combustible (boxes, lubricantes, cafetería, tiendas de ropa, etc.)
    if (!isFuelValid(p.title, p.description, p.commerce.name, p.category?.slug)) {
      continue
    }

    const brands = resolveFuelBrands(p.commerce.name, p.title, p.description)
    if (brands.length === 0) continue

    const discountPct = p.maxDiscountPct || 10

    // Prioridad 1: tope estructurado en requirements
    let cap: number | null = null
    for (const r of p.requirements) {
      if (typeof r.cap === 'number' && r.cap > 0 && r.cap < 200000) {
        if (cap === null || r.cap > cap) {
          cap = r.cap
        }
      }
    }
    // Prioridad 2: inferir del texto si no está estructurado
    if (cap === null) {
      cap = extractCap(p.title, p.description)
    }

    const days = bitmaskToDayNames(p.validDays)

    // Procesamos los requerimientos estructurados
    const fullText = `${p.title} ${p.description || ''} ${p.commerce.name} ${p.sourceUrl || ''}`.toLowerCase()
    const requiresModo = fullText.includes('modo') || fullText.includes('semana nacion') || fullText.includes('semananacion')

    const requirements = p.requirements.map(r => {
      let walletSlug = r.wallet?.slug || null
      let walletName = r.wallet?.name || null
      if (!walletSlug && requiresModo) {
        walletSlug = 'modo'
        walletName = 'MODO'
      }
      return {
        bankName: r.bank?.name || null,
        bankSlug: r.bank?.slug || null,
        walletName,
        walletSlug,
      }
    })

    if (requirements.length === 0 && requiresModo) {
      requirements.push({
        bankName: null,
        bankSlug: null,
        walletName: 'MODO',
        walletSlug: 'modo',
      })
    }

    // Inyectamos la promo para cada marca a la que aplica
    for (const brand of brands) {
      promos.push({
        id: `${p.id}-${brand}`,
        brand,
        title: p.title,
        description: p.description,
        discountPct,
        capAmount: cap,
        validDays: days,
        validDaysBitmask: p.validDays,
        requirements,
        isFeatured: p.isFeatured,
        logoUrl: p.commerce.logoUrl,
      })
    }
  }

  return (
    <main className="min-h-screen bg-[#0A1428] text-slate-100 selection:bg-[#D94F2B]/30">
      <CombustibleSimulator initialPromos={promos} />
    </main>
  )
}
