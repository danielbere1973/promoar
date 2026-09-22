'use client'

import './picker.css'
import './theme.css'
import { Picker } from './Picker'
import V1Narrativa from './V1Narrativa'
import V2ChipsCompacta from './V2ChipsCompacta'
import V3Editorial from './V3Editorial'
import V4SplitComparativa from './V4SplitComparativa'
import V5Conversacional from './V5Conversacional'
import V6Expandible from './V6Expandible'
import V7Horizontal3Col from './V7Horizontal3Col'
import V8HorizontalCompacta from './V8HorizontalCompacta'
import { useState } from 'react'

const VARIANTS: { name: string; Component: React.ComponentType; hasMotion: boolean; wide?: boolean }[] = [
  { name: 'Narrativa', Component: V1Narrativa, hasMotion: true },
  { name: 'Chips compacta', Component: V2ChipsCompacta, hasMotion: true },
  { name: 'Editorial', Component: V3Editorial, hasMotion: true },
  { name: 'Split comparativa', Component: V4SplitComparativa, hasMotion: true },
  { name: 'Conversacional', Component: V5Conversacional, hasMotion: true },
  { name: 'Expandible', Component: V6Expandible, hasMotion: true },
  { name: 'Horizontal 3 col', Component: V7Horizontal3Col, hasMotion: true, wide: true },
  { name: 'Horizontal compacta', Component: V8HorizontalCompacta, hasMotion: true, wide: true },
]

export default function RecommendationCardPrototype() {
  const [index, setIndex] = useState(0)
  const [mountKey, setMountKey] = useState(0)

  const Active = VARIANTS[index].Component
  const isWide = !!VARIANTS[index].wide

  return (
    <div className="proto-stage">
      <div className="proto-stage-inner" style={isWide ? { maxWidth: 760 } : undefined}>
        <div className="proto-stage-label">La Pizarra — Recommendation Card</div>
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
