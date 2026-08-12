// Datos mock para el Design Lab de la Home por rubros.
// IMPORTANTE: esto es un fixture manual para maquetar el layout — NO es el Decision Engine real.
// El copy narrativo y las razones por oportunidad están escritos a mano acá para demostrar
// que el componente es fijo pero el contenido es variable (CPO Review §2/§3). La generación
// real de este texto es responsabilidad del motor + capa de presentación, ver RFC-008 §2.5
// (ReasonCode estructurado, mapeo a texto vive en la Home) — no de este archivo de prototipo.

export type RazonCode =
  | 'medio_ya_tenes'
  | 'rubro_prioritario'
  | 'mejor_oportunidad'
  | 'cercania'
  | 'vence_pronto'
  | 'oportunidad_infrecuente'
  | 'maximiza_ahorro_mensual'
  | 'coincide_gasto_habitual'
  | 'favorito'

export const RAZON_LABEL: Record<RazonCode, string> = {
  medio_ya_tenes: 'Ya tenés este medio de pago',
  rubro_prioritario: 'Es un rubro prioritario para vos',
  mejor_oportunidad: 'Es una de las mejores oportunidades disponibles hoy',
  cercania: 'Tenés una sucursal cerca',
  vence_pronto: 'Es una promoción que vence pronto',
  oportunidad_infrecuente: 'Es una oportunidad poco frecuente',
  maximiza_ahorro_mensual: 'Maximiza tu ahorro mensual',
  coincide_gasto_habitual: 'Coincide con tus gastos habituales',
  favorito: 'Es uno de tus comercios favoritos',
}

export type Oportunidad = {
  comercio: string
  tituloNarrativo: string
  descuentoPct?: number
  cuotas?: string // ej. "3 cuotas sin interés" — alternativa al %, mismo slot visual
  tope?: string
  medio: string
  red?: string
  segmento?: string
  dias?: string
  vencimiento?: string
  razones: RazonCode[]
  logoInicial: string
  logoColor: string
  logoUrl: string
}

export type Secundaria = {
  comercio: string
  descuentoPct: number
  medio: string
  logoInicial: string
  logoColor: string
  logoUrl: string
}

export type RubroEmptyReason = 'sin_candidatos' | 'bajo_confianza' | 'perfil_incompleto'

export type RubroSlot =
  | { status: 'ok'; id: string; label: string; destacada: Oportunidad; secundarias?: Secundaria[] }
  | { status: 'empty'; id: string; label: string; reason: RubroEmptyReason }

export const RUBROS: RubroSlot[] = [
  {
    status: 'ok',
    id: 'supermercados',
    label: 'Supermercados',
    destacada: {
      comercio: 'Carrefour',
      tituloNarrativo: 'Te conviene hacer la compra semanal en Carrefour.',
      descuentoPct: 30,
      tope: '$3.000',
      medio: 'Banco Galicia',
      red: 'Visa',
      segmento: 'Crédito',
      dias: 'Martes y miércoles',
      vencimiento: 'Vence hoy 23:59',
      razones: ['medio_ya_tenes', 'rubro_prioritario', 'mejor_oportunidad'],
      logoInicial: 'C',
      logoColor: '#0a3ca8',
      logoUrl: 'https://logo.clearbit.com/carrefour.com.ar',
    },
    secundarias: [
      {
        comercio: 'Jumbo',
        descuentoPct: 20,
        medio: 'Banco Galicia',
        logoInicial: 'J',
        logoColor: '#e30613',
        logoUrl: 'https://logo.clearbit.com/jumbo.com.ar',
      },
      {
        comercio: 'Coto',
        descuentoPct: 15,
        medio: 'Mercado Pago',
        logoInicial: 'C',
        logoColor: '#ed1c24',
        logoUrl: 'https://beneficiosclub.personalpay.dev/partner/Logo_Supermercado_Coto.jpg',
      },
    ],
  },
  {
    status: 'ok',
    id: 'combustible',
    label: 'Combustible',
    destacada: {
      comercio: 'YPF',
      tituloNarrativo: 'Esta semana cargá combustible en YPF con Mercado Pago.',
      descuentoPct: 20,
      tope: '$5.000',
      medio: 'Mercado Pago',
      dias: 'Todos los días',
      vencimiento: 'Vence en 4 días',
      razones: ['maximiza_ahorro_mensual', 'coincide_gasto_habitual'],
      logoInicial: 'Y',
      logoColor: '#1a1a1a',
      logoUrl: 'https://logo.clearbit.com/ypf.com.ar',
    },
  },
  {
    status: 'ok',
    id: 'farmacias',
    label: 'Farmacia',
    destacada: {
      comercio: 'Farmacity',
      tituloNarrativo: 'Si necesitás medicamentos, Farmacity tiene la mejor oportunidad disponible.',
      cuotas: '3 cuotas sin interés',
      medio: 'Banco Santander',
      red: 'Visa',
      dias: 'Todos los días',
      razones: ['mejor_oportunidad', 'cercania'],
      logoInicial: 'F',
      logoColor: '#e30613',
      logoUrl: 'https://logo.clearbit.com/farmacity.com',
    },
  },
  {
    status: 'ok',
    id: 'indumentaria',
    label: 'Indumentaria',
    destacada: {
      comercio: 'Zara',
      tituloNarrativo: 'Si estabas pensando comprar ropa, Zara tiene la mejor financiación esta semana.',
      cuotas: '6 cuotas sin interés',
      medio: 'Banco Macro',
      red: 'Mastercard',
      vencimiento: 'Vence en 2 días',
      razones: ['vence_pronto', 'oportunidad_infrecuente'],
      logoInicial: 'Z',
      logoColor: '#1a1a1a',
      logoUrl: 'https://logo.clearbit.com/zara.com',
    },
  },
  {
    status: 'empty',
    id: 'mascotas',
    label: 'Mascotas',
    reason: 'bajo_confianza',
  },
]

export const RUBRO_EMPTY_COPY: Record<RubroEmptyReason, string> = {
  sin_candidatos: 'No encontramos promociones activas en este rubro por ahora.',
  bajo_confianza: 'Sin oportunidad destacada en este rubro hoy.',
  perfil_incompleto: 'Completá tu perfil para ver recomendaciones en este rubro.',
}
