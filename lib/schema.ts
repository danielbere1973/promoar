const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'

export function schemaOrganization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'PromoAR',
    url: BASE_URL,
    logo: `${BASE_URL}/logo_promoar.jpeg`,
    description: 'Buscador de promociones bancarias y descuentos en Argentina.',
    sameAs: [
      'https://www.instagram.com/promoar.com.ar',
    ],
  }
}

export function schemaWebSite() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'PromoAR',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/promos?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function schemaOffer(params: {
  name: string
  description?: string | null
  url: string
  sellerName: string
  validFrom?: Date | null
  validThrough?: Date | null
  image?: string | null
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: params.name,
    description: params.description || params.name,
    url: params.url,
    ...(params.image && { image: params.image }),
    ...(params.validFrom && { validFrom: params.validFrom.toISOString() }),
    ...(params.validThrough && { validThrough: params.validThrough.toISOString() }),
    seller: {
      '@type': 'Organization',
      name: params.sellerName,
    },
    areaServed: {
      '@type': 'Country',
      name: 'Argentina',
    },
  }
}

export function schemaItemList(params: {
  name: string
  description?: string
  url: string
  items: Array<{ name: string; url: string }>
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: params.name,
    description: params.description,
    url: params.url,
    itemListElement: params.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Offer',
        name: item.name,
        url: item.url,
      },
    })),
  }
}
