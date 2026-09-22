import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { getPromosData } from '@/lib/getPromos'

export interface BankPromoInfo {
  label: string
  discountValue: number
  discountType: string
}

function normalizeStr(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Resuelve el nombre de supermercado tal como aparece en el carrito de /precios
// (ej. "Jumbo", "Más Online") contra el Commerce real de la base, pasando por
// CommerceAlias — el mismo mecanismo de normalización que usa el scraper — para
// no depender de que el string coincida letra por letra con Commerce.name.
// Devuelve el Commerce.name canónico (no el id): getPromosData filtra `commerceIds`
// contra Commerce.name incluso con searchMode 'exact', nunca contra el id.
async function resolveCommerceNames(names: string[]): Promise<Map<string, { id: string; name: string }>> {
  const normNames = names.map(n => ({ raw: n, norm: normalizeStr(n) }))

  const commerces = await prisma.commerce.findMany({ select: { id: true, name: true } })
  const aliases = await prisma.commerceAlias.findMany({ select: { alias: true, commerceId: true } })

  const commerceById = new Map(commerces.map(c => [c.id, c]))
  const byNormName = new Map(commerces.map(c => [normalizeStr(c.name), c]))
  const byNormAlias = new Map(
    aliases
      .map(a => [normalizeStr(a.alias), commerceById.get(a.commerceId)] as const)
      .filter((entry): entry is [string, { id: string; name: string }] => !!entry[1])
  )

  const result = new Map<string, { id: string; name: string }>()
  for (const { raw, norm } of normNames) {
    const commerce = byNormName.get(norm) ?? byNormAlias.get(norm)
    if (commerce) result.set(raw, commerce)
  }
  return result
}

// Dado un set de nombres de comercio (los mismos "supermarket" que ya se muestran
// en el carrito de /precios), devuelve la mejor promo bancaria del perfil del
// usuario para cada uno — o null si no tiene ninguna aplicable.
export async function POST(req: NextRequest) {
  try {
    const { commerces } = await req.json() as { commerces: string[] }
    if (!Array.isArray(commerces) || commerces.length === 0) {
      return NextResponse.json({ promos: {} })
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    const email = (token?.email as string | undefined) || req.headers.get('x-user-email')
    const role = token?.role as string | undefined
    const isAdmin = role === 'ADMIN' || role === 'MODERATOR'

    if (!email || isAdmin) {
      // Sin perfil financiero cargado no hay match posible; admins no tienen perfil propio.
      return NextResponse.json({ promos: {} })
    }

    const resolvedByName = await resolveCommerceNames(commerces)
    const results: Record<string, BankPromoInfo | null> = {}

    await Promise.all(commerces.map(async (name) => {
      const resolved = resolvedByName.get(name)
      if (!resolved) {
        results[name] = null
        return
      }
      try {
        const { promos } = await getPromosData(
          { commerceIds: [resolved.name], searchMode: 'exact', forMe: true },
          email,
          false,
        )
        let best: BankPromoInfo | null = null
        for (const p of promos as any[]) {
          if (p.commerce?.id !== resolved.id) continue
          const req = p.userBestDiscount
          if (!req) continue
          const entityName = req.bank?.name || req.wallet?.name
          if (!entityName) continue
          const label = req.cardNetwork?.name ? `${entityName} ${req.cardNetwork.name}` : entityName
          if (!best || (req.discountValue ?? 0) > best.discountValue) {
            best = { label, discountValue: req.discountValue ?? 0, discountType: req.discountType }
          }
        }
        results[name] = best
      } catch {
        results[name] = null
      }
    }))

    return NextResponse.json({ promos: results })
  } catch (error) {
    console.error('[POST /api/precios/bank-promos]', error)
    return NextResponse.json({ promos: {} }, { status: 500 })
  }
}
