export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedEmail } from '@/lib/auth'

type GuestCard = {
  bankId?: string
  walletId?: string
  cardNetworkId?: string
  cardType: 'CREDIT' | 'DEBIT' | 'ACCOUNT'
  segmentId?: string
  cardSegmentId?: string
  bankAccountType?: string
  currency?: string
  accountNumber?: string
  isPayroll?: boolean
  isPensioner?: boolean
}

export async function POST(req: NextRequest) {
  const email = await getAuthenticatedEmail(req)
  if (!email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { cards }: { cards: GuestCard[] } = await req.json()
  if (!Array.isArray(cards) || cards.length === 0) return NextResponse.json({ imported: 0 })

  const user = await prisma.user.findUnique({
    where: { email },
    include: { financialProfile: { include: { cards: true, banks: true, wallets: true } } },
  })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  let profileId = user.financialProfile?.id
  if (!profileId) {
    const created = await prisma.financialProfile.create({ data: { userId: user.id } })
    profileId = created.id
  }

  const existingCards = user.financialProfile?.cards ?? []
  let imported = 0

  for (const card of cards) {
    const alreadyExists = existingCards.some(c => {
      if (card.bankId && c.bankId !== card.bankId) return false
      if (card.walletId && c.walletId !== card.walletId) return false
      if (card.cardNetworkId && c.cardNetworkId !== card.cardNetworkId) return false
      if (c.cardType !== card.cardType) return false
      return true
    })
    if (alreadyExists) continue

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
        accountNumber: card.accountNumber ?? null,
        isPayroll: card.isPayroll ?? false,
        isPensioner: card.isPensioner ?? false,
      },
    })

    if (card.bankId) {
      const exists = user.financialProfile?.banks.some(b => b.bankId === card.bankId)
      if (!exists) {
        await prisma.userBank.upsert({
          where: { financialProfileId_bankId: { financialProfileId: profileId, bankId: card.bankId } },
          create: { financialProfileId: profileId, bankId: card.bankId },
          update: {},
        })
      }
    }
    if (card.walletId) {
      const exists = user.financialProfile?.wallets.some(w => w.walletId === card.walletId)
      if (!exists) {
        await prisma.userWallet.upsert({
          where: { financialProfileId_walletId: { financialProfileId: profileId, walletId: card.walletId } },
          create: { financialProfileId: profileId, walletId: card.walletId },
          update: {},
        })
      }
    }

    imported++
  }

  return NextResponse.json({ imported })
}
