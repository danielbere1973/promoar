import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 21600 // 6 horas

export interface BilleteraTasaItem {
  id: string
  nombre: string
  tna: number
  tea: number
  tipo: 'Cuenta Remunerada' | 'Fondo Común (FCI)'
  tope: string
  disponibilidad: string
  logoUrl: string
  color: string
  destacado?: string
  notas?: string
}

function calcTEA(tna: number): number {
  if (!tna || tna <= 0) return 0
  return Math.round(((Math.pow(1 + tna / 36500, 365) - 1) * 100) * 100) / 100
}

const BILLETERAS_DATA: Omit<BilleteraTasaItem, 'tea'>[] = [
  {
    id: 'uala',
    nombre: 'Ualá',
    tna: 24.0,
    tipo: 'Cuenta Remunerada',
    tope: 'Sin tope de saldo',
    disponibilidad: 'Inmediata 24/7',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=uala.com.ar',
    color: '#E53E3E',
    destacado: 'Top tasa general',
    notas: 'Rendimiento base ~20.08% con FCI Ualintec, ampliable hasta 24% cumpliendo metas mensuales.',
  },
  {
    id: 'banco-bica',
    nombre: 'Banco Bica',
    tna: 22.0,
    tipo: 'Cuenta Remunerada',
    tope: 'Hasta $5.000.000',
    disponibilidad: 'Días hábiles / Inmediata',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=bancobica.com.ar',
    color: '#004B87',
    notas: 'Cuenta sueldo y cuenta remunerada bancaria con interés diario.',
  },
  {
    id: 'carrefour-banco',
    nombre: 'Carrefour Banco',
    tna: 21.0,
    tipo: 'Cuenta Remunerada',
    tope: 'Hasta $4.468.800',
    disponibilidad: 'Inmediata 24/7',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=bancodeserviciosfinancieros.com.ar',
    color: '#0055A5',
    destacado: 'Top tasa bancaria',
    notas: 'Operado por Banco de Servicios Financieros (BSF). Remunera saldo directo en cuenta y brinda descuentos en Carrefour.',
  },
  {
    id: 'letsbit',
    nombre: 'LetsBit',
    tna: 19.4,
    tipo: 'Cuenta Remunerada',
    tope: 'Sin tope',
    disponibilidad: 'Inmediata 24/7',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=letsbit.io',
    color: '#3B82F6',
    notas: 'Rendimiento diario sobre saldo en pesos argentinos.',
  },
  {
    id: 'personal-pay',
    nombre: 'Personal Pay',
    tna: 19.35,
    tipo: 'Fondo Común (FCI)',
    tope: 'Hasta $1.500.000',
    disponibilidad: 'Inmediata 24/7',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=personalpay.com.ar',
    color: '#5A2D82',
    destacado: 'Muy popular',
    notas: 'Tasa base en Fondo Común Delta. Niveles 2 y 3 suman reintegros adicionales.',
  },
  {
    id: 'claro-pay',
    nombre: 'Claro Pay',
    tna: 19.3,
    tipo: 'Fondo Común (FCI)',
    tope: 'Sin tope',
    disponibilidad: 'Inmediata 24/7',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=claropay.com.ar',
    color: '#EF4444',
    notas: 'Inversión automática administrada en Money Market con acreditación diaria.',
  },
  {
    id: 'naranja-x',
    nombre: 'Naranja X',
    tna: 19.0,
    tipo: 'Cuenta Remunerada',
    tope: 'Hasta $1.000.000',
    disponibilidad: 'Inmediata 24/7',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=naranjax.com',
    color: '#E35205',
    destacado: 'Favorito diario',
    notas: 'Acredita intereses todos los días a medianoche. Tasa fija asegurada hasta el tope.',
  },
  {
    id: 'mercadopago',
    nombre: 'Mercado Pago',
    tna: 19.0,
    tipo: 'Fondo Común (FCI)',
    tope: 'Sin tope de saldo',
    disponibilidad: 'Inmediata 24/7',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=mercadopago.com.ar',
    color: '#009EE3',
    destacado: 'Mayor liquidez',
    notas: 'Fondo Común Mercado Fondo administrado por BIND. Rendimiento variable con disponibilidad total.',
  },
  {
    id: 'app-ypf',
    nombre: 'App YPF',
    tna: 18.9,
    tipo: 'Fondo Común (FCI)',
    tope: 'Sin tope',
    disponibilidad: 'Inmediata 24/7',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=ypf.com',
    color: '#0A3B7B',
    notas: 'Dinero en cuenta invertido en Fondo Común administrado junto a Banco Santander. Disponible para pagar nafta o transferir.',
  },
  {
    id: 'prex',
    nombre: 'Prex',
    tna: 18.5,
    tipo: 'Cuenta Remunerada',
    tope: 'Sin tope',
    disponibilidad: 'Inmediata 24/7',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=prexcard.com.ar',
    color: '#7C3AED',
    notas: 'Intereses diarios sobre saldo en pesos.',
  },
  {
    id: 'fiwind',
    nombre: 'Fiwind',
    tna: 20.0,
    tipo: 'Cuenta Remunerada',
    tope: 'Hasta $750.000 con bonus',
    disponibilidad: 'Inmediata 24/7',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=fiwind.io',
    color: '#10B981',
    notas: 'Rendimiento en pesos con tasa extra por saldo ingresado.',
  },
  {
    id: 'belo',
    nombre: 'Belo',
    tna: 19.0,
    tipo: 'Cuenta Remunerada',
    tope: 'Sin tope',
    disponibilidad: 'Inmediata 24/7',
    logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=belo.app',
    color: '#6366F1',
    notas: 'Genera rendimientos diarios sobre pesos y monedas estables.',
  },
]

export async function GET() {
  try {
    const items: BilleteraTasaItem[] = BILLETERAS_DATA.map(b => ({
      ...b,
      tea: calcTEA(b.tna),
    })).sort((a, b) => b.tna - a.tna)

    return NextResponse.json({
      items,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[GET /api/finanzas/billeteras]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
