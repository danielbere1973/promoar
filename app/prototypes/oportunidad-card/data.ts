export type Oportunidad = {
  comercio: string
  categoria: string
  descuentoPct: number
  medio: string // banco/wallet
  red?: string // Visa/Mastercard/etc
  tope?: string
  minimo?: string
  dias?: string
  vencimiento?: string
  cuotas?: string
  logoInicial: string
  logoColor: string
  logoUrl: string
  matchScore?: number // 0-100, qué tan bien matchea el perfil del usuario
}

export const OPORTUNIDAD: Oportunidad = {
  comercio: 'Carrefour',
  categoria: 'Supermercados',
  descuentoPct: 25,
  medio: 'Banco Galicia',
  red: 'Visa',
  tope: '$8.000',
  dias: 'Miércoles',
  vencimiento: 'Vence hoy 23:59',
  logoInicial: 'C',
  logoColor: '#0a3ca8',
  logoUrl: 'https://backwebclub-media.glanacion.com/Club.LN-Strapi/A768333_57b63bd572.jpg',
  matchScore: 96,
}

export const SIBLINGS: Oportunidad[] = [
  {
    comercio: 'YPF',
    categoria: 'Combustible',
    descuentoPct: 20,
    medio: 'MODO',
    tope: '$5.000',
    dias: 'Martes',
    logoInicial: 'Y',
    logoColor: '#1a1a1a',
    logoUrl: '/logo_ypf.png',
    matchScore: 88,
  },
  {
    comercio: 'Farmacity',
    categoria: 'Farmacias',
    descuentoPct: 0,
    cuotas: '3 cuotas sin interés',
    medio: 'Banco Santander',
    red: 'Visa',
    logoInicial: 'F',
    logoColor: '#e30613',
    logoUrl: '/logo_farmacity.png',
    matchScore: 74,
  },
  {
    comercio: 'Coto',
    categoria: 'Supermercados',
    descuentoPct: 15,
    medio: 'Mercado Pago',
    dias: 'Todos los días',
    logoInicial: 'C',
    logoColor: '#ed1c24',
    logoUrl: 'https://beneficiosclub.personalpay.dev/partner/Logo_Supermercado_Coto.jpg',
    matchScore: 81,
  },
]
