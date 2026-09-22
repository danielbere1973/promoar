'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

export interface CatalogEntity {
  id: string
  slug: string
  name: string
  logoUrl?: string | null
  type: 'bank' | 'wallet' | 'card' | 'benefit'
  color?: string
  popular?: boolean
}

export interface FourLevelsCatalog {
  banks: CatalogEntity[]
  wallets: CatalogEntity[]
  cards: CatalogEntity[]
  benefits: CatalogEntity[]
}

interface SimulatorPaymentSelectorProps {
  fullCatalog: FourLevelsCatalog
  userProfileCatalog: FourLevelsCatalog | null
  initialUserMethods?: string[]
  userInfo?: {
    name: string | null
    email: string | null
  } | null
  selectedMethods: string[]
  onToggleMethod: (id: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  onSelectProfileOnly: () => void
  callbackUrl?: string
}

export default function SimulatorPaymentSelector({
  fullCatalog,
  userProfileCatalog,
  initialUserMethods = [],
  userInfo = null,
  selectedMethods,
  onToggleMethod,
  onSelectAll,
  onClearAll,
  onSelectProfileOnly,
  callbackUrl = '/promos',
}: SimulatorPaymentSelectorProps) {
  const hasRegisteredProfile = !!(userProfileCatalog && initialUserMethods.length > 0)

  const userProfileItemCount = useMemo(() => {
    if (!userProfileCatalog) return 0
    return (
      userProfileCatalog.banks.length +
      userProfileCatalog.wallets.length +
      userProfileCatalog.cards.length +
      userProfileCatalog.benefits.length
    )
  }, [userProfileCatalog])

  // MODO PRINCIPAL: 1. Mis productos financieros vs 2. Ver todas las opciones
  // Si tiene perfil arranca en 'profile', pero puede alternar con un solo clic a 'all' (Opción A Tabs)
  const [selectionMode, setSelectionMode] = useState<'profile' | 'all'>(() => {
    return hasRegisteredProfile ? 'all' : 'all'
  })

  // Tab activa dentro de la Opción 2: 'banks' | 'wallets' | 'cards' | 'benefits'
  const [activeTab, setActiveTab] = useState<'banks' | 'wallets' | 'cards' | 'benefits'>('banks')
  const [bankSearchQuery, setBankSearchQuery] = useState('')

  // Filtrado de bancos
  const filteredBanks = useMemo(() => {
    if (!bankSearchQuery.trim()) {
      return fullCatalog.banks
    }
    const q = bankSearchQuery.toLowerCase().trim()
    return fullCatalog.banks.filter(b => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q))
  }, [fullCatalog.banks, bankSearchQuery])

  // Conteos de seleccionados por categoría
  const countSelected = (items: CatalogEntity[]) => {
    return items.filter(i => selectedMethods.includes(i.id) || selectedMethods.includes(i.slug)).length
  }

  const selectedBanksCount = useMemo(() => countSelected(fullCatalog.banks), [fullCatalog.banks, selectedMethods])
  const selectedWalletsCount = useMemo(() => countSelected(fullCatalog.wallets), [fullCatalog.wallets, selectedMethods])
  const selectedCardsCount = useMemo(() => countSelected(fullCatalog.cards), [fullCatalog.cards, selectedMethods])
  const selectedBenefitsCount = useMemo(() => countSelected(fullCatalog.benefits), [fullCatalog.benefits, selectedMethods])

  const isSelected = (id: string, slug?: string) => {
    return selectedMethods.includes(id) || (slug ? selectedMethods.includes(slug) : false)
  }

