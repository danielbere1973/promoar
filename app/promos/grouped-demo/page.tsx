'use client'
import { useEffect, useState } from 'react'
import CommerceGroupCard from '../../components/CommerceGroupCard'
import PromoDetailSheet from '../../components/PromoDetailSheet'

type Req = {
  bank?: { name: string; logoUrl?: string | null; slug?: string } | null
  wallet?: { name: string; logoUrl?: string | null; slug?: string } | null
  cardNetwork?: { name: string; slug: string } | null
  discountType?: string
  discountValue?: number
  nxmN?: number | null
  nxmM?: number | null
  cap?: number | null
  capPeriod?: string | null
  minPurchase?: number | null
}

type Promo = {
  id: string
  title: string
  description: string
  slug?: string | null
  validDays: number
  validDaysNote?: string | null
  specificDates?: string | null
  uniqueUsePerPeriod: boolean
  stackable: boolean
  sourceText?: string | null
  sourceUrl?: string | null
  salesChannel?: string | null
  commerceNote?: string | null
  validFrom: string
  validUntil: string | null
  category: { name: string; slug?: string; color: string; icon?: string }
  commerce: { id?: string; name: string; logoUrl?: string | null; instagramUrl?: string | null }
  requirements: Req[]
}

export default function GroupedDemoPage() {
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [detailPromo, setDetailPromo] = useState<Promo | null>(null)

  useEffect(() => {
    fetch('/api/promos?commerces=Changomas&searchMode=exact&view=week')
      .then(res => res.json())
      .then(data => setPromos(Array.isArray(data) ? data : data.promos ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#F8F9FB] dark:bg-slate-900 pb-24">
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-lg font-black text-[#1E3A5F] dark:text-white mb-1">
          Prototipo: tarjeta agrupada por comercio
        </h1>
        <p className="text-[12px] text-gray-500 dark:text-slate-400 mb-5">
          Comercio de prueba: Changomas — {promos.length} promos activas
        </p>

        {loading && <p className="text-sm text-gray-400">Cargando...</p>}

        {!loading && promos.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <CommerceGroupCard
              commerce={promos[0].commerce}
              promos={promos}
              onPromoClick={setDetailPromo}
            />
          </div>
        )}

        {!loading && promos.length === 0 && (
          <p className="text-sm text-gray-400">No se encontraron promos para Changomas.</p>
        )}
      </div>

      {detailPromo && (
        <PromoDetailSheet promo={detailPromo as any} onClose={() => setDetailPromo(null)} />
      )}
    </div>
  )
}
