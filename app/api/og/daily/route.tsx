import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const revalidate = 3600

const fontData = fs.readFileSync(
  path.resolve('./node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf')
)

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://promoar.com.ar')
const PCT_TYPES = ['PERCENTAGE_REINTEGRO', 'PERCENTAGE_DESCUENTO', 'BONIFICACION']

function absoluteLogo(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function validDaysLabel(validDays: number | null): string {
  if (!validDays || validDays === 127) return 'Todos los días'
  const days = DAY_NAMES.filter((_, i) => (validDays & (1 << i)) !== 0)
  if (days.length === 0) return ''
  // Detectar rango contiguo simple (ej. Lun a Vie)
  const indices = DAY_NAMES.map((_, i) => i).filter(i => (validDays & (1 << i)) !== 0)
  const isContiguous = indices.every((v, idx) => idx === 0 || v === indices[idx - 1] + 1)
  if (isContiguous && indices.length > 1) {
    return `${DAY_NAMES[indices[0]]} a ${DAY_NAMES[indices[indices.length - 1]]}`
  }
  return days.join(', ')
}

function discountLabel(req: { discountType: string; discountValue: number | null; nxmN?: number | null; nxmM?: number | null }): string {
  const v = req.discountValue ?? 0
  if (PCT_TYPES.includes(req.discountType)) return `${v}% OFF`
  if (req.discountType === 'CUOTAS_SIN_INTERES') return `${v} cuotas`
  if (req.discountType === 'NXM') return `${req.nxmN ?? 2}x${req.nxmM ?? 1}`
  if (req.discountType === 'FIXED_AMOUNT') return `$${v.toLocaleString('es-AR')} reintegro`
  return `${v}%`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const count = Math.min(parseInt(searchParams.get('n') ?? '5'), 8)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const isWeekly = searchParams.get('range') === 'week'

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  // Hora Argentina explícita — el servidor corre en UTC, y sin esto el
  // día calculado queda adelantado entre las 21:00 y las 00:00 ART.
  const nowAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
  const todayBit = 1 << nowAR.getDay()

  // Categorías prioritarias en orden
  const PRIORITY_CATS = ['supermercados', 'combustible', 'transporte', 'farmacias']

  const raw = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      isCSIOnly: false,
      maxDiscountPct: { gte: 15 },
      commerce: { activePromoCount: { gte: 5 } },
      OR: [{ validUntil: null }, { validUntil: { gte: startOfToday } }],
    },
    include: {
      commerce: { select: { id: true, name: true, logoUrl: true, activePromoCount: true } },
      category: { select: { slug: true } },
      requirements: {
        where: { discountType: { in: PCT_TYPES } },
        include: {
          bank: { select: { name: true } },
          wallet: { select: { name: true } },
        },
        orderBy: { discountValue: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ maxDiscountPct: 'desc' }],
    take: 500,
  })

  const seenCommerce = new Set<string>()
  const seenCatCount = new Map<string, number>()
  const MAX_PER_CAT = Math.max(1, Math.ceil(count / PRIORITY_CATS.length))

  const candidates = raw
    .filter(p => {
      if (p.requirements.length === 0) return false
      // En la semanal no filtramos por día — se muestran las mejores promos
      // de la semana sin importar qué días de la semana aplican.
      if (isWeekly) return true
      if (!p.validDays || p.validDays === 127) return false
      if ((p.validDays & todayBit) === 0) return false
      return true
    })
    .sort((a, b) => {
      const aCatIdx = PRIORITY_CATS.indexOf(a.category?.slug ?? '')
      const bCatIdx = PRIORITY_CATS.indexOf(b.category?.slug ?? '')
      const aRank = aCatIdx === -1 ? 99 : aCatIdx
      const bRank = bCatIdx === -1 ? 99 : bCatIdx
      if (aRank !== bRank) return aRank - bRank
      return (b.requirements[0]?.discountValue ?? 0) - (a.requirements[0]?.discountValue ?? 0)
    })

  const promos = candidates
    .filter(p => {
      if (seenCommerce.has(p.commerce.id)) return false
      const cat = p.category?.slug ?? 'otros'
      if ((seenCatCount.get(cat) ?? 0) >= MAX_PER_CAT) return false
      seenCommerce.add(p.commerce.id)
      seenCatCount.set(cat, (seenCatCount.get(cat) ?? 0) + 1)
      return true
    })
    .slice((page - 1) * count, page * count)

  const dayName = nowAR.toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' }).toUpperCase()
  const dateStr = nowAR.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })

  // Rango lunes-a-domingo de la semana que arranca este lunes (el banner
  // semanal se genera los lunes, mostrando la semana que empieza ese día).
  const weekStart = new Date(nowAR)
  const isoDow = nowAR.getDay() === 0 ? 7 : nowAR.getDay() // lunes=1..domingo=7
  weekStart.setDate(nowAR.getDate() + (isoDow === 1 ? 0 : 8 - isoDow))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const weekRangeStr = `${weekStart.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} al ${weekEnd.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`

  // Colors for variety
  const ACCENT_COLORS = ['#D94F2B', '#2563EB', '#059669', '#7C3AED', '#D97706', '#DC2626', '#0891B2', '#65A30D']

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          background: 'linear-gradient(160deg, #0a1628 0%, #0f2140 40%, #1a3050 100%)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Noto',
        }}
      >
        {/* Header — banda blanca de ancho completo */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'white', padding: '24px 56px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE_URL}/promoar_gabi_transparente_fixed.png`} alt="PromoAR" width={200} height={109} style={{ objectFit: 'contain', marginLeft: '-14px' }} />
            <span style={{ color: '#3a6a9a', fontSize: '18px', fontWeight: 700 }}>Todas tus promos en un solo lugar</span>
          </div>
          <span style={{ color: '#3a6a9a', fontSize: '18px', fontWeight: 700 }}>promoar.com.ar</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '40px 56px 56px' }}>
          {/* Título — dinámico según día/rango */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '28px' }}>
            <span style={{ color: 'white', fontSize: '44px', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.1 }}>
              {isWeekly ? '📅 Lo mejor de la semana' : `🔥 Tus promos para hoy`}
            </span>
            <span style={{ color: '#7ab0e0', fontSize: '26px', fontWeight: 700 }}>
              {isWeekly ? weekRangeStr : `${dayName} ${dateStr}`}
            </span>
          </div>

          {/* Divider */}
          <div style={{ height: '2px', background: 'rgba(255,255,255,0.08)', marginBottom: '28px' }} />

          {/* Promos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
          {promos.map((p, i) => {
            const req = p.requirements[0]
            const discount = discountLabel(req)
            const entity = req?.bank?.name ?? req?.wallet?.name ?? ''
            const isPct = PCT_TYPES.includes(req.discountType)
            const accent = ACCENT_COLORS[i % ACCENT_COLORS.length]

            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: i === 0
                    ? `linear-gradient(135deg, rgba(217,79,43,0.2) 0%, rgba(217,79,43,0.05) 100%)`
                    : 'rgba(255,255,255,0.05)',
                  borderRadius: '20px',
                  padding: '18px 28px',
                  border: i === 0
                    ? '1.5px solid rgba(217,79,43,0.4)'
                    : '1.5px solid rgba(255,255,255,0.07)',
                  gap: '24px',
                }}
              >
                {/* Logo */}
                <div style={{
                  width: '64px', height: '64px',
                  borderRadius: '14px',
                  background: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  {absoluteLogo(p.commerce.logoUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={absoluteLogo(p.commerce.logoUrl)!}
                      alt={p.commerce.name}
                      width={56}
                      height={56}
                      style={{ objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: '30px' }}>🏷️</span>
                  )}
                </div>

                {/* Commerce + entity */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '3px' }}>
                  <span style={{ color: 'white', fontSize: '22px', fontWeight: 900, lineHeight: 1 }}>
                    {p.commerce.name}
                  </span>
                  <span style={{ color: '#7ab0e0', fontSize: '15px', fontWeight: 600 }}>
                    {entity ? `con ${entity}` : ' '}
                    {validDaysLabel(p.validDays) ? ` · ${validDaysLabel(p.validDays)}` : ''}
                  </span>
                </div>

                {/* Discount badge */}
                <div style={{
                  background: isPct ? accent : 'rgba(255,255,255,0.1)',
                  borderRadius: '14px',
                  padding: '10px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                  minWidth: '120px',
                }}>
                  <span style={{
                    color: 'white',
                    fontSize: isPct ? '30px' : '20px',
                    fontWeight: 900,
                    lineHeight: 1,
                  }}>
                    {discount}
                  </span>
                </div>
              </div>
            )
          })}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            marginTop: '32px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '16px',
            padding: '20px',
            gap: '6px',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#64a0d4', fontSize: '20px', fontWeight: 600 }}>
                Encontrá más promos para tus tarjetas, bancos y billeteras en
              </span>
              <span style={{ color: 'white', fontSize: '22px', fontWeight: 900 }}>
                promoar.com.ar
              </span>
            </div>
            <span style={{ color: '#7ab0e0', fontSize: '18px', fontWeight: 700 }}>
              👆 Link en bio
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: [{ name: 'Noto', data: fontData, weight: 400, style: 'normal' }],
    }
  )
}
