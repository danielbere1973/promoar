import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

// Redirect de la Home (28/9/2026, ajustado 26/11/2026): la landing de
// marketing que vivía acá se movió a /bienvenida (se conserva para ads/SEO,
// no se borró). La raíz ahora manda directo a la experiencia real de promos:
// - Invitado (sin sesión) → /promos/explorar: catálogo completo, funciona
//   bien sin perfil (forMe=false por default).
// - Logueado CON perfil financiero cargado → /promos: Home v2 / Decision
//   Engine, que necesita un perfil real para ser útil (recomendaciones,
//   spotlight).
// - Logueado SIN perfil financiero → /promos/explorar, igual que un
//   invitado. Pedido explícito de Pablo (26/11/2026): Home v2 debe quedar
//   reservado a usuarios con perfil cargado — antes, un logueado sin
//   tarjetas caía en /promos y veía la misma vidriera genérica que un
//   guest (status 'guest_showcase', ver route.ts), con un CTA sutil para
//   cargar el perfil en vez de ser mandado directo a donde sí puede navegar
//   el catálogo completo hoy mismo.
// Motivo original: GA4 mostraba ~2.9mil usuarios activos/mes pero solo 98
// registros, con la landing de marketing como página más vista — la mayoría
// del tráfico nunca llegaba a ver una promo real. Ver memoria del proyecto
// para el detalle de la investigación previa a este cambio.
export default async function RootPage() {
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

  redirect(hasProfile ? '/promos' : '/promos/explorar')
}
