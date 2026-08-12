'use client'

import { useEffect, useRef, useState } from 'react'
import { OPORTUNIDAD } from './data'
import LogoImg from './LogoImg'

// Axis: interaction model — acción directa por gesto (swipe derecha = guardar, izquierda = descartar), tracking 1:1 con el puntero, spring de vuelta si no cruza el umbral.
export default function V10Swipe() {
  const [mounted, setMounted] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'dismissed'>('idle')
  const cardRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const currentX = useRef(0)
  const o = OPORTUNIDAD

  useEffect(() => {
    setMounted(true)
  }, [])

  const applyTransform = (x: number) => {
    const card = cardRef.current
    if (!card) return
    const rotate = x / 20
    card.style.transform = `translateX(${x}px) rotate(${rotate}deg)`
    const opacity = Math.max(0, 1 - Math.abs(x) / 220)
    card.style.opacity = String(opacity < 1 ? 0.4 + opacity * 0.6 : 1)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (status !== 'idle') return
    dragging.current = true
    startX.current = e.clientX
    currentX.current = 0
    cardRef.current?.setPointerCapture(e.pointerId)
    if (cardRef.current) cardRef.current.style.transition = 'none'
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    currentX.current = e.clientX - startX.current
    applyTransform(currentX.current)
  }

  const onPointerUp = () => {
    if (!dragging.current) return
    dragging.current = false
    const card = cardRef.current
    if (!card) return
    card.style.transition = 'transform 320ms cubic-bezier(0.23,1,0.32,1), opacity 320ms cubic-bezier(0.23,1,0.32,1)'

    if (currentX.current > 100) {
      card.style.transform = `translateX(420px) rotate(18deg)`
      card.style.opacity = '0'
      setStatus('saved')
    } else if (currentX.current < -100) {
      card.style.transform = `translateX(-420px) rotate(-18deg)`
      card.style.opacity = '0'
      setStatus('dismissed')
    } else {
      applyTransform(0)
    }
  }

  const reset = () => {
    setStatus('idle')
    requestAnimationFrame(() => {
      const card = cardRef.current
      if (!card) return
      card.style.transition = 'none'
      applyTransform(0)
    })
  }

  return (
    <div style={{ position: 'relative', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {status !== 'idle' && (
        <div style={{ textAlign: 'center', color: '#6b6459', fontSize: 14 }}>
          {status === 'saved' ? '✓ Guardada para después' : 'Descartada'}
          <div>
            <button
              onClick={reset}
              style={{
                marginTop: 12,
                fontSize: 13,
                color: '#6b6459',
                background: 'none',
                border: '1px solid #eae4d8',
                borderRadius: 8,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              Reiniciar
            </button>
          </div>
        </div>
      )}

      <div
        ref={cardRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: status === 'idle' ? 'static' : 'absolute',
          width: '100%',
          background: '#fff',
          border: '1px solid #eae4d8',
          borderRadius: 16,
          padding: 22,
          opacity: mounted ? 1 : 0,
          touchAction: 'pan-y',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <LogoImg o={o} size={40} radius={10} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{o.comercio}</div>
            <div style={{ fontSize: 12, color: '#6b6459' }}>{o.medio} · {o.red}</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 24, fontWeight: 800, color: '#d94f2b' }}>{o.descuentoPct}%</div>
        </div>
        <div style={{ fontSize: 12, color: '#a39d90', textAlign: 'center' }}>
          ← descartar &nbsp;·&nbsp; arrastrá &nbsp;·&nbsp; guardar →
        </div>
      </div>
    </div>
  )
}
