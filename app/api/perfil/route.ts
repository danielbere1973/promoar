export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedEmail } from '@/lib/auth'

// GET /api/perfil — devuelve el perfil completo del usuario logueado
export async function GET(req: NextRequest) {
  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      financialProfile: {
        include: {
          banks: { include: { bank: { select: { id: true, name: true, slug: true } } } },
          wallets: { include: { wallet: { select: { id: true, name: true, slug: true } } } },
          cards: {
            include: {
              bank: { select: { id: true, name: true } },
              cardNetwork: { select: { id: true, name: true } },
              wallet: { select: { id: true, name: true } },
              segmentRef: { select: { id: true, name: true } },
              cardSegmentRef: { select: { id: true, name: true, cardType: true, cardNetwork: { select: { name: true } } } },
            },
          },
        },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      phoneMobile: user.phoneMobile,
      phoneFixed: user.phoneFixed,
      documentType: user.documentType,
      documentNumber: user.documentNumber,
      addressStreet: user.addressStreet,
      addressNumber: user.addressNumber,
      addressFloor: user.addressFloor,
      addressApt: user.addressApt,
      addressZipCode: user.addressZipCode,
      addressCity: user.addressCity,
      addressState: user.addressState,
      addressCountry: user.addressCountry,
    },
    profile: user.financialProfile ?? null,
  })
}

// POST /api/perfil — crea o actualiza el perfil financiero y personal
export async function POST(req: NextRequest) {
  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await req.json()
  const { 
    action, bankId, walletId, cardId, cardBankId, cardNetworkId, cardType, cardWalletId, 
    name, lastName, phoneMobile, phoneFixed, documentType, documentNumber,
    addressStreet, addressNumber, addressFloor, addressApt, addressZipCode, 
    addressCity, addressState, addressCountry,
    segmentId, cardSegmentId, lastFour, accountNumber,
    shortAccountNumber, bankAccountType, currency, alias,
    isPayroll, isPensioner
  } = body

  const user = await prisma.user.findUnique({
    where: { email },
    include: { financialProfile: true },
  })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // Crear perfil si no existe (para la parte financiera)
  let profileId = user.financialProfile?.id
  if (!profileId && ['add_bank', 'remove_bank', 'add_wallet', 'remove_wallet', 'add_card', 'remove_card'].includes(action)) {
    const profile = await prisma.financialProfile.create({
      data: { userId: user.id },
    })
    profileId = profile.id
  }

  try {
    if (action === 'update_profile') {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name, lastName, phoneMobile, phoneFixed, documentType, documentNumber,
          addressStreet, addressNumber, addressFloor, addressApt, addressZipCode,
          addressCity, addressState, addressCountry
        }
      })
    } else if (action === 'add_bank' && bankId) {
      if (!profileId) throw new Error("No hay perfil financiero")
      await prisma.userBank.upsert({
        where: { financialProfileId_bankId: { financialProfileId: profileId, bankId } },
        update: {},
        create: { financialProfileId: profileId, bankId },
      })
    } else if (action === 'remove_bank' && bankId) {
      if (!profileId) throw new Error("No hay perfil financiero")
      await prisma.userBank.deleteMany({ where: { financialProfileId: profileId, bankId } })
    } else if (action === 'add_wallet' && walletId) {
      if (!profileId) throw new Error("No hay perfil financiero")
      await prisma.userWallet.upsert({
        where: { financialProfileId_walletId: { financialProfileId: profileId, walletId } },
        update: {},
        create: { financialProfileId: profileId, walletId },
      })
    } else if (action === 'remove_wallet' && walletId) {
      if (!profileId) throw new Error("No hay perfil financiero")
      await prisma.userWallet.deleteMany({ where: { financialProfileId: profileId, walletId } })
    } else if (action === 'add_card') {
      if (!profileId) throw new Error("No hay perfil financiero")
      
      const networkIds = Array.isArray(body.cardNetworkIds) ? body.cardNetworkIds : [cardNetworkId].filter(Boolean)
      
      if (networkIds.length > 0) {
        // Creación múltiple
        await Promise.all(networkIds.map((nid: string) => 
          prisma.userCard.create({
            data: {
              financialProfileId: profileId!,
              bankId: cardBankId || null,
              cardNetworkId: nid,
              cardType: cardType || 'CREDIT',
              walletId: cardWalletId || null,
              segmentId: segmentId || null,
              cardSegmentId: cardSegmentId || null,
              lastFour: lastFour || null,
              accountNumber: accountNumber || null,
              shortAccountNumber: shortAccountNumber || null,
              bankAccountType: bankAccountType || null,
              currency: currency || null,
              alias: alias || null,
              isPayroll: isPayroll || false,
              isPensioner: isPensioner || false,
            },
          })
        ))
      } else {
        // Caso sin marca especificada
        await prisma.userCard.create({
          data: {
            financialProfileId: profileId,
            bankId: cardBankId || null,
            cardNetworkId: null,
            cardType: cardType || 'CREDIT',
            walletId: cardWalletId || null,
            segmentId: segmentId || null,
            cardSegmentId: cardSegmentId || null,
            lastFour: lastFour || null,
            accountNumber: accountNumber || null,
            shortAccountNumber: shortAccountNumber || null,
            bankAccountType: bankAccountType || null,
            currency: currency || null,
            alias: alias || null,
            isPayroll: isPayroll || false,
            isPensioner: isPensioner || false,
          },
        })
      }
    } else if (action === 'update_card' && cardId) {
      if (!profileId) throw new Error("No hay perfil financiero")
      
      // La UI envía cardNetworkIds como array, tomamos el primero para actualizar el registro individual
      const effectiveNetworkId = (Array.isArray(body.cardNetworkIds) && body.cardNetworkIds.length > 0)
        ? body.cardNetworkIds[0]
        : (cardNetworkId || null)

      await prisma.userCard.update({
        where: { id: cardId, financialProfileId: profileId },
        data: {
          bankId: cardBankId || null,
          cardNetworkId: effectiveNetworkId,
          cardType: cardType || 'CREDIT',
          walletId: cardWalletId || null,
          segmentId: segmentId || null,
          cardSegmentId: cardSegmentId || null,
          lastFour: lastFour || null,
          accountNumber: accountNumber || null,
          shortAccountNumber: shortAccountNumber || null,
          bankAccountType: bankAccountType || null,
          currency: currency || null,
          alias: alias || null,
          isPayroll: isPayroll || false,
          isPensioner: isPensioner || false,
        },
      })
    } else if (action === 'remove_card' && cardId) {
      if (!profileId) throw new Error("No hay perfil financiero")
      await prisma.userCard.deleteMany({ where: { id: cardId, financialProfileId: profileId } })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/perfil]', error)
    return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 })
  }
}
