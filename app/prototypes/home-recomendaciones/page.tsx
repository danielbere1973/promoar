'use client'

import './picker.css'
import './theme.css'
import { Picker } from './Picker'
import { RUBROS } from './data'
import RecommendationCardDesktop from './RecommendationCardDesktop'
import RecommendationCardMobile from './RecommendationCardMobile'
import RubroEmptyState from './RubroEmptyState'
import { useState } from 'react'

const VIEWS = ['Desktop', 'Mobile']

export default function HomeRecomendacionesPrototype() {
  const [view, setView] = useState(0)
  const isMobile = view === 1

  return (
    <div className="home-proto">
      <div className="home-proto-header" style={isMobile ? { maxWidth: 420, margin: '0 auto 28px' } : undefined}>
        <div>
          <div className="home-proto-title">Para vos</div>
          <div className="home-proto-subtitle">
            Design Lab — Home por rubros ({RUBROS.length} rubros, hipótesis N=5, ver definicion-producto-home.md §2)
          </div>
        </div>
      </div>

      <div className="home-proto-rubros" data-mobile={isMobile ? '' : undefined}>
        {RUBROS.map((rubro) => (
          <section key={rubro.id}>
            <div className="home-proto-rubro-label">{rubro.label}</div>
            {rubro.status === 'ok' ? (
              isMobile ? (
                <RecommendationCardMobile o={rubro.destacada} secundarias={rubro.secundarias} />
              ) : (
                <RecommendationCardDesktop o={rubro.destacada} secundarias={rubro.secundarias} />
              )
            ) : (
              <RubroEmptyState reason={rubro.reason} wide={!isMobile} />
            )}
          </section>
        ))}
      </div>

      <div className="home-proto-cta" data-mobile={isMobile ? '' : undefined}>
        <button className="home-proto-cta-btn">Explorar todas las promociones →</button>
      </div>

      <Picker names={VIEWS} hasMotion={VIEWS.map(() => false)} onChange={(i) => setView(i)} />
    </div>
  )
}
