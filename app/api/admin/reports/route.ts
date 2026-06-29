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
        include: {
          commerce: true,
          requirements: {
            include: {
              bank: { select: { name: true } },
              wallet: { select: { name: true } },
            },
          },
        },
        orderBy: [{ commerce: { name: 'asc' } }, { title: 'asc' }],
      })
      const rows = promos.map(p => {
        const bancos = Array.from(new Set(p.requirements.map(r => r.bank?.name).filter(Boolean))).join(' / ')
        const billeteras = Array.from(new Set(p.requirements.map(r => r.wallet?.name).filter(Boolean))).join(' / ')
        return {
          id: p.id,
          comercio: p.commerce.name,
          titulo: p.title,
          bancos,
          billeteras,
          fuente: p.sourceUrl || '',
          validFrom: p.validFrom?.toISOString().slice(0, 10) || '',
          validUntil: p.validUntil?.toISOString().slice(0, 10) || '',
        }
      })
      csv = toCSV(rows, ['id', 'comercio', 'titulo', 'bancos', 'billeteras', 'fuente', 'validFrom', 'validUntil'])
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

    else if (type === 'por-banco') {
      const banco = new URL(req.url).searchParams.get('banco') || ''
      if (!banco) return NextResponse.json({ error: 'Parámetro banco requerido' }, { status: 400 })

      const promos = await prisma.promo.findMany({
        where: {
          status: 'ACTIVE',
          requirements: {
            some: {
              OR: [
                { bank: { name: { contains: banco, mode: 'insensitive' } } },
                { wallet: { name: { contains: banco, mode: 'insensitive' } } },
              ]
            }
          }
        },
        include: {
          commerce: true,
          category: true,
          requirements: {
            include: {
              bank: { select: { name: true } },
              wallet: { select: { name: true } },
              cardNetwork: { select: { name: true } },
            }
          }
        },
        orderBy: [{ commerce: { name: 'asc' } }, { title: 'asc' }],
      })

      const rows = promos.map(p => {
        const bancos = Array.from(new Set(p.requirements.map(r => r.bank?.name).filter(Boolean))).join(' / ')
        const wallets = Array.from(new Set(p.requirements.map(r => r.wallet?.name).filter(Boolean))).join(' / ')
        const redes = Array.from(new Set(p.requirements.map(r => r.cardNetwork?.name).filter(Boolean))).join(' / ')
        const descuentos = p.requirements.map(r => `${r.discountValue}${r.discountType === 'CUOTAS_SIN_INTERES' ? ' CSI' : '%'}`).join(' / ')
        return {
          id: p.id,
          comercio: p.commerce.name,
          categoria: p.category.name,
          titulo: p.title,
          descripcion: p.description,
          bancos,
          wallets,
          redes,
          descuentos,
          validFrom: p.validFrom?.toISOString().slice(0, 10) || '',
          validUntil: p.validUntil?.toISOString().slice(0, 10) || '',
          fuente: p.sourceUrl || '',
        }
      })
      csv = toCSV(rows, ['id', 'comercio', 'categoria', 'titulo', 'descripcion', 'bancos', 'wallets', 'redes', 'descuentos', 'validFrom', 'validUntil', 'fuente'])
      name = `banco_${banco.replace(/\s+/g, '_').toLowerCase()}`
    }

    else if (type === 'por-vencer') {
      const horas = parseInt(new URL(req.url).searchParams.get('horas') || '24')
      const now = new Date()
      const limite = new Date(now.getTime() + horas * 60 * 60 * 1000)
      const promos = await prisma.promo.findMany({
        where: {
          status: 'ACTIVE',
          validUntil: { gte: now, lte: limite },
        },
        include: {
          commerce: true,
          category: true,
          requirements: { include: { bank: { select: { name: true } }, wallet: { select: { name: true } } } },
        },
        orderBy: { validUntil: 'asc' },
      })
      const rows = promos.map(p => ({
        comercio: p.commerce.name,
        categoria: p.category.name,
        titulo: p.title,
        bancos: Array.from(new Set(p.requirements.map(r => r.bank?.name).filter(Boolean))).join(' / '),
        wallets: Array.from(new Set(p.requirements.map(r => r.wallet?.name).filter(Boolean))).join(' / '),
        validUntil: p.validUntil?.toISOString().slice(0, 10) || '',
        fuente: p.sourceUrl || '',
      }))
      csv = toCSV(rows, ['comercio', 'categoria', 'titulo', 'bancos', 'wallets', 'validUntil', 'fuente'])
      name = `vencen_en_${horas}hs`
    }

    else if (type === 'proximas') {
      const now = new Date()
      const promos = await prisma.promo.findMany({
        where: {
          status: 'ACTIVE',
          validFrom: { gt: now },
        },
        include: {
          commerce: true,
          category: true,
          requirements: { include: { bank: { select: { name: true } }, wallet: { select: { name: true } } } },
        },
        orderBy: { validFrom: 'asc' },
      })
      const rows = promos.map(p => ({
        comercio: p.commerce.name,
        categoria: p.category.name,
        titulo: p.title,
        bancos: Array.from(new Set(p.requirements.map(r => r.bank?.name).filter(Boolean))).join(' / '),
        wallets: Array.from(new Set(p.requirements.map(r => r.wallet?.name).filter(Boolean))).join(' / '),
        validFrom: p.validFrom?.toISOString().slice(0, 10) || '',
        validUntil: p.validUntil?.toISOString().slice(0, 10) || '',
        fuente: p.sourceUrl || '',
      }))
      csv = toCSV(rows, ['comercio', 'categoria', 'titulo', 'bancos', 'wallets', 'validFrom', 'validUntil', 'fuente'])
      name = 'proximas'
    }

    else if (type === 'por-fechas') {
      const desde = new URL(req.url).searchParams.get('desde')
      const hasta = new URL(req.url).searchParams.get('hasta')
      if (!desde || !hasta) return NextResponse.json({ error: 'Parámetros desde y hasta requeridos' }, { status: 400 })
      const promos = await prisma.promo.findMany({
        where: {
          status: 'ACTIVE',
          validFrom: { gte: new Date(desde) },
          validUntil: { lte: new Date(hasta + 'T23:59:59Z') },
        },
        include: {
          commerce: true,
          category: true,
          requirements: { include: { bank: { select: { name: true } }, wallet: { select: { name: true } } } },
        },
        orderBy: [{ validFrom: 'asc' }, { commerce: { name: 'asc' } }],
      })
      const rows = promos.map(p => ({
        comercio: p.commerce.name,
        categoria: p.category.name,
        titulo: p.title,
        bancos: Array.from(new Set(p.requirements.map(r => r.bank?.name).filter(Boolean))).join(' / '),
        wallets: Array.from(new Set(p.requirements.map(r => r.wallet?.name).filter(Boolean))).join(' / '),
        validFrom: p.validFrom?.toISOString().slice(0, 10) || '',
        validUntil: p.validUntil?.toISOString().slice(0, 10) || '',
        fuente: p.sourceUrl || '',
      }))
      csv = toCSV(rows, ['comercio', 'categoria', 'titulo', 'bancos', 'wallets', 'validFrom', 'validUntil', 'fuente'])
      name = `fechas_${desde}_${hasta}`
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
