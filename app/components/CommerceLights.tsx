'use client'

interface LightLogo {
  name: string
  logo: string
}

// Lista curada a mano (no query a DB) — cadenas de alto volumen ya conocidas
// del negocio (ver CLAUDE.md "Estado de scrapers"). Los logoUrl son los que
// ya están cargados en Commerce.logoUrl en producción.
const COMMERCE_LOGOS: LightLogo[] = [
  { name: 'Coto', logo: 'https://beneficiosclub.personalpay.dev/partner/Logo_Supermercado_Coto.jpg' },
  { name: 'Carrefour', logo: 'https://backwebclub-media.glanacion.com/Club.LN-Strapi/A768333_57b63bd572.jpg' },
  { name: 'YPF', logo: '/logo_ypf.png' },
  { name: 'Farmacity', logo: '/logo_farmacity.png' },
  { name: 'Jumbo', logo: 'https://promociones.mercadopago.com.ar/wp-content/uploads/2026/05/LOGO-JUMBO.jpg' },
  { name: 'Disco', logo: '/logos/disco.png' },
  { name: 'Vea', logo: 'https://promociones.mercadopago.com.ar/wp-content/uploads/2026/05/LOGO-VEA.jpg' },
  { name: 'Changomas', logo: 'https://static.wikia.nocookie.net/logopedia/images/f/fb/ChangoM%C3%A1s_2021.svg/revision/latest/scale-to-width-down/300?cb=20260330204513' },
  { name: 'Diarco', logo: 'https://www.galicia.ar/content/dam/galicia/banco-galicia/personas/promociones/catalogo-de-beneficios/diarco_180.png' },
  { name: 'Shell', logo: 'https://filer.365.clarin.com/filer/materiales-salesforce/prod/202311/29/202311-29-a05e3296-6d33-46b4-a5b8-1fcc46ab308b.png' },
  { name: 'Axion', logo: 'https://cdn.prod.website-files.com/63091bbd808ef433808b70cd/6938531d4ec0deada3fb5d19_Axion1%201.png' },
  { name: 'Cabify', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Cabify-Logo-Moradul-RGB.png' },
  { name: 'Mostaza', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Mostaza_restaurant_logo.png' },
  { name: "McDonald's", logo: 'https://filer.365.clarin.com/filer/materiales-salesforce/prod/202403/27/202403-27-ab955707-f410-4296-a493-fa45e28745db.png' },
  { name: 'Burger King', logo: 'https://ahorrosybeneficios.bancopatagonia.com.ar/pub/media/catalog/product/cache/535dd7322fd89df55ad0692e3106f436/b/u/burger_king_3.png' },
  { name: 'Personal', logo: 'https://www.galicia.ar/content/dam/galicia/banco-galicia/personas/promociones/catalogo-de-beneficios/personal_180.png' },
  { name: 'Havanna', logo: 'https://havanna.com.ar/images/logo.png?v=1.2' },
  { name: 'Freddo', logo: 'https://backwebclub-media.glanacion.com/Club.LN-Strapi/A767899_e3177fd433.jpg' },
  { name: 'Grido', logo: 'https://filer.365.clarin.com/filer/materiales-salesforce/prod/202305/02/202305-02-70c88775-f2e3-44b3-9215-53ee4d444b6c.png' },
  { name: 'Despegar', logo: 'https://cdn.prod.website-files.com/63091bbd808ef433808b70cd/69719c6010b62083a2ab08ce_image%20576.png' },
  { name: 'Zara', logo: 'https://d15j2h49piim29.cloudfront.net/zara.png' },
]

// Posiciones fijas, ya debajo del header + las 2 franjas de marquee (~140px)
// para no mezclarse con esas — "top" acá es relativo a esa zona libre, no al
// viewport completo. Escalonadas en altura y en el delay de la animación
// para que el efecto de "luces" no titile todo junto. Tamaño grande (110-170px)
// para que se lean con claridad en el margen ancho que deja el 2xl+.
const LEFT_SLOTS = [
  { top: '2%', size: 120 },
  { top: '18%', size: 145 },
  { top: '34%', size: 110 },
  { top: '49%', size: 160 },
  { top: '65%', size: 125 },
  { top: '80%', size: 150 },
  { top: '93%', size: 115 },
]
const RIGHT_SLOTS = [
  { top: '8%', size: 140 },
  { top: '24%', size: 115 },
  { top: '40%', size: 165 },
  { top: '55%', size: 130 },
  { top: '70%', size: 150 },
  { top: '85%', size: 120 },
  { top: '96%', size: 135 },
]

function LightColumn({ side, slots, logos }: { side: 'left' | 'right'; slots: typeof LEFT_SLOTS; logos: LightLogo[] }) {
  return (
    <div
      className={`hidden 2xl:block fixed top-36 bottom-0 w-52 pointer-events-none z-0 ${side === 'left' ? 'left-6' : 'right-6'}`}
      aria-hidden="true"
    >
      {slots.map((slot, i) => {
        const bank = logos[i % logos.length]
        return (
          <div
            key={`${side}-${i}`}
            className="absolute animate-light-fade"
            style={{
              top: slot.top,
              [side]: 0,
              width: slot.size,
              height: slot.size,
              animationDelay: `${i * 2.5}s`,
            } as React.CSSProperties}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bank.logo}
              alt={bank.name}
              className="w-full h-full object-contain rounded-2xl bg-white dark:bg-[#0F2040] shadow-md p-3"
            />
          </div>
        )
      })}
    </div>
  )
}

// Marcas de alto volumen mostradas como "luces" que aparecen/desaparecen en
// los márgenes libres — solo en pantallas anchas (2xl+), donde hay espacio
// real a los costados del contenido central max-w-3xl.
export default function CommerceLights() {
  return (
    <>
      <LightColumn side="left" slots={LEFT_SLOTS} logos={COMMERCE_LOGOS} />
      <LightColumn side="right" slots={RIGHT_SLOTS} logos={[...COMMERCE_LOGOS].reverse()} />
    </>
  )
}
