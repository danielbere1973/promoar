'use client'
import React from 'react'
import { CARD_NETWORK_LOGOS } from './EntitiesSheet'

type Req = {
  bank?: { name: string; logoUrl?: string | null } | null
  wallet?: { name: string; logoUrl?: string | null } | null
  cardNetwork?: { name: string; slug: string } | null
}

// Medio de pago como elemento protagonista (CPO Review Home v2, punto "el medio
// de pago tiene que ser protagonista") — antes solo aparecía como texto plano
// dentro del reason. Prioridad de logo: banco > billetera > red de tarjeta.
export default function PaymentMethodBadge({ req, size = 'md' }: { req: Req | null; size?: 'sm' | 'md' }) {
  if (!req) return null
  const entity = req.bank ?? req.wallet ?? null
  const logoUrl = entity?.logoUrl ?? (req.cardNetwork ? CARD_NETWORK_LOGOS[req.cardNetwork.slug] : undefined)
  const name = entity?.name ?? req.cardNetwork?.name
  if (!name) return null

  const dims = size === 'sm' ? 'h-5 pl-1 pr-2 gap-1' : 'h-7 pl-1.5 pr-2.5 gap-1.5'
  const imgDims = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-[11px]'

  return (
    <span className={`inline-flex items-center ${dims} rounded-full bg-white dark:bg-[#0F2040] border border-[#D0DBF0] dark:border-[#26406F] shrink-0`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className={`${imgDims} rounded-full object-contain shrink-0`} />
      ) : (
        <span className={`${imgDims} rounded-full bg-[#EEF2F8] dark:bg-[#16294B] shrink-0`} />
      )}
      <span className={`${textSize} font-extrabold text-[#1D3D6E] dark:text-[#8AADD4] truncate max-w-[110px]`}>{name}</span>
    </span>
  )
}
