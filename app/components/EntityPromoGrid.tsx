'use client'
import { useRouter } from 'next/navigation'
import PromoCard from './PromoCard'

// Grid de tarjetas de promo (mismo look&feel que /promos y /promos/explorar)
// para usar en páginas de detalle de banco/billetera y comercio — reemplaza
// el listado de filas full-width por tarjetitas chicas agrupadas por categoría.
type Promo = Parameters<typeof PromoCard>[0]['promo']

export default function EntityPromoGrid({ promos }: { promos: Promo[] }) {
  const router = useRouter()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {promos.map(promo => (
        <PromoCard
          key={promo.id}
          promo={promo}
          fullWidth
          onClick={() => promo.slug && router.push(`/promos/${promo.slug}`)}
        />
      ))}
    </div>
  )
}
