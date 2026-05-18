export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function toCSV(rows: Record<string, any>[], headers: string[]): string {
  const escape = (v: any) => {
    if (v == null) return ''
    const s = String(v).replace(/"/g, '""')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
  }
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ]
  return '﻿' + lines.join('\r\n') // BOM UTF-8 para Excel
}

function fileName(name: string) {
  const date = new Date().toISOString().slice(0, 10)
  return `promoar_${name}_${date}.csv`
}

export async function GET(req: NextRequest) {
  const type = new URL(req.url).searchParams.get('type') || 'sin-categoria'

  try {
    let csv = ''
    let name = type

    if (type === 'sin-categoria') {
      const promos = await prisma.promo.findMany({
        where: { status: 'ACTIVE', category: { slug: 'sin-categoria' } },
        include: { commerce: true, category: true },
        orderBy: [{ commerce: { name: 'asc' } }, { title: 'asc' }],
      })
      const rows = promos.map(p => ({
        id: p.id,
        comercio: p.commerce.name,
        titulo: p.title,
        descripcion: p.description,
        sourceUrl: p.sourceUrl || '',
        validFrom: p.validFrom?.toISOString().slice(0, 10) || '',
        validUntil: p.validUntil?.toISOString().slice(0, 10) || '',
        creado: p.createdAt.toISOString().slice(0, 10),
      }))
      csv = toCSV(rows, ['id', 'comercio', 'titulo', 'descripcion', 'sourceUrl', 'validFrom', 'validUntil', 'creado'])
      name = 'sin_categoria'
    }

    else if (type === 'por-scraper') {
      const result = await prisma.$queryRaw<any[]>`
        SELECT
          COALESCE(b.name, w.name, 'Sin entidad') as fuente,
          COUNT(DISTINCT p.id)::int as total_promos,
          COUNT(DISTINCT c.id)::int as total_comercios
        FROM promos p
        JOIN commerces c ON p."commerceId" = c.id
        LEFT JOIN promo_requirements pr ON pr."promoId" = p.id
        LEFT JOIN banks b ON pr."bankId" = b.id
        LEFT JOIN wallets w ON pr."walletId" = w.id
        WHERE p.status = 'ACTIVE'
        GROUP BY COALESCE(b.name, w.name, 'Sin entidad')
        ORDER BY total_promos DESC
      `
      csv = toCSV(result, ['fuente', 'total_promos', 'total_comercios'])
      name = 'por_scraper'
    }

    else if (type === 'sin-logo') {
      const commerces = await prisma.commerce.findMany({
        where: { active: true, logoUrl: null },
        include: { _count: { select: { promos: { where: { status: 'ACTIVE' } } } } },
        orderBy: { name: 'asc' },
      })
      const rows = commerces.map(c => ({
        id: c.id,
        nombre: c.name,
        slug: c.slug,
        promos_activas: c._count.promos,
      }))
      csv = toCSV(rows, ['id', 'nombre', 'slug', 'promos_activas'])
      name = 'sin_logo'
    }

    else if (type === 'vencidas') {
      const promos = await prisma.promo.findMany({
        where: { status: 'EXPIRED' },
        include: { commerce: true, category: true },
        orderBy: { validUntil: 'desc' },
        take: 500,
      })
      const rows = promos.map(p => ({
        id: p.id,
        comercio: p.commerce.name,
        categoria: p.category.name,
        titulo: p.title,
        validUntil: p.validUntil?.toISOString().slice(0, 10) || '',
        sourceUrl: p.sourceUrl || '',
      }))
      csv = toCSV(rows, ['id', 'comercio', 'categoria', 'titulo', 'validUntil', 'sourceUrl'])
      name = 'vencidas'
    }

    else if (type === 'por-categoria') {
      const cats = await prisma.category.findMany({
        include: { _count: { select: { promos: { where: { status: 'ACTIVE' } } } } },
        orderBy: { name: 'asc' },
      })
      const rows = cats.map(c => ({
        categoria: c.name,
        slug: c.slug,
        promos_activas: c._count.promos,
      }))
      csv = toCSV(rows, ['categoria', 'slug', 'promos_activas'])
      name = 'por_categoria'
    }

    else if (type === 'duplicadas') {
      const result = await prisma.$queryRaw<any[]>`
        SELECT
          c.name as comercio,
          p.title,
          COUNT(p.id)::int as cantidad,
          STRING_AGG(p.id, ', ') as ids
        FROM promos p
        JOIN commerces c ON p."commerceId" = c.id
        WHERE p.status = 'ACTIVE'
        GROUP BY c.name, p.title
        HAVING COUNT(p.id) > 1
        ORDER BY cantidad DESC, c.name
      `
      csv = toCSV(result, ['comercio', 'title', 'cantidad', 'ids'])
      name = 'duplicadas'
    }

    else {
      return NextResponse.json({ error: 'Tipo de reporte inválido' }, { status: 400 })
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName(name)}"`,
      },
    })
  } catch (error) {
    console.error('[Reports]', error)
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 })
  }
}
