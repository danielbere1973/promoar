import type { Metadata } from 'next'
import Providers from './providers'
import PostHogProvider from './components/PostHogProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'PromoAR',
  description: 'Tus promociones y beneficios bancarios',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
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
        <PostHogProvider>
          <Providers>
            {children}
          </Providers>
        </PostHogProvider>
      </body>
    </html>
  )
}