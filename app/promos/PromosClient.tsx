'use client'
import React, { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import BottomNav from '../components/BottomNav'
import ThemeToggle from '../components/ThemeToggle'
import SplashScreen from '../components/SplashScreen'
import OnboardingBanner from '../components/OnboardingBanner'
import HomeRubros from '../components/home/HomeRubros'
import ExploreCatalogCta from '../components/ExploreCatalogCta'
import { useHomeDecision } from '@/lib/useHomeDecision'
import { trackRecommendationEvent } from '@/lib/recommendationEvents'

const PromoDetailSheet = dynamic(() => import('../components/PromoDetailSheet'), { ssr: false })
const ProvinceSelector = dynamic(() => import('../components/ProvinceSelector'), { ssr: false })

type UserProfile = {
  banks: { bankId: string }[]
  wallets: { walletId: string }[]
  cards: { cardNetworkId: string | null }[]
} | null

// Home v2 (CPO Direction "Integración Home + Decision Engine v2", 12/8/2026):
// organizada por rubros prioritarios (HomeDecisionPayload real, RFC-008), no
// por Top-3 global. Nada de catálogo/búsqueda/filtros acá: eso vive en
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

  const { data, loading } = useHomeDecision(province)

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

  const handleOpenPromo = useCallback((promo: unknown) => setDetailPromo(promo), [])
  const handleCloseDetail = useCallback(() => setDetailPromo(null), [])
  const handleGoToProfile = useCallback(() => {
    router.push(status === 'authenticated' ? '/perfil?tab=finance' : '/registro')
  }, [router, status])

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A1428] pb-24">
      {!splashDone && <SplashScreen loading={loading} onDone={() => setSplashDone(true)} />}

      <header className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-[15px] font-black text-[#0D1B2E] dark:text-white">PromoAR</span>
        <ThemeToggle />
      </header>

      <OnboardingBanner isLoggedIn={status === 'authenticated'} hasProfile={hasProfile} profileReady={profileReady} />

      {data?.status === 'incomplete_profile' && (
        <div className="px-4 pt-3 pb-5">
          <h1 className="text-[21px] font-black text-[#0D1B2E] dark:text-white leading-tight mb-1">
            Encontrá las promos que valen la pena
          </h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-4 leading-snug">
            Cargá tus tarjetas y billeteras para que te mostremos solo lo que te sirve a vos, rubro por rubro.
          </p>
          <button
            onClick={handleGoToProfile}
            className="inline-flex items-center gap-2 text-[13px] font-black text-white bg-[#1D3D6E] dark:bg-[#3A6BC4] rounded-2xl px-5 py-3 hover:opacity-90 transition-opacity"
          >
            Configurar mi perfil →
          </button>
        </div>
      )}

      {data?.status !== 'incomplete_profile' && (
        <div className="px-4 md:px-6 pt-3 pb-2">
          <HomeRubros data={data} loading={loading} onOpenPromo={handleOpenPromo} />
        </div>
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
