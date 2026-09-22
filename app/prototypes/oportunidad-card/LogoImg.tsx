'use client'

import { useState } from 'react'
import type { Oportunidad } from './data'

type Props = {
  o: Pick<Oportunidad, 'logoUrl' | 'logoInicial' | 'logoColor' | 'comercio'>
  size: number
  radius?: number
  fontSize?: number
}

// Logo real del comercio con fallback a inicial+color si la imagen externa no carga.
export default function LogoImg({ o, size, radius = size * 0.28, fontSize = size * 0.45 }: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: o.logoColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {o.logoInicial}
      </div>
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        flexShrink: 0,
        background: '#f4f1ea',
        border: '1px solid #eae4d8',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={o.logoUrl}
        alt={o.comercio}
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: size * 0.05 }}
      />
    </div>
  )
}
