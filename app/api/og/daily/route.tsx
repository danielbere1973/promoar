import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const revalidate = 3600

const fontData = fs.readFileSync(
  path.resolve('./node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf')
)

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'
const PCT_TYPES = ['PERCENTAGE_REINTEGRO', 'PERCENTAGE_DESCUENTO', 'BONIFICACION']

function absoluteLogo(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
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

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const todayBit = 1 << new Date().getDay()

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

  const today = new Date()
  const dateStr = today.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)

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
          padding: '56px',
          fontFamily: 'Noto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '44px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              background: '#D94F2B',
              borderRadius: '16px',
              width: '52px', height: '52px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px',
            }}>🎯</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'white', fontSize: '38px', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1 }}>PromoAR</span>
              <span style={{ color: '#64a0d4', fontSize: '19px', fontWeight: 600, marginTop: '4px' }}>
                🔥 {dateCapitalized}
              </span>
            </div>
          </div>
          <span style={{ color: '#3a6a9a', fontSize: '18px', fontWeight: 700 }}>promoar.com.ar</span>
        </div>

        {/* Divider */}
        <div style={{ height: '2px', background: 'rgba(255,255,255,0.08)', marginBottom: '32px' }} />

        {/* Promos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
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
                  padding: '22px 28px',
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
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '5px' }}>
                  <span style={{ color: 'white', fontSize: '24px', fontWeight: 900, lineHeight: 1 }}>
                    {p.commerce.name}
                  </span>
                  {entity ? (
                    <span style={{ color: '#7ab0e0', fontSize: '17px', fontWeight: 600 }}>
                      con {entity}
                    </span>
                  ) : null}
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
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          marginTop: '32px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '20px',
          gap: '10px',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <span style={{ color: '#64a0d4', fontSize: '20px', fontWeight: 600 }}>
            Encontrá más promos para tu tarjeta en
          </span>
          <span style={{ color: 'white', fontSize: '22px', fontWeight: 900 }}>
            promoar.com.ar
          </span>
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
