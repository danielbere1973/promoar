export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function bitmaskToDays(mask: number): string {
  if (mask === 127) return 'Todos los días'
  return DAYS.filter((_, i) => (mask & (1 << i)) !== 0).join(', ')
}

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET() {
  try {
    const promos = await prisma.promo.findMany({
      where: { status: 'ACTIVE' },
      include: {
        category: true,
        commerce:  true,
        requirements: {
          include: {
            bank:        { select: { name: true } },
            wallet:      { select: { name: true } },
            cardNetwork: { select: { name: true } },
            segmentRef:  { select: { name: true } },
          },
        },
      },
      orderBy: [{ category: { name: 'asc' } }, { commerce: { name: 'asc' } }],
    })

    const headers = [
      'Categoría',
      'Comercio',
      'Título',
      'Desde',
      'Hasta',
      'Fechas especiales',
      'Días',
      'Tipo beneficio',
      'Valor',
      'Mínimo compra $',
      'Tope $',
      'Frecuencia tope',
      'Tope por',
      'Tipo cuenta',
      'Canal de pago',
      'Tipo tarjeta',
      'Red de tarjeta',
      'Banco',
      'Billetera',
      'Segmento',
      'Fuente',
    ]

    const rows: string[][] = [headers]

    for (const p of promos) {
      const dias          = bitmaskToDays(p.validDays)
      const desde         = p.validFrom  ? p.validFrom.toISOString().split('T')[0]  : ''
      const hasta         = p.validUntil ? p.validUntil.toISOString().split('T')[0] : ''
      const fechasEsp     = p.specificDates ?? ''

      if (p.requirements.length === 0) {
        rows.push([
          p.category.name, p.commerce.name, p.title,
          desde, hasta, fechasEsp, dias,
          '', '', '', '', '', '', '', '', '', '', '', '', '', p.sourceUrl ?? '',
        ])
        continue
      }

      for (const r of p.requirements) {
        rows.push([
          p.category.name,
          p.commerce.name,
          p.title,
          desde,
          hasta,
          fechasEsp,
          dias,
          r.discountType,
          String(r.discountValue),
          r.minPurchase != null ? String(r.minPurchase) : '',
          r.cap         != null ? String(r.cap)         : '',
          r.capPeriod   ?? '',
          r.capTarget   ?? '',
          r.accountType ?? '',
          r.paymentChannel ?? '',
          r.cardType    ?? '',
          r.cardNetwork?.name ?? '',
          r.bank?.name        ?? '',
          r.wallet?.name      ?? '',
          r.segmentRef?.name  ?? '',
          p.sourceUrl ?? '',
        ])
      }
    }

    const csv = rows.map(r => r.map(escapeCSV).join(',')).join('\r\n')
    const bom  = '﻿' // BOM para que Excel reconozca UTF-8

    return new NextResponse(bom + csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="promos-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/export]', error)
    return NextResponse.json({ error: 'Error al exportar' }, { status: 500 })
  }
}
