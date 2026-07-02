export interface CategoryNode {
  id: string
  name: string
  section?: 'supermercados' | 'farmacias' | 'electrónica' // undefined = supermercados (default)
  cotoId?: string
  carrefourId?: string
  cencosudSlug?: string
  diaSlug?: string
  vtexMap?: string
  farmaSlug?: string // slug para búsqueda en farmacias VTEX
  electroSlug?: string // término de búsqueda para electrónica
  children?: CategoryNode[]
}

export const CATEGORIES: CategoryNode[] = [
  {
    id: 'bebidas',
    name: 'Bebidas',
    cotoId: 'catv00001256',
    carrefourId: '255',
    cencosudSlug: 'bebidas',
    diaSlug: 'bebidas',
    vtexMap: 'c',
    children: [
      {
        id: 'bebidas-sin-alcohol',
        name: 'Bebidas Sin Alcohol',
        cotoId: 'catv00001301',
        carrefourId: '255',
        cencosudSlug: 'bebidas',
        diaSlug: 'bebidas',
        vtexMap: 'c',
        children: [
          {
            id: 'gaseosas',
            name: 'Gaseosas',
            cotoId: 'catv00001540',
            carrefourId: '255/277',
            cencosudSlug: 'gaseosas',
            diaSlug: 'gaseosas',
            vtexMap: 'c,c'
          },
          {
            id: 'aguas',
            name: 'Aguas',
            cotoId: 'catv00004086',
            carrefourId: '255/283',
            cencosudSlug: 'aguas',
            diaSlug: 'aguas',
            vtexMap: 'c,c'
          },
          {
            id: 'jugos',
            name: 'Jugos',
            cotoId: 'catv00001542',
            carrefourId: '255/286',
            cencosudSlug: 'jugos',
            diaSlug: 'jugos-e-isotonicas',
            vtexMap: 'c,c'
          }
        ]
      },
      {
        id: 'bebidas-con-alcohol',
        name: 'Bebidas Con Alcohol',
        cotoId: 'catv00001300',
        carrefourId: '255',
        cencosudSlug: 'bebidas',
        diaSlug: 'bebidas',
        vtexMap: 'c',
        children: [
          {
            id: 'cervezas',
            name: 'Cervezas',
            cotoId: 'catv00001527',
            carrefourId: '255/256',
            cencosudSlug: 'cervezas',
            diaSlug: 'cervezas',
            vtexMap: 'c,c'
          },
          {
            id: 'vinos',
            name: 'Vinos',
            cotoId: 'catv00001532',
            carrefourId: '255/257',
            cencosudSlug: 'vinos',
            diaSlug: 'bodega',
            vtexMap: 'c,c'
          }
        ]
      }
    ]
  },
  {
    id: 'almacen',
    name: 'Almacén',
    cotoId: 'catv00001254',
    carrefourId: '161',
    cencosudSlug: 'almacen',
    diaSlug: 'almacen',
    vtexMap: 'c',
    children: [
      {
        id: 'infusiones',
        name: 'Infusiones',
        cotoId: 'catv00001275',
        carrefourId: '222/238',
        cencosudSlug: 'infusiones',
        diaSlug: 'desayuno',
        vtexMap: 'c,c'
      },
      {
        id: 'aceites',
        name: 'Aceites y Vinagres',
        cotoId: 'catv00001264',
        carrefourId: '161/162',
        cencosudSlug: 'aceites-y-vinagres',
        diaSlug: 'aceites-y-aderezos',
        vtexMap: 'c,c'
      }
    ]
  },
  {
    id: 'lacteos',
    name: 'Lácteos y Frescos',
    cotoId: 'catv00001255',
    carrefourId: '292',
    cencosudSlug: 'lacteos',
    diaSlug: 'frescos',
    vtexMap: 'c',
    children: [
      {
        id: 'leches',
        name: 'Leches',
        cotoId: 'catv00003266',
        carrefourId: '292/293',
        cencosudSlug: 'leches',
        diaSlug: 'leches',
        vtexMap: 'c,c'
      },
      {
        id: 'quesos',
        name: 'Quesos',
        cotoId: 'catv00003769',
        carrefourId: '292/310',
        cencosudSlug: 'quesos-y-fiambres',
        diaSlug: 'frescos',
        vtexMap: 'c,c'
      }
    ]
  },
  {
    id: 'limpieza',
    name: 'Limpieza',
    cotoId: 'catv00001258',
    carrefourId: '359',
    cencosudSlug: 'limpieza',
    diaSlug: 'limpieza',
    vtexMap: 'c',
    children: [
      {
        id: 'limpieza-ropa',
        name: 'Cuidado de la Ropa',
        cotoId: 'catv00002752',
        carrefourId: '359/360',
        cencosudSlug: 'cuidado-para-la-ropa',
        diaSlug: 'cuidado-de-la-ropa',
        vtexMap: 'c,c'
      }
    ]
  },
  {
    id: 'perfumeria',
    name: 'Perfumería',
    cotoId: 'catv00001257',
    carrefourId: '402',
    cencosudSlug: 'perfumeria',
    diaSlug: 'perfumeria',
    vtexMap: 'c',
    children: [
      {
        id: 'cuidado-cabello',
        name: 'Cuidado del Cabello',
        cotoId: 'catv00002821',
        carrefourId: '402/403',
        cencosudSlug: 'cuidado-capilar',
        diaSlug: 'cuidado-del-pelo',
        vtexMap: 'c,c'
      },
      {
        id: 'cuidado-oral',
        name: 'Cuidado Bucal',
        cotoId: 'catv00002871',
        carrefourId: '402/412',
        cencosudSlug: 'cuidado-oral',
        diaSlug: 'cuidado-bucal',
        vtexMap: 'c,c'
      },
      {
        id: 'jabones',
        name: 'Jabones',
        cotoId: 'catv00002856',
        carrefourId: '402/418',
        cencosudSlug: 'cuidado-personal',
        diaSlug: 'jabones',
        vtexMap: 'c,c'
      }
    ]
  },
  {
    id: 'congelados',
    name: 'Congelados',
    cotoId: 'catv00001296',
    carrefourId: '347',
    cencosudSlug: 'congelados',
    diaSlug: 'congelados',
    vtexMap: 'c',
    children: [
      {
        id: 'hamburguesas-medallones',
        name: 'Hamburguesas y Medallones',
        cotoId: 'catv00001358',
        carrefourId: '347/348',
        cencosudSlug: 'hamburguesas-y-milanesas',
        diaSlug: 'hamburguesas-y-medallones',
        vtexMap: 'c,c'
      },
      {
        id: 'papas-congeladas',
        name: 'Papas Congeladas',
        cotoId: 'catv00001363',
        carrefourId: '347/350',
        cencosudSlug: 'papas',
        diaSlug: 'papas-congeladas',
        vtexMap: 'c,c'
      }
    ]
  },
  {
    id: 'carnes',
    name: 'Carnes',
    cotoId: 'catv00001292',
    carrefourId: '321',
    cencosudSlug: 'carnes',
    diaSlug: 'frescos',
    vtexMap: 'c',
    children: [
      {
        id: 'carne-vacuna',
        name: 'Carne Vacuna',
        cotoId: 'catv00001323',
        carrefourId: '321/322',
        cencosudSlug: 'carne-vacuna',
        diaSlug: 'carniceria',
        vtexMap: 'c,c'
      },
      {
        id: 'pollo',
        name: 'Pollo',
        cotoId: 'catv00001327',
        carrefourId: '321/323',
        cencosudSlug: 'pollos',
        diaSlug: 'carniceria',
        vtexMap: 'c,c'
      }
    ]
  },
  {
    id: 'frutas-verduras',
    name: 'Frutas y Verduras',
    cotoId: 'catv00003285',
    carrefourId: '330',
    cencosudSlug: 'frutas-y-verduras',
    diaSlug: 'frescos'
  },
  {
    id: 'panaderia',
    name: 'Panadería',
    cotoId: 'catv00003530',
    carrefourId: '336',
    cencosudSlug: 'panaderia-y-pasteleria',
    diaSlug: 'panaderia'
  },
  {
    id: 'mascotas',
    name: 'Mascotas',
    cotoId: 'catv00006878',
    carrefourId: '471',
    cencosudSlug: 'mascotas',
    diaSlug: 'mascotas',
    vtexMap: 'c',
    children: [
      {
        id: 'perros',
        name: 'Perros',
        cotoId: 'catv00006880',
        carrefourId: '471/472',
        cencosudSlug: 'perros',
        diaSlug: 'perros',
        vtexMap: 'c,c'
      },
      {
        id: 'gatos',
        name: 'Gatos',
        cotoId: 'catv00006879',
        carrefourId: '471/474',
        cencosudSlug: 'gatos',
        diaSlug: 'gatos',
        vtexMap: 'c,c'
      }
    ]
  },
  {
    id: 'bebes',
    name: 'Bebés',
    cotoId: 'catv00002976',
    carrefourId: '451',
    cencosudSlug: 'mundo-bebe',
    diaSlug: 'bebes-y-ninos',
    vtexMap: 'c',
    children: [
      {
        id: 'panales',
        name: 'Pañales',
        cotoId: 'catv00002985',
        carrefourId: '451/452',
        cencosudSlug: 'panales',
        diaSlug: 'panales',
        vtexMap: 'c,c'
      }
    ]
  },
  {
    id: 'electro',
    name: 'Electro y Tecnología',
    cotoId: 'catv00001990',
    carrefourId: '3',
    cencosudSlug: 'electro',
    diaSlug: 'tecnologia',
    vtexMap: 'c'
  },
  {
    id: 'hogar',
    name: 'Hogar y Deco',
    cotoId: 'catv00001260',
    carrefourId: '71',
    cencosudSlug: 'hogar-y-textil',
    diaSlug: 'hogar-y-deco',
    vtexMap: 'c'
  },
  {
    id: 'textil',
    name: 'Indumentaria',
    cotoId: 'catv00001259',
    carrefourId: '563',
    cencosudSlug: 'hogar-y-textil',
    diaSlug: 'indumentaria-y-calzado',
    vtexMap: 'c'
  },
  {
    id: 'aire-libre',
    name: 'Aire Libre y Deportes',
    cotoId: 'catv00001261',
    carrefourId: '665',
    cencosudSlug: 'tiempo-libre',
    diaSlug: 'aire-libre',
    vtexMap: 'c'
  },
  {
    id: 'automotor',
    name: 'Automotor',
    cotoId: 'catv00001261',
    carrefourId: '635',
    cencosudSlug: 'hogar-y-textil',
    diaSlug: 'aire-libre',
    vtexMap: 'c'
  },

  // ─── ELECTRÓNICA ─────────────────────────────────────────────────────────
  { id: 'electro-tv', name: 'Televisores', section: 'electrónica', electroSlug: 'televisor smart tv' },
  { id: 'electro-celulares', name: 'Celulares', section: 'electrónica', electroSlug: 'celular smartphone' },
  { id: 'electro-laptops', name: 'Computadoras y Laptops', section: 'electrónica', electroSlug: 'notebook laptop computadora' },
  { id: 'electro-tablets', name: 'Tablets', section: 'electrónica', electroSlug: 'tablet' },
  { id: 'electro-audio', name: 'Audio y Parlantes', section: 'electrónica', electroSlug: 'parlante auriculares bluetooth' },
  { id: 'electro-heladeras', name: 'Heladeras y Freezers', section: 'electrónica', electroSlug: 'heladera no frost' },
  { id: 'electro-lavarropas', name: 'Lavarropas', section: 'electrónica', electroSlug: 'lavarropas' },
  { id: 'electro-aire', name: 'Aires Acondicionados', section: 'electrónica', electroSlug: 'aire acondicionado split' },
  { id: 'electro-cocinas', name: 'Cocinas y Hornos', section: 'electrónica', electroSlug: 'cocina horno microondas' },
  { id: 'electro-gaming', name: 'Gaming', section: 'electrónica', electroSlug: 'playstation xbox nintendo' },
  { id: 'electro-camara', name: 'Cámaras y Foto', section: 'electrónica', electroSlug: 'camara reflex fotografica' },
  { id: 'electro-peq-electro', name: 'Pequeños Electrodomésticos', section: 'electrónica', electroSlug: 'licuadora aspiradora plancha' },

  // ─── FARMACIAS ────────────────────────────────────────────────────────────
  {
    id: 'farma-analgesicos',
    name: 'Analgésicos',
    section: 'farmacias',
    farmaSlug: 'analgesicos',
  },
  {
    id: 'farma-digestivos',
    name: 'Digestivos',
    section: 'farmacias',
    farmaSlug: 'digestivos',
  },
  {
    id: 'farma-vitaminas',
    name: 'Vitaminas y Suplementos',
    section: 'farmacias',
    farmaSlug: 'vitaminas-y-suplementos',
  },
  {
    id: 'farma-dermocosmetica',
    name: 'Dermocosmética',
    section: 'farmacias',
    farmaSlug: 'dermocosmetica',
  },
  {
    id: 'farma-higiene',
    name: 'Higiene Personal',
    section: 'farmacias',
    farmaSlug: 'higiene-personal',
  },
  {
    id: 'farma-bebe',
    name: 'Bebé y Embarazo',
    section: 'farmacias',
    farmaSlug: 'bebe-y-embarazo',
  },
  {
    id: 'farma-optica',
    name: 'Óptica y Contactología',
    section: 'farmacias',
    farmaSlug: 'optica-y-contactologia',
  },
  {
    id: 'farma-primeros-auxilios',
    name: 'Primeros Auxilios',
    section: 'farmacias',
    farmaSlug: 'primeros-auxilios',
  },
  {
    id: 'farma-sueño',
    name: 'Sueño',
    section: 'farmacias',
    farmaSlug: 'sueno',
  },
  {
    id: 'farma-antimicoticos',
    name: 'Antimicóticos',
    section: 'farmacias',
    farmaSlug: 'antimicoticos',
  },
]

export function findCategoryNode(id: string, nodes: CategoryNode[] = CATEGORIES): CategoryNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findCategoryNode(id, node.children)
      if (found) return found
    }
  }
  return null
}

export function getFullCategoryPath(id: string, property: 'cencosudSlug' | 'diaSlug', nodes: CategoryNode[] = CATEGORIES, currentPath: string[] = []): string | null {
  for (const node of nodes) {
    const slug = node[property]
    if (slug) {
      const newPath = [...currentPath, slug]
      if (node.id === id) {
        return newPath.join('/')
      }
      if (node.children) {
        const found = getFullCategoryPath(id, property, node.children, newPath)
        if (found) return found
      }
    }
  }
  return null
}
