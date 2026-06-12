import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/getBaseUrl'
import { YahooSection } from '../sections'
import Disclaimer from '../Disclaimer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Acciones de EEUU hoy: cotizaciones en dólares',
  description: 'Cotización actual de las principales acciones de Estados Unidos en dólares, con variación diaria. Información de referencia para seguir el mercado norteamericano.',
}

async function getData() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/finanzas/yahoo?tipo=usa`, { cache: 'no-store' })
    if (!res.ok) return undefined
    const d = await res.json()
    if (d.error) return undefined
    return { items: d.items ?? [], updatedAt: d.updatedAt ?? null }
  } catch {
    return undefined
  }
}

export default async function AccionesUsaPage() {
  const initialData = await getData()

  return (
    <>
      <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3 px-1">
        Acciones de Estados Unidos hoy
      </h2>
      <YahooSection tipo="usa" initialData={initialData} />
      <Disclaimer />
    </>
  )
}
