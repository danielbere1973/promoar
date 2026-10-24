import BottomNav from './BottomNav'
import DetailSidebar, { SidebarCategory, SidebarEntity, SidebarCommerce } from '@/app/promos/[slug]/DetailSidebar'

// Shell común para páginas de detalle (banco, comercio, promo) — reusa el
// mismo DetailSidebar (desktop) y BottomNav (mobile) que ya usa
// /promos/[slug], para que todas las pantallas de detalle compartan el
// mismo look and feel en vez de inventar un sidebar nuevo por pantalla.
type Props = {
  children: React.ReactNode
  categories?: SidebarCategory[]
  otherEntities?: SidebarEntity[]
  commerces?: SidebarCommerce[]
  entityFilters?: SidebarEntity[]
}

export default function DetailPageShell({ children, categories, otherEntities, commerces, entityFilters }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0 lg:flex">
      <DetailSidebar categories={categories} otherEntities={otherEntities} commerces={commerces} entityFilters={entityFilters} />

      <div className="flex-1 min-w-0 lg:overflow-y-auto">
        {children}
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
