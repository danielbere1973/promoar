import PromosClient from './PromosClient'

export const revalidate = 0

// Home v2 (CPO Direction, 9/8/2026): experiencia cerrada de decisión
// (Spotlight + recomendaciones + señales + CTA), sin catálogo debajo.
// Ya no hace falta el preview SSR de promos que tenía esta ruta —
// las recomendaciones se resuelven client-side vía /api/promos/recommended
// (useRecommendations), igual que en el resto de la Home v2.
// El catálogo completo con SSR/paginación vive en /promos/explorar.
export default function PromosPage() {
  return <PromosClient />
}
