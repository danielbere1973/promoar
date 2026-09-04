import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentPeriod } from '@/lib/promoUsage'
import { PROMOS_PUBLIC_TAG } from '@/lib/cache/promosCache'
import { matchesProfile as matchesProfileShared } from '@/lib/matchesProfile'
import { buildProfileSignature } from '@/lib/financialMatchIndex'

// Guardrail OOM (cpo-a-cto-aprobacion-rfc-guardrail-oom-y-autorizacion-spike-25-8-2026.md):
// límite defensivo genérico para cualquier findMany sin paginar ni `take`
// explícito — evita instanciar miles de filas con requirements anidados en
// memoria ante un `where` inesperadamente amplio. Se usa cuando NO hay
// narrowing SQL real por perfil (forMe sin tarjetas efectivas, o invitado
// con filtros libres).
const HARD_CAP_TAKE = 200

// Cap para el caso forMe=true CON tarjetas efectivas: el `where` ya viene
// acotado por matching de perfil financiero + validDays en SQL (bloque
// "PRE-FILTRO SQL POR PERFIL FINANCIERO" más abajo), así que el universo
// resultante ya es relevante para el usuario y no amerita el cap genérico de
// 200 — eso truncaba a usuarios con perfil completo (bug reportado 27/8/2026:
// usuario con 3765 promos matcheadas veía solo ~100 en la Home). Sigue habiendo
// un techo por las dudas, más alto, hasta que exista paginación real logueada.
const HARD_CAP_TAKE_NARROWED = 1000

// Prisma/Postgres `contains`+`insensitive` solo ignora mayúsculas, no acentos —
// "cafe" no matchea "Café" sin este normalizado en ambos lados de la comparación.
function normalizeAccents(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Cache del count total de promos activas — se recalcula cada 5 minutos
let cachedTotalCount: number | null = null
let cachedTotalCountAt: number = 0
async function getActiveTotalCount(): Promise<number> {
  if (cachedTotalCount !== null && Date.now() - cachedTotalCountAt < 5 * 60 * 1000) {
    return cachedTotalCount
  }
  cachedTotalCount = await prisma.promo.count({ where: { status: 'ACTIVE' } })
  cachedTotalCountAt = Date.now()
  return cachedTotalCount
}

// Normaliza nombres de provincia para comparar texto libre (perfil de usuario)
// contra nombres de Nominatim (CommerceBranch.province): sin acentos, minúsculas,
// y alias comunes de CABA / Buenos Aires.
export function normalizeProvince(s: string): string {
  const n = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  if (['caba', 'capital federal', 'ciudad de buenos aires', 'ciudad autonoma de buenos aires', 'ciudad autonoma de bs. as.', 'ciudad autonoma de bs as'].includes(n)) {
    return 'caba'
  }
  if (['buenos aires', 'bs as', 'bs. as.', 'pba', 'provincia de buenos aires', 'gba', 'gran buenos aires'].includes(n)) {
    return 'buenos aires'
  }
  return n
}

// Por encima de esta cantidad de provincias distintas con sucursales, se considera
// que el comercio tiene cobertura nacional y no se filtra por ubicación.
export const NATIONAL_COVERAGE_THRESHOLD = 4

// RFC-002 Fase 1 — caché exclusiva de la rama pública de invitado sin filtros
// de banco/wallet/red/categoría/etc (sin email, sin filtros). `province` entra
// como parte de la clave de cache: cada provincia distinta cachea su propia
// página — el filtro SQL por `provinces[]` sigue viviendo acá adentro (no se
// puede mover a un post-filtro en JS sin volver a traer el universo completo
// sin LIMIT, el mismo bug que motivó RFC-002). El filtro fino ADR-001
// (salesChannel/geographicScope/locationModel/branches) se aplica una sola vez,
// afuera, en getPromosData, sobre el resultado ya cacheado — ver ese bloque.
// `forMe=true` sin guest_profile (ver hasRealProfile en route.ts) no filtra
// nada y puede pasar por acá igual que un invitado común — el guard que decide
// llamar a esta función (isPublicCacheableView en getPromosData) ya excluye
// email/isAdmin/perfil real por construcción; esta función no acepta esos
// parámetros en su firma para que sea imposible colarlos por error.
//
// Cache del count total de promos activas Y válidas hoy (por dayBit) — mismo criterio
// que getActiveTotalCount pero acotado al bitmask del día, recalculado cada 5 minutos.
// Sin esto, el totalCount que ve el invitado en view=today incluiría promos de otros días.
const cachedTodayCountByBit = new Map<number, { count: number; at: number }>()
async function getActiveTodayCount(dayBit: number): Promise<number> {
  const cached = cachedTodayCountByBit.get(dayBit)
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.count
  const count = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint as count FROM "promos"
    WHERE status = 'ACTIVE'
      AND "validFrom" <= now()
      AND ("validUntil" IS NULL OR "validUntil" >= date_trunc('day', now()))
      AND ("validDays" & ${dayBit}) != 0
  `.then(rows => Number(rows[0]?.count ?? 0))
  cachedTodayCountByBit.set(dayBit, { count, at: Date.now() })
  return count
}

// TTL de 10 minutos como red de seguridad (por si una invalidación por evento
// falla en algún punto de escritura) + revalidateTag('promos-public') disparado
// desde cada mutación real (scraper, admin CRUD, auto-validate, cron de
// expiración) — ver lib/cache/promosCache.ts.
//
// El filtro de día (dayBit) se aplica en el WHERE de la query SQL, ANTES del
// take/skip — filtrarlo en JS después de paginar (como se hacía antes) recorta
// primero por mayor descuento y recién después por día, dejando fuera a la
// enorme mayoría de promos válidas hoy que no entraron en esa página truncada
// (bug: invitado veía ~37 promos en vez de miles). dayBit forma parte de la
// clave de cache — sin esto, el resultado de hoy quedaría sirviéndose mañana
// hasta vencer el TTL.
const getPublicPromosPage = unstable_cache(
  async (page: number, pageSize: number, view: string, dayBit: number, province: string | null) => {
    console.log(`[promos-cache] MISS — ejecutando query real (page=${page} pageSize=${pageSize} view=${view} dayBit=${dayBit} province=${province})`)

    const today = new Date()
    const startOfToday = new Date(today); startOfToday.setHours(0, 0, 0, 0)

    const where: any = {
      status: 'ACTIVE' as const,
      validFrom: { lte: today },
      OR: [
        { validUntil: null },
        { validUntil: { gte: startOfToday } },
      ],
    }

    if (province) {
      where.AND = [
        {
          OR: [
            { provinces: { hasSome: ['Todas', 'TODAS', province] } },
            { provinces: { isEmpty: true } },
          ],
        },
      ]
    }

    // view === 'week' no filtra por día — se mantiene el universo completo de activas.
    const dayFiltered = view !== 'week'
    if (dayFiltered) {
      // Prisma no soporta operadores bitwise en `where` sobre un Int — se resuelve
      // el set de IDs candidatos con SQL crudo y luego se hace el findMany real
      // con el `include` completo vía `id: { in }`, para no perder el shape de datos.
      // El ORDER BY/LIMIT/OFFSET va acá también (mismo criterio que el findMany de
      // abajo): sin esto, esta query traía TODOS los IDs activos que matchean el día
      // (miles) para terminar usando sólo `pageSize` — generaba un `IN (...)` con
      // miles de parámetros en cada visita de invitado, manteniendo el compute de
      // Neon siempre activo (nunca llegaba a idle/suspend).
      // El filtro de provincia (promos.provinces[]) se replica acá en SQL crudo —
      // si solo se aplicara en el where de Prisma más abajo, el LIMIT/OFFSET de
      // esta query ya habría cortado la página por dayBit sin tener en cuenta
      // provincia, devolviendo menos de pageSize filas de las que corresponden.
      const idRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "promos"
        WHERE status = 'ACTIVE'
          AND "validFrom" <= now()
          AND ("validUntil" IS NULL OR "validUntil" >= date_trunc('day', now()))
          AND ("validDays" & ${dayBit}) != 0
          AND (${province}::text IS NULL OR cardinality(provinces) = 0 OR provinces && ARRAY[${province}::text, 'Todas', 'TODAS'])
        ORDER BY
          "isCSIOnly" ASC,
          "maxDiscountPct" DESC NULLS LAST,
          id ASC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `
      const matchingIds = idRows.map(r => r.id)
      where.id = { in: matchingIds }
    }

    const [promos, totalCount] = await Promise.all([
      prisma.promo.findMany({
        where,
        select: {
          // Mismo angostamiento que el findMany de getPromosData (RFC
          // perf-payload-and-sort, 25/8/2026) — ver comentario ahí para el
          // detalle de qué campos se sacan y por qué.
          id: true,
          slug: true,
          title: true,
          validDays: true,
          validDaysNote: true,
          specificDates: true,
          salesChannel: true,
          geographicScope: true,
          provinces: true,
          validFrom: true,
          validUntil: true,
          categoryId: true,
          commerceId: true,
          isFeatured: true,
          category: { select: { name: true, slug: true, icon: true, color: true } },
          commerce: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              instagramUrl: true,
              activePromoCount: true,
              // locationModel/branches solo hacen falta cuando hay provincia — el
              // filtro ADR-001 completo (getPromosData, más abajo) solo corre bajo
              // `if (userProvince && !isAdmin)`. Sin esto, invitados con provincia
              // perderían el filtro de cercanía/cobertura al pasar por esta función.
              ...(province ? {
                locationModel: true,
                branches: { select: { province: true }, where: { province: { not: null } } },
              } : {}),
            },
          },
          requirements: {
            include: {
              bank: { select: { id: true, name: true, slug: true, logoUrl: true } },
              wallet: { select: { id: true, name: true, slug: true, logoUrl: true } },
              cardNetwork: { select: { id: true, name: true, slug: true } },
            },
          },
        },
        orderBy: [
          { isCSIOnly: 'asc' },
          { maxDiscountPct: { sort: 'desc', nulls: 'last' } },
          { id: 'asc' },
        ],
        // Si dayFiltered, el where.id ya viene acotado a la página exacta
        // (LIMIT/OFFSET aplicado en la query cruda de arriba) — aplicar skip
        // de nuevo acá saltearía sobre un set que ya es la página, dando 0 filas.
        take: dayFiltered ? undefined : pageSize,
        skip: dayFiltered ? undefined : (page - 1) * pageSize,
      }),
      view === 'week' ? getActiveTotalCount() : getActiveTodayCount(dayBit),
    ])

    // El filtro geográfico fino (ADR-001: salesChannel/geographicScope/locationModel/
    // branches) se aplica una sola vez, afuera de esta función cacheada, en
    // getPromosData — tanto para este resultado cacheado como para el camino
    // no-cacheado. Acá solo se resolvió el filtro grueso por `provinces[]` en SQL
    // (necesario para no romper el LIMIT/OFFSET, ver comentario más arriba).
    return [promos, totalCount] as const
  },
  ['public-promos-page'],
  { revalidate: 600, tags: [PROMOS_PUBLIC_TAG] }, // 600s = 10min TTL de seguridad
)

