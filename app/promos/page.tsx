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
export default function PromosPage() {
  return (
    <PromosClient>
      <CategoryPillarLinks />
    </PromosClient>
  )
}
