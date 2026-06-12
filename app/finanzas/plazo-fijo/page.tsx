import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/getBaseUrl'
import { PlazoFijoSection } from '../sections'
import Disclaimer from '../Disclaimer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mejores tasas de plazo fijo hoy',
  description: 'Comparativa actualizada de tasas TNA y TEA de plazo fijo en bancos de Argentina, para clientes y no clientes. Información de referencia para comparar antes de invertir.',
}

async function getData() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/finanzas/plazo-fijo`, { cache: 'no-store' })
    if (!res.ok) return undefined
    const d = await res.json()
    if (d.error) return undefined
    return { items: d.items ?? [], updatedAt: d.updatedAt ?? null }
  } catch {
    return undefined
  }
}

export default async function PlazoFijoPage() {
  const initialData = await getData()

  return (
    <>
      <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3 px-1">
        Tasas de plazo fijo hoy
      </h2>
      <PlazoFijoSection initialData={initialData} />
      <Disclaimer />
    </>
  )
}
