import type { Metadata } from 'next'
import Providers from './providers'
import PostHogProvider from './components/PostHogProvider'
import SupportChat from './components/SupportChat'
import PushNotificationPrompt from './components/PushNotificationPrompt'
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
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: BASE_URL,
    siteName: 'PromoAR',
    title: 'PromoAR — Todas las promos de tus tarjetas, en un lugar',
    description: 'Descubrí descuentos y cuotas sin interés de más de 20 bancos y billeteras. Filtrado por tu perfil financiero.',
    images: [{ url: '/logo_promoar.jpeg', width: 1200, height: 630, alt: 'PromoAR' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PromoAR — Todas las promos de tus tarjetas',
    description: 'Descubrí descuentos y cuotas sin interés de más de 20 bancos y billeteras.',
    images: ['/logo_promoar.jpeg'],
  },
  alternates: {
    canonical: BASE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({
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
      </head>
      <body>
        <Providers>
          <PostHogProvider>
            {children}
            <SupportChat />
            <PushNotificationPrompt />
          </PostHogProvider>
        </Providers>
      </body>
    </html>
  )
}