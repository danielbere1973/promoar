'use client'

import PromoUnavailable from './components/PromoUnavailable'

export default function NotFoundClient({ promos }: { promos: any[] }) {
  return <PromoUnavailable reason="not_found" promos={promos} />
}
