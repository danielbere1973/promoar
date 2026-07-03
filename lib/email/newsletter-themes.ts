export interface NewsletterTheme {
  id: string
  label: string
  emoji: string
  defaultSubject: string
  intro: string
  categoryIds: string[] | null // null = todas las categorías
  dayBitmask: number | null    // null = todos los días
  take: number
  groupByDay?: boolean
}

// Bits: dom=1, lun=2, mar=4, mié=8, jue=16, vie=32, sáb=64
export const NEWSLETTER_THEMES: NewsletterTheme[] = [
  {
    id: 'top3-finde',
    label: '3 mejores para el finde',
    emoji: '🎉',
    defaultSubject: '🎉 Tus 3 mejores promos para este fin de semana',
    intro: 'El finde viene con descuentos. Estas son tus mejores promos para este sábado y domingo.',
    categoryIds: null,
    dayBitmask: 65, // sáb(64) + dom(1)
    take: 3,
  },
  {
    id: 'top5-semana',
    label: '5 mejores de la semana',
    emoji: '📅',
    defaultSubject: '📅 Tus 5 mejores promos de esta semana',
    intro: 'Las mejores promociones disponibles esta semana según tus tarjetas y banco.',
    categoryIds: null,
    dayBitmask: null,
    take: 5,
  },
  {
    id: 'heladerias',
    label: 'Heladerías',
    emoji: '🍦',
    defaultSubject: '🍦 Las mejores promos en heladerías para vos',
    intro: 'Siempre es buen momento para una heladería. Estas son las mejores promos con tus tarjetas.',
    categoryIds: ['cmoeltt1n000dbhs92pqmh9wa'],
    dayBitmask: null,
    take: 3,
  },
  {
    id: 'gastronomia',
    label: 'Gastronomía',
    emoji: '🍽️',
    defaultSubject: '🍽️ Tus mejores descuentos en gastronomía',
    intro: 'Salir a comer siempre es mejor con una promo bancaria. Mirá lo que tenés disponible.',
    categoryIds: ['cmnulzrnd000oqlkkha2lvzwn'],
    dayBitmask: null,
    take: 3,
  },
  {
    id: 'petshops',
    label: '🐾 Petshops',
    emoji: '🐾',
    defaultSubject: '🐾 Promos en petshops — porque tu mascota también ahorra',
    intro: '¿Tenés mascota? Estas son las 3 mejores promos en petshops para aprovechar esta semana.',
    categoryIds: ['cmnulzr0f000nqlkkmmw3g0wl'],
    dayBitmask: null,
    take: 3,
  },
  {
    id: 'farmacias',
    label: 'Farmacias',
    emoji: '💊',
    defaultSubject: '💊 Tus 3 mejores promos en farmacias',
    intro: 'Ahorrá en medicamentos, cosmética y cuidado personal con estas promos.',
    categoryIds: ['cmnulzqd4000mqlkk2c9xedfp'],
    dayBitmask: null,
    take: 3,
  },
  {
    id: 'transporte',
    label: 'Transporte',
    emoji: '🚌',
    defaultSubject: '🚌 ¿Viajás en bondi y subte? Estas promos son para vos',
    intro: 'Las mejores promos en transporte público — SUBE, colectivo, tren y subte.',
    categoryIds: ['cmnulznre000jqlkk0y1kuo8w'],
    dayBitmask: null,
    take: 3,
  },
  {
    id: 'supermercados-por-dia',
    label: 'Supermercados por día',
    emoji: '🛒',
    defaultSubject: '🛒 Tus descuentos en supermercados — día por día',
    intro: 'Organizá tus compras del super según qué promo aplica cada día de la semana.',
    categoryIds: ['cmnulzpng000lqlkklp8a7q4k'],
    dayBitmask: null,
    take: 12,
    groupByDay: true,
  },
  {
    id: 'combustible',
    label: 'Combustible',
    emoji: '⛽',
    defaultSubject: '⛽ Aprovechá estas promos en combustible y automotores',
    intro: 'Cargá nafta, GNC o diesel con descuento. Las mejores promos disponibles para vos.',
    categoryIds: ['cmnulzoxs000kqlkkk641j763', 'cmok4ul4l0000xg1wf0mmt8lo'],
    dayBitmask: null,
    take: 3,
  },
  {
    id: 'shoppings',
    label: 'Shoppings',
    emoji: '🛍️',
    defaultSubject: '🛍️ Andá de compras al shopping con estas 5 promos',
    intro: 'Aprovechá y hacete un gustito. Estas son las 5 mejores promos en shoppings para vos.',
    categoryIds: ['cmq1sxst0000h10rx0f3s1rx5'],
    dayBitmask: null,
    take: 5,
  },
]

export const THEME_BY_ID = Object.fromEntries(NEWSLETTER_THEMES.map(t => [t.id, t]))

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const DAY_BITS = [1, 2, 4, 8, 16, 32, 64]

export function getValidDayNames(validDays: number | null): string[] {
  if (!validDays || validDays === 127) return ['todos los días']
  return DAY_NAMES.filter((_, i) => (validDays & DAY_BITS[i]) !== 0)
}

export function groupPromosByDay(promos: any[]): { dayLabel: string; bit: number; promos: any[] }[] {
  const result: { dayLabel: string; bit: number; promos: any[] }[] = []
  const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  for (let i = 0; i < 7; i++) {
    const bit = DAY_BITS[i]
    const matching = promos.filter(p => (p.validDays & bit) !== 0)
    if (matching.length > 0) {
      result.push({ dayLabel: dayLabels[i], bit, promos: matching })
    }
  }
  return result
}