// ─── Alternativa 2 (DR-004) — Candidate Selection con conocimiento de perfil ──
// Filtro grueso en SQL crudo: estado + vigencia + día + provincia (misma lógica
// que getPublicPromosPage) MÁS un filtro permisivo por bankId/walletId del
// perfil del usuario, ANTES del matching financiero fino en JS.
//
// El filtro por banco/wallet es deliberadamente una SOBRE-aproximación: acepta
// falsos positivos (promos que después matchesProfile() puede rechazar por
// red/tipo/segmento/tier/cuenta), pero NUNCA produce falsos negativos, porque
// toda rama de matchesProfile() que devuelve true ya implica que el bankId/
// walletId del requirement (cuando existe) pertenece al perfil del usuario —
// ver diseno-alternativa-2-candidate-selection.md §2 para la demostración
// caso por caso de las 3 reglas de matchesProfile().
//
// No filtra por red/tipo/segmento/tier/cuenta — eso sigue siendo exclusivo de
// matchesProfile() en TypeScript, sin cambios (ver DR-004: "no un WHERE que
// replique matchesProfile()").
//
// Precedencia explícita (DR-004): el bypass de promos guardadas (savedPromoIds)
// vive DENTRO del AND general de estado/vigencia/geografía, nunca como OR
// externo — así una promo guardada vencida/suspendida/excluida geográficamente
// sigue quedando afuera. El bypass solo exime del matching financiero (bankId/
// walletId), no de vigencia/estado/geografía.
//
// LIMIT: medido contra 5 perfiles reales (1-9 bancos, 1-8 wallets), el WHERE
// permisivo por sí solo reduce el universo ACTIVE (~24.4k) a 4.400-8.400 filas
// según la amplitud del perfil — y ese conteo NO paga costo extra de query al
// quitar el LIMIT (~1.0-1.5s con o sin límite, medido con $queryRaw directo:
// el costo vive en el EXISTS/BitmapAnd, no en cuántas filas junta el ORDER BY).
// Es decir, la reducción de universo la hace el WHERE (perfil-aware), no el
// LIMIT — a diferencia de la Alternativa 1, acá el LIMIT ya no es el mecanismo
// de reducción, es solo un techo de seguridad muy por encima de lo observado.
// 3000 (heredado de Alternativa 1) truncaba al peor caso real (8406, perfil de
// 9 bancos/8 wallets) — subir a 15000 deja ~1.8x de margen sobre ese máximo
// observado. Si algún perfil futuro más amplio lo alcanza, el warning de abajo
// avisa — no es un número mágico dado por cerrado, es un techo con telemetría.
const CANDIDATE_LIMIT = 15000

// CPO Directiva "Vidriera guest permisiva, no restrictiva" (31/8/2026): un
// guest sin perfil no debe ver solo promos "sin banco/wallet" (REGLA 1 de
// matchesProfile.ts) — ese universo es demasiado angosto (en dev, 2 de 18
// rubros). En su lugar, para guests se amplía el candidate pool para incluir
// también los emisores con mayor volumen de promos reales del catálogo
// (bancos: Galicia, BBVA, Santander, BNA, Ciudad; billeteras: MODO, Mercado
// Pago, Cuenta DNI) — mostrados igual con "Hasta X% con [Entidad]" (ver
// lib/homeCopy.ts guestBenefitHeadline) para dejar explícito que depende de
// tener esa tarjeta/billetera. Registrarse sigue siendo lo que resuelve el
// match real contra el perfil del usuario.
export const GUEST_FEATURED_BANK_IDS = [
  'cmnulzag70001qlkkult0vte1', // Galicia
  'cmnulzc4t0003qlkkkezpcuho', // BBVA
  'cmnulzbhs0002qlkkruq7oxyc', // Santander
  'cmnulzcrs0004qlkk8qo969qg', // Banco Nación
  'cmnulze1k0006qlkkzmwrflpx', // Ciudad
]
export const GUEST_FEATURED_WALLET_IDS = [
  'cmnulzh04000aqlkk8mnpzo46', // MODO
  'cmnulzfz80009qlkkuyavwcvh', // Mercado Pago
  '5a90bf8a-6f95-449f-b4f6-8647a6d3c9b4', // Cuenta DNI
]

