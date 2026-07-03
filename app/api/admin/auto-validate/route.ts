export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

async function isAdmin() {
  const session = await getServerSession()
  if (!session?.user?.email) return false
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })
  return user?.role === 'ADMIN'
}

function normalizeTitle(t: string) {
  return t.toLowerCase().trim().replace(/\s+/g, ' ')
}

function validatePromo(
  promo: any,
  activeTitles: Map<string, Array<{ title: string; bankIds: Set<string>; walletIds: Set<string> }>>,
): string[] {
  const issues: string[] = []

  // 1. Sin requirements
  if (!promo.requirements || promo.requirements.length === 0) {
    issues.push('Sin requisitos de pago')
    return issues // sin requirements no hay más que chequear
  }

  // 2. Cap en 0 sin capUnlimited (excluir CSI — el tope no aplica)
  const hasBadCap = promo.requirements.some((r: any) =>
    r.cap === 0 && !r.capUnlimited && r.discountType !== 'CUOTAS_SIN_INTERES'
  )
  if (hasBadCap) issues.push('Tope en $0 — verificar si es sin tope')

  // 3. Requisito sin entidad financiera (banco, wallet y red todos null)
  // Excepción: accountType JUBILADO/HABERES/ANSES es un constraint válido sin entidad bancaria
  const hasOrphanReq = promo.requirements.some((r: any) =>
    !r.bankId && !r.walletId && !r.cardNetworkId &&
    (!r.accountType || r.accountType === 'ANY')
  )
  if (hasOrphanReq) issues.push('Requisito sin entidad financiera')

  // 4. Descuento en 0 (NXM como 2x1 siempre tiene discountValue=0 por diseño)
  const hasZeroDiscount = promo.requirements.some((r: any) => r.discountValue === 0 && r.discountType !== 'NXM')
  if (hasZeroDiscount) issues.push('Descuento en 0')

  // 4. Sin días
  if (!promo.validDays || promo.validDays === 0) issues.push('Sin días válidos')

  // 5. Requirements duplicados (mismo banco+wallet+red+segmento+canal+tipo+valor)
  const reqKeys = promo.requirements.map((r: any) =>
    [r.bankId ?? '', r.walletId ?? '', r.cardNetworkId ?? '', r.cardSegmentId ?? '', r.paymentChannel ?? '', r.discountType, r.discountValue].join('|')
  )
  if (new Set(reqKeys).size < reqKeys.length) issues.push('Requisitos duplicados')

  // 6. Duplicado de promo activa (mismo comercio + título + al menos una entidad en común)
  const normTitle = normalizeTitle(promo.title)
  const activesForCommerce = activeTitles.get(promo.commerceId) ?? []
  const draftBankIds = new Set(promo.requirements.map((r: any) => r.bankId).filter(Boolean))
  const draftWalletIds = new Set(promo.requirements.map((r: any) => r.walletId).filter(Boolean))
  const isDupe = activesForCommerce.some(a => {
    if (a.title !== normTitle) return false
    const sharedBank   = Array.from(draftBankIds).some(id => a.bankIds.has(id as string))
    const sharedWallet = Array.from(draftWalletIds).some(id => a.walletIds.has(id as string))
    return sharedBank || sharedWallet
  })
  if (isDupe) issues.push('Ya existe activa con mismo comercio, título y entidad')

  return issues
}

export async function POST() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Cargar DRAFTs con requirements
  const drafts = await prisma.promo.findMany({
    where: { status: 'DRAFT' },
    include: {
      commerce: { select: { id: true, name: true } },
      requirements: {
        select: {
          id: true, discountType: true, discountValue: true,
          cap: true, capUnlimited: true,
          bankId: true, walletId: true, cardNetworkId: true,
          cardSegmentId: true, paymentChannel: true,
        },
      },
    },
  })

  if (drafts.length === 0) {
    return NextResponse.json({ approved: 0, flagged: [] })
  }

  // Cargar promos activas con entidades para detectar duplicados reales
  const actives = await prisma.promo.findMany({
    where: { status: 'ACTIVE' },
    select: {
      commerceId: true, title: true,
      requirements: { select: { bankId: true, walletId: true } },
    },
  })
  // Map: commerceId → lista de { title normalizado, bankIds, walletIds }
  const activeTitles = new Map<string, Array<{ title: string; bankIds: Set<string>; walletIds: Set<string> }>>()
  for (const a of actives) {
    if (!activeTitles.has(a.commerceId)) activeTitles.set(a.commerceId, [])
    activeTitles.get(a.commerceId)!.push({
      title: normalizeTitle(a.title),
      bankIds: new Set(a.requirements.map(r => r.bankId).filter(Boolean) as string[]),
      walletIds: new Set(a.requirements.map(r => r.walletId).filter(Boolean) as string[]),
    })
  }

  const toApprove: string[] = []
  const flagged: { promoId: string; title: string; commerceName: string; issues: string[] }[] = []

  for (const draft of drafts) {
    const issues = validatePromo(draft, activeTitles)
    if (issues.length === 0) {
      toApprove.push(draft.id)
    } else {
      flagged.push({
        promoId: draft.id,
        title: draft.title,
        commerceName: draft.commerce.name,
        issues,
      })
    }
  }

  // Aprobar los limpios
  let approvedSlugs: string[] = []
  if (toApprove.length > 0) {
    await prisma.promo.updateMany({
      where: { id: { in: toApprove } },
      data: { status: 'ACTIVE' },
    })
    // Obtener slugs para IndexNow
    const approved = await prisma.promo.findMany({
      where: { id: { in: toApprove }, slug: { not: null } },
      select: { slug: true },
    })
    approvedSlugs = approved.map(p => p.slug!).filter(Boolean)
  }

  // Notificar IndexNow (fire-and-forget, no bloquea la respuesta)
  if (approvedSlugs.length > 0) {
    const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'
    const INDEXNOW_KEY = '218059e4ea38492aa43715204a12cde4'
    fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(BASE_URL).hostname,
        key: INDEXNOW_KEY,
        keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: approvedSlugs.map(s => `${BASE_URL}/promos/${s}`),
      }),
    }).catch(() => {}) // silencioso si falla
  }

  return NextResponse.json({ approved: toApprove.length, flagged })
}
