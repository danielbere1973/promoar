import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { GoogleAnalytics } from '@next/third-parties/google'
import Providers from './providers'
import PostHogProvider from './components/PostHogProvider'
import SupportChat from './components/SupportChat'
import MLOAuthHandler from './components/MLOAuthHandler'
import PushNotificationPrompt from './components/PushNotificationPrompt'
import InstallPrompt from './components/InstallPrompt'
import { schemaOrganization, schemaWebSite } from '@/lib/schema'
import './globals.css'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'PromoAR — Todas las promos de tus tarjetas, en un lugar',
    template: '%s | PromoAR',
  },
  description: 'Descubrí descuentos, cuotas sin interés y reintegros de tus bancos y billeteras. Galicia, BBVA, Santander, Nación, ICBC y más de 20 entidades. Gratis.',
  keywords: 'promociones bancarias, descuentos tarjetas, promos bancos argentina, cuotas sin interés',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: BASE_URL,
    siteName: 'PromoAR',
    title: 'PromoAR — Todas las promos de tus tarjetas, en un lugar',
    description: 'Descubrí descuentos y cuotas sin interés de más de 20 bancos y billeteras. Filtrado por tu perfil financiero.',
    images: [{ url: '/api/og/daily', width: 1080, height: 1080, alt: 'Promos de hoy en PromoAR' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PromoAR — Todas las promos de tus tarjetas',
    description: 'Descubrí descuentos y cuotas sin interés de más de 20 bancos y billeteras.',
    images: ['/api/og/daily'],
  },
  alternates: {
    canonical: BASE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  verification: {
    other: { 'msvalidate.01': '3C0BC04C6B361721148576B592ADDE88' },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PromoAR',
  },
}

export const viewport: Viewport = {
  themeColor: '#1D3D6E',
}

// EXPERIMENTO cdn-cache-static-detail (26/11/2026): el root layout llamaba a
// getServerSession() en cada request solo para precargar el estado inicial de
// SessionProvider (next-auth/react) y evitar el parpadeo "cargando sesión" al
// montar. getServerSession() lee la cookie de sesión vía next/headers, lo que
// fuerza dynamic rendering en TODAS las rutas de la app sin excepción —
// incluidas /promos/[slug] y /comercios/[slug], que no tocan cookies/headers
// por su cuenta. Esta es la causa raíz real de por qué ninguna página del
// sitio se servía desde el Full Route Cache de Vercel (confirmado con curl en
// producción: Cache-Control: private, no-store en todas las rutas probadas),
// no el middleware (que ya evita su propio getToken() en rutas públicas).
// Fix: SessionProvider sin `session` inicial hace su propio fetch client-side
// a /api/auth/session al montar (comportamiento estándar de next-auth/react
// cuando no se le pasa sesión precargada) — mismo resultado final, solo con
// un breve estado `loading` en useSession() en vez de session ya resuelta en
// el primer render. Sin esto, ningún layout page puede ser estático.
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){document.documentElement.classList.add('dark');})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrganization()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaWebSite()) }}
        />
      </head>
      <body>
        <Providers>
          <PostHogProvider>
            <MLOAuthHandler />
            {children}
            <SupportChat />
            <PushNotificationPrompt />
            <InstallPrompt />
          </PostHogProvider>
        </Providers>
        <Analytics />
        {process.env.NEXT_PUBLIC_GA_ID && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />}
      </body>
    </html>
  )
}