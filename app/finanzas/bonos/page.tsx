import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/getBaseUrl'
import { IOLScraperSection } from '../sections'
import Disclaimer from '../Disclaimer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Cotización de bonos argentinos hoy',
  description: 'Precios y variación diaria de los principales bonos argentinos en pesos y dólares. Información de referencia actualizada para comparar antes de operar.',
}

async function getData() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/finanzas/iol-scraper/bonos`, { cache: 'no-store' })
    if (!res.ok) return undefined
    const d = await res.json()
    if (d.error) return undefined
    return { items: d.items ?? [], updatedAt: d.updatedAt ?? null }
  } catch {
    return undefined
  }
}

export default async function BonosPage() {
  const initialData = await getData()

  return (
    <>
      <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3 px-1">
        Bonos argentinos hoy
      </h2>
      <IOLScraperSection tipo="bonos" initialData={initialData} />
      <Disclaimer />
    </>
  )
}
