import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthToken } from '@/lib/auth'
import { RUBRO_CATALOG } from '@/lib/rubroCatalog'

// GET/PUT /api/perfil/rubros — CPO Approval "Tus rubros" (16/8/2026), punto 3 de la
// propuesta técnica. Mismo patrón de auth que app/api/promos/home-decision/route.ts:
// identidad SOLO desde el JWT verificado (getAuthToken), sin fallback a header
// x-user-email — este endpoint lee y escribe UserRubroPreference de un usuario real,
// no hay caso de uso legítimo para aceptar un header spoofeable acá.

const CATALOG_IDS = new Set(RUBRO_CATALOG.map(r => r.id))

async function requireUserId(req: NextRequest): Promise<string | null> {
  const token = await getAuthToken(req)
  const email = (token?.email as string | undefined) || null
  if (!email) return null
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

async function buildResponsePayload(userId: string) {
  const [activeRubroIds, declaredRows] = await Promise.all([
    prisma.homeRubro.findMany({ select: { id: true, active: true } }),
    prisma.userRubroPreference.findMany({
      where: { userId, source: 'DECLARED', status: 'ACTIVE' },
      select: { rubroId: true },
    }),
  ])
  const activeById = new Map(activeRubroIds.map(r => [r.id, r.active]))
  const universe = RUBRO_CATALOG.map(r => ({
    id: r.id,
    label: r.label,
    icon: r.icon,
    active: activeById.get(r.id) ?? false,
  }))
  const declared = declaredRows.map(d => d.rubroId)
  return { universe, declared }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const payload = await buildResponsePayload(userId)
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[GET /api/perfil/rubros]', error)
    return NextResponse.json({ error: 'Error al obtener rubros' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = await requireUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const declaredInput: unknown = body?.declared
    if (!Array.isArray(declaredInput) || !declaredInput.every(id => typeof id === 'string')) {
      return NextResponse.json({ error: 'Body inválido: se espera { declared: string[] }' }, { status: 400 })
    }
    const nextDeclared = new Set<string>(declaredInput)

    for (const id of Array.from(nextDeclared)) {
      if (!CATALOG_IDS.has(id)) {
        return NextResponse.json({ error: `Rubro desconocido: ${id}` }, { status: 400 })
      }
    }

    const [activeRows, existingRows] = await Promise.all([
      prisma.homeRubro.findMany({ where: { id: { in: Array.from(nextDeclared) } }, select: { id: true, active: true } }),
      prisma.userRubroPreference.findMany({
        where: { userId, source: 'DECLARED' },
        select: { id: true, rubroId: true, status: true },
      }),
    ])
    const activeById = new Map(activeRows.map(r => [r.id, r.active]))
    const existingByRubroId = new Map(existingRows.map(r => [r.rubroId, r]))

    // Un rubro inactivo no puede agregarse de cero — solo puede permanecer si ya
    // estaba declarado (ACTIVE o SUPPRESSED, reactivación permitida).
    for (const id of Array.from(nextDeclared)) {
      const isActive = activeById.get(id) ?? false
      if (!isActive && !existingByRubroId.has(id)) {
        return NextResponse.json({ error: `Rubro inactivo, no se puede agregar: ${id}` }, { status: 400 })
      }
    }

    const toInsert: string[] = []
    const toReactivate: string[] = []
    const toSuppress: string[] = []

    for (const id of Array.from(nextDeclared)) {
      const existing = existingByRubroId.get(id)
      if (!existing) {
        toInsert.push(id)
      } else if (existing.status === 'SUPPRESSED') {
        toReactivate.push(id)
      }
      // status ya ACTIVE → sin cambios
    }
    for (const row of existingRows) {
      if (row.status === 'ACTIVE' && !nextDeclared.has(row.rubroId)) {
        toSuppress.push(row.rubroId)
      }
    }

    await prisma.$transaction([
      ...toInsert.map(rubroId =>
        prisma.userRubroPreference.create({
          data: { userId, rubroId, source: 'DECLARED', status: 'ACTIVE' },
        })
      ),
      ...toReactivate.map(rubroId =>
        prisma.userRubroPreference.updateMany({
          where: { userId, rubroId, source: 'DECLARED' },
          data: { status: 'ACTIVE', suppressedAt: null },
        })
      ),
      ...toSuppress.map(rubroId =>
        prisma.userRubroPreference.updateMany({
          where: { userId, rubroId, source: 'DECLARED' },
          data: { status: 'SUPPRESSED', suppressedAt: new Date() },
        })
      ),
    ])

    const payload = await buildResponsePayload(userId)
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[PUT /api/perfil/rubros]', error)
    return NextResponse.json({ error: 'Error al guardar rubros' }, { status: 500 })
  }
}
