# Auditoría SEO — PromoAR (`promoar.com.ar`)

Sos Claude Code con acceso completo al proyecto Next.js 14 de PromoAR.
Necesito que hagas una auditoría SEO completa y apliques las correcciones donde sea posible.
Seguí el orden de prioridades tal como está listado.

---

## Contexto del proyecto

- **Stack:** Next.js 14 (App Router), TypeScript, Prisma, Neon PostgreSQL
- **Dominio:** `https://www.promoar.com.ar`
- **Problema principal:** El sitio no aparece indexado en Google a pesar de tener sitemap y robots.txt enviados. Dominio nuevo, cero backlinks.

---

## PASO 1 — Diagnóstico: recorrido inicial

Antes de tocar nada, hacé lo siguiente y reportame los resultados:

```
1. Listá la estructura de carpetas de `app/` completa (árabe y niveles)
2. Mostrá el contenido de `next.config.js` (o `next.config.ts`)
3. Mostrá el contenido de `app/layout.tsx` (root layout)
4. Buscá todos los archivos que contengan la palabra "noindex" en el proyecto
5. Buscá todos los archivos `metadata` o `generateMetadata` en app/
6. Mostrá el contenido de `app/sitemap.ts` (o `sitemap.xml` si es estático)
7. Mostrá el contenido de `public/robots.txt`
8. Buscá si hay algún `<meta name="robots"` hardcodeado en algún componente
```

Con esa info podemos confirmar si hay algo bloqueando la indexación desde el código.

---

## PASO 2 — Verificar renderizado (SSR vs CSR)

El problema más común en Next.js 14 con App Router es que las páginas de datos
se rendericen del lado del cliente (con `useEffect` o SWR/React Query sin cache),
lo que hace que Googlebot vea HTML vacío.

```
1. Abrí los archivos de las rutas principales:
   - app/page.tsx (home)
   - app/promos/page.tsx (o como se llame la página de promociones)
   - app/banco/[banco]/page.tsx (o ruta equivalente)
   - app/finanzas/page.tsx

2. Para cada uno, identificá si los datos se cargan con:
   a) async/await en el server component (BIEN — SSR)
   b) useEffect / useSWR / useQuery en un client component (MAL para SEO)
   c) fetch() directo en el server component (BIEN si no tiene { cache: 'no-store' } sin revalidate)

3. Reportame qué patrón usa cada ruta.
```

---

## PASO 3 — Implementar `generateMetadata()` dinámico

Para cada ruta que no tenga metadata dinámica, agregala.

### 3.1 Root layout (`app/layout.tsx`)

El root layout debe tener metadata base. Verificá que exista y tenga este formato mínimo:

```tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://www.promoar.com.ar'),
  title: {
    default: 'PromoAR — Promociones bancarias en Argentina',
    template: '%s | PromoAR',
  },
  description: 'Encontrá los mejores descuentos con tu tarjeta: Galicia, Santander, BBVA, MODO, Cuenta DNI y más. Actualizado diario.',
  openGraph: {
    siteName: 'PromoAR',
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}
```

### 3.2 Página de banco (`app/banco/[banco]/page.tsx`)

Si no tiene `generateMetadata`, agregala:

```tsx
export async function generateMetadata({ params }: { params: { banco: string } }): Promise<Metadata> {
  const nombreBanco = params.banco.charAt(0).toUpperCase() + params.banco.slice(1)
  
  return {
    title: `Promociones ${nombreBanco} hoy`,
    description: `Descuentos y reintegros con tarjetas ${nombreBanco} en supermercados, combustible, gastronomía y más. Actualizado diario en PromoAR.`,
    openGraph: {
      title: `Promociones ${nombreBanco} | PromoAR`,
      description: `Todos los descuentos con ${nombreBanco} en un solo lugar.`,
      url: `https://www.promoar.com.ar/banco/${params.banco}`,
    },
    alternates: {
      canonical: `https://www.promoar.com.ar/banco/${params.banco}`,
    },
  }
}
```

### 3.3 Página de promociones (`app/promos/page.tsx`)

```tsx
export const metadata: Metadata = {
  title: 'Promociones bancarias Argentina hoy',
  description: 'Todas las promociones bancarias de Argentina en un lugar. Filtrá por banco, día y categoría. Galicia, Santander, BBVA, MODO y más.',
  alternates: {
    canonical: 'https://www.promoar.com.ar/promos',
  },
}
```

---

## PASO 4 — Implementar Schema.org (JSON-LD)

Este es el diferenciador más grande frente a los competidores.
Permite que las promos aparezcan como **rich results** en Google.

### 4.1 Crear helper en `lib/schema.ts`

```typescript
// lib/schema.ts

export function schemaOrganization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'PromoAR',
    url: 'https://www.promoar.com.ar',
    logo: 'https://www.promoar.com.ar/logo.png',
    description: 'Buscador de promociones bancarias y descuentos en Argentina.',
    sameAs: [
      // Agregá acá si tenés redes sociales
    ],
  }
}