  return (
    <>
      {/* ===================================================================== */}
      {/* CONTENEDOR PRINCIPAL DEL PASO 1 (IDÉNTICO AL PROTOTIPO OPCIÓN A)       */}
      {/* ===================================================================== */}
      {/* CONTENEDOR PRINCIPAL DEL PASO 1 (IDÉNTICO AL PROTOTIPO OPCIÓN A)       */}
      {/* ===================================================================== */}
      <div className="bg-[#0A1428]/80 border border-[#26406F] rounded-3xl p-5 md:p-6 mb-8 shadow-2xl backdrop-blur-sm">
        {/* Header del Paso 1 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-base md:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span className="text-[#D94F2B] text-xl">💳</span>
              <span>Paso 1: Elegí tus medios de pago</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Calcularemos en vivo tus reintegros reales en cada cadena
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {selectionMode === 'profile' && hasRegisteredProfile ? (
              <button
                onClick={onSelectProfileOnly}
                className="text-[#E8724F] hover:text-white font-semibold px-3 py-1 rounded-lg bg-[#0A1428] hover:bg-[#1E3A5F] border border-[#26406F] transition-colors"
              >
                Marcar perfil
              </button>
            ) : (
              <button
                onClick={onSelectAll}
                className="text-[#8AADD4] hover:text-white font-semibold px-3 py-1 rounded-lg bg-[#0A1428] hover:bg-[#1E3A5F] border border-[#26406F] transition-colors"
              >
                Marcar todos
              </button>
            )}
            <button
              onClick={onClearAll}
              className="text-slate-400 hover:text-slate-200 font-medium px-3 py-1 rounded-lg bg-[#0A1428] hover:bg-slate-800 border border-[#26406F]/50 transition-colors"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* LAS 2 OPCIONES SUPERIORES (PROTOTIPO OFICIAL)                         */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {/* Opción 1: Mis productos financieros */}
          <button
            onClick={() => {
              setSelectionMode('profile')
              if (hasRegisteredProfile) {
                onSelectProfileOnly()
              }
            }}
            className={`p-4 rounded-2xl text-left transition-all border flex items-start gap-3.5 relative overflow-hidden ${
              selectionMode === 'profile'
                ? 'bg-gradient-to-br from-[#1E3A5F]/90 via-[#142840] to-[#0A1428] border-[#D94F2B] shadow-lg shadow-[#D94F2B]/15 ring-1 ring-[#D94F2B]/40'
                : 'bg-[#0A1428]/60 border-[#26406F] hover:bg-[#142840] hover:border-slate-600 text-slate-400'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                selectionMode === 'profile'
                  ? 'bg-[#D94F2B] text-white font-black shadow-md shadow-[#D94F2B]/30'
                  : 'bg-[#0A1428] text-slate-400 border border-[#26406F]'
              }`}
            >
              👤
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black ${selectionMode === 'profile' ? 'text-white' : 'text-slate-300'}`}>
                  1. Mis productos financieros
                </span>
                {hasRegisteredProfile && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#D94F2B]/20 text-[#E8724F] border border-[#D94F2B]/30">
                    {userProfileItemCount} registrados
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {hasRegisteredProfile
                  ? `Según tu perfil registrado en PromoAR (${userInfo?.name || userInfo?.email || 'tu cuenta'})`
                  : 'Usá tus tarjetas y bancos guardados en PromoAR'}
              </p>
            </div>
            {selectionMode === 'profile' && (
              <span className="w-2 h-2 rounded-full bg-[#D94F2B] animate-ping absolute top-3 right-3" />
            )}
          </button>

          {/* Opción 2: Ver todas las opciones (4 niveles) */}
          <button
            onClick={() => setSelectionMode('all')}
            className={`p-4 rounded-2xl text-left transition-all border flex items-start gap-3.5 relative overflow-hidden ${
              selectionMode === 'all'
                ? 'bg-gradient-to-br from-[#1E3A5F]/90 via-[#142840] to-[#0A1428] border-[#D94F2B] shadow-lg shadow-[#D94F2B]/15 ring-1 ring-[#D94F2B]/40'
                : 'bg-[#0A1428]/60 border-[#26406F] hover:bg-[#142840] hover:border-slate-600 text-slate-400'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                selectionMode === 'all'
                  ? 'bg-[#D94F2B] text-white font-black shadow-md shadow-[#D94F2B]/30'
                  : 'bg-[#0A1428] text-slate-400 border border-[#26406F]'
              }`}
            >
              🌐
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black ${selectionMode === 'all' ? 'text-white' : 'text-slate-300'}`}>
                  2. Ver todas las opciones
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#8AADD4]/20 text-[#8AADD4] border border-[#8AADD4]/30">
                  4 niveles
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Bancos, billeteras, tarjetas de crédito/débito y beneficios
              </p>
            </div>
            {selectionMode === 'all' && (
              <span className="w-2 h-2 rounded-full bg-[#D94F2B] animate-ping absolute top-3 right-3" />
            )}
          </button>
        </div>

        {/* ===================================================================== */}
        {/* CONTENIDO DE LA OPCIÓN 1: MIS PRODUCTOS FINANCIEROS REGISTRADOS       */}
        {/* ===================================================================== */}
        {selectionMode === 'profile' && (
          <div className="space-y-5 animate-fadeIn">
            {hasRegisteredProfile && userProfileCatalog ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-[#0A1428]/80 border border-[#26406F] text-xs text-[#8AADD4]">
                  <div className="flex items-center gap-2">
                    <span className="text-base text-[#D94F2B]">✨</span>
                    <span>
                      Simulando con tus{' '}
                      <strong className="text-white font-bold">{userProfileItemCount} medios de pago</strong> guardados en tu cuenta.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={onSelectProfileOnly}
                      className="text-[#E8724F] hover:text-white font-semibold underline"
                    >
                      Marcar mis productos
                    </button>
                    <Link
                      href="/perfil"
                      className="font-bold text-white bg-[#D94F2B] hover:bg-[#c44325] px-3.5 py-1.5 rounded-lg transition-colors shrink-0 self-start sm:self-auto"
                    >
                      Editar mi perfil →
                    </Link>
                  </div>
                </div>

                {/* 1. Bancos del usuario */}
                {userProfileCatalog.banks.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <span>🏛️</span> Tus Bancos ({userProfileCatalog.banks.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {userProfileCatalog.banks.map(bank => {
                        const isSel = isSelected(bank.id, bank.slug)
                        return (
                          <button
                            key={bank.id}
                            onClick={() => onToggleMethod(bank.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                              isSel
                                ? 'bg-[#D94F2B] text-white border-[#D94F2B] shadow-sm shadow-[#D94F2B]/30 scale-[1.02]'
                                : 'bg-[#0A1428] text-slate-400 border-[#26406F] hover:bg-[#142840] hover:text-slate-200'
                            }`}
                          >
                            <span>{bank.name}</span>
                            {isSel && <span className="font-black">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Billeteras del usuario */}
                {userProfileCatalog.wallets.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <span>📱</span> Tus Billeteras Virtuales ({userProfileCatalog.wallets.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {userProfileCatalog.wallets.map(wallet => {
                        const isSel = isSelected(wallet.id, wallet.slug)
                        return (
                          <button
                            key={wallet.id}
                            onClick={() => onToggleMethod(wallet.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                              isSel
                                ? 'bg-[#D94F2B] text-white border-[#D94F2B] shadow-sm shadow-[#D94F2B]/30 scale-[1.02]'
                                : 'bg-[#0A1428] text-slate-400 border-[#26406F] hover:bg-[#142840] hover:text-slate-200'
                            }`}
                          >
                            <span>{wallet.name}</span>
                            {isSel && <span className="font-black">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Tarjetas del usuario */}
                {userProfileCatalog.cards.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <span>💳</span> Tus Tarjetas (Redes) ({userProfileCatalog.cards.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {userProfileCatalog.cards.map(card => {
                        const isSel = isSelected(card.id, card.slug)
                        return (
                          <button
                            key={card.id}
                            onClick={() => onToggleMethod(card.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                              isSel
                                ? 'bg-[#D94F2B] text-white border-[#D94F2B] shadow-sm shadow-[#D94F2B]/30 scale-[1.02]'
                                : 'bg-[#0A1428] text-slate-400 border-[#26406F] hover:bg-[#142840] hover:text-slate-200'
                            }`}
                          >
                            <span>{card.name}</span>
                            {isSel && <span className="font-black">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Beneficios del usuario */}
                {userProfileCatalog.benefits.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8AADD4] flex items-center gap-1.5">
                        <span>⭐</span> Tus Programas de Beneficios ({userProfileCatalog.benefits.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {userProfileCatalog.benefits.map(benefit => {
                        const isSel = isSelected(benefit.id, benefit.slug)
                        return (
                          <button
                            key={benefit.id}
                            onClick={() => onToggleMethod(benefit.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                              isSel
                                ? 'bg-[#D94F2B] text-white border-[#D94F2B] shadow-sm shadow-[#D94F2B]/30 scale-[1.02]'
                                : 'bg-[#0A1428] text-slate-400 border-[#26406F] hover:bg-[#142840]'
                            }`}
                          >
                            <span>⭐ {benefit.name}</span>
                            {isSel && <span className="font-black">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Usuario no registrado o sin perfil */
              <div className="p-8 rounded-2xl bg-gradient-to-br from-[#142840] via-[#0A1428] to-[#0A1428] border border-[#26406F] text-center max-w-xl mx-auto shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-[#D94F2B]/15 text-[#E8724F] border border-[#D94F2B]/30 flex items-center justify-center text-2xl mx-auto mb-3 shadow-md shadow-[#D94F2B]/10">
                  🛡️
                </div>
                <h3 className="text-base font-black text-white mb-2">
                  Aún no tenés productos registrados en PromoAR
                </h3>
                <p className="text-xs md:text-sm text-slate-400 mb-6 leading-relaxed">
                  Iniciá sesión con tu cuenta gratuita o configurá tus bancos, tarjetas y beneficios en tu perfil para que el simulador reconozca automáticamente tus medios de pago reales.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                    className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#D94F2B] hover:bg-[#c44325] text-white transition-all shadow-md shadow-[#D94F2B]/30 hover:scale-[1.02]"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/perfil"
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#142840] hover:bg-[#1E3A5F] text-slate-200 border border-[#26406F] transition-colors"
                  >
                    Configurar tarjetas
                  </Link>
                  <button
                    onClick={() => setSelectionMode('all')}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#8AADD4] hover:text-white transition-colors"
                  >
                    Explorar todas las opciones →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* CONTENIDO DE LA OPCIÓN 2: ENFOQUE A TABS (PROTOTIPO OFICIAL)          */}
        {/* ===================================================================== */}
        {selectionMode === 'all' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Pestañas de Nivel (Bancos, Billeteras, Tarjetas, Beneficios) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <button
                onClick={() => setActiveTab('banks')}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all ${
                  activeTab === 'banks'
                    ? 'bg-[#0A1428] text-white border-[#D94F2B] shadow-md shadow-[#D94F2B]/10 ring-1 ring-[#D94F2B]/30'
                    : 'bg-[#0A1428]/50 text-slate-400 border-[#26406F]/60 hover:text-slate-200 hover:border-[#26406F]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-base">🏛️</span>
                  <span>Bancos</span>
                </div>
                {selectedBanksCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#D94F2B] text-white">
                    {selectedBanksCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('wallets')}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all ${
                  activeTab === 'wallets'
                    ? 'bg-[#0A1428] text-white border-[#D94F2B] shadow-md shadow-[#D94F2B]/10 ring-1 ring-[#D94F2B]/30'
                    : 'bg-[#0A1428]/50 text-slate-400 border-[#26406F]/60 hover:text-slate-200 hover:border-[#26406F]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-base">📱</span>
                  <span>Billeteras</span>
                </div>
                {selectedWalletsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#D94F2B] text-white">
                    {selectedWalletsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('cards')}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all ${
                  activeTab === 'cards'
                    ? 'bg-[#0A1428] text-white border-[#D94F2B] shadow-md shadow-[#D94F2B]/10 ring-1 ring-[#D94F2B]/30'
                    : 'bg-[#0A1428]/50 text-slate-400 border-[#26406F]/60 hover:text-slate-200 hover:border-[#26406F]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-base">💳</span>
                  <span>Tarjetas</span>
                </div>
                {selectedCardsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#D94F2B] text-white">
                    {selectedCardsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('benefits')}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all ${
                  activeTab === 'benefits'
                    ? 'bg-[#0A1428] text-white border-[#D94F2B] shadow-md shadow-[#D94F2B]/10 ring-1 ring-[#D94F2B]/30'
                    : 'bg-[#0A1428]/50 text-slate-400 border-[#26406F]/60 hover:text-slate-200 hover:border-[#26406F]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-base">⭐</span>
                  <span>Beneficios</span>
                </div>
                {selectedBenefitsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#D94F2B] text-white">
                    {selectedBenefitsCount}
                  </span>
                )}
              </button>
            </div>

            {/* Contenedor del contenido de la Tab activa */}
            <div className="p-4 rounded-2xl bg-[#0A1428]/60 border border-[#26406F]/80">
              {activeTab === 'banks' && (
                <div>
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="Buscar banco... (ej. Galicia, BNA, Santander, Macro)"
                      value={bankSearchQuery}
                      onChange={e => setBankSearchQuery(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-[#142840] border border-[#26406F] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#D94F2B] transition-colors"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-[380px] overflow-y-auto pr-1">
                    {filteredBanks.map(bank => {
                      const isSel = isSelected(bank.id, bank.slug)
                      return (
                        <button
                          key={bank.id}
                          onClick={() => onToggleMethod(bank.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                            isSel
                              ? 'bg-[#D94F2B] text-white border-[#D94F2B] shadow-sm shadow-[#D94F2B]/30 scale-[1.02]'
                              : 'bg-[#142840]/60 text-slate-300 border-[#26406F] hover:bg-[#142840] hover:text-white'
                          }`}
                        >
                          <span>{bank.name}</span>
                          {isSel && <span className="font-black">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'wallets' && (
                <div className="flex flex-wrap gap-2 max-h-[380px] overflow-y-auto pr-1">
                  {fullCatalog.wallets.map(wallet => {
                    const isSel = isSelected(wallet.id, wallet.slug)
                    return (
                      <button
                        key={wallet.id}
                        onClick={() => onToggleMethod(wallet.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                          isSel
                            ? 'bg-[#D94F2B] text-white border-[#D94F2B] shadow-sm shadow-[#D94F2B]/30 scale-[1.02]'
                            : 'bg-[#142840]/60 text-slate-300 border-[#26406F] hover:bg-[#142840] hover:text-white'
                        }`}
                      >
                        <span>{wallet.name}</span>
                        {isSel && <span className="font-black">✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}

              {activeTab === 'cards' && (
                <div className="flex flex-wrap gap-2 max-h-[380px] overflow-y-auto pr-1">
                  {fullCatalog.cards.map(card => {
                    const isSel = isSelected(card.id, card.slug)
                    return (
                      <button
                        key={card.id}
                        onClick={() => onToggleMethod(card.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                          isSel
                            ? 'bg-[#D94F2B] text-white border-[#D94F2B] shadow-sm shadow-[#D94F2B]/30 scale-[1.02]'
                            : 'bg-[#142840]/60 text-slate-300 border-[#26406F] hover:bg-[#142840] hover:text-white'
                        }`}
                      >
                        <span>{card.name}</span>
                        {isSel && <span className="font-black">✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}

              {activeTab === 'benefits' && (
                <div className="flex flex-wrap gap-2 max-h-[380px] overflow-y-auto pr-1">
                  {fullCatalog.benefits.map(benefit => {
                    const isSel = isSelected(benefit.id, benefit.slug)
                    return (
                      <button
                        key={benefit.id}
                        onClick={() => onToggleMethod(benefit.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                          isSel
                            ? 'bg-[#D94F2B] text-white border-[#D94F2B] shadow-sm shadow-[#D94F2B]/30 scale-[1.02]'
                            : 'bg-[#142840]/60 text-slate-300 border-[#26406F] hover:bg-[#142840] hover:text-white'
                        }`}
                      >
                        <span>⭐ {benefit.name}</span>
                        {isSel && <span className="font-black">✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
