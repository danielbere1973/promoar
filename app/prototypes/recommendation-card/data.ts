// Datos de referencia para el prototipo de Recommendation Card.
// Basado en el ejemplo conceptual del CPO Direction "Reencuadre de la pieza visual" (11/8/2026):
// rubro Supermercados, destacada Carrefour + secundarias Jumbo/Coto.

export type RazonCode = 'medio_ya_tenes' | 'rubro_prioritario' | 'mejor_oportunidad' | 'cercania' | 'vence_pronto'

export const RAZON_LABEL: Record<RazonCode, string> = {
  medio_ya_tenes: 'Ya tenés el medio de pago',
  rubro_prioritario: 'Es un rubro prioritario para vos',
  mejor_oportunidad: 'Es una de las mejores oportunidades disponibles hoy para este gasto',
  cercania: 'Tenés una sucursal cerca',
  vence_pronto: 'Vence pronto',
}

export type Recomendacion = {
  rubro: string
  comercio: string
  tituloNarrativo: string // "Te conviene hacer la compra semanal en Carrefour."
  descuentoPct: number
  tope?: string
  medio: string // banco/wallet
  red?: string // Visa/Mastercard/etc
  segmento?: string // "Crédito", "Débito"
  dias?: string
  vencimiento?: string
  razones: RazonCode[]
  logoInicial: string
  logoColor: string
  logoUrl: string
  medioLogoUrl: string
  matchScore: number // 0-100
}

export const DESTACADA: Recomendacion = {
  rubro: 'Supermercados',
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
  medioLogoUrl: 'https://logo.clearbit.com/galicia.com.ar',
  matchScore: 96,
}

export type Secundaria = {
  comercio: string
  descuentoPct: number
  medio: string
  logoInicial: string
  logoColor: string
  logoUrl: string
}

export const SECUNDARIAS: Secundaria[] = [
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
]
