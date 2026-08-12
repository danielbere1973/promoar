'use client'

import { useEffect, useState } from 'react'
import { OPORTUNIDAD, SIBLINGS } from './data'

// Axis: grilla de miniaturas tipo MODO — logo/foto cuadrada, título de descuento debajo, muy denso, pensado para escanear muchas oportunidades.
export default function V4Compacta() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const items = [OPORTUNIDAD, ...SIBLINGS]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {items.map((o, i) => (
        <div
          key={o.comercio + i}
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(6px)',
            transition: `opacity 200ms cubic-bezier(0.23,1,0.32,1) ${i * 50}ms, transform 200ms cubic-bezier(0.23,1,0.32,1) ${i * 50}ms`,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              aspectRatio: '1.4',
              borderRadius: 10,
              background: '#f4f1ea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
              border: '1px solid #eae4d8',
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={o.logoUrl}
              alt={o.comercio}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 10 }}
            />
          </div>
          <div style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500, lineHeight: 1.3 }}>
            {o.descuentoPct > 0 ? `${o.descuentoPct}% de reintegro en` : o.cuotas} {o.comercio}
          </div>
        </div>
      ))}
    </div>
  )
}
