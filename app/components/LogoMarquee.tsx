'use client'

interface MarqueeLogo {
  name: string
  logo: string
}

export const COMMERCE_MARQUEE_LOGOS: MarqueeLogo[] = [
  { name: 'Coto', logo: 'https://beneficiosclub.personalpay.dev/partner/Logo_Supermercado_Coto.jpg' },
  { name: 'Carrefour', logo: 'https://backwebclub-media.glanacion.com/Club.LN-Strapi/A768333_57b63bd572.jpg' },
  { name: 'YPF', logo: '/logo_ypf.png' },
  { name: 'Farmacity', logo: '/logo_farmacity.png' },
  { name: 'Jumbo', logo: 'https://promociones.mercadopago.com.ar/wp-content/uploads/2026/05/LOGO-JUMBO.jpg' },
  { name: 'Disco', logo: '/logos/disco.png' },
  { name: 'Changomas', logo: 'https://static.wikia.nocookie.net/logopedia/images/f/fb/ChangoM%C3%A1s_2021.svg/revision/latest/scale-to-width-down/300?cb=20260330204513' },
  { name: 'Diarco', logo: 'https://www.galicia.ar/content/dam/galicia/banco-galicia/personas/promociones/catalogo-de-beneficios/diarco_180.png' },
  { name: 'Shell', logo: 'https://filer.365.clarin.com/filer/materiales-salesforce/prod/202311/29/202311-29-a05e3296-6d33-46b4-a5b8-1fcc46ab308b.png' },
  { name: 'Axion', logo: 'https://cdn.prod.website-files.com/63091bbd808ef433808b70cd/6938531d4ec0deada3fb5d19_Axion1%201.png' },
  { name: 'Cabify', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Cabify-Logo-Moradul-RGB.png' },
  { name: 'Mostaza', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Mostaza_restaurant_logo.png' },
]

const BANK_LOGOS: MarqueeLogo[] = [
  { name: 'Galicia', logo: 'https://www.google.com/s2/favicons?sz=128&domain=galicia.ar' },
  { name: 'BBVA', logo: 'https://www.bbva.com.ar/favicon.ico' },
  { name: 'Santander', logo: 'https://www.google.com/s2/favicons?sz=128&domain=santander.com.ar' },
  { name: 'Banco Nación', logo: 'https://www.google.com/s2/favicons?sz=128&domain=bna.com.ar' },
  { name: 'Banco Ciudad', logo: 'https://www.bancociudad.com.ar/beneficios/assets/img/logo-banco-ciudad.svg' },
  { name: 'Macro', logo: 'https://www.google.com/s2/favicons?sz=128&domain=macro.com.ar' },
  { name: 'ICBC', logo: 'https://logo-teka.com/wp-content/uploads/2026/01/icbc-vertical-logo.svg' },
  { name: 'Naranja X', logo: 'https://www.google.com/s2/favicons?sz=128&domain=naranjax.com' },
  { name: 'Brubank', logo: 'https://www.google.com/s2/favicons?sz=128&domain=brubank.com' },
  { name: 'Ualá', logo: 'https://www.google.com/s2/favicons?sz=128&domain=ualabee.com' },
  { name: 'MODO', logo: 'https://www.google.com/s2/favicons?sz=128&domain=modo.com.ar' },
  { name: 'Mercado Pago', logo: 'https://www.google.com/s2/favicons?sz=128&domain=mercadopago.com.ar' },
  { name: 'Cuenta DNI', logo: 'https://www.google.com/s2/favicons?sz=128&domain=cuentadni.com.ar' },
]

interface LogoMarqueeProps {
  logos?: MarqueeLogo[]
  reverse?: boolean
  label?: string
  tone?: 'default' | 'muted'
  className?: string
}

// Loop infinito: se duplica la lista y se anima -50% (una vuelta completa de
// la primera copia), así el corte entre el final y el reinicio es invisible.
export default function LogoMarquee({
  logos: logoSet = BANK_LOGOS,
  reverse = false,
  label,
  tone = 'default',
  className = '',
}: LogoMarqueeProps) {
  const logos = [...logoSet, ...logoSet]
  const bg = tone === 'muted' ? 'bg-[#F7F8FA] dark:bg-[#0D1D3A]' : 'bg-white dark:bg-[#0A1428]'

  return (
    <div className={`border-b border-[#E4E8EF] dark:border-slate-800 ${bg} pt-2.5 pb-3 overflow-hidden ${className}`}>
      {label && (
        <p className="px-4 mb-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {label}
        </p>
      )}
      <div
        className={`group flex w-max hover:[animation-play-state:paused] motion-reduce:animate-none ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'}`}
      >
        {logos.map((bank, i) => (
          <div
            key={`${bank.name}-${i}`}
            className="flex items-center gap-2 px-5 shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bank.logo} alt={bank.name} className="h-6 w-6 object-contain rounded-sm" />
            <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {bank.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
