import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import PromosClient from './PromosClient'
import CategoryPillarLinks from '@/app/components/CategoryPillarLinks'

export const revalidate = 0

// Home v2 (CPO Direction, 9/8/2026): experiencia cerrada de decisión
// (Spotlight + recomendaciones + señales + CTA), sin catálogo debajo.
// Ya no hace falta el preview SSR de promos que tenía esta ruta —
// las recomendaciones se resuelven client-side vía /api/promos/recommended
// (useRecommendations), igual que en el resto de la Home v2.
// El catálogo completo con SSR/paginación vive en /promos/explorar.
//
// CategoryPillarLinks (plan SEO Fase 1, 18/11/2026): enlace interno server-
// rendered hacia las páginas pilar /promos/categoria/[categoria] — sin esto
// Googlebot solo las descubre por sitemap. Pasado como children para que
// PromosClient lo ubique dentro de su propio layout (header/fondo).
//
// Guard de perfil (26/11/2026, mismo criterio que app/page.tsx): Home v2
// queda reservada a logueados con perfil financiero cargado. Pedido CPO
// (26/11/2026): ni un guest sin sesión ni un logueado sin perfil deben
// llegar acá por ninguna vía (link guardado, back button, navegación
// interna) — ambos se redirigen a /promos/explorar, igual que si hubieran
// entrado por "/".
export default async function PromosPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/promos/explorar')

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      financialProfile: {
        select: {
          _count: { select: { banks: true, wallets: true, cards: true } },
        },
      },
    },
  })
  const counts = user?.financialProfile?._count
  const hasProfile = !!counts && (counts.banks > 0 || counts.wallets > 0 || counts.cards > 0)
  if (!hasProfile) redirect('/promos/explorar')

  return (
    <PromosClient>
      <CategoryPillarLinks />
    </PromosClient>
  )
}
