import type { Metadata } from 'next'
import { getBaseUrl } from '@/lib/getBaseUrl'
import BilleterasClient from './BilleterasClient'
import Disclaimer from '../Disclaimer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tasas de Billeteras Virtuales Hoy | PromoAR',
  description: 'Comparativa en vivo de rendimientos y tasas de Mercado Pago, Naranja X, Personal Pay, Ualá y bancos. Calculá tu ganancia diaria con saldo remunerado.',
}

async function getData() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/finanzas/billeteras`, { cache: 'no-store' })
    if (!res.ok) return undefined
    const d = await res.json()
    if (d.error) return undefined
    return { items: d.items ?? [], updatedAt: d.updatedAt ?? null }
  } catch {
    return undefined
  }
}

export default async function BilleterasPage() {
  const initialData = await getData()

  return (
    <>
      <div className="mb-4">
        <h2 className="text-base font-black text-gray-900 dark:text-white px-1">
          Rendimiento de Billeteras y Cuentas Remuneradas
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 px-1 mt-0.5">
          ¿En qué app te conviene dejar tus pesos hoy con disponibilidad 24/7?
        </p>
      </div>
      <BilleterasClient initialData={initialData} />
      <Disclaimer />
    </>
  )
}
