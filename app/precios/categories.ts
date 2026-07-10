export interface CategoryNode {
  id: string
  name: string
  section?: 'supermercados' | 'farmacias' | 'electrónica' // undefined = supermercados (default)
  cotoId?: string
  carrefourId?: string
  cencosudSlug?: string
  diaSlug?: string
  vtexMap?: string
  farmaSlug?: string // slug para búsqueda en farmacias VTEX (fallback texto libre)
  farmacityId?: string // id de categoría VTEX real en farmacity.com
  farmaplusId?: string // id de categoría VTEX real en farmaplus.com.ar
  openfarmaTaxonId?: string // id de taxon Spree real en openfarma.com.ar
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
  // farmacityId/farmaplusId guardan el PATH COMPLETO de ancestros VTEX (ej. "979/980/987"),
  // requerido por el filtro fq=C:<path> — el id solo no alcanza. Relevado navegando
  // /api/catalog_system/pub/category/tree/3 de cada sitio. openfarmaTaxonId sí es standalone.
  {
    id: 'farma-analgesicos',
    name: 'Analgésicos',
    section: 'farmacias',
    farmaSlug: 'analgesicos',
    farmacityId: '979/980',
    farmaplusId: '5/363/364',
    openfarmaTaxonId: '4099',
    children: [
      { id: 'farma-analgesicos-adultos', name: 'Adultos', section: 'farmacias', farmaSlug: 'analgesicos adultos', farmacityId: '979/980/987', farmaplusId: '5/363/364', openfarmaTaxonId: '4099' },
      { id: 'farma-analgesicos-infantiles', name: 'Infantiles', section: 'farmacias', farmaSlug: 'analgesicos infantiles', farmacityId: '979/980/989', farmaplusId: '5/363/364', openfarmaTaxonId: '4099' },
    ],
  },
  {
    id: 'farma-digestivos',
    name: 'Digestivos',
    section: 'farmacias',
    farmaSlug: 'digestivos',
    farmacityId: '979/1011',
    farmaplusId: '5/363/365',
    openfarmaTaxonId: '4101',
    children: [
      { id: 'farma-digestivos-acidez', name: 'Acidez', section: 'farmacias', farmaSlug: 'acidez', farmacityId: '979/1011/1012', farmaplusId: '5/363/365/366', openfarmaTaxonId: '4101' },
      { id: 'farma-digestivos-antidiarreicos', name: 'Antidiarreicos', section: 'farmacias', farmaSlug: 'antidiarreicos', farmacityId: '979/1011/1013', farmaplusId: '5/363/365/367', openfarmaTaxonId: '4101' },
      { id: 'farma-digestivos-laxantes', name: 'Laxantes', section: 'farmacias', farmaSlug: 'laxantes', farmacityId: '979/1011/1017', farmaplusId: '5/363/365/368', openfarmaTaxonId: '4101' },
      { id: 'farma-digestivos-dolor-panza', name: 'Dolor de Panza', section: 'farmacias', farmaSlug: 'dolor de panza', farmacityId: '979/1011/1014', farmaplusId: '5/363/365/369', openfarmaTaxonId: '4101' },
      { id: 'farma-digestivos-mareos', name: 'Mareos', section: 'farmacias', farmaSlug: 'mareos', farmacityId: '979/1011/1016', farmaplusId: '5/363/365/370', openfarmaTaxonId: '4101' },
      { id: 'farma-digestivos-resaca', name: 'Antiresaca', section: 'farmacias', farmaSlug: 'antiresaca', farmacityId: '979/1011/1015', farmaplusId: '5/363/365/371', openfarmaTaxonId: '4101' },
    ],
  },
  {
    id: 'farma-vitaminas',
    name: 'Vitaminas y Suplementos',
    section: 'farmacias',
    farmaSlug: 'vitaminas-y-suplementos',
    farmacityId: '248/280',
    farmaplusId: '6/38',
    openfarmaTaxonId: '1740',
    children: [
      { id: 'farma-vitaminas-multivitaminicos', name: 'Multivitamínicos', section: 'farmacias', farmaSlug: 'multivitaminicos', farmacityId: '248/280/971', farmaplusId: '6/38/203', openfarmaTaxonId: '1740' },
      { id: 'farma-vitaminas-energia', name: 'Energía', section: 'farmacias', farmaSlug: 'energizante', farmacityId: '248/280/286', farmaplusId: '6/38/201', openfarmaTaxonId: '1740' },
      { id: 'farma-vitaminas-memoria', name: 'Memoria y Concentración', section: 'farmacias', farmaSlug: 'memoria', farmacityId: '248/280/291', farmaplusId: '6/38/204', openfarmaTaxonId: '1740' },
      { id: 'farma-vitaminas-huesos', name: 'Huesos y Articulaciones', section: 'farmacias', farmaSlug: 'huesos y articulaciones', farmacityId: '248/280/289', farmaplusId: '6/38/195', openfarmaTaxonId: '1740' },
      { id: 'farma-vitaminas-piel-unas-cabello', name: 'Piel, Uñas y Cabello', section: 'farmacias', farmaSlug: 'piel unas cabello', farmacityId: '248/280/294', farmaplusId: '6/38/196', openfarmaTaxonId: '1740' },
      { id: 'farma-vitaminas-defensas', name: 'Invierno y Defensas', section: 'farmacias', farmaSlug: 'defensas', farmacityId: '248/280/290', farmaplusId: '6/38/194', openfarmaTaxonId: '1740' },
    ],
  },
  {
    id: 'farma-dermocosmetica',
    name: 'Dermocosmética',
    section: 'farmacias',
    farmaSlug: 'dermocosmetica',
    farmacityId: '116',
    farmaplusId: '2',
    openfarmaTaxonId: '1569',
    children: [
      { id: 'farma-dermo-facial', name: 'Facial', section: 'farmacias', farmaSlug: 'dermocosmetica facial', farmacityId: '116/67', farmaplusId: '2/18', openfarmaTaxonId: '1569' },
      { id: 'farma-dermo-corporal', name: 'Corporal', section: 'farmacias', farmaSlug: 'dermocosmetica corporal', farmacityId: '116/124', farmaplusId: '2/19', openfarmaTaxonId: '1569' },
      { id: 'farma-dermo-solar', name: 'Protección Solar', section: 'farmacias', farmaSlug: 'protector solar', farmacityId: '116/432', farmaplusId: '2/21', openfarmaTaxonId: '1569' },
      { id: 'farma-dermo-capilar', name: 'Capilar', section: 'farmacias', farmaSlug: 'dermocosmetica capilar', farmacityId: '116/437', farmaplusId: '2/20', openfarmaTaxonId: '1569' },
    ],
  },
  {
    id: 'farma-higiene',
    name: 'Higiene Personal',
    section: 'farmacias',
    farmaSlug: 'higiene-personal',
    farmacityId: '92/170',
    farmaplusId: '4/28',
    openfarmaTaxonId: '1713',
    children: [
      { id: 'farma-higiene-oral', name: 'Cuidado Oral', section: 'farmacias', farmaSlug: 'cuidado oral', farmacityId: '92/149', farmaplusId: '4/26', openfarmaTaxonId: '1713' },
      { id: 'farma-higiene-afeitado', name: 'Afeitado y Depilación', section: 'farmacias', farmaSlug: 'afeitado depilacion', farmacityId: '92/170/171', farmaplusId: '4/28/143', openfarmaTaxonId: '1713' },
      { id: 'farma-higiene-femenina', name: 'Protección Femenina', section: 'farmacias', farmaSlug: 'proteccion femenina', farmacityId: '92/170/190', farmaplusId: '4/28/146', openfarmaTaxonId: '1713' },
      { id: 'farma-higiene-desodorantes', name: 'Desodorantes', section: 'farmacias', farmaSlug: 'desodorantes', farmacityId: '92/170/441', farmaplusId: '4/28/322', openfarmaTaxonId: '1713' },
    ],
  },
  {
    id: 'farma-bebe',
    name: 'Bebé y Embarazo',
    section: 'farmacias',
    farmaSlug: 'bebe-y-embarazo',
    farmacityId: '3',
    farmaplusId: '1',
    openfarmaTaxonId: '1639',
    children: [
      { id: 'farma-bebe-panales', name: 'Pañales', section: 'farmacias', farmaSlug: 'pañales bebe', farmacityId: '3/1036', farmaplusId: '1/14/63', openfarmaTaxonId: '1639' },
      { id: 'farma-bebe-higiene', name: 'Higiene del Bebé', section: 'farmacias', farmaSlug: 'higiene del bebe', farmacityId: '3/967', farmaplusId: '1/14', openfarmaTaxonId: '1639' },
      { id: 'farma-bebe-lactancia', name: 'Lactancia y Maternidad', section: 'farmacias', farmaSlug: 'lactancia', farmacityId: '3/966', farmaplusId: '1/282', openfarmaTaxonId: '1639' },
      { id: 'farma-bebe-nutricion', name: 'Nutrición Infantil', section: 'farmacias', farmaSlug: 'nutricion infantil', farmacityId: '3/13', farmaplusId: '1/13', openfarmaTaxonId: '1639' },
    ],
  },
  {
    id: 'farma-optica',
    name: 'Óptica y Contactología',
    section: 'farmacias',
    farmaSlug: 'optica-y-contactologia',
    farmacityId: '979/1026',
    farmaplusId: '5/32',
    children: [
      { id: 'farma-optica-lagrimas', name: 'Lágrimas Artificiales', section: 'farmacias', farmaSlug: 'lagrimas artificiales', farmacityId: '979/1026/1027', farmaplusId: '5/32/291' },
      { id: 'farma-optica-descongestivos', name: 'Descongestivos Oculares', section: 'farmacias', farmaSlug: 'descongestivo ocular', farmacityId: '979/1026/1028', farmaplusId: '5/32/291' },
      { id: 'farma-optica-limpiadores', name: 'Limpiadores de Cristales', section: 'farmacias', farmaSlug: 'limpiador de cristales', farmacityId: '979/1026', farmaplusId: '5/32/173' },
      { id: 'farma-optica-soluciones', name: 'Soluciones Multipropósito', section: 'farmacias', farmaSlug: 'solucion multiproposito lentes', farmacityId: '979/1026', farmaplusId: '5/32/292' },
    ],
  },
  {
    id: 'farma-primeros-auxilios',
    name: 'Primeros Auxilios',
    section: 'farmacias',
    farmaSlug: 'primeros-auxilios',
    farmacityId: '979/1031',
    farmaplusId: '5/34',
    children: [
      { id: 'farma-auxilios-antisepticos', name: 'Antisépticos', section: 'farmacias', farmaSlug: 'antisepticos', farmacityId: '979/1031/1032', farmaplusId: '5/34/177' },
      { id: 'farma-auxilios-vendas', name: 'Apósitos, Vendas y Gasas', section: 'farmacias', farmaSlug: 'apositos vendas gasas', farmacityId: '199/226/232', farmaplusId: '5/34/178' },
      { id: 'farma-auxilios-picaduras', name: 'Picaduras', section: 'farmacias', farmaSlug: 'picaduras', farmacityId: '979/1031/1033', farmaplusId: '5/34/177' },
    ],
  },
  {
    id: 'farma-sueño',
    name: 'Sueño',
    section: 'farmacias',
    farmaSlug: 'sueno',
    farmacityId: '979/1022',
    farmaplusId: '5/363/382',
    children: [
      { id: 'farma-sueño-sedantes', name: 'Sedantes', section: 'farmacias', farmaSlug: 'sedantes', farmacityId: '979/1022/1023', farmaplusId: '5/363/382' },
      { id: 'farma-sueño-reguladores', name: 'Reguladores de Sueño', section: 'farmacias', farmaSlug: 'reguladores de sueño', farmacityId: '979/1022/1024', farmaplusId: '5/363/382' },
      { id: 'farma-sueño-inductores', name: 'Inductores de Sueño', section: 'farmacias', farmaSlug: 'inductores de sueño', farmacityId: '979/1022/1025', farmaplusId: '5/363/382' },
    ],
  },
  {
    id: 'farma-antimicoticos',
    name: 'Antimicóticos',
    section: 'farmacias',
    farmaSlug: 'antimicoticos',
    farmacityId: '979/993',
    farmaplusId: '5/363/385',
    openfarmaTaxonId: '4162',
    children: [
      { id: 'farma-antimicoticos-piel', name: 'Piel', section: 'farmacias', farmaSlug: 'antimicotico piel', farmacityId: '979/993/994', farmaplusId: '5/363/385', openfarmaTaxonId: '4162' },
      { id: 'farma-antimicoticos-unas', name: 'Uñas', section: 'farmacias', farmaSlug: 'antimicotico uñas', farmacityId: '979/993/995', farmaplusId: '5/363/385', openfarmaTaxonId: '4162' },
      { id: 'farma-antimicoticos-vaginales', name: 'Vaginales', section: 'farmacias', farmaSlug: 'antimicotico vaginal', farmacityId: '979/993/996', farmaplusId: '5/363/385', openfarmaTaxonId: '4162' },
    ],
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
