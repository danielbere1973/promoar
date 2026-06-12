import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/getBaseUrl'
import { LecapsSection } from '../sections'
import Disclaimer from '../Disclaimer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'LECAPs y BONCAPs hoy: tasas y vencimientos',
  description: 'Listado actualizado de LECAPs y BONCAPs con tasa, TEM, TNA y fecha de vencimiento. Información de referencia para comparar instrumentos en pesos.',
}

async function getData() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/finanzas/lecaps`, { cache: 'no-store' })
    if (!res.ok) return undefined
    const d = await res.json()
    if (d.error) return undefined
    return { items: d.items ?? [], updatedAt: d.updatedAt ?? null }
  } catch {
    return undefined
  }
}

export default async function LecapsPage() {
  const initialData = await getData()

  return (
    <>
      <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3 px-1">
        LECAPs y BONCAPs hoy
      </h2>
      <LecapsSection initialData={initialData} />
      <Disclaimer />
    </>
  )
}