export async function getCandidatePromosForProfile(params: {
  dayBit: number | null // null = view 'week', no filtra por día
  province: string | null
  userBankIds: string[]
  userWalletIds: string[]
  savedPromoIds: string[]
  // Perf fix (29/8/2026, ver comentario en home-decision/route.ts): cuando el
  // caller ya sabe que solo le importa un subconjunto de categorías (ej. Home
  // v2, que solo usa los rubros DECLARADOS por el usuario), acotar acá evita
  // traer y después hidratar miles de filas de categorías que nunca se van a
  // usar. Vacío/undefined = sin filtro, comportamiento idéntico al anterior.
  categorySlugs?: string[]
  // Ver GUEST_FEATURED_BANK_IDS/WALLET_IDS arriba. false/undefined = criterio
  // estricto de siempre (solo promos sin banco/wallet, o que matchean el
  // perfil real si userBankIds/userWalletIds vienen poblados).
  guestPermissive?: boolean
}): Promise<{ ids: string[]; queryMs: number; hitLimit: boolean }> {
  const t0 = Date.now()
  const { dayBit, province, userBankIds, userWalletIds, savedPromoIds, categorySlugs, guestPermissive } = params
  const categoryFilter = categorySlugs && categorySlugs.length > 0 ? categorySlugs : null
  const effectiveBankIds = guestPermissive ? [...userBankIds, ...GUEST_FEATURED_BANK_IDS] : userBankIds
  const effectiveWalletIds = guestPermissive ? [...userWalletIds, ...GUEST_FEATURED_WALLET_IDS] : userWalletIds

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM "promos" p
    WHERE p.status = 'ACTIVE'
      AND p."validFrom" <= now()
      AND (p."validUntil" IS NULL OR p."validUntil" >= date_trunc('day', now()))
      AND (${dayBit}::int IS NULL OR (p."validDays" & ${dayBit}::int) != 0)
      AND (
        ${province}::text IS NULL
        OR p."geographicScope" != 'PROVINCES'
        OR cardinality(p.provinces) = 0
        OR p.provinces && ARRAY[${province}::text, 'Todas', 'TODAS']
      )
      AND (
        ${categoryFilter}::text[] IS NULL
        OR p."categoryId" IN (SELECT id FROM "categories" WHERE slug = ANY(${categoryFilter}::text[]))
      )
      AND (
        p.id = ANY(${savedPromoIds}::text[])
        OR EXISTS (
          SELECT 1 FROM "promo_requirements" r
          WHERE r."promoId" = p.id
            AND (
              (r."bankId" IS NULL AND r."walletId" IS NULL)
              OR r."bankId" = ANY(${effectiveBankIds}::text[])
              OR r."walletId" = ANY(${effectiveWalletIds}::text[])
            )
        )
      )
    ORDER BY
      "isCSIOnly" ASC,
      "maxDiscountPct" DESC NULLS LAST,
      id ASC
    LIMIT ${CANDIDATE_LIMIT}
  `
  const queryMs = Date.now() - t0
  const hitLimit = rows.length === CANDIDATE_LIMIT
  if (hitLimit) {
    console.warn(`[candidate-query] LIMIT alcanzado (${CANDIDATE_LIMIT}) — riesgo de truncamiento de candidatas válidas. dayBit=${dayBit} province=${province} banks=${userBankIds.length} wallets=${userWalletIds.length}`)
  }
  return { ids: rows.map(r => r.id), queryMs, hitLimit }
}

// Nombre presentable para el badge de cobertura territorial (Title Case, sin acentos perdidos
// en los casos comunes). No cubre absolutamente todas las provincias con tildes correctas —
// alcanza para el uso como texto de UI, no como clave de comparación (para eso está normalizeProvince).
export function displayProvinceName(normalized: string): string {
  if (normalized === 'caba') return 'CABA'
  const specialCases: Record<string, string> = {
    'buenos aires': 'Buenos Aires',
    'cordoba': 'Córdoba',
    'rio negro': 'Río Negro',
    'entre rios': 'Entre Ríos',
    'santa fe': 'Santa Fe',
    'san luis': 'San Luis',
    'san juan': 'San Juan',
    'la pampa': 'La Pampa',
    'la rioja': 'La Rioja',
    'tierra del fuego': 'Tierra del Fuego',
    'santiago del estero': 'Santiago del Estero',
  }
  return specialCases[normalized] ?? normalized.replace(/\b\w/g, c => c.toUpperCase())
}

// Arma el texto de `coverageLabel` para TERRITORIAL a partir del alcance real (no siempre nacional):
// 1 provincia → nombre puntual; 2-3 → listado corto; 4+ o "todas" → "Todo el país".
export function describeProvinceScope(provinces: string[]): string {
  const normalized = Array.from(new Set(provinces.map(normalizeProvince)))
  if (normalized.some(p => ['todas', 'all'].includes(p)) || normalized.length >= NATIONAL_COVERAGE_THRESHOLD) {
    return 'Todo el país'
  }
  if (normalized.length === 1) return displayProvinceName(normalized[0])
  return normalized.map(displayProvinceName).join(', ')
}
export interface PromoQueryParams {
  categorySlug?: string | null
  categorySlugs?: string[]
  day?: string | null
  forMe?: boolean
  bankIds?: string[]
  walletIds?: string[]
  networkIds?: string[]
  channels?: string[]
  capPeriods?: string[]
  hasCap?: string | null
  capMin?: number | null
  capMax?: number | null
  dateFromStr?: string | null
  dateToStr?: string | null
  dayIndices?: number[]
  view?: string | null
  discountRanges?: string[]
  hasInstallments?: string | null
  commerceIds?: string[]
  searchMode?: string | null
  province?: string | null
  guestProfileParam?: string | null
  /** Limita la cantidad de promos consultadas (usado para el preview SSR). */
  take?: number
  /** Activar paginación keyset (invitados sin filtros). */
  paginate?: boolean
  /** Página 1-based para paginación (default 1). */
  page?: number
  /** Cantidad de promos por página (default 500). */
  pageSize?: number
  /** DR-003/DR-004: usa el filtro grueso SQL (candidate selection) en vez de traer
   * el universo completo sin LIMIT. Solo tiene efecto cuando forMe=true y no hay
   * filtros manuales de banco/wallet/red/etc (esos casos siguen el camino viejo). */
  useCandidateQuery?: boolean
  /** Home v2 / Decision Engine (13/8/2026): fuerza el cálculo de `userBestDiscount`
   * (matching financiero real contra bancos/tarjetas/wallets del perfil) aunque
   * el usuario tenga rol ADMIN/MODERATOR. El bypass de perfil para admins existe
   * para el catálogo/backoffice (ven todas las promos sin relación con su propio
   * perfil) — pero la Home personalizada debe evaluarse siempre como experiencia
   * de usuario final, sin importar el rol. No cambia `isAdmin` en ningún otro
   * lugar de esta función (branches, filtro geográfico, etc. siguen igual). */
  forceProfileMatching?: boolean
}

export async function getPromosData(params: PromoQueryParams, email?: string | null, isAdmin?: boolean) {
  const __t0 = Date.now()
  const __PERF = process.env.PERF_DEBUG === '1'
  const __mark = (label: string) => { if (__PERF) console.log(`[perf] ${label}: ${Date.now() - __t0}ms`) }
  const {
    categorySlug = null,
    categorySlugs = [],
    day = null,
    forMe = false,
    bankIds,
    walletIds,
    networkIds,
    channels,
    capPeriods,
    hasCap = null,
    capMin = null,
    capMax = null,
    dateFromStr = null,
    dateToStr = null,
    dayIndices,
    view = null,
    discountRanges = [],
    hasInstallments = null,
    commerceIds,
    searchMode = 'startsWith',
    province: paramProvince = null,
    guestProfileParam = null,
    take,
    paginate = false,
    page = 1,
    pageSize = 500,
    useCandidateQuery = false,
    forceProfileMatching = false,
  } = params

  const perfStart = Date.now()
  const perf: Record<string, any> = {}

  const today = new Date()
  const startOfToday = new Date(today); startOfToday.setHours(0, 0, 0, 0)

  // RFC-002 Fase 1: la auto-expiración se eliminó de este read path público.
  // Vive exclusivamente en /api/internal/expire-promos (cron), que además
  // invalida la caché pública tras expirar promos — ver ese archivo.

  // Servidor corre en UTC (Vercel) — Argentina es UTC-3 fijo (sin horario de verano).
  // Sin este ajuste, getDay() adelanta el día ~3hs antes de tiempo (ej. jueves 21hs ARG
  // ya es viernes 00hs UTC, mostrando promos de "mañana" como si fueran de "hoy").
  // getUTCDay() (no getDay()) para que el resultado no dependa de la zona horaria del
  // SO donde corre Node — en Windows/localhost (ya UTC-3) .getDay() aplicaba un segundo
  // desplazamiento de -3hs sobre argNow, adelantando el día equivocado (bug 27/8/2026).
  const argNow = new Date(today.getTime() - 3 * 60 * 60 * 1000)

  // Default to today if no specific day filter is provided
  const defaultDayBit = 1 << argNow.getUTCDay()

  // Construct Prisma where clause
  const where: any = {
    status: 'ACTIVE',
    // Time validity: simplified
    validFrom: { lte: today },
    OR: [
      { validUntil: null },
      { validUntil: { gte: startOfToday } }
    ]
  }

  // Filtro por provincia: usuario logueado con addressState, o guest con param ?province=
  let userProvince: string | null = null
  let fetchedUser: any = null

  if (email) {
    // Una sola query: traemos provincia + perfil completo de una vez (evita doble hit a DB)
    const userObj = await prisma.user.findUnique({
      where: { email },
      select: {
        addressState: true,
        financialProfile: { include: { banks: true, wallets: true, cards: true } },
        savedPromos: { select: { promoId: true } },
      }
    })
    userProvince = paramProvince || userObj?.addressState || null
    // Pre-asignar si forMe (evita segunda query más adelante)
    if (forMe && userObj?.financialProfile) {
      fetchedUser = userObj as any
    }
  } else {
    userProvince = paramProvince
  }
  __mark('after initial user fetch')

  if (userProvince) {
    where.AND = [
      {
        OR: [
          { provinces: { hasSome: ['Todas', 'TODAS', userProvince] } },
          { provinces: { isEmpty: true } }
        ]
      }
    ]
  }

  if (categorySlugs.length > 0) {
    where.category = { slug: { in: categorySlugs, not: 'sin-categoria' } }
  } else if (categorySlug && categorySlug !== 'todos') {
    where.category = { slug: categorySlug }
  }

  if (commerceIds?.length) {
    // Resolvemos los nombres candidatos en JS (normalizando acentos en ambos lados)
    // en vez de usar `contains`/`startsWith` de Prisma, que en Postgres solo ignora
    // mayúsculas y no diacríticos (ej. "cafe" no matchea "Café Martínez").
    const candidates = await prisma.commerce.findMany({ select: { id: true, name: true } })
    const matchedIds = new Set<string>()
    for (const term of commerceIds) {
      const normTerm = normalizeAccents(term)
      for (const c of candidates) {
        const normName = normalizeAccents(c.name)
        const isMatch =
          searchMode === 'exact'    ? normName === normTerm :
          searchMode === 'contains' ? normName.includes(normTerm) :
                                       normName.startsWith(normTerm)
        if (isMatch) matchedIds.add(c.id)
      }
    }
    where.commerce = { id: { in: Array.from(matchedIds) } }
  }

  if (dateFromStr) where.validFrom = { ...where.validFrom, gte: new Date(dateFromStr) }
  if (dateToStr) where.validUntil = { ...where.validUntil, lte: new Date(dateToStr) }

  // Requirements based filters (nested)
  const reqFilter: any = {}
  if (bankIds?.length) reqFilter.bankId = { in: bankIds }
  if (walletIds?.length) reqFilter.walletId = { in: walletIds }
  if (networkIds?.length) reqFilter.cardNetworkId = { in: networkIds }
  if (channels?.length) reqFilter.paymentChannel = { in: channels }
  if (capPeriods?.length) reqFilter.capPeriod = { in: capPeriods }

  if (hasCap === 'true') reqFilter.cap = { not: null }
  if (hasCap === 'false') reqFilter.cap = null

  if (capMin !== null || capMax !== null) {
    reqFilter.cap = { ...reqFilter.cap, gte: capMin ?? undefined, lte: capMax ?? undefined }
  }

  if (Object.keys(reqFilter).length > 0) {
    where.requirements = { some: reqFilter }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRE-FILTRO SQL POR PERFIL FINANCIERO (RFC useCandidateQuery, aprobado por
  // CPO 25/8/2026 — automático, sin flag). Se resuelve el perfil ACÁ, antes
  // del findMany, para poder acotar `where.requirements` a nivel DB en vez de
  // traer todo el pool ACTIVE y filtrar en JS después (el costo real de la
  // latencia de forMe=true — ver RFC en ColabClaudeGemini/). Duplica parte
  // del cálculo de más abajo (línea ~600, effectiveCards/userProfile) porque
  // ese bloque también alimenta el filtro geográfico/dedup por tier que corre
  // sobre `filtered` — no se elimina, solo se adelanta lo mínimo necesario.
  // ═══════════════════════════════════════════════════════════════════════
  let candidateFetchedUser: any = fetchedUser
  let candidateUserProfile: any = null
  if (forMe && email) {
    if (!candidateFetchedUser) {
      candidateFetchedUser = await prisma.user.findUnique({
        where: { email },
        select: {
          addressState: true,
          financialProfile: { include: { banks: true, wallets: true, cards: true } },
          savedPromos: { select: { promoId: true } },
        }
      })
      fetchedUser = candidateFetchedUser
    }
    candidateUserProfile = candidateFetchedUser?.financialProfile || null
  }
  let candidateGuestCards: any[] | null = null
  if (guestProfileParam) {
    try {
      const decoded = JSON.parse(Buffer.from(guestProfileParam, 'base64').toString('utf-8'))
      if (Array.isArray(decoded?.cards)) candidateGuestCards = decoded.cards
    } catch {}
  }
  const candidateEffectiveCards: any[] | null =
    candidateUserProfile?.cards ?? (candidateGuestCards && forMe ? candidateGuestCards : null)

  // Guardrail OOM (cpo-a-cto-aprobacion-rfc-guardrail-oom-y-autorizacion-spike-25-8-2026.md,
  // Opción C): forMe=true sin ninguna tarjeta efectiva (perfil inexistente o
  // vacío) no debe caer en el findMany sin narrowing SQL — ese camino no tiene
  // `take` cuando `paginate=false` (cualquier usuario logueado) y puede traer
  // miles de filas con requirements anidados a memoria. En vez de intentar
  // filtrar por perfil (no hay con qué), se corta el corte temprano: se ignora
  // `forMe` para efectos de la query y se responde con el mismo criterio que un
  // invitado (destacadas/populares), marcando `profileIncomplete: true` para
  // que el frontend muestre el aviso UX-3 sin bloquear la Home.
  const profileIncomplete = forMe && !candidateEffectiveCards?.length

  // Precondición (RFC 3.1): solo se activa con forMe=true + al menos 1 tarjeta
  // efectiva. Sin esto, el código sigue exactamente como hoy — cero riesgo de
  // regresión para invitados, admins sin forceProfileMatching, o usuarios sin
  // perfil cargado.
  if (forMe && candidateEffectiveCards?.length) {
    // Un `OR` por cada tarjeta efectiva: matchea un requirement si su
    // bankId/walletId/cardNetworkId son null (sin restricción en ese campo) O
    // coinciden con la tarjeta. Replica la semántica de matchesProfile.ts
    // (lib/matchesProfile.ts) para bankId/walletId/cardNetworkId — cardSegmentId
    // y cardTier quedan fuera (se resuelven en JS más abajo, sin cambios).
    // No se agrega una rama fija para requirements "sin entidad financiera"
    // (los 3 campos null): matchesProfile.ts REGLA 1 los excluye explícitamente
    // cuando hay perfil activo, así que esa rama solo agregaría candidatos que
    // el paso JS descarta igual — sería una rama sin beneficio real.
    const cardOrBranches = candidateEffectiveCards.map((c: any) => ({
      AND: [
        { OR: [{ bankId: null }, { bankId: c.bankId ?? undefined }] },
        { OR: [{ walletId: null }, { walletId: c.walletId ?? undefined }] },
        { OR: [{ cardNetworkId: null }, { cardNetworkId: c.cardNetworkId ?? undefined }] },
      ],
    }))
    const profileReqFilter = { OR: cardOrBranches }
    const narrowedByProfile = Object.keys(reqFilter).length > 0
      ? { requirements: { some: { AND: [reqFilter, profileReqFilter] } } }
      : { requirements: { some: profileReqFilter } }

    // Las promos guardadas (favoritos) siempre deben mostrarse aunque su
    // requirement no matchee el perfil (ver "savedSet.has" más abajo,
    // reliability fix 21/8/2026) — el pre-filtro SQL no puede excluirlas, así
    // que se les da un OR a nivel de promo, por fuera del filtro por requirements.
    const savedPromoIds = (candidateFetchedUser?.savedPromos ?? []).map((sp: any) => sp.promoId)
    where.AND = [
      ...(where.AND ?? []),
      savedPromoIds.length
        ? { OR: [narrowedByProfile, { id: { in: savedPromoIds } }] }
        : narrowedByProfile,
    ]
  }

  const paginateOrderBy = paginate
    ? [
        { isCSIOnly: 'asc' as const },
        { maxDiscountPct: { sort: 'desc' as const, nulls: 'last' as const } },
        { id: 'asc' as const },
      ]
    : undefined

  // RFC-002 Fase 1 (+ ampliación provincia + ADR-001): la rama pública (invitado
  // sin filtros, CON o sin provincia, siempre que no haya perfil real detrás) va
  // por una función cacheada (10 min TTL + invalidación por tag). `province` es
  // parte de la clave de cache — cada provincia cachea su propia página, con el
  // filtro grueso por `provinces[]` ya resuelto en SQL dentro de la función. El
  // filtro fino ADR-001 (salesChannel/geographicScope/locationModel/branches) se
  // aplica después, en el bloque más abajo, sobre este resultado ya cacheado —
  // igual que sobre el camino no-cacheado. `paginate` (route.ts) ya excluye
  // forMe/email/filtros; acá además hace falta excluir el guest profile (perfil
  // temporal sin cuenta) para no cachear una vista personalizada por error.
  const isPublicCacheableView = paginate && !guestProfileParam
  __mark('before findMany')

  // Fix mismo bug ya resuelto para invitados (ver comentario línea ~87): en el
  // camino no paginado (cualquier usuario logueado, o invitado con filtros),
  // `take: HARD_CAP_TAKE` se aplicaba ANTES del filtro de `validDays` (línea
  // ~611, en JS), recortando por `createdAt desc` y dejando afuera a la
  // mayoría de las promos válidas hoy que no estaban entre las 200 más
  // recientemente creadas (bug: usuario logueado veía ~88 promos en vez de
  // miles, ej. categoría "Supermercados" con 1 sola promo). Se acota `where`
  // a los IDs válidos hoy en SQL (bitmask), igual que getPublicPromosPage,
  // antes de aplicar el `take`. `view === 'week'` no filtra por día, igual
  // que el camino público.
  if (!isPublicCacheableView && view !== 'week') {
    const dayBitForFilter = dayIndices?.length
      ? dayIndices.reduce((mask, d) => mask | (1 << d), 0)
      : day !== null ? (1 << parseInt(day)) : defaultDayBit
    const validTodayIds = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "promos"
      WHERE status = 'ACTIVE'
        AND "validFrom" <= now()
        AND ("validUntil" IS NULL OR "validUntil" >= date_trunc('day', now()))
        AND ("validDays" & ${dayBitForFilter}) != 0
    `
    where.AND = [
      ...(where.AND ?? []),
      { id: { in: validTodayIds.map(r => r.id) } },
    ]
  }

  // DR-003/DR-004: candidate selection solo cuando forMe=true, sin filtros manuales
  // de requirements (bankIds/walletIds/etc — esos ya tienen su propio camino vía
  // reqFilter) y sin paginate (paginate ya usa el camino cacheado de arriba).
  const useCandidates = useCandidateQuery && forMe && !isPublicCacheableView && Object.keys(reqFilter).length === 0

  type CandidatePerf = { queryMs: number; rows: number; hitLimit: boolean }
  const candidatePerfBox: { value: CandidatePerf | null } = { value: null }

  // DR-004 (Alternativa 2): si vamos a usar candidate selection, necesitamos
  // bankIds/walletIds/savedPromoIds del perfil ANTES de armar la query candidata
  // (el filtro fino de perfil, más abajo, sigue calculando lo mismo de nuevo con
  // fetchedUser ya cacheado — no se duplica el fetch a DB, solo se adelanta la
  // extracción de IDs que ya viven en el objeto).
  let candidateUserBankIds: string[] = []
  let candidateUserWalletIds: string[] = []
  let candidateSavedPromoIds: string[] = []
  if (useCandidates) {
    if (email && !fetchedUser) {
      fetchedUser = await prisma.user.findUnique({
        where: { email },
        select: {
          addressState: true,
          financialProfile: { include: { banks: true, wallets: true, cards: true } },
          savedPromos: { select: { promoId: true } },
        }
      }) as any
    }
    const profileForCandidates = (fetchedUser as any)?.financialProfile || null
    let guestCardsForCandidates: any[] | null = null
    if (!profileForCandidates && guestProfileParam) {
      try {
        const decoded = JSON.parse(Buffer.from(guestProfileParam, 'base64').toString('utf-8'))
        if (Array.isArray(decoded?.cards)) guestCardsForCandidates = decoded.cards
      } catch {}
    }
    const cardsForCandidates: any[] = profileForCandidates?.cards ?? guestCardsForCandidates ?? []
    candidateUserBankIds = Array.from(new Set(
      [...cardsForCandidates, ...(profileForCandidates?.banks ?? [])]
        .map((c: any) => c.bankId)
        .filter((id: any): id is string => !!id)
    ))
    candidateUserWalletIds = Array.from(new Set(
      [...cardsForCandidates, ...(profileForCandidates?.wallets ?? [])]
        .map((c: any) => c.walletId)
        .filter((id: any): id is string => !!id)
    ))
    candidateSavedPromoIds = fetchedUser ? (fetchedUser as any).savedPromos.map((sp: any) => sp.promoId) : []
  }

  const [promos, totalCount] = isPublicCacheableView
    ? await getPublicPromosPage(page, pageSize, view ?? 'today', defaultDayBit, userProvince)
    : useCandidates
    ? await (async () => {
        // view='week' (caso de Recommendation Block) no filtra por día en SQL —
        // el bitmask se re-aplica igual más abajo (líneas ~459-468) sobre el
        // resultado, sin cambios respecto al camino viejo.
        const dayBitForQuery = view === 'week' ? null : defaultDayBit
        const candidates = await getCandidatePromosForProfile({
          dayBit: dayBitForQuery,
          province: userProvince,
          userBankIds: candidateUserBankIds,
          userWalletIds: candidateUserWalletIds,
          savedPromoIds: candidateSavedPromoIds,
          categorySlugs,
          // CPO Directiva "Vidriera guest permisiva, no restrictiva" (31/8/2026):
          // sin esto, un guest (profileIncomplete=true, candidateUserBankIds/
          // WalletIds vacíos) solo pasaba promos sin NINGUNA restricción de
          // banco/wallet — universo demasiado angosto para la vidriera de
          // variedad que pide Home v2 guest. Ver GUEST_FEATURED_BANK_IDS arriba.
          guestPermissive: profileIncomplete,
        })
        candidatePerfBox.value = { queryMs: candidates.queryMs, rows: candidates.ids.length, hitLimit: candidates.hitLimit }
        if (!candidates.ids.length) return [[], 0] as const
        const hydrationT0 = Date.now()
        const rows = await prisma.promo.findMany({
          where: {
            id: { in: candidates.ids },
            // Defensa en profundidad: aunque el SQL de candidatas ya filtra por
            // categorySlugs, repetir acá evita hidratar de más si esa query
            // cambia en el futuro y alguien olvida propagar el filtro.
            ...(categorySlugs.length > 0 ? { category: { slug: { in: categorySlugs, not: 'sin-categoria' } } } : {}),
          },
          include: {
            category: { select: { name: true, slug: true, icon: true, color: true } },
            commerce: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                instagramUrl: true,
                activePromoCount: true,
                locationModel: true,
                ...(userProvince && !isAdmin ? { branches: { select: { province: true }, where: { province: { not: null } } } } : {}),
              },
            },
            requirements: {
              include: {
                bank: { select: { id: true, name: true, slug: true, logoUrl: true } },
                wallet: { select: { id: true, name: true, slug: true, logoUrl: true } },
                cardNetwork: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        })
        // Prisma no garantiza el orden del `where: {id: {in}}` — reordenar según
        // el ORDER BY ya resuelto por la query de candidatas (mismo orden que
        // usaría el camino viejo antes del sort final más abajo).
        const orderIndex = new Map(candidates.ids.map((id, i) => [id, i]))
        rows.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))
        if (candidatePerfBox.value) (candidatePerfBox.value as any).hydrationMs = Date.now() - hydrationT0
        return [rows, rows.length] as const
      })()
    : await Promise.all([
        prisma.promo.findMany({
          where,
          select: {
            // Payload angostado (RFC perf-payload-and-sort, 25/8/2026): se sacan
            // `description`/`sourceText`/`sourceUrl`/`commerceNote`/`stackable*`/
            // `uniqueUsePerPeriod`/`maxUsesPerPeriod`/`validFromHour`/`validToHour`
            // — ninguno se lee en PromosClient.tsx ni en el cálculo de coverageStatus/
            // globalMaxDiscount/userBestDiscount más abajo en este archivo. La página
            // de detalle (/promos/[slug]) usa su propio `findUnique` con todos los
            // campos, así que esto no afecta esa vista.
            id: true,
            slug: true,
            title: true,
            validDays: true,
            validDaysNote: true,
            specificDates: true,
            salesChannel: true,
            geographicScope: true,
            provinces: true,
            validFrom: true,
            validUntil: true,
            categoryId: true,
            commerceId: true,
            isFeatured: true,
            // stackable vuelve a traerse (revierte parcialmente el narrowing de
            // 25/8/2026): /api/precios/bank-promos lo necesita para saber si LA PROMO
            // GANADORA concreta acumula con descuentos de góndola — Commerce.stacksWithBankPromos
            // es un solo valor por comercio y no alcanza cuando conviven promos que sí
            // acumulan (ej. MODO jueves en Jumbo) y promos que no (ej. reintegro $100.000
            // en Jumbo, texto legal "NO ACUMULABLE CON OTRAS PROMOCIONES") (bug 3/9/2026).
            stackable: true,
            category: { select: { name: true, slug: true, icon: true, color: true } },
            commerce: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                instagramUrl: true,
                activePromoCount: true,
                locationModel: true,
                ...(userProvince && !isAdmin ? { branches: { select: { province: true }, where: { province: { not: null } } } } : {}),
              },
            },
            requirements: {
              include: {
                bank: { select: { id: true, name: true, slug: true, logoUrl: true } },
                wallet: { select: { id: true, name: true, slug: true, logoUrl: true } },
                cardNetwork: { select: { id: true, name: true, slug: true } },
              },
            },
          },
          // Antes del fix de narrowing por `validDays` (ver más arriba), este
          // camino ordenaba por `createdAt desc` — dentro del universo ya
          // acotado a "válidas hoy" seguía sesgando el `take: HARD_CAP_TAKE`
          // hacia las promos más recientemente creadas, dejando afuera
          // categorías con pocas altas recientes (ej. Supermercados). Se usa
          // el mismo criterio de relevancia que ya tenía el camino público
          // (isCSIOnly asc, maxDiscountPct desc, id asc) para que el cap
          // recorte por mejor descuento, no por fecha de alta.
          orderBy: paginateOrderBy ?? (take
            ? [{ isFeatured: 'desc' }, { createdAt: 'desc' }]
            : [{ isCSIOnly: 'asc' as const }, { maxDiscountPct: { sort: 'desc' as const, nulls: 'last' as const } }, { id: 'asc' as const }]),
          // Hard cap defensivo (guardrail OOM, Opción C, 25/8/2026): pensado
          // para el caso "forMe=true sin narrowing real" (profileIncomplete
          // ya cubre perfil vacío) — pero se aplicaba incondicionalmente a
          // TODO camino no paginado, incluyendo usuarios con perfil real ya
          // acotado por SQL (matching de perfil + validDays, ver bloque
          // "PRE-FILTRO SQL POR PERFIL FINANCIERO" más arriba), donde el
          // universo real (ej. 3765 filas) es manejable y el cap de 200
          // truncaba resultados legítimos sin necesidad (bug reportado:
          // usuario logueado veía 96-104 promos de un total real de 3765,
          // categorías enteras casi vacías). Con narrowing real por perfil ya
          // aplicado, se usa un cap más generoso (HARD_CAP_TAKE_NARROWED).
          //
          // Segundo bug relacionado (27/8/2026): un usuario LOGUEADO en modo
          // "Todas" (forMe=false, toggle "Todas/Para Mí") también caía acá con
          // el cap de 200 — `paginate` (route.ts) excluye cualquier request
          // con `email`, así que nunca usa el `pageSize` (1500+) que sí recibe
          // un invitado viendo el mismo catálogo sin perfil. No hay riesgo de
          // OOM distinto al de un invitado (mismo `where`, sin narrowing por
          // perfil en ningún caso) — se lo trata igual: cap generoso en vez
          // del cap de 200. Solo se mantiene el cap de 200 para el caso con
          // riesgo real de `where` amplio sin ningún narrowing conocido: sin
          // sesión Y sin perfil de invitado (guest_profile).
          ...(paginate
            ? { take: pageSize, skip: (page - 1) * pageSize }
            : { take: take ?? ((forMe && candidateEffectiveCards?.length) || email ? HARD_CAP_TAKE_NARROWED : HARD_CAP_TAKE) }),
        }),
        // Usar count cacheado para invitados sin filtros (evita full scan en cada request)
        paginate ? getActiveTotalCount() : prisma.promo.count({ where }),
      ])
  __mark(`after findMany (promos=${promos.length}, totalCount=${totalCount})`)

  if (candidatePerfBox.value) {
    perf.candidateQueryMs = candidatePerfBox.value.queryMs
    perf.candidateRows = candidatePerfBox.value.rows
    perf.candidateHitLimit = candidatePerfBox.value.hitLimit
    perf.hydrationMs = (candidatePerfBox.value as any).hydrationMs
  }
  perf.fetchMs = Date.now() - perfStart

  // Day bitmask filtering
  let filtered = promos
  if (dayIndices?.length) {
    const bitmask = dayIndices.reduce((mask, d) => mask | (1 << d), 0)
    filtered = filtered.filter(p => (p.validDays & bitmask) !== 0)
  } else if (day !== null) {
    const dayBit = 1 << parseInt(day)
    filtered = filtered.filter(p => (p.validDays & dayBit) !== 0)
  } else if (view !== 'week') {
    // DEFAULT: Filter by today unless view is 'week'
    filtered = filtered.filter(p => (p.validDays & defaultDayBit) !== 0)
  }
  __mark(`after day bitmask filter (filtered=${filtered.length})`)

  // Filtrar promos con specificDates — mostrar solo si HOY está en las fechas
  const todayStr = today.toISOString().split('T')[0]
  filtered = filtered.filter(p => {
    if (!p.specificDates) return true
    try {
      const dates: string[] = JSON.parse(p.specificDates)
      if (!dates.length) return true
      if (view === 'week') {
        // En modo semana: mostrar si alguna fecha futura existe
        return dates.some(d => d >= todayStr)
      }
      // En modo hoy: mostrar solo si HOY está en las fechas
      return dates.includes(todayStr)
    } catch {
      return true
    }
  })


  // ── Filtro geográfico (ADR-001) ───────────────────────────────────────────────────────
  // El filtro arranca por la promo (salesChannel + geographicScope), no por las sucursales.
  // Admins ven todo sin filtro geográfico (y no reciben coverageStatus: no los necesitan).
  //
  // De paso, se calcula `coverageStatus` — una clasificación liviana de 4 valores que la UI
  // de Explorar usa para mostrar un badge, en vez de mandar el array de `branches` al cliente
  // (más pesado) o re-implementar esta misma cascada de reglas en React:
  //   'NEARBY'      → hay sucursal confirmada en la provincia del usuario
  //   'TERRITORIAL' → cobertura provincial/regional/nacional explícita o inferida (4+ provincias)
  //   'ONLINE'      → sin dependencia de ubicación física (online, servicio móvil, etc.)
  //   'UNKNOWN'     → sin datos suficientes para clasificar (pass-through, no es un rechazo)
  //
  // `coverageLabel` acompaña a TERRITORIAL con el alcance real (no siempre es "todo el país" —
  // puede ser una provincia puntual, varias, o inferido de branches) para que el badge de la UI
  // nunca generalice de más (el mismo error conceptual que ADR-001 vino a resolver).
  if (userProvince && !isAdmin) {
    const userProvinceNorm = normalizeProvince(userProvince)
    filtered = filtered.filter(promo => {
      const salesChannel   = (promo as any).salesChannel   ?? 'UNKNOWN'
      const geographicScope = (promo as any).geographicScope ?? 'UNKNOWN'
      const locationModel  = (promo as any).commerce?.locationModel ?? 'UNKNOWN'

      // 1. Promos sin dependencia física → no evaluar proximidad
      if (salesChannel === 'ONLINE') {
        // Sin restricción territorial → siempre visible
        if (geographicScope === 'NO_GEOGRAPHIC_RESTRICTION' || geographicScope === 'NATIONWIDE') {
          ;(promo as any).coverageStatus = 'ONLINE'
          return true
        }
        // Con restricción por provincia → respetar provinces[]
        if (geographicScope === 'PROVINCES') {
          const ps = (promo as any).provinces as string[]
          if (!ps?.length) { ;(promo as any).coverageStatus = 'UNKNOWN'; return true }
          const matches = ps.some(p => normalizeProvince(p) === userProvinceNorm || ['todas', 'all'].includes(normalizeProvince(p)))
          if (matches) (promo as any).coverageStatus = 'ONLINE'
          return matches
        }
        // UNKNOWN online → pass-through (safe default, sin badge de cercanía)
        ;(promo as any).coverageStatus = 'ONLINE'
        return true
      }

      // 2. Servicios móviles y sin ubicación fija → no filtrar por branches
      if (locationModel === 'MOBILE_SERVICE' || locationModel === 'NO_FIXED_LOCATION') {
        ;(promo as any).coverageStatus = 'ONLINE'
        return true
      }

      // 3. Alcance nacional explícito → aplicabilidad territorial OK
      //    (no implica cercanía — 'NEARBY' solo se asigna con sucursal real en la provincia)
      if (geographicScope === 'NATIONWIDE') {
        ;(promo as any).coverageStatus = 'TERRITORIAL'
        ;(promo as any).coverageLabel = 'Todo el país'
        return true
      }

      // 4. Restricción por provincias explícita → respetar provinces[]
      if (geographicScope === 'PROVINCES') {
        const ps = (promo as any).provinces as string[]
        if (!ps?.length) { ;(promo as any).coverageStatus = 'UNKNOWN'; return true }
        const matches = ps.some(p => normalizeProvince(p) === userProvinceNorm || ['todas', 'all'].includes(normalizeProvince(p)))
        if (matches) {
          (promo as any).coverageStatus = 'TERRITORIAL'
          ;(promo as any).coverageLabel = describeProvinceScope(ps)
        }
        return matches
      }

      // 5. Basada en sucursales (BRANCHES) o UNKNOWN → evaluar branches en DB
      const branches = (promo as any).commerce?.branches as { province: string | null }[] | undefined
      if (!branches?.length) { ;(promo as any).coverageStatus = 'UNKNOWN'; return true }  // sin datos = deuda de información, pass-through

      const branchProvinces = new Set(branches.map(b => normalizeProvince(b.province as string)))

      // Compatibilidad temporal: comercio UNKNOWN con 4+ provincias → cobertura nacional inferida
      if (locationModel === 'UNKNOWN' && branchProvinces.size >= NATIONAL_COVERAGE_THRESHOLD) {
        ;(promo as any).coverageStatus = 'TERRITORIAL'
        ;(promo as any).coverageLabel = describeProvinceScope(Array.from(branchProvinces))
        return true
      }

      const hasNearbyBranch = branchProvinces.has(userProvinceNorm)
      if (hasNearbyBranch) (promo as any).coverageStatus = 'NEARBY'
      return hasNearbyBranch
    })
  }
  // Ya no se necesita `branches` en la respuesta — coverageStatus ya quedó calculado arriba.
  for (const p of filtered) {
    if ((p as any).commerce) delete (p as any).commerce.branches
  }
  __mark(`after geo filter (filtered=${filtered.length})`)

  // ═══════════════════════════════════════════════════════════════════════
  // FILTRADO POR PERFIL FINANCIERO
  // Admins también filtran por perfil cuando piden "Para mí" — el bypass
  // geográfico ya está arriba. La vista "Todas" no manda forMe=true.
  // ═══════════════════════════════════════════════════════════════════════
  // userProfile/guestCards ya se resolvieron arriba (candidateUserProfile/
  // candidateGuestCards, bloque del pre-filtro SQL por perfil) — se reutilizan
  // acá para no repetir el decode de guestProfileParam ni la query de usuario.
  const userProfile = candidateUserProfile

  // Mapa cardTier → segmentId: para matchear tiers (Selecta, Eminent) con segmentos del perfil
  const tierToSegmentId = new Map<string, string>()
  if (forMe && email && userProfile) {
    const allSegments = await prisma.bankSegment.findMany({ select: { id: true, name: true } })
    for (const seg of allSegments) {
      tierToSegmentId.set(seg.name.toUpperCase(), seg.id)
    }
  }

  // Usar guest profile si no hay usuario logueado con perfil en DB
  const effectiveCards = candidateEffectiveCards

  // Tarjetas virtuales desde UserWallet — excluye MODO porque toda promo MODO
  // requiere un banco asociado; MODO sin banco no existe en la práctica.
  // MODO matchea solo via cards reales (bankId + walletId=MODO).
  const MODO_WALLET_ID = 'cmnulzh04000aqlkk8mnpzo46'
  const walletVirtualCards = (userProfile?.wallets ?? [])
    .filter((w: any) => w.walletId !== MODO_WALLET_ID)
    .map((w: any) => ({
      walletId: w.walletId, bankId: null, cardNetworkId: null,
      cardType: 'ACCOUNT', cardSegmentId: null, segmentId: null,
      cardTier: null, isPayroll: false, isPensioner: false,
    }))

  const hasProfile = forMe && !!(effectiveCards || walletVirtualCards.length > 0)

  if (hasProfile) {
    const userCards = [...(effectiveCards ?? []), ...walletVirtualCards]
    const savedSet = new Set(fetchedUser ? (fetchedUser as any).savedPromos.map((sp: any) => sp.promoId) : [])

    // Función estricta de matching: verifica que el perfil del usuario
    // satisface los criterios del requirement. Implementación real vive en
    // lib/matchesProfile.ts (fuente de verdad única, ver comentario ahí).
    const matchesProfile = (req: any): boolean => matchesProfileShared(req, userCards, tierToSegmentId)

    // Financial Match Index (Variante B, ver financial-match-index.md): si ya
    // hay filas indexadas para la firma de este perfil, usarlas en vez de
    // recalcular matchesProfile() contra cada requirement. Si la firma no
    // está indexada todavía (perfil nuevo o índice no poblado), cae al
    // matching en memoria de siempre — el índice nunca es punto único de falla.
    const profileSignature = buildProfileSignature(userCards)
    const indexedPromoIds = await prisma.financialMatchIndex.findMany({
      where: { profileHash: profileSignature },
      select: { promoId: true },
    })
    const indexedSet = indexedPromoIds.length ? new Set(indexedPromoIds.map(r => r.promoId)) : null

    const profileMatchStart = Date.now()
    filtered = filtered.filter(promo => {
      // Las promos guardadas siempre se muestran (favoritos del usuario)
      if (savedSet.has(promo.id)) return true

      // Sin requirements → datos incompletos del scraper, NO mostrar en "Mis promos"
      if (!promo.requirements.length) return false

      if (indexedSet) return indexedSet.has(promo.id)

      // La promo aplica si AL MENOS UN requirement coincide con el perfil
      return promo.requirements.some(req => matchesProfile(req))
    })
    perf.profileMatchMs = Date.now() - profileMatchStart
    perf.matchedRows = filtered.length
  }
  __mark(`after profile matching filter (filtered=${filtered.length})`)

  // ── Alerta Inteligente de Oportunidad (RFC dictamen CPO 24/8/2026) ─────────
  // En modo "Hoy" (view !== 'week', sin day/dayIndices explícito), para cada
  // comercio que ya quedó en `filtered`, se adjuntan sus promos activas de
  // otros días de la semana que matcheen el perfil del usuario — sin alterar
  // `filtered` (no cambia el conteo de "promos hoy" ni el modo Semana). El
  // frontend (CommerceGroupCard) decide si dispara el aviso comparando %.
  const isDefaultTodayView = view !== 'week' && !dayIndices?.length && day === null
  if (isDefaultTodayView && filtered.length) {
    const commerceIds = Array.from(new Set(filtered.map(p => (p as any).commerceId).filter(Boolean)))
    if (commerceIds.length) {
      const otherDayWhere: any = {
        status: 'ACTIVE',
        commerceId: { in: commerceIds },
        validFrom: { lte: today },
        OR: [
          { validUntil: null },
          { validUntil: { gte: startOfToday } },
        ],
      }
      const otherDayCandidates = await prisma.promo.findMany({
        where: otherDayWhere,
        select: {
          id: true,
          commerceId: true,
          validDays: true,
          requirements: {
            include: {
              bank: { select: { id: true, name: true, slug: true, logoUrl: true } },
              wallet: { select: { id: true, name: true, slug: true, logoUrl: true } },
              cardNetwork: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      })

      const uCards = [...(effectiveCards ?? []), ...walletVirtualCards]
      const byCommerce = new Map<string, any[]>()
      for (const cand of otherDayCandidates) {
        // Ya válida hoy → no es "otro día", el usuario ya la ve en la lista principal.
        if ((cand.validDays & defaultDayBit) !== 0) continue
        // Con perfil activo, solo adjuntar promos que matcheen — sin perfil, no hay
        // base para comparar "mejor descuento para vos", se omite el cálculo.
        if (hasProfile) {
          const matches = cand.requirements.some((req: any) => matchesProfileShared(req, uCards, tierToSegmentId))
          if (!matches) continue
        } else {
          continue
        }
        const list = byCommerce.get(cand.commerceId!) ?? []
        list.push(cand)
        byCommerce.set(cand.commerceId!, list)
      }

      if (byCommerce.size) {
        for (const p of filtered as any[]) {
          const candidates = byCommerce.get(p.commerceId)
          if (!candidates?.length) continue
          p.otherDayPromos = candidates.map((c: any) => {
            const bestReq = c.requirements.reduce((max: any, r: any) => (r.discountValue ?? 0) > (max?.discountValue ?? 0) ? r : max, c.requirements[0])
            return {
              id: c.id,
              validDays: c.validDays,
              bestDiscountValue: bestReq?.discountValue ?? 0,
              bestDiscountType: bestReq?.discountType ?? null,
              bankName: bestReq?.bank?.name ?? null,
              walletName: bestReq?.wallet?.name ?? null,
            }
          })
        }
      }
    }
  }

  // ── Filtro rango de descuento ─────────────────────────────────────────
  if (discountRanges.length > 0) {
    filtered = filtered.filter(promo => {
      const maxVal = promo.requirements.reduce((max, r) => {
        if (r.discountType === 'CUOTAS_SIN_INTERES' || r.discountType === 'NXM') return max
        return Math.max(max, r.discountValue ?? 0)
      }, 0)
      return discountRanges.some((range: string) => {
        if (range === '0-10')  return maxVal > 0 && maxVal <= 10
        if (range === '10-20') return maxVal > 10 && maxVal <= 20
        if (range === '20-30') return maxVal > 20 && maxVal <= 30
        if (range === '30+')   return maxVal > 30
        return false
      })
    })
  }

  // ── Filtro cuotas sin interés ─────────────────────────────────────────
  if (hasInstallments === 'true') {
    filtered = filtered.filter(promo =>
      promo.requirements.some(r => r.discountType === 'CUOTAS_SIN_INTERES')
    )
  } else if (hasInstallments === 'false') {
    filtered = filtered.filter(promo =>
      promo.requirements.every(r => r.discountType !== 'CUOTAS_SIN_INTERES')
    )
  }

  // ─── Uso de promos (tope consumido) — solo con perfil activo ──────────────
  // Se carga el uso del período vigente por requirement, para pintar el badge
  // "Promo utilizada" sin que el cliente tenga que pedirlo aparte.
  const usageByRequirementId = new Map<string, { amountUsed: number; periodEnd: Date }>()
  if (forMe && email && filtered.length) {
    const userForUsage = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (userForUsage) {
      const reqIds = [...new Set(filtered.flatMap(p => (p as any).requirements?.map((r: any) => r.id) ?? []))]
      if (reqIds.length) {
        // Postgres limita a ~32767 bind variables por prepared statement. Con pools
        // grandes de promos (ej. filtrado por ubicación) reqIds puede superarlo y
        // Prisma tira P2035. Se trocea en lotes muy por debajo del límite.
        const REQ_IDS_CHUNK_SIZE = 5000
        const chunks: string[][] = []
        for (let i = 0; i < reqIds.length; i += REQ_IDS_CHUNK_SIZE) {
          chunks.push(reqIds.slice(i, i + REQ_IDS_CHUNK_SIZE))
        }
        const usageChunks = await Promise.all(
          chunks.map(chunk =>
            prisma.promoUsage.findMany({
              where: {
                userId: userForUsage.id,
                requirementId: { in: chunk },
                periodEnd: { gte: new Date() },
              },
            })
          )
        )
        for (const usages of usageChunks) {
          for (const u of usages) {
            usageByRequirementId.set(u.requirementId, { amountUsed: u.amountUsed, periodEnd: u.periodEnd })
          }
        }
      }
    }
  }

  // ─── Enriquecimiento final de promos ──────────────────────────────────────
  const finalSavedSet = new Set(fetchedUser ? (fetchedUser as any).savedPromos.map((sp: any) => sp.promoId) : [])
  const finalPromos = filtered.map(p => {
    if (usageByRequirementId.size) {
      (p as any).requirements = (p as any).requirements.map((r: any) => {
        const usage = usageByRequirementId.get(r.id)
        if (!usage || r.cap == null) return r
        return {
          ...r,
          usage: {
            amountUsed: usage.amountUsed,
            cap: r.cap,
            exhausted: usage.amountUsed >= r.cap,
            periodEnd: usage.periodEnd,
          },
        }
      })
    }
    const allReqs = p.requirements ?? []
    const globalMaxDiscount = allReqs.length > 0 ? allReqs.reduce((max, r) => (r.discountValue ?? 0) > (max?.discountValue ?? 0) ? r : max, allReqs[0]) : null

    let userBestDiscount = null
    let matchingEntityNames: string[] = []
    if (!isAdmin || forceProfileMatching) {
      const uCards = [...(effectiveCards ?? []), ...walletVirtualCards]
      // Reutiliza lib/matchesProfile.ts (fuente de verdad única) para calcular
      // el mejor descuento — antes esto reimplementaba la lógica a mano y le
      // faltaba el chequeo de cardTier en la rama banco+wallet (drift real,
      // detectado en el spike del Financial Match Index, 19/8/2026).
      const matching = allReqs.filter(req => matchesProfileShared(req, uCards, tierToSegmentId))

      if (matching.length) {
        userBestDiscount = matching.reduce((max: any, r: any) => (r.discountValue ?? 0) > (max?.discountValue ?? 0) ? r : max, matching[0])
        // Entidades (banco o billetera) que empatan en el descuento ganador — para que
        // el consumidor de esta promo pueda mostrar "MODO (+13 bancos)" en vez de nombrar
        // un banco cualquiera como si la promo fuera exclusiva de él (bug reportado
        // 3/9/2026: promo multibanco de MODO mostraba "Banco Nación" arbitrariamente,
        // ocultando que aplica igual con ~14 bancos distintos).
        const bestValue = userBestDiscount.discountValue ?? 0
        matchingEntityNames = [...new Set(
          matching
            .filter((r: any) => (r.discountValue ?? 0) === bestValue)
            .map((r: any) => r.bank?.name || r.wallet?.name)
            .filter(Boolean)
        )] as string[]
      }
    }

    return { ...p, isSaved: finalSavedSet.has(p.id), globalMaxDiscount, userBestDiscount, matchingEntityNames }
  })

  // ── Deduplicación por tier: si el usuario matchea una promo con cardTier
  // para un banco+comercio, ocultar la promo genérica del mismo banco+comercio
  let dedupedPromos = finalPromos
  if (forMe && effectiveCards) {
    // Encontrar todos los (commerceId, bankId) que tienen al menos una promo con tier
    const tierKeys = new Set<string>()
    for (const p of finalPromos) {
      for (const r of (p as any).requirements ?? []) {
        if (r.cardTier) tierKeys.add(`${(p as any).commerceId}|${r.bankId}`)
      }
    }
    if (tierKeys.size > 0) {
      dedupedPromos = finalPromos.filter(p => {
        const reqs = (p as any).requirements ?? []
        const hasTier    = reqs.some((r: any) => r.cardTier)
        const hasGeneric = reqs.some((r: any) => !r.cardTier && tierKeys.has(`${(p as any).commerceId}|${r.bankId}`))
        // Descartar promos puramente genéricas cuando existe una con tier para el mismo banco+comercio
        return !(hasGeneric && !hasTier)
      })
    }
  }

  // Para el path paginado (invitados sin filtros), el orden viene de la DB y no hay dedup por tier.
  // Solo se aplican los filtros JS de bitmask y specificDates (ya aplicados en `filtered`).
  if (paginate) {
    return { promos: filtered as any[], totalCount, hasMore: totalCount > page * pageSize, profileIncomplete }
  }

  // ── Ordenamiento (path no-paginado: usuarios con perfil o filtros complejos) ────────────
  // 1. Métricas por promo
  const promoData = dedupedPromos.map(p => {
    const maxPct = (p as any).requirements.reduce((max: number, r: any) => {
      if (r.discountType === 'CUOTAS_SIN_INTERES' || r.discountType === 'NXM') return max
      return Math.max(max, r.discountValue ?? 0)
    }, 0)
    const maxCsi = (p as any).requirements.reduce((max: number, r: any) => {
      if (r.discountType !== 'CUOTAS_SIN_INTERES') return max
      return Math.max(max, r.discountValue ?? 0)
    }, 0)
    const hasNxm: boolean = (p as any).requirements.some((r: any) => r.discountType === 'NXM')
    const catSlug: string = (p as any).category?.slug ?? ''
    const name: string = (p as any).commerce?.name ?? ''
    // Tipo: 1 = % o NXM (sin CSI), 2 = (% o NXM) + CSI, 3 = solo CSI
    const hasMainDiscount = maxPct > 0 || hasNxm
    const type = hasMainDiscount && maxCsi > 0 ? 2 : hasMainDiscount ? 1 : 3
    return { p, maxPct, maxCsi, catSlug, name, type }
  })

  // 2. Popularidad de categoría = nº de promos tipo 1 y 2 (con %) de esa categoría
  const catCounts: Record<string, number> = {}
  for (const d of promoData) {
    if (d.type !== 3) catCounts[d.catSlug] = (catCounts[d.catSlug] ?? 0) + 1
  }

  // 3. Ordenar:
  //    Grupos 1 y 2 (con %): catPopularity DESC → tipo (1 antes que 2) → mayor descuento DESC → alfabético
  //    Grupo 3 (solo CSI): al final, ordenado por más cuotas DESC
  //    La popularidad de COMERCIO ya no pesa en el orden: un comercio con una sola promo
  //    de mayor descuento debe rankear por encima de un comercio con muchas promos de menor %.
  const orderedPromos = [...promoData].sort((a, b) => {
    // CSI solo siempre va al final
    if (a.type === 3 && b.type !== 3) return 1
    if (b.type === 3 && a.type !== 3) return -1

    // Dentro del grupo CSI: más cuotas primero
    if (a.type === 3 && b.type === 3) {
      return b.maxCsi - a.maxCsi
    }

    // Grupos 1 y 2: popularidad de categoría primero
    const catDiff = (catCounts[b.catSlug] ?? 0) - (catCounts[a.catSlug] ?? 0)
    if (catDiff !== 0) return catDiff

    // Luego tipo: 1 (solo % / NXM) antes que 2 (% + CSI)
    if (a.type !== b.type) return a.type - b.type

    // Luego mayor descuento %
    if (b.maxPct !== a.maxPct) return b.maxPct - a.maxPct

    // Comparación plana en vez de localeCompare('es') (RFC perf-payload-and-sort,
    // 25/8/2026): localeCompare invoca colación ICU por llamada, ~2.4s sobre 3199
    // elementos en el peor caso. Es el último criterio de desempate — nadie nota
    // si "Árbol" ordena antes o después de "Auto" acá (decisión CPO 25/8).
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  }).map(d => d.p)
  __mark('before return (after final sort)')

  if (useCandidates) {
    perf.totalMs = Date.now() - perfStart
    perf.recommendationsCount = orderedPromos.length
    console.log(`[candidate-selection] ${JSON.stringify(perf)}`)
    return { promos: orderedPromos, totalCount, hasMore: false, perf, profileIncomplete }
  }

  return { promos: orderedPromos, totalCount, hasMore: false, profileIncomplete }
}
