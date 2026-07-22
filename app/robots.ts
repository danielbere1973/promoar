import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: ['/admin', '/api/', '/verificar', '/recuperar'],
      },
      {
        // Bing aporta tráfico marginal (70 clicks / 3.4K impresiones en 3 meses vs.
        // 1.26K clicks / 53.9K impresiones de Google en la misma ventana) pero su
        // crawler despertaba Neon constantemente — ya bloqueado en middleware.ts,
        // esto además le pide explícitamente que deje de indexar.
        userAgent: 'bingbot',
        disallow: ['/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
