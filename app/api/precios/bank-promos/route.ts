import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

import { getAuthToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPromosData } from '@/lib/getPromos'

export interface BankPromoInfo {
  label: string
  discountValue: number
  discountType: string
  stacking: 'ALWAYS' | 'NEVER' | 'UNKNOWN'
  matchingEntityNames: string[]
  capAmount?: number | null
  capPeriod?: string | null
  betterDay?: {
    dayLabel: string
    discountValue: number
    discountType: string
    label: string
  }
}

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// validDays es un bitmask (bit 0 = domingo ... bit 6 = sábado, ver getPromos.ts).
// Para el mensaje "el viernes tenés más %", basta el primer día marcado.
function firstDayLabel(validDays: number): string {
  for (let i = 0; i < 7; i++) {
    if ((validDays & (1 << i)) !== 0) return DAY_LABELS[i]
  }
  return ''
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
async function resolveCommerceNames(names: string[]): Promise<Map<string, { id: string; name: string; stacksWithBankPromos: 'ALWAYS' | 'NEVER' | 'UNKNOWN' }>> {
  const normNames = names.map(n => ({ raw: n, norm: normalizeStr(n) }))

  const commerces = await prisma.commerce.findMany({ select: { id: true, name: true, stacksWithBankPromos: true } })
  const aliases = await prisma.commerceAlias.findMany({ select: { alias: true, commerceId: true } })

  const commerceById = new Map(commerces.map(c => [c.id, c]))
  const byNormName = new Map(commerces.map(c => [normalizeStr(c.name), c]))
  const byNormAlias = new Map(
    aliases
      .map(a => [normalizeStr(a.alias), commerceById.get(a.commerceId)] as const)
      .filter((entry): entry is [string, typeof commerces[number]] => !!entry[1])
  )

  const result = new Map<string, { id: string; name: string; stacksWithBankPromos: 'ALWAYS' | 'NEVER' | 'UNKNOWN' }>()
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

    const token = await getAuthToken(req)
    const email = (token?.email as string | undefined) || req.headers.get('x-user-email')

    const resolvedByName = await resolveCommerceNames(commerces)
    const results: Record<string, BankPromoInfo | null> = {}

    const resolvedEntries = commerces
      .map(name => [name, resolvedByName.get(name)] as const)
      .filter((entry): entry is [string, NonNullable<typeof entry[1]>] => !!entry[1])

    for (const name of commerces) {
      if (!resolvedByName.get(name)) results[name] = null
    }

    if (resolvedEntries.length > 0) {
      try {
        // Si el usuario está logueado, forMe=true filtra por su perfil financiero real.
        // Si es invitado (sin sesión), forMe=false trae las mejores promos públicas del día.
        const forMe = !!email
        const { promos } = await getPromosData(
          { commerceIds: resolvedEntries.map(([, c]) => c.name), searchMode: 'exact', forMe },
          email || undefined,
          false,
        )

        const byCommerceId = new Map(resolvedEntries.map(([, c]) => [c.id, [] as any[]]))
        for (const p of promos as any[]) {
          const bucket = byCommerceId.get(p.commerce?.id)
          if (bucket) bucket.push(p)
        }

        for (const [name, resolved] of resolvedEntries) {
          let best: BankPromoInfo | null = null
          let bestOtherDay: { validDays: number; bestDiscountValue: number; bestDiscountType: string; bankName: string | null; walletName: string | null } | null = null
          for (const p of byCommerceId.get(resolved.id) ?? []) {
            const req = p.userBestDiscount || (p.requirements && p.requirements.length > 0 ? p.requirements.slice().sort((a: any, b: any) => (b.discountValue ?? 0) - (a.discountValue ?? 0))[0] : null)
            if (req) {
              const entityName = req.bank?.name || req.wallet?.name
              if (entityName) {
                const matchingNames: string[] = (p as any).matchingEntityNames?.length ? (p as any).matchingEntityNames : [entityName]
                // Con 1 sola entidad matcheando, el nombre real identifica la promo
                // ("Visa Galicia"). Con varias empatadas en el mismo %, nombrar una sola
                // implica falsamente exclusividad — se usa el canal (wallet si la tiene,
                // si no la red) + cuántas entidades más aplican.
                const label = matchingNames.length > 1
                  ? `${req.wallet?.name || req.cardNetwork?.name || entityName} (+${matchingNames.length - 1} banco${matchingNames.length - 1 === 1 ? '' : 's'})`
                  : (req.cardNetwork?.name ? `${entityName} ${req.cardNetwork.name}` : entityName)
                const normEntity = entityName.toLowerCase()
                const normWallet = (req.wallet?.name || '').toLowerCase()

                // Política de acumulación:
                // 1. Si el comercio por definición NO acumula (ej. Coto = NEVER), se respeta estrictamente NEVER.
                //    Ninguna billetera (MODO, Personal Pay, etc.) puede pasar por encima de la regla de Coto
                //    de no acumular con ofertas de góndola / productos en promo.
                // 2. Si la promo misma está marcada como `stackable: true`, es ALWAYS.
                // 3. Cuenta DNI en comercios adheridos que no sean Coto (ej. Carrefour) suele aplicar al total del ticket.
                // 4. De lo contrario, se respeta la política del comercio (stacksWithBankPromos) o UNKNOWN.
                const isCoto = resolved.name.toLowerCase().includes('coto')
                let stacking: 'ALWAYS' | 'NEVER' | 'UNKNOWN' = isCoto ? 'NEVER' : (resolved.stacksWithBankPromos ?? 'UNKNOWN')

                if (resolved.stacksWithBankPromos === 'NEVER' || isCoto) {
                  stacking = 'NEVER'
                } else if ((p as any).stackable === true) {
                  stacking = 'ALWAYS'
                } else if ((normEntity.includes('cuenta dni') || normWallet.includes('cuenta dni')) && !isCoto) {
                  stacking = 'ALWAYS'
                }

                const capAmount = req.cap ?? (p as any).cap ?? null
                const capPeriod = req.capPeriod ?? (p as any).capPeriod ?? null

                if (!best || (req.discountValue ?? 0) > best.discountValue) {
                  best = {
                    label,
                    discountValue: req.discountValue ?? 0,
                    discountType: req.discountType,
                    stacking,
                    matchingEntityNames: matchingNames,
                    capAmount,
                    capPeriod,
                    promoId: p.id,
                    slug: p.slug ?? null,
                    title: p.title ?? null,
                    description: p.description ?? null,
                    sourceUrl: (p as any).sourceUrl ?? null,
                    sourceText: (p as any).sourceText ?? null,
                    stackableNote: (p as any).stackableNote ?? null,
                    commerceNote: (p as any).commerceNote ?? null,
                  }
                }
              }
            }
            // getPromosData ya adjunta `otherDayPromos` por promo (Alerta Inteligente de
            // Oportunidad, Home v2) cuando no hay filtro explícito de día — mismo caso de uso acá.
            const otherDays = (p as any).otherDayPromos as Array<{ validDays: number; bestDiscountValue: number; bestDiscountType: string; bankName: string | null; walletName: string | null }> | undefined
            for (const od of otherDays ?? []) {
              if (od.bestDiscountType === 'CUOTAS_SIN_INTERES') continue
              if (!bestOtherDay || od.bestDiscountValue > bestOtherDay.bestDiscountValue) bestOtherDay = od
            }
          }
          if (best && bestOtherDay && bestOtherDay.bestDiscountValue > best.discountValue) {
            const entityName = bestOtherDay.bankName || bestOtherDay.walletName || ''
            best.betterDay = {
              dayLabel: firstDayLabel(bestOtherDay.validDays),
              discountValue: bestOtherDay.bestDiscountValue,
              discountType: bestOtherDay.bestDiscountType,
              label: entityName,
            }
          }
          results[name] = best
        }
      } catch (err) {
        console.error('[POST /api/precios/bank-promos] getPromosData failed', err)
        for (const [name] of resolvedEntries) results[name] = null
      }
    }

    return NextResponse.json({ promos: results })
  } catch (error) {
    console.error('[POST /api/precios/bank-promos]', error)
    return NextResponse.json({ promos: {} }, { status: 500 })
  }
}
