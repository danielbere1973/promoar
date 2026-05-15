export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedEmail } from '@/lib/auth'

type SyncCard = {
  bankId?: string
  walletId?: string
  cardNetworkId?: string
  cardType: 'CREDIT' | 'DEBIT' | 'ACCOUNT'
  segmentId?: string
  cardSegmentId?: string
  bankAccountType?: string
  currency?: string
  accountNumber?: string
  cbu?: string
  firstSix?: string
  lastFour?: string
  isPayroll?: boolean
  isPensioner?: boolean
}

export async function POST(req: NextRequest) {
  const email = await getAuthenticatedEmail(req)
  if (!email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { cards }: { cards: SyncCard[] } = await req.json()
  if (!Array.isArray(cards)) return NextResponse.json({ error: 'cards requerido' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { email },
    include: { financialProfile: true },
  })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  let profileId = user.financialProfile?.id

  if (profileId) {
    await prisma.userCard.deleteMany({ where: { financialProfileId: profileId } })
    await prisma.userBank.deleteMany({ where: { financialProfileId: profileId } })
    await prisma.userWallet.deleteMany({ where: { financialProfileId: profileId } })
  } else {
    const created = await prisma.financialProfile.create({ data: { userId: user.id } })
    profileId = created.id
  }

  for (const card of cards) {
    await prisma.userCard.create({
      data: {
        financialProfileId: profileId,
        bankId: card.bankId ?? null,
        walletId: card.walletId ?? null,
        cardNetworkId: card.cardNetworkId ?? null,
        cardType: card.cardType as any,
        segmentId: card.segmentId ?? null,
        cardSegmentId: card.cardSegmentId ?? null,
        bankAccountType: card.bankAccountType ?? null,
        currency: card.currency ?? null,
        accountNumber: card.cbu ?? card.accountNumber ?? null,
        lastFour: card.lastFour ?? null,
        isPayroll: card.isPayroll ?? false,
        isPensioner: card.isPensioner ?? false,
      },
    })

    if (card.bankId) {
      await prisma.userBank.upsert({
        where: { financialProfileId_bankId: { financialProfileId: profileId, bankId: card.bankId } },
        create: { financialProfileId: profileId, bankId: card.bankId },
        update: {},
      })
    }
    if (card.walletId) {
      await prisma.userWallet.upsert({
        where: { financialProfileId_walletId: { financialProfileId: profileId, walletId: card.walletId } },
        create: { financialProfileId: profileId, walletId: card.walletId },
        update: {},
      })
    }
  }

  return NextResponse.json({ ok: true, saved: cards.length })
}
