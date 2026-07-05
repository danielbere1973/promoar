export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function increment(key: string) {
  const existing = await prisma.siteConfig.findUnique({ where: { key } })
  const next = String((parseInt(existing?.value ?? '0') || 0) + 1)
  await prisma.siteConfig.upsert({
    where: { key },
    create: { key, value: next },
    update: { value: next },
  })
}

export async function POST(req: NextRequest) {
  const { bannerId = 'unknown' } = await req.json().catch(() => ({}))

  const today = new Date().toISOString().slice(0, 10)
  await increment(`banner_${bannerId}_clicks_total`)
  await increment(`banner_${bannerId}_clicks_${today}`)

  return NextResponse.json({ ok: true })
}
