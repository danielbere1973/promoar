import { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'

export const metadata: Metadata = {
  alternates: { canonical: `${BASE_URL}/promos` },
}

export default function PromosLayout({ children }: { children: React.ReactNode }) {
  return children
}
