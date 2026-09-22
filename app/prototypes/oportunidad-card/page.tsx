'use client'

import './picker.css'
import './theme.css'
import { Picker } from './Picker'
import V1NumeroDominante from './V1NumeroDominante'
import V2LogoFirst from './V2LogoFirst'
import V3WalletHero from './V3WalletHero'
import V4Compacta from './V4Compacta'
import V5MatchBadge from './V5MatchBadge'
import V6ContextoTemporal from './V6ContextoTemporal'
import V7Comparativa from './V7Comparativa'
import V8Minimal from './V8Minimal'
import V9Editorial from './V9Editorial'
import V10Swipe from './V10Swipe'
import { useState } from 'react'

const VARIANTS: { name: string; Component: React.ComponentType; hasMotion: boolean }[] = [
  { name: 'Número dominante', Component: V1NumeroDominante, hasMotion: true },
  { name: 'Logo first', Component: V2LogoFirst, hasMotion: true },
  { name: 'Wallet hero', Component: V3WalletHero, hasMotion: true },
  { name: 'Compacta', Component: V4Compacta, hasMotion: true },
  { name: 'Match badge', Component: V5MatchBadge, hasMotion: true },
  { name: 'Contexto temporal', Component: V6ContextoTemporal, hasMotion: true },
  { name: 'Comparativa', Component: V7Comparativa, hasMotion: true },
  { name: 'Minimal', Component: V8Minimal, hasMotion: true },
  { name: 'Editorial', Component: V9Editorial, hasMotion: true },
  { name: 'Swipe', Component: V10Swipe, hasMotion: true },
]

export default function OportunidadCardPrototype() {
  const [index, setIndex] = useState(0)
  const [mountKey, setMountKey] = useState(0)

  const Active = VARIANTS[index].Component

  return (
    <div className="proto-stage">
      <div className="proto-stage-inner">
        <div className="proto-stage-label">La Pizarra — Card de oportunidad</div>
        <div key={`${index}-${mountKey}`}>
          <Active />
        </div>
      </div>

      <Picker
        names={VARIANTS.map((v) => v.name)}
        hasMotion={VARIANTS.map((v) => v.hasMotion)}
        onChange={(i, key) => {
          setIndex(i)
          setMountKey(key)
        }}
      />
    </div>
  )
}
