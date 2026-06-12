import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/getBaseUrl'
import { IOLScraperSection } from '../sections'
import Disclaimer from '../Disclaimer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Obligaciones Negociables (ONs) hoy: cotizaciones',
  description: 'Precios y variación diaria de las principales Obligaciones Negociables (ONs) argentinas. Información de referencia actualizada para comparar antes de operar.',
}

async function getData() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/finanzas/iol-scraper/ons`, { cache: 'no-store' })
    if (!res.ok) return undefined
    const d = await res.json()
    if (d.error) return undefined
    return { items: d.items ?? [], updatedAt: d.updatedAt ?? null }
  } catch {
    return undefined
  }
}

export default async function OnsPage() {
  const initialData = await getData()

  return (
    <>
      <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3 px-1">
        Obligaciones Negociables (ONs) hoy
      </h2>
      <IOLScraperSection tipo="ons" initialData={initialData} />
      <Disclaimer />
    </>
  )
}
