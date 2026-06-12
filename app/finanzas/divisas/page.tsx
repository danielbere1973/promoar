import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/getBaseUrl'
import { DivisasSection } from '../sections'
import Disclaimer from '../Disclaimer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Cotización del dólar hoy en Argentina',
  description: 'Cotización actual del dólar, euro, real y libra según el Banco Nación Argentina, con valores de compra y venta. Información de referencia actualizada.',
}

async function getData() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/finanzas/divisas`, { cache: 'no-store' })
    if (!res.ok) return undefined
    const d = await res.json()
    if (d.error) return undefined
    return { divisas: d.divisas ?? [], fecha: d.fecha ?? null, hora: d.hora ?? null, updatedAt: d.updatedAt ?? null }
  } catch {
    return undefined
  }
}

export default async function DivisasPage() {
  const initialData = await getData()

  return (
    <>
      <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3 px-1">
        Cotización del dólar y otras divisas hoy
      </h2>
      <DivisasSection initialData={initialData} />
      <Disclaimer />
    </>
  )
}
