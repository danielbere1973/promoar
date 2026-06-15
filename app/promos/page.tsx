import { getServerSession } from 'next-auth/next'
import { getPromosData } from '@/lib/getPromos'
import PromosClient from './PromosClient'

export const revalidate = 0

// Preview chico para el primer render (SEO/LCP): el catálogo completo de "hoy sin
// filtros" tiene ~7000 promos / 38MB y tarda ~25s — el cliente lo trae igual que hoy
// vía el fetch normal, este preview solo evita que el HTML inicial llegue vacío.
const PREVIEW_TAKE = 300

export default async function PromosPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>
}) {
  const session = await getServerSession()
  const initialCats = searchParams.cats?.split(',').filter(Boolean) ?? []
  const forMe = !!session?.user?.email
  const isAdmin = (session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'MODERATOR'

  const { promos: rawPromos, totalCount } = await getPromosData(
    { forMe, view: 'today', categorySlugs: initialCats, take: PREVIEW_TAKE },
    session?.user?.email,
    isAdmin,
  ).catch(() => ({ promos: null, totalCount: 0 }))

  // Mismo round-trip de serialización que NextResponse.json (convierte Date -> string ISO)
  // para que coincida con el tipo `Promo` esperado por PromosClient
  const initialPromos = rawPromos ? JSON.parse(JSON.stringify(rawPromos)) : null

  return <PromosClient initialPromos={initialPromos} initialCats={initialCats} initialTotalCount={totalCount} />
}