export function schemaWebSite() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'PromoAR',
    url: 'https://www.promoar.com.ar',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://www.promoar.com.ar/promos?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function schemaPromoList(banco: string, promociones: Array<{
  titulo: string
  descripcion: string
  descuento: string
  fechaDesde?: string
  fechaHasta?: string
}>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Promociones bancarias ${banco}`,
    description: `Descuentos con tarjetas ${banco} en Argentina`,
    url: `https://www.promoar.com.ar/banco/${banco.toLowerCase()}`,
    itemListElement: promociones.map((promo, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Offer',
        name: promo.titulo,
        description: promo.descripcion,
        discount: promo.descuento,
        ...(promo.fechaDesde && { validFrom: promo.fechaDesde }),
        ...(promo.fechaHasta && { validThrough: promo.fechaHasta }),
        seller: {
          '@type': 'Organization',
          name: banco,
        },
        areaServed: {
          '@type': 'Country',
          name: 'Argentina',
        },
      },
    })),
  }
}
```

### 4.2 Agregar JSON-LD al root layout

```tsx
// app/layout.tsx
import { schemaOrganization, schemaWebSite } from '@/lib/schema'

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrganization()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaWebSite()) }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### 4.3 Agregar JSON-LD a páginas de banco

```tsx
// app/banco/[banco]/page.tsx
import { schemaPromoList } from '@/lib/schema'

export default async function BancoPage({ params }) {
  const promociones = await getPromosByBanco(params.banco) // tu función existente
  
  const jsonLd = schemaPromoList(params.banco, promociones)
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* resto del componente */}
    </>
  )
}
```

---

## PASO 5 — Verificar y mejorar el sitemap dinámico

Si el sitemap es dinámico (`app/sitemap.ts`), verificá que incluya:

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Rutas estáticas
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: 'https://www.promoar.com.ar',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://www.promoar.com.ar/promos',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: 'https://www.promoar.com.ar/finanzas',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  // Rutas dinámicas por banco
  const bancos = [
    'galicia', 'santander', 'bbva', 'macro', 'nacion',
    'ciudad', 'provincia', 'hsbc', 'icbc', 'brubank',
    'uala', 'modo', 'cuenta-dni', 'mercado-pago', 'personal-pay',
  ]
  
  const bancoRoutes: MetadataRoute.Sitemap = bancos.map(banco => ({
    url: `https://www.promoar.com.ar/banco/${banco}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  return [...staticRoutes, ...bancoRoutes]
}
```

> **Importante:** Si las rutas de banco son distintas en tu app, ajustá los slugs.
> Asegurate de que cada URL en el sitemap sea accesible (no redirija ni devuelva 404).

---

## PASO 6 — Agregar canonical tags

Para evitar contenido duplicado (especialmente si hay parámetros de URL como `?banco=galicia`),
verificá que todas las páginas indexables tengan canonical. Next.js lo maneja con `alternates.canonical`
en la metadata (ya incluido en los ejemplos del Paso 3).

Si hay páginas que se acceden con y sin `/` al final, verificar que `next.config.js` tenga:

```js
// next.config.js
const nextConfig = {
  trailingSlash: false, // o true, pero consistente
}
```

---

## PASO 7 — Checklist final de verificación

Después de aplicar todos los cambios, verificá esto en el navegador:

- [ ] `https://www.promoar.com.ar/robots.txt` — sin `Disallow: /` global
- [ ] `https://www.promoar.com.ar/sitemap.xml` — todas las URLs esperadas visibles
- [ ] Ver source (`Ctrl+U`) de la home — ¿hay contenido HTML real o solo divs vacíos?
- [ ] Ver source de `/banco/galicia` — ¿hay texto sobre promociones en el HTML inicial?
- [ ] Abrir DevTools → Network → deshabilitar JS → recargar página → ¿se ve contenido?
- [ ] Buscar en Google: `site:promoar.com.ar` — reportar cuántas URLs aparecen
- [ ] Usar la herramienta "Inspeccionar URL" en Google Search Console para la home

---

## Notas adicionales

**Keywords prioritarias a atacar:**
- `promociones bancarias argentina`
- `descuentos con tarjeta [banco] hoy`
- `qué día conviene ir al súper con [banco]`
- `reintegros [banco] [mes] [año]`
- `promociones modo argentina`
- `cuenta dni descuentos supermercado`

**Ventaja competitiva en SEO a explotar:**
El dominio `.com.ar` tiene señal de relevancia local para búsquedas argentinas.
El principal competidor (promoarg.com) usa `.com` — eso es una ventaja tuya.

**Próximo paso post-técnico:**
Una vez que el sitio esté indexando correctamente, el factor que más va a mover
la aguja es conseguir los primeros 10-20 backlinks. Ver plan de link building aparte.
