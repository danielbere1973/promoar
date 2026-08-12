'use client'
import React, { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import BottomNav from '../components/BottomNav'
import ThemeToggle from '../components/ThemeToggle'
import SplashScreen from '../components/SplashScreen'
import OnboardingBanner from '../components/OnboardingBanner'
import RecommendationSpotlight from '../components/RecommendationSpotlight'
import RecommendationSecondaryCard from '../components/RecommendationSecondaryCard'
import SignalStrip from '../components/SignalStrip'
import ExploreCatalogCta from '../components/ExploreCatalogCta'
import { useRecommendations } from '@/lib/useRecommendations'
import { trackRecommendationEvent } from '@/lib/recommendationEvents'

const PromoDetailSheet = dynamic(() => import('../components/PromoDetailSheet'), { ssr: false })
const ProvinceSelector = dynamic(() => import('../components/ProvinceSelector'), { ssr: false })

type UserProfile = {
  banks: { bankId: string }[]
  wallets: { walletId: string }[]
  cards: { cardNetworkId: string | null }[]
} | null

// Home v2 (CPO Direction, 9/8/2026): experiencia cerrada de decisión.
// "¿Qué me conviene hoy?" — Spotlight + 2 recomendaciones + señales + CTA
// hacia el catálogo. Nada de catálogo/búsqueda/filtros acá: eso vive en
// /promos/explorar. Componente independiente del viejo PromosClient
// (ahora en app/promos/explorar/PromosClient.tsx) — no comparte estado
// ni fetch con el catálogo.
export default function PromosClient() {
  const router = useRouter()
  const { status } = useSession()

  const [splashDone, setSplashDone] = useState(false)
  const [province, setProvince] = useState<string | null>(null)
  const [showProvinceSelector, setShowProvinceSelector] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile>(null)
  const [profileReady, setProfileReady] = useState(false)
  const [detailPromo, setDetailPromo] = useState<any>(null)

  const { data, loading } = useRecommendations(province)

  // Provincia: cookie ya seteada por visitas previas (ver ProvinceSelector) o
  // pedirla si todavía no existe, para no arrancar cada sesión desde cero.
  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )userProvince=([^;]*)/)
    if (match) {
      setProvince(decodeURIComponent(match[1]))
    } else {
      setShowProvinceSelector(true)
    }
  }, [])

  useEffect(() => {
    async function fetchUserProfile() {
      if (status !== 'authenticated') { setProfileReady(true); return }
      try {
        const r = await fetch('/api/perfil')
        if (r.ok) {
          const data = await r.json()
          if (data.profile) setUserProfile(data.profile)
        }
      } catch (err) {
        console.error('Error fetching user profile:', err)
      } finally {
        setProfileReady(true)
      }
    }
    if (status !== 'loading') fetchUserProfile()
  }, [status])

  // Evento de exposición: se dispara una sola vez cuando la recomendación
  // efectivamente se muestra (no en el fetch, sino cuando ya hay data).
  useEffect(() => {
    if (!data) return
    trackRecommendationEvent('recommendation_block_shown', {
      recommendation_status: data.status,
      generatedAt: data.generatedAt,
      latency_ms: data.latencyMs,
    })
  }, [data])

  const hasProfile = !!userProfile && (userProfile.banks.length > 0 || userProfile.wallets.length > 0 || userProfile.cards.length > 0)

  const handleOpenPromo = useCallback((promo: any) => setDetailPromo(promo), [])
  const handleCloseDetail = useCallback(() => setDetailPromo(null), [])
  const handleGoToProfile = useCallback(() => {
    router.push(status === 'authenticated' ? '/perfil?tab=finance' : '/registro')
  }, [router, status])
  const handleShareLocation = useCallback(() => setShowProvinceSelector(true), [])

  const secondary = data?.status === 'ok' || data?.status === 'no_location' ? data.recommendations.slice(1, 3) : []

  const handleSecondaryClick = useCallback((reco: { promo: any; reasons: string[] }, position: number) => {
    if (!data) return
    trackRecommendationEvent('recommendation_clicked', {
      recommendation_position: position,
      commerceId: reco.promo.commerce?.id,
      promoId: reco.promo.id,
      recommendation_reasons: reco.reasons,
      recommendation_status: data.status,
      generatedAt: data.generatedAt,
      latency_ms: data.latencyMs,
    })
    setDetailPromo(reco.promo)
  }, [data])

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A1428] pb-24">
      {!splashDone && <SplashScreen loading={loading} onDone={() => setSplashDone(true)} />}

      <header className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-[15px] font-black text-[#0D1B2E] dark:text-white">PromoAR</span>
        <ThemeToggle />
      </header>

      <OnboardingBanner isLoggedIn={status === 'authenticated'} hasProfile={hasProfile} profileReady={profileReady} />

      <RecommendationSpotlight
        data={data}
        loading={loading}
        onOpenPromo={handleOpenPromo}
        onGoToProfile={handleGoToProfile}
      />

      {secondary.length > 0 && (
        <div className="px-4 pb-2 grid grid-cols-2 gap-3">
          {secondary.map((reco, i) => (
            <RecommendationSecondaryCard
              key={reco.promo.id}
              promo={reco.promo}
              reasons={reco.reasons}
              onClick={() => handleSecondaryClick(reco, i + 2)}
            />
          ))}
        </div>
      )}

      {data && (
        <SignalStrip data={data} onShareLocation={handleShareLocation} />
      )}

      {data && (
        <ExploreCatalogCta status={data.status} generatedAt={data.generatedAt} latencyMs={data.latencyMs} />
      )}

      <BottomNav />

      {detailPromo && (
        <PromoDetailSheet promo={detailPromo} onClose={handleCloseDetail} />
      )}

      {showProvinceSelector && (
        <ProvinceSelector
          currentProvince={province ?? undefined}
          onSelect={(prov: string) => {
            setProvince(prov)
            setShowProvinceSelector(false)
          }}
          onDismiss={() => setShowProvinceSelector(false)}
        />
      )}
    </div>
  )
}
