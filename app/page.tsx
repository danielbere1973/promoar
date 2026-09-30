import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'

// Redirect de la Home (28/9/2026): la landing de marketing que vivía acá se
// movió a /bienvenida (se conserva para ads/SEO, no se borró). La raíz ahora
// manda directo a la experiencia real de promos:
// - Invitado (sin sesión) → /promos/explorar: catálogo completo, funciona
//   bien sin perfil (forMe=false por default).
// - Logueado (con sesión) → /promos: Home v2 / Decision Engine, que necesita
//   un perfil financiero real para ser útil (recomendaciones, spotlight).
// Motivo: GA4 mostraba ~2.9mil usuarios activos/mes pero solo 98 registros,
// con la landing de marketing como página más vista — la mayoría del tráfico
// nunca llegaba a ver una promo real. Ver memoria del proyecto para el detalle
// de la investigación previa a este cambio.
export default async function RootPage() {
  const session = await getServerSession(authOptions)
  redirect(session?.user ? '/promos' : '/promos/explorar')
}
