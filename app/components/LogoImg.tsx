'use client'

import { useState } from 'react'

type Props = {
  src: string
  fallbackInitial: string
  fallbackColor: string
  alt: string
  size: number
  radius?: number
  fontSize?: number
  bg?: string
  border?: string
}

// Logo real (comercio o medio de pago) con fallback a inicial+color si la imagen no carga.
export default function LogoImg({
  src,
  fallbackInitial,
  fallbackColor,
  alt,
  size,
  radius = size * 0.28,
  fontSize = size * 0.42,
  bg = '#f4f1ea',
  border = '1px solid #eae4d8',
}: Props) {
  const [failed, setFailed] = useState(false)

  if (failed || !src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: fallbackColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {fallbackInitial}
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
        background: bg,
        border,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: size * 0.06 }}
      />
    </div>
  )
}
