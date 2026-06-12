import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/getBaseUrl'
import { YahooSection } from '../sections'
import Disclaimer from '../Disclaimer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Índices bursátiles hoy: Merval, S&P 500, Dow Jones',
  description: 'Cotización actual de los principales índices bursátiles de Argentina y el mundo, con variación diaria. Información de referencia para seguir los mercados.',
}

async function getData() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/finanzas/yahoo?tipo=indices`, { cache: 'no-store' })
    if (!res.ok) return undefined
    const d = await res.json()
    if (d.error) return undefined
    return { items: d.items ?? [], updatedAt: d.updatedAt ?? null }
  } catch {
    return undefined
  }
}

export default async function IndicesPage() {
  const initialData = await getData()

  return (
    <>
      <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3 px-1">
        Índices bursátiles hoy
      </h2>
      <YahooSection tipo="indices" initialData={initialData} />
      <Disclaimer />
    </>
  )
}
