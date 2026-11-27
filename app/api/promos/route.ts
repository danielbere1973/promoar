import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
export const dynamic = 'force-dynamic'

import { getAuthToken } from '@/lib/auth'
import { getPromosData, PromoQueryParams } from '@/lib/getPromos'
import { invalidatePublicPromosCache } from '@/lib/cache/promosCache'
import { invalidateCategoriesCache } from '@/lib/cache/filtersCache'
import { invalidatePromoDetailBySlugs, invalidateCommerceDetailBySlugs } from '@/lib/cache/detailCache'

// Mismo patrón que app/api/admin/scrape/route.ts: Bearer VTEX_SESSION_SECRET
// (callers internos/server-to-server) o sesión con rol ADMIN (formularios de
// app/admin/page.tsx y app/admin/promos-v2/page.tsx, los únicos callers reales
// hoy). Agregado 25/11/2026 — antes POST no tenía ningún auth check propio y
// el path estaba en PUBLIC_PATHS de middleware.ts.
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization') || ''
  const secret = process.env.VTEX_SESSION_SECRET
  if (secret && auth === `Bearer ${secret}`) return true

  const session = await getServerSession()
  if (!session?.user?.email) return false
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })
  return user?.role === 'ADMIN'
}

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

    const token = await getAuthToken(req)
    const email = (token?.email as string | undefined) || req.headers.get('x-user-email')
    const role = token?.role as string | undefined
    const isAdmin = role === 'ADMIN' || role === 'MODERATOR'
    const forMe = params.forMe ?? false

    // Paginación: solo para invitados sin filtros de banco/wallet/red/categoría/canal/día.
    // `forMe=true` sin sesión ni guest_profile no filtra nada (no hay perfil real
    // detrás, ver hasProfile en getPromosData) — no debe tirar del path cacheable
    // por sí solo, solo cuenta como "con perfil" si viene acompañado de alguno.
    // BUG (27/9/2026): faltaba `day`/`dayIndices` acá — un filtro de día explícito
    // (ej. "Viernes" desde el cuadro superior, sin categoría/banco seleccionado)
    // caía igual en el camino cacheado (getPublicPromosPage), que solo filtra por
    // el día REAL del servidor (defaultDayBit) e ignora por completo `dayIndices`.
    // Resultado: promos que sí aplicaban el día filtrado (ej. Estación Mascotera,
    // Vie+Sáb) desaparecían porque el server evaluaba el día de hoy (domingo), no
    // el filtrado. Con `day`/`dayIndices` acá, ese caso sale del camino cacheado
    // y pasa por el camino no-cacheado que sí respeta `dayIndices` (ver
    // lib/getPromos.ts líneas ~718-733 y ~966-968).
    const hasFilters = !!(
      params.bankIds?.length || params.walletIds?.length || params.networkIds?.length ||
      params.categorySlugs?.length || params.categorySlug || params.channels?.length ||
      params.commerceIds?.length || params.discountRanges?.length || params.hasInstallments ||
      params.day || params.dayIndices?.length
    )
    const hasRealProfile = !!email || !!params.guestProfileParam
    // BUG (11/11/2026): un usuario LOGUEADO en modo "Todas" (forMe=false, toggle
    // Todas/Para Mí — ej. entrando a /promos/explorar) caía igual fuera del
    // camino paginado/cacheado solo por tener `email`, aunque no pida perfil
    // activo. Sin narrowing SQL por perfil (forMe=false) ese camino hace un
    // findMany sin filtro real sobre miles de promos ACTIVE — medido en ~8s
    // solo de query + ~3s de sort JS adicional, tiempo suficiente para que
    // /promos/explorar quede cargando en blanco en producción (timeout) y
    // tarde ~30s en local. Es el mismo `where` amplio que vería un invitado
    // (sin perfil, sin filtros) — debe entrar al mismo camino cacheado.
    const paginate = !(forMe && hasRealProfile) && (!email || !forMe) && !hasFilters
    const page = parseInt(searchParams.get('page') ?? '1') || 1

    // Fechas clave: buscar si hoy está dentro del window de alguna fecha especial
    // Servidor en UTC (Vercel) — ajustar a Argentina (UTC-3 fijo) para no adelantar el día
    const argNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
    // getUTCDay(), no getDay() — evita el doble desplazamiento de zona horaria en
    // localhost/Windows (ya en UTC-3) que adelantaba el día (bug 27/8/2026).
    const isWeekend = [5, 6, 0].includes(argNow.getUTCDay())
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

    // BUG (17/11/2026): reporte de usuario real — filtrar "Para Mí" estando
    // logueado tardaba ~1 minuto (vs instantáneo de invitado). Causa: esta ruta
    // nunca pasaba `useCandidateQuery`, así que forMe=true siempre caía en el
    // camino viejo sin narrowing SQL por perfil (findMany sobre TODAS las
    // promos ACTIVE — ya 18.000+ — + matching en JS). `recommended`,
    // `home-decision` y el snapshot de recomendaciones ya usaban el candidate
    // selection (DR-003/DR-004) desde antes; esta ruta había quedado afuera.
    // Ver getPromos.ts línea ~738: useCandidates ya hace fallback seguro al
    // camino viejo si hay filtros manuales de banco/wallet/red/etc (reqFilter).
    const result = await getPromosData(
      { ...params, paginate, page, pageSize, useCandidateQuery: true },
      email,
      isAdmin
    )

    // Alarma de tamaño de payload — pedido explícito de Pablo (22/11/2026):
    // avisar bien antes del límite real de ~4.5MB que ya se vio pegar un 200
    // con payloads de ~4.7MB. 3.8MB es el umbral de alerta temprana.
    const serialized = JSON.stringify(result)
    const bytes = Buffer.byteLength(serialized, 'utf8')
    const SIZE_WARN_THRESHOLD = 3_800_000
    if (bytes > SIZE_WARN_THRESHOLD) {
      console.warn(
        `[promos-size-warning] /api/promos devolvió ${(bytes / 1_000_000).toFixed(2)}MB ` +
        `(${result.promos?.length ?? 0} promos) — supera el umbral de alerta de ` +
        `${(SIZE_WARN_THRESHOLD / 1_000_000).toFixed(1)}MB. Límite de riesgo real: ~4.5MB.`
      )
    }

    return new NextResponse(serialized, {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[GET /api/promos]', error)
    return NextResponse.json({ error: 'Error al obtener promos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

    await invalidatePublicPromosCache()
    invalidateCategoriesCache()
    // Invalidación puntual por slug (no global) — crear 1 promo nunca debe
    // vaciar las fichas de todo el sitio. Ver incidente 25/11/2026 en CLAUDE.md.
    await invalidatePromoDetailBySlugs(promo.slug ? [promo.slug] : [], {
      alwaysBySlug: true,
      commerceSlugs: promo.commerce?.slug ? [promo.commerce.slug] : [],
      origin: 'POST /api/promos',
    })
    if (promo.commerce?.slug) {
      await invalidateCommerceDetailBySlugs([promo.commerce.slug], { alwaysBySlug: true, origin: 'POST /api/promos' })
    }
    return NextResponse.json({ promo }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/promos]', error)
    return NextResponse.json({ error: 'Error al crear promo' }, { status: 500 })
  }
}
