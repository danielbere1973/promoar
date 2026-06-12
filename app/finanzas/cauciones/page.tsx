import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/getBaseUrl'
import { IOLScraperSection } from '../sections'
import Disclaimer from '../Disclaimer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tasas de cauciones hoy en Argentina',
  description: 'Tasas de caución bursátil por plazo y moneda, actualizadas. Información de referencia para comparar el costo del dinero en el mercado de capitales.',
}

async function getData() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/finanzas/iol-scraper/cauciones`, { cache: 'no-store' })
    if (!res.ok) return undefined
    const d = await res.json()
    if (d.error) return undefined
    return { items: d.items ?? [], updatedAt: d.updatedAt ?? null }
  } catch {
    return undefined
  }
}

export default async function CaucionesPage() {
  const initialData = await getData()

  return (
    <>
      <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3 px-1">
        Tasas de cauciones hoy
      </h2>
      <IOLScraperSection tipo="cauciones" initialData={initialData} />
      <Disclaimer />
    </>
  )
}
