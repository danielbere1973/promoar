import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

import { getToken } from 'next-auth/jwt'
import { getPromosData, PromoQueryParams } from '@/lib/getPromos'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const params: PromoQueryParams = {
      categorySlug: searchParams.get('category')
        ?.toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') ?? null,
      categorySlugs: searchParams.get('categories')
        ?.split(',')
        .map(s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
        .filter(Boolean) ?? [],
      day: searchParams.get('day'), // Single day filter (legacy/shortcut)
      forMe: searchParams.get('for_me') === 'true',
      bankIds: searchParams.get('banks')?.split(',').filter(Boolean),
      walletIds: searchParams.get('wallets')?.split(',').filter(Boolean),
      networkIds: searchParams.get('networks')?.split(',').filter(Boolean),
      channels: searchParams.get('channels')?.split(',').filter(Boolean) as any[],
      capPeriods: searchParams.get('capPeriods')?.split(',').filter(Boolean) as any[],
      hasCap: searchParams.get('hasCap'),
      capMin: searchParams.get('capMin') ? parseFloat(searchParams.get('capMin')!) : null,
      capMax: searchParams.get('capMax') ? parseFloat(searchParams.get('capMax')!) : null,
      dateFromStr: searchParams.get('dateFrom'),
      dateToStr: searchParams.get('dateTo'),
      dayIndices: searchParams.get('days')?.split(',').filter(Boolean).map(d => parseInt(d)),
      view: searchParams.get('view'), // 'today' | 'week'
      discountRanges: searchParams.get('discountRanges')?.split(',').filter(Boolean) ?? [],
      hasInstallments: searchParams.get('hasInstallments'), // 'true' | 'false' | null
      commerceIds: searchParams.get('commerces')?.split(',').filter(Boolean),
      searchMode: searchParams.get('searchMode') || 'startsWith', // startsWith | contains | exact
      province: searchParams.get('province'),
      guestProfileParam: searchParams.get('guest_profile'),
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    const email = (token?.email as string | undefined) || req.headers.get('x-user-email')
    const role = token?.role as string | undefined
    const isAdmin = role === 'ADMIN' || role === 'MODERATOR'
    const forMe = params.forMe ?? false

    // Paginación: solo para invitados sin filtros de banco/wallet/red/categoría/canal
    const hasFilters = !!(
      params.bankIds?.length || params.walletIds?.length || params.networkIds?.length ||
      params.categorySlugs?.length || params.categorySlug || params.channels?.length ||
      params.commerceIds?.length || params.discountRanges?.length || params.hasInstallments
    )
    const paginate = !forMe && !email && !hasFilters
    const page = parseInt(searchParams.get('page') ?? '1') || 1

    // Fechas clave: buscar si hoy está dentro del window de alguna fecha especial
    // Servidor en UTC (Vercel) — ajustar a Argentina (UTC-3 fijo) para no adelantar el día
    const argNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const isWeekend = [5, 6, 0].includes(argNow.getDay())
    const windowMax = new Date(); windowMax.setDate(windowMax.getDate() + 30)
    const keyDate = paginate ? await prisma.promoCalendar.findFirst({
      where: { date: { gte: new Date(), lte: windowMax } },
      orderBy: { date: 'asc' },
    }) : null
    const isKeyDate = keyDate
      ? Math.ceil((keyDate.date.getTime() - Date.now()) / 86400000) <= keyDate.windowDays
      : false

    const baseToday = isKeyDate ? keyDate!.pageSizeToday : isWeekend ? 2000 : 1500
    const baseWeek  = isKeyDate ? keyDate!.pageSizeWeek  : isWeekend ? 4000 : 3000
    const defaultPageSize = params.view === 'week' ? baseWeek : baseToday
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? String(defaultPageSize)) || defaultPageSize, 7000)

    const result = await getPromosData({ ...params, paginate, page, pageSize }, email, isAdmin)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/promos]', error)
    return NextResponse.json({ error: 'Error al obtener promos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      title, description,
      uniqueUsePerPeriod, maxUsesPerPeriod, stackable, stackableNote,
      validFrom, validUntil, validDays, validDaysNote,
      validFromHour, validToHour,
      categoryId, commerceId, requirements,
      status, sourceUrl, sourceNote, commerceNote, provinces,
    } = body

    const promo = await prisma.promo.create({
      data: {
        title,
        description,
        uniqueUsePerPeriod: uniqueUsePerPeriod ?? false,
        maxUsesPerPeriod: maxUsesPerPeriod ? parseInt(maxUsesPerPeriod) : null,
        stackable: stackable ?? false,
        stackableNote: stackableNote || null,
        validFrom: new Date(validFrom),
        validUntil: validUntil ? new Date(validUntil) : null,
        validDays: validDays ?? 127, // 127 = todos los dias
        validDaysNote: validDaysNote || null,
        validFromHour: validFromHour ? parseInt(validFromHour) : null,
        validToHour: validToHour ? parseInt(validToHour) : null,
        categoryId,
        commerceId,
        status: status ?? 'ACTIVE',
        sourceUrl: sourceUrl || null,
        sourceNote: sourceNote || null,
        commerceNote: commerceNote || null,
        provinces: Array.isArray(provinces) ? provinces : [],
        requirements: requirements?.length
          ? {
            create: requirements.map((r: any) => ({
              bankId: r.bankId || null,
              walletId: r.walletId || null,
              cardNetworkId: r.cardNetworkId || null,
              cardType: r.cardType || null,
              paymentChannel: r.paymentChannel || 'ANY',
              accountType: r.accountType || 'ANY',
              segment: r.segment || null,
              discountType: r.discountType || 'PERCENTAGE_REINTEGRO',
              discountValue: r.discountValue ? parseFloat(r.discountValue) : 0,
              nxmN: r.nxmN ? parseInt(r.nxmN) : null,
              nxmM: r.nxmM ? parseInt(r.nxmM) : null,
              minPurchase: r.minPurchase ? parseFloat(r.minPurchase) : null,
              cap: r.cap ? parseFloat(r.cap) : null,
              capPeriod: r.capPeriod || null,
              capTarget: (r.capTarget as 'USER' | 'CARD' | 'ACCOUNT' | 'TRANSACCION') || (r.cap ? 'USER' : null),
              note: r.note || null,
            })),
          }
          : undefined,
      },
      include: {
        category: true,
        commerce: true,
        requirements: true,
      },
    })

    return NextResponse.json({ promo }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/promos]', error)
    return NextResponse.json({ error: 'Error al crear promo' }, { status: 500 })
  }
}
