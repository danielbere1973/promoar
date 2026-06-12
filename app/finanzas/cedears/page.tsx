import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/getBaseUrl'
import { IOLScraperSection } from '../sections'
import Disclaimer from '../Disclaimer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Precios de CEDEARs hoy en Argentina',
  description: 'Precios y variación diaria de los principales CEDEARs que cotizan en Argentina, en pesos. Información de referencia actualizada para comparar antes de operar.',
}

async function getData() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/finanzas/iol-scraper/cedears`, { cache: 'no-store' })
    if (!res.ok) return undefined
    const d = await res.json()
    if (d.error) return undefined
    return { items: d.items ?? [], updatedAt: d.updatedAt ?? null }
  } catch {
    return undefined
  }
}

export default async function CedearsPage() {
  const initialData = await getData()

  return (
    <>
      <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3 px-1">
        CEDEARs hoy
      </h2>
      <IOLScraperSection tipo="cedears" initialData={initialData} />
      <Disclaimer />
    </>
  )
}
