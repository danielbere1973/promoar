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
  activeTitles: Map<string, Set<string>>, // commerceId → Set<normalizedTitle>
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
  const hasOrphanReq = promo.requirements.some((r: any) => !r.bankId && !r.walletId && !r.cardNetworkId)
  if (hasOrphanReq) issues.push('Requisito sin entidad financiera')

  // 4. Descuento en 0
  const hasZeroDiscount = promo.requirements.some((r: any) => r.discountValue === 0)
  if (hasZeroDiscount) issues.push('Descuento en 0')

  // 4. Sin días
  if (!promo.validDays || promo.validDays === 0) issues.push('Sin días válidos')

  // 5. Requirements duplicados (mismo banco+wallet+red+canal+tipo+valor)
  const reqKeys = promo.requirements.map((r: any) =>
    [r.bankId ?? '', r.walletId ?? '', r.cardNetworkId ?? '', r.paymentChannel ?? '', r.discountType, r.discountValue].join('|')
  )
  if (new Set(reqKeys).size < reqKeys.length) issues.push('Requisitos duplicados')

  // 6. Duplicado de promo activa (mismo comercio + título)
  const normTitle = normalizeTitle(promo.title)
  const activesForCommerce = activeTitles.get(promo.commerceId)
  if (activesForCommerce?.has(normTitle)) issues.push('Ya existe activa con mismo comercio y título')

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
        },
      },
    },
  })

  if (drafts.length === 0) {
    return NextResponse.json({ approved: 0, flagged: [] })
  }

  // Cargar títulos de promos activas para detectar duplicados
  const actives = await prisma.promo.findMany({
    where: { status: 'ACTIVE' },
    select: { commerceId: true, title: true },
  })
  const activeTitles = new Map<string, Set<string>>()
  for (const a of actives) {
    if (!activeTitles.has(a.commerceId)) activeTitles.set(a.commerceId, new Set())
    activeTitles.get(a.commerceId)!.add(normalizeTitle(a.title))
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
  if (toApprove.length > 0) {
    await prisma.promo.updateMany({
      where: { id: { in: toApprove } },
      data: { status: 'ACTIVE' },
    })
  }

  return NextResponse.json({ approved: toApprove.length, flagged })
}
