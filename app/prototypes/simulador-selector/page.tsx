'use client'

import { useState } from 'react'
import Link from 'next/link'
import SimulatorHeader from '@/app/components/SimulatorHeader'

// ==========================================
// DATOS MOCK REPRESENTATIVOS DE PROMOAR
// ==========================================
interface EntityItem {
  id: string
  name: string
  popular?: boolean
  color?: string
}

const MOCK_BANKS: EntityItem[] = [
  { id: 'galicia', name: 'Banco Galicia', popular: true, color: '#E35205' },
  { id: 'santander', name: 'Banco Santander', popular: true, color: '#EC0000' },
  { id: 'bna', name: 'Banco Nación (BNA)', popular: true, color: '#004B87' },
  { id: 'bbva', name: 'BBVA', popular: true, color: '#004481' },
  { id: 'macro', name: 'Banco Macro', popular: true, color: '#002D72' },
  { id: 'ciudad', name: 'Banco Ciudad', popular: true, color: '#0072CE' },
  { id: 'provincia', name: 'Banco Provincia', popular: true, color: '#00A650' },
  { id: 'credicoop', name: 'Banco Credicoop', popular: true, color: '#006633' },
  { id: 'supervielle', name: 'Banco Supervielle', popular: true, color: '#B30838' },
  { id: 'patagonia', name: 'Banco Patagonia', popular: true, color: '#003366' },
  { id: 'icbc', name: 'ICBC', popular: true, color: '#C8102E' },
  { id: 'cordoba', name: 'Bancor (Córdoba)', popular: true, color: '#E30613' },
  { id: 'hipotecario', name: 'Banco Hipotecario', color: '#008080' },
  { id: 'comafi', name: 'Banco Comafi', color: '#1B365D' },
  { id: 'itau', name: 'Banco Itaú', color: '#EC7000' },
  { id: 'brubank', name: 'Brubank', color: '#6C5CE7' },
  { id: 'bancodel-sol', name: 'Banco del Sol', color: '#F1C40F' },
  { id: 'santafe', name: 'Banco Santa Fe', color: '#0055A5' },
  { id: 'san-juan', name: 'Banco San Juan', color: '#0055A5' },
  { id: 'corrientes', name: 'Banco de Corrientes', color: '#009933' },
]

const MOCK_WALLETS: EntityItem[] = [
  { id: 'modo', name: 'MODO', popular: true, color: '#00CC99' },
  { id: 'cuenta-dni', name: 'Cuenta DNI', popular: true, color: '#00A650' },
  { id: 'personal-pay', name: 'Personal Pay', popular: true, color: '#5A2D82' },
  { id: 'app-ypf', name: 'App YPF', popular: true, color: '#0057B8' },
  { id: 'shell-box', name: 'Shell Box', popular: true, color: '#FBCE07' },
  { id: 'mercadopago', name: 'Mercado Pago', popular: true, color: '#009EE3' },
  { id: 'uala', name: 'Ualá', popular: true, color: '#E53E3E' },
  { id: 'cencopay', name: 'CencoPay', color: '#D94F2B' },
  { id: 'buepp', name: 'BUEPP (Ciudad)', color: '#0072CE' },
  { id: 'carrefour-tarjeta', name: 'Mi Carrefour Prepaga', color: '#00387B' },
]

const MOCK_CARDS: EntityItem[] = [
  { id: 'visa-credito', name: 'Visa Crédito', popular: true },
  { id: 'visa-debito', name: 'Visa Débito', popular: true },
  { id: 'mastercard-credito', name: 'Mastercard Crédito', popular: true },
  { id: 'mastercard-debito', name: 'Mastercard Débito', popular: true },
  { id: 'amex', name: 'American Express (AmEx)', popular: true },
  { id: 'cabal', name: 'Cabal', popular: true },
]

const MOCK_BENEFITS: EntityItem[] = [
  { id: 'comunidad-coto', name: 'Comunidad Coto' },
  { id: 'jumbo-mas', name: 'Jumbo Prime / Jumbo+' },
  { id: 'vea-ahorro', name: 'Vea Ahorro' },
  { id: 'club-dia', name: 'Club Día' },
  { id: 'club-la-nacion', name: 'Club La Nación' },
  { id: 'clarin-365', name: 'Clarín 365' },
]

export default function SimuladorSelectorPrototype() {
  // Toolbar del laboratorio: cuál de los 3 enfoques mostrar para la Opción 2
  const [activeApproach, setActiveApproach] = useState<'A' | 'B' | 'C'>('A')

  // Simulador de autenticación: ¿el usuario está logueado o es invitado?
  const [isLogged, setIsLogged] = useState<boolean>(true)

  // MODO PRINCIPAL: 1. Mis productos financieros vs 2. Ver todas las opciones
  const [selectionMode, setSelectionMode] = useState<'profile' | 'all'>('profile')

  // Datos simulados de perfil registrado de PromoAR
  const userProfile = {
    name: 'Dani Test',
    itemCount: 21,
    banks: [
      { id: 'galicia', name: 'Banco Galicia' },
      { id: 'santander', name: 'Banco Santander' },
      { id: 'bna', name: 'Banco Nación' },
      { id: 'macro', name: 'Banco Macro' },
    ],
    wallets: [
      { id: 'modo', name: 'MODO' },
      { id: 'cuenta-dni', name: 'Cuenta DNI' },
      { id: 'personal-pay', name: 'Personal Pay' },
      { id: 'app-ypf', name: 'App YPF' },
    ],
    cards: [
      { id: 'visa-credito', name: 'Visa Crédito' },
      { id: 'mastercard-credito', name: 'Mastercard Crédito' },
      { id: 'visa-debito', name: 'Visa Débito' },
    ],
    benefits: [
      { id: 'comunidad-coto', name: 'Comunidad Coto' },
      { id: 'jumbo-mas', name: 'Jumbo Prime' },
    ],
  }

  // Estado común de selección
  const [selectedIds, setSelectedIds] = useState<string[]>([
    'galicia',
    'santander',
    'modo',
    'cuenta-dni',
    'visa-credito',
    'comunidad-coto',
  ])

  // Estado Enfoque A (Tabs)
  const [activeTab, setActiveTab] = useState<'banks' | 'wallets' | 'cards' | 'benefits'>('banks')
  const [bankSearchA, setBankSearchA] = useState('')

  // Estado Enfoque B (Acordeón)
  const [openAccordion, setOpenAccordion] = useState<string | null>('banks')
  const [bankSearchB, setBankSearchB] = useState('')

  // Estado Enfoque C (Modal / Drawer)
  const [isModalOpenC, setIsModalOpenC] = useState(false)
  const [modalTabC, setModalTabC] = useState<'banks' | 'wallets' | 'cards' | 'benefits'>('banks')
  const [bankSearchC, setBankSearchC] = useState('')

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAllProfile = () => {
    const allProfileIds = [
      ...userProfile.banks.map(b => b.id),
      ...userProfile.wallets.map(w => w.id),
      ...userProfile.cards.map(c => c.id),
      ...userProfile.benefits.map(be => be.id),
    ]
    setSelectedIds(Array.from(new Set([...selectedIds, ...allProfileIds])))
  }

  const clearAll = () => setSelectedIds([])

  // Helper para buscar el nombre
  const getEntityName = (id: string) => {
    const all = [...MOCK_BANKS, ...MOCK_WALLETS, ...MOCK_CARDS, ...MOCK_BENEFITS]
    return all.find(x => x.id === id)?.name || id
  }

  // Conteos por categoría
  const countSelected = (items: EntityItem[]) =>
    items.filter(item => selectedIds.includes(item.id)).length

  return (
    <div className="min-h-screen bg-[#0A1428] text-slate-100 selection:bg-[#D94F2B]/30 pb-0">
      {/* 1. Header oficial e idéntico de PromoAR */}
      <SimulatorHeader active="supermercados" />

      {/* Toolbar del laboratorio para probar los 3 enfoques de la Opción 2 */}
      <div className="sticky top-16 z-40 bg-[#060D1A]/95 border-b border-[#26406F] backdrop-blur-md py-3 px-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-[#E8724F] bg-[#D94F2B]/15 px-2.5 py-1 rounded-md border border-[#D94F2B]/30">
              Lab UX PromoAR
            </span>
            <span className="text-xs text-slate-300 font-semibold hidden sm:inline">
              Probá cómo se comporta la opción &quot;2. Ver todas las opciones&quot;:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle de simulación: Logueado vs Invitado */}
            <div className="flex items-center bg-[#0A1428] p-0.5 rounded-xl border border-[#26406F]">
              <button
                onClick={() => {
                  setIsLogged(true)
                  setSelectionMode('profile')
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  isLogged
                    ? 'bg-[#1E3A5F] text-[#8AADD4] border border-[#26406F]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👤 Logueado
              </button>
              <button
                onClick={() => {
                  setIsLogged(false)
                  setSelectionMode('all')
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  !isLogged
                    ? 'bg-[#1E3A5F] text-[#8AADD4] border border-[#26406F]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👥 No logueado
              </button>
            </div>

            {/* Selector de enfoques */}
            <div className="flex items-center gap-1.5 bg-[#142840] p-1 rounded-xl border border-[#26406F]">
              <button
                onClick={() => {
                  setActiveApproach('A')
                  setSelectionMode('all')
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeApproach === 'A' && selectionMode === 'all'
                    ? 'bg-[#D94F2B] text-white shadow-sm shadow-[#D94F2B]/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                🌟 Enfoque A: Tabs
              </button>
              <button
                onClick={() => {
                  setActiveApproach('B')
                  setSelectionMode('all')
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeApproach === 'B' && selectionMode === 'all'
                    ? 'bg-[#D94F2B] text-white shadow-sm shadow-[#D94F2B]/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                📂 Enfoque B: Acordeón
              </button>
              <button
                onClick={() => {
                  setActiveApproach('C')
                  setSelectionMode('all')
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeApproach === 'C' && selectionMode === 'all'
                    ? 'bg-[#D94F2B] text-white shadow-sm shadow-[#D94F2B]/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                ⚡ Enfoque C: Populares + Más
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* ========================================================================= */}
        {/* BARRA PERMANENTE DE SELECCIONADOS (Aplica a cualquiera de los dos modos)   */}
        {/* ========================================================================= */}
        {selectedIds.length > 0 && (
          <div className="mb-6 p-3.5 rounded-2xl bg-[#142840]/90 border border-[#26406F] shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8AADD4] flex items-center gap-1.5">
                <span>✓</span> Tus tarjetas y medios activos para simular ({selectedIds.length})
              </span>
              <button
                onClick={clearAll}
                className="text-[11px] text-[#E8724F] hover:text-white font-semibold transition-colors"
              >
                Desmarcar todos
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedIds.map(id => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-[#0A1428] text-white border border-[#D94F2B]/60 text-xs font-bold shadow-xs"
                >
                  <span>{getEntityName(id)}</span>
                  <button
                    onClick={() => toggleSelect(id)}
                    className="w-4 h-4 rounded-full bg-slate-800 hover:bg-[#D94F2B] text-slate-400 hover:text-white flex items-center justify-center text-[10px] transition-colors"
                    title="Quitar"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PASO 1: LOS 2 MODOS DE SELECCIÓN CON LA IDENTIDAD PROMOAR                  */}
        {/* ========================================================================= */}
        <div className="bg-[#142840]/70 border border-[#26406F] rounded-3xl p-5 md:p-6 mb-8 shadow-xl">
          {/* Header de Paso 1 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#26406F]">
            <div>
              <h3 className="text-base md:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span className="text-[#D94F2B] text-xl">💳</span>
                <span>Paso 1:</span> Elegí tus medios de pago
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Calcularemos en vivo tus reintegros reales en cada cadena
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {selectionMode === 'profile' && isLogged ? (
                <button
                  onClick={selectAllProfile}
                  className="text-[#E8724F] hover:text-white font-semibold px-3 py-1 rounded-lg bg-[#0A1428] hover:bg-[#1E3A5F] border border-[#26406F] transition-colors"
                >
                  Marcar todos mis productos
                </button>
              ) : (
                <button
                  onClick={clearAll}
                  className="text-slate-400 hover:text-slate-200 font-medium px-3 py-1 rounded-lg bg-[#0A1428] hover:bg-slate-800 transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* ===================================================================== */}
          {/* LAS 2 OPCIONES ARRIBA DEL CUADRO (Paleta Oficial PromoAR)             */}
          {/* ===================================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {/* Opción 1: Mis productos financieros según mi perfil PromoAR registrado */}
            <button
              onClick={() => setSelectionMode('profile')}
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
                  {isLogged && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#D94F2B]/20 text-[#E8724F] border border-[#D94F2B]/30">
                      {userProfile.itemCount} registrados
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {isLogged
                    ? `Según tu perfil registrado en PromoAR (${userProfile.name})`
                    : 'Usá tus tarjetas y bancos guardados en PromoAR'}
                </p>
              </div>
              {selectionMode === 'profile' && (
                <span className="w-2 h-2 rounded-full bg-[#D94F2B] animate-ping absolute top-3 right-3" />
              )}
            </button>

            {/* Opción 2: Ver todas las opciones disponibles en PromoAR (4 niveles) */}
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
              {isLogged ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-[#0A1428]/80 border border-[#26406F] text-xs text-[#8AADD4]">
                    <div className="flex items-center gap-2">
                      <span className="text-base text-[#D94F2B]">✨</span>
                      <span>
                        Simulando con tus{' '}
                        <strong className="text-white font-bold">{userProfile.itemCount} medios de pago</strong> guardados en tu cuenta.
                      </span>
                    </div>
                    <Link
                      href="/perfil"
                      className="font-bold text-white bg-[#D94F2B] hover:bg-[#c44325] px-3.5 py-1.5 rounded-lg transition-colors shrink-0 self-start sm:self-auto"
                    >
                      Editar mi perfil →
                    </Link>
                  </div>

                  {/* 1. Bancos del usuario */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <span>🏛️</span> Tus Bancos ({userProfile.banks.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.banks.map(bank => {
                        const isSelected = selectedIds.includes(bank.id)
                        return (
                          <button
                            key={bank.id}
                            onClick={() => toggleSelect(bank.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                              isSelected
                                ? 'bg-white text-slate-950 border-white shadow-md shadow-white/10 scale-[1.02]'
                                : 'bg-[#0A1428] text-slate-400 border-[#26406F] hover:bg-[#142840] hover:text-slate-200'
                            }`}
                          >
                            <span>{bank.name}</span>
                            {isSelected && <span className="text-[#D94F2B] font-black">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 2. Billeteras del usuario */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <span>📱</span> Tus Billeteras Virtuales ({userProfile.wallets.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.wallets.map(wallet => {
                        const isSelected = selectedIds.includes(wallet.id)
                        return (
                          <button
                            key={wallet.id}
                            onClick={() => toggleSelect(wallet.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                              isSelected
                                ? 'bg-[#D94F2B] text-white border-[#D94F2B] shadow-sm shadow-[#D94F2B]/30 scale-[1.02]'
                                : 'bg-[#0A1428] text-slate-400 border-[#26406F] hover:bg-[#142840] hover:text-slate-200'
                            }`}
                          >
                            <span>{wallet.name}</span>
                            {isSelected && <span className="font-black">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 3. Tarjetas del usuario */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <span>💳</span> Tus Tarjetas (Redes) ({userProfile.cards.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.cards.map(card => {
                        const isSelected = selectedIds.includes(card.id)
                        return (
                          <button
                            key={card.id}
                            onClick={() => toggleSelect(card.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                              isSelected
                                ? 'bg-[#1E3A5F] text-white border-[#8AADD4] shadow-sm scale-[1.02]'
                                : 'bg-[#0A1428] text-slate-400 border-[#26406F] hover:bg-[#142840] hover:text-slate-200'
                            }`}
                          >
                            <span>{card.name}</span>
                            {isSelected && <span className="text-[#8AADD4] font-black">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 4. Beneficios del usuario */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8AADD4] flex items-center gap-1.5">
                        <span>⭐</span> Tus Programas de Beneficios ({userProfile.benefits.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.benefits.map(benefit => {
                        const isSelected = selectedIds.includes(benefit.id)
                        return (
                          <button
                            key={benefit.id}
                            onClick={() => toggleSelect(benefit.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                              isSelected
                                ? 'bg-[#D94F2B]/20 text-[#E8724F] border-[#D94F2B] shadow-sm scale-[1.02]'
                                : 'bg-[#0A1428] text-slate-400 border-[#26406F] hover:bg-[#142840]'
                            }`}
                          >
                            <span>⭐ {benefit.name}</span>
                            {isSelected && <span className="text-[#D94F2B] font-black">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : (
                /* Card cuando el usuario NO está logueado */
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
                      href="/login?callbackUrl=/ahorro_interactivo/supermercados"
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
          {/* CONTENIDO DE LA OPCIÓN 2: SEGÚN EL ENFOQUE SELECCIONADO (A, B o C)   */}
          {/* ===================================================================== */}
          {selectionMode === 'all' && (
            <div className="space-y-5 animate-fadeIn">
              {/* ENFOQUE A: TABS SEGMENTADAS POR NIVEL */}
              {activeApproach === 'A' && (
                <div>
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
                      {countSelected(MOCK_BANKS) > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#D94F2B] text-white">
                          {countSelected(MOCK_BANKS)}
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
                      {countSelected(MOCK_WALLETS) > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#D94F2B] text-white">
                          {countSelected(MOCK_WALLETS)}
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
                      {countSelected(MOCK_CARDS) > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#D94F2B] text-white">
                          {countSelected(MOCK_CARDS)}
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
                      {countSelected(MOCK_BENEFITS) > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#D94F2B] text-white">
                          {countSelected(MOCK_BENEFITS)}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0A1428]/60 border border-[#26406F]/80">
                    {activeTab === 'banks' && (
                      <div>
                        <div className="mb-3">
                          <input
                            type="text"
                            placeholder="Buscar banco... (ej. Galicia, BNA, Santander, Macro)"
                            value={bankSearchA}
                            onChange={e => setBankSearchA(e.target.value)}
                            className="w-full px-3.5 py-2 text-xs bg-[#142840] border border-[#26406F] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#D94F2B] transition-colors"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {MOCK_BANKS.filter(b => b.name.toLowerCase().includes(bankSearchA.toLowerCase())).map(bank => {
                            const isSel = selectedIds.includes(bank.id)
                            return (
                              <button
                                key={bank.id}
                                onClick={() => toggleSelect(bank.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
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
                      <div className="flex flex-wrap gap-2">
                        {MOCK_WALLETS.map(wallet => {
                          const isSel = selectedIds.includes(wallet.id)
                          return (
                            <button
                              key={wallet.id}
                              onClick={() => toggleSelect(wallet.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
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
                      <div className="flex flex-wrap gap-2">
                        {MOCK_CARDS.map(card => {
                          const isSel = selectedIds.includes(card.id)
                          return (
                            <button
                              key={card.id}
                              onClick={() => toggleSelect(card.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
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
                      <div className="flex flex-wrap gap-2">
                        {MOCK_BENEFITS.map(ben => {
                          const isSel = selectedIds.includes(ben.id)
                          return (
                            <button
                              key={ben.id}
                              onClick={() => toggleSelect(ben.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                                isSel
                                  ? 'bg-[#D94F2B] text-white border-[#D94F2B] shadow-sm shadow-[#D94F2B]/30 scale-[1.02]'
                                  : 'bg-[#142840]/60 text-slate-300 border-[#26406F] hover:bg-[#142840] hover:text-white'
                              }`}
                            >
                              <span>⭐ {ben.name}</span>
                              {isSel && <span className="font-black">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ENFOQUE B: ACORDEÓN POR NIVEL */}
              {activeApproach === 'B' && (
                <div className="space-y-3">
                  <div className="border border-[#26406F] rounded-2xl bg-[#0A1428]/60 overflow-hidden">
                    <button
                      onClick={() => setOpenAccordion(openAccordion === 'banks' ? null : 'banks')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">🏛️</span>
                        <div>
                          <span className="text-sm font-black text-white">Nivel 1: Bancos</span>
                          <span className="text-xs text-slate-400 ml-2">({MOCK_BANKS.length} disponibles)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {countSelected(MOCK_BANKS) > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D94F2B] text-white">
                            {countSelected(MOCK_BANKS)} seleccionados
                          </span>
                        )}
                        <span className="text-slate-400 font-bold">{openAccordion === 'banks' ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {openAccordion === 'banks' && (
                      <div className="p-4 pt-1 border-t border-[#26406F]/80 animate-fadeIn">
                        <input
                          type="text"
                          placeholder="Buscar banco..."
                          value={bankSearchB}
                          onChange={e => setBankSearchB(e.target.value)}
                          className="w-full mb-3 px-3 py-1.5 text-xs bg-[#142840] border border-[#26406F] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#D94F2B]"
                        />
                        <div className="flex flex-wrap gap-2">
                          {MOCK_BANKS.filter(b => b.name.toLowerCase().includes(bankSearchB.toLowerCase())).map(b => {
                            const isSel = selectedIds.includes(b.id)
                            return (
                              <button
                                key={b.id}
                                onClick={() => toggleSelect(b.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                  isSel
                                    ? 'bg-[#D94F2B] text-white border-[#D94F2B]'
                                    : 'bg-[#142840]/60 text-slate-300 border-[#26406F] hover:bg-[#142840]'
                                }`}
                              >
                                {b.name} {isSel && '✓'}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border border-[#26406F] rounded-2xl bg-[#0A1428]/60 overflow-hidden">
                    <button
                      onClick={() => setOpenAccordion(openAccordion === 'wallets' ? null : 'wallets')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">📱</span>
                        <div>
                          <span className="text-sm font-black text-white">Nivel 2: Billeteras Virtuales</span>
                          <span className="text-xs text-slate-400 ml-2">({MOCK_WALLETS.length} disponibles)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {countSelected(MOCK_WALLETS) > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D94F2B] text-white">
                            {countSelected(MOCK_WALLETS)} seleccionadas
                          </span>
                        )}
                        <span className="text-slate-400 font-bold">{openAccordion === 'wallets' ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {openAccordion === 'wallets' && (
                      <div className="p-4 pt-1 border-t border-[#26406F]/80 animate-fadeIn flex flex-wrap gap-2">
                        {MOCK_WALLETS.map(w => {
                          const isSel = selectedIds.includes(w.id)
                          return (
                            <button
                              key={w.id}
                              onClick={() => toggleSelect(w.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                isSel
                                  ? 'bg-[#D94F2B] text-white border-[#D94F2B]'
                                  : 'bg-[#142840]/60 text-slate-300 border-[#26406F] hover:bg-[#142840]'
                              }`}
                            >
                              {w.name} {isSel && '✓'}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border border-[#26406F] rounded-2xl bg-[#0A1428]/60 overflow-hidden">
                    <button
                      onClick={() => setOpenAccordion(openAccordion === 'cards' ? null : 'cards')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">💳</span>
                        <div>
                          <span className="text-sm font-black text-white">Nivel 3: Tarjetas (Crédito / Débito)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {countSelected(MOCK_CARDS) > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D94F2B] text-white">
                            {countSelected(MOCK_CARDS)}
                          </span>
                        )}
                        <span className="text-slate-400 font-bold">{openAccordion === 'cards' ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {openAccordion === 'cards' && (
                      <div className="p-4 pt-1 border-t border-[#26406F]/80 animate-fadeIn flex flex-wrap gap-2">
                        {MOCK_CARDS.map(c => {
                          const isSel = selectedIds.includes(c.id)
                          return (
                            <button
                              key={c.id}
                              onClick={() => toggleSelect(c.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                isSel
                                  ? 'bg-[#D94F2B] text-white border-[#D94F2B]'
                                  : 'bg-[#142840]/60 text-slate-300 border-[#26406F] hover:bg-[#142840]'
                              }`}
                            >
                              {c.name} {isSel && '✓'}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border border-[#26406F] rounded-2xl bg-[#0A1428]/60 overflow-hidden">
                    <button
                      onClick={() => setOpenAccordion(openAccordion === 'benefits' ? null : 'benefits')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">⭐</span>
                        <div>
                          <span className="text-sm font-black text-white">Nivel 4: Beneficios y Clubes</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {countSelected(MOCK_BENEFITS) > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D94F2B] text-white">
                            {countSelected(MOCK_BENEFITS)}
                          </span>
                        )}
                        <span className="text-slate-400 font-bold">{openAccordion === 'benefits' ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {openAccordion === 'benefits' && (
                      <div className="p-4 pt-1 border-t border-[#26406F]/80 animate-fadeIn flex flex-wrap gap-2">
                        {MOCK_BENEFITS.map(ben => {
                          const isSel = selectedIds.includes(ben.id)
                          return (
                            <button
                              key={ben.id}
                              onClick={() => toggleSelect(ben.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                isSel
                                  ? 'bg-[#D94F2B] text-white border-[#D94F2B]'
                                  : 'bg-[#142840]/60 text-slate-300 border-[#26406F] hover:bg-[#142840]'
                              }`}
                            >
                              ⭐ {ben.name} {isSel && '✓'}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ENFOQUE C: TOP POPULARES + MODAL */}
              {activeApproach === 'C' && (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
                      <span>🏛️</span> Bancos Principales
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {MOCK_BANKS.filter(b => b.popular).slice(0, 8).map(b => {
                        const isSel = selectedIds.includes(b.id)
                        return (
                          <button
                            key={b.id}
                            onClick={() => toggleSelect(b.id)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                              isSel
                                ? 'bg-[#D94F2B] text-white border-[#D94F2B] shadow-sm shadow-[#D94F2B]/30 scale-[1.02]'
                                : 'bg-[#0A1428]/80 text-slate-300 border-[#26406F] hover:bg-[#142840]'
                            }`}
                          >
                            {b.name} {isSel && '✓'}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
                      <span>📱</span> Billeteras Populares
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {MOCK_WALLETS.filter(w => w.popular).slice(0, 5).map(w => {
                        const isSel = selectedIds.includes(w.id)
                        return (
                          <button
                            key={w.id}
                            onClick={() => toggleSelect(w.id)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                              isSel
                                ? 'bg-[#D94F2B] text-white border-[#D94F2B] shadow-sm shadow-[#D94F2B]/30 scale-[1.02]'
                                : 'bg-[#0A1428]/80 text-slate-300 border-[#26406F] hover:bg-[#142840]'
                            }`}
                          >
                            {w.name} {isSel && '✓'}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setIsModalOpenC(true)}
                      className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-[#26406F] hover:border-[#D94F2B] bg-[#0A1428]/50 hover:bg-[#0A1428] text-xs font-bold text-[#8AADD4] hover:text-white transition-all flex items-center justify-center gap-2 group"
                    >
                      <span>🔍</span>
                      <span>¿Tenés otro banco, tarjeta regional o suscripción?</span>
                      <span className="text-[#D94F2B] group-hover:underline">Abrir catálogo completo (+35 opciones) →</span>
                    </button>
                  </div>

                  {isModalOpenC && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                      <div className="bg-[#142840] border border-[#26406F] w-full max-w-2xl rounded-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between pb-4 border-b border-[#26406F] mb-4">
                          <div>
                            <h4 className="text-base font-black text-white">Catálogo Completo PromoAR</h4>
                            <p className="text-xs text-slate-400">Seleccioná cualquier entidad para sumarla al simulador</p>
                          </div>
                          <button
                            onClick={() => setIsModalOpenC(false)}
                            className="w-8 h-8 rounded-full bg-[#0A1428] hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold border border-[#26406F]"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                          {(['banks', 'wallets', 'cards', 'benefits'] as const).map(tab => (
                            <button
                              key={tab}
                              onClick={() => setModalTabC(tab)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                                modalTabC === tab
                                  ? 'bg-[#D94F2B] text-white border-[#D94F2B]'
                                  : 'bg-[#0A1428] text-slate-400 border-[#26406F] hover:text-white'
                              }`}
                            >
                              {tab === 'banks' && '🏛️ Bancos'}
                              {tab === 'wallets' && '📱 Billeteras'}
                              {tab === 'cards' && '💳 Tarjetas'}
                              {tab === 'benefits' && '⭐ Beneficios'}
                            </button>
                          ))}
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1">
                          {modalTabC === 'banks' && (
                            <div className="space-y-3">
                              <input
                                type="text"
                                placeholder="Filtrar bancos..."
                                value={bankSearchC}
                                onChange={e => setBankSearchC(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-[#0A1428] border border-[#26406F] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#D94F2B]"
                              />
                              <div className="flex flex-wrap gap-2">
                                {MOCK_BANKS.filter(b => b.name.toLowerCase().includes(bankSearchC.toLowerCase())).map(b => {
                                  const isSel = selectedIds.includes(b.id)
                                  return (
                                    <button
                                      key={b.id}
                                      onClick={() => toggleSelect(b.id)}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                        isSel
                                          ? 'bg-[#D94F2B] text-white border-[#D94F2B]'
                                          : 'bg-[#0A1428] text-slate-300 border-[#26406F] hover:bg-slate-800'
                                      }`}
                                    >
                                      {b.name} {isSel && '✓'}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {modalTabC === 'wallets' && (
                            <div className="flex flex-wrap gap-2">
                              {MOCK_WALLETS.map(w => {
                                const isSel = selectedIds.includes(w.id)
                                return (
                                  <button
                                    key={w.id}
                                    onClick={() => toggleSelect(w.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                      isSel
                                        ? 'bg-[#D94F2B] text-white border-[#D94F2B]'
                                        : 'bg-[#0A1428] text-slate-300 border-[#26406F] hover:bg-slate-800'
                                    }`}
                                  >
                                    {w.name} {isSel && '✓'}
                                  </button>
                                )
                              })}
                            </div>
                          )}

                          {modalTabC === 'cards' && (
                            <div className="flex flex-wrap gap-2">
                              {MOCK_CARDS.map(c => {
                                const isSel = selectedIds.includes(c.id)
                                return (
                                  <button
                                    key={c.id}
                                    onClick={() => toggleSelect(c.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                      isSel
                                        ? 'bg-[#D94F2B] text-white border-[#D94F2B]'
                                        : 'bg-[#0A1428] text-slate-300 border-[#26406F] hover:bg-slate-800'
                                    }`}
                                  >
                                    {c.name} {isSel && '✓'}
                                  </button>
                                )
                              })}
                            </div>
                          )}

                          {modalTabC === 'benefits' && (
                            <div className="flex flex-wrap gap-2">
                              {MOCK_BENEFITS.map(ben => {
                                const isSel = selectedIds.includes(ben.id)
                                return (
                                  <button
                                    key={ben.id}
                                    onClick={() => toggleSelect(ben.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                      isSel
                                        ? 'bg-[#D94F2B] text-white border-[#D94F2B]'
                                        : 'bg-[#0A1428] text-slate-300 border-[#26406F] hover:bg-slate-800'
                                    }`}
                                  >
                                    ⭐ {ben.name} {isSel && '✓'}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        <div className="pt-4 mt-4 border-t border-[#26406F] flex items-center justify-between">
                          <span className="text-xs text-[#8AADD4] font-semibold">
                            {selectedIds.length} medios seleccionados en total
                          </span>
                          <button
                            onClick={() => setIsModalOpenC(false)}
                            className="px-5 py-2 rounded-xl bg-[#D94F2B] hover:bg-[#c44325] text-white text-xs font-black transition-colors"
                          >
                            Listo, aplicar selección
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Podio representativo de muestra para ver cómo convive el selector con los resultados */}
        <div className="p-6 rounded-3xl bg-[#142840]/40 border border-[#26406F]/50 text-center mb-12">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Vista previa del resto de la pantalla
          </span>
          <h4 className="text-lg font-black text-white mt-1">
            Podio de Ahorro en Vivo (con los colores oficiales de PromoAR)
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Abajo de este selector se calculan los reintegros en tiempo real manteniendo siempre la misma estética de tarjetas.
          </p>
        </div>
      </div>

      {/* Footer oficial con la estructura de PromoAR */}
      <footer className="w-full bg-[#060D1A] border-t border-[#26406F]/80 text-slate-400 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" className="inline-block mb-3">
                <span className="text-xl font-black text-white tracking-tight">
                  Promo<span className="text-[#D94F2B]">AR</span>
                </span>
              </Link>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                El agregador de promociones bancarias y descuentos más completo de Argentina.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-200 mb-3">Herramientas</p>
              <ul className="space-y-2 text-xs">
                <li><Link href="/promos" className="hover:text-white transition-colors">Todas las Promos</Link></li>
                <li><Link href="/ahorro-interactivo/supermercados" className="text-[#E8724F] font-semibold hover:text-white transition-colors">Simulador Supermercados</Link></li>
                <li><Link href="/ahorro-interactivo/combustible" className="text-[#E8724F] font-semibold hover:text-white transition-colors">Simulador Nafta</Link></li>
                <li><Link href="/ahorro-interactivo/farmacias" className="text-[#E8724F] font-semibold hover:text-white transition-colors">Simulador Farmacias</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-200 mb-3">Empresa</p>
              <ul className="space-y-2 text-xs">
                <li><Link href="/quienes-somos" className="hover:text-white transition-colors">Quiénes somos</Link></li>
                <li><Link href="/como-funciona" className="hover:text-white transition-colors">Cómo funciona</Link></li>
                <li><Link href="/contacto" className="hover:text-white transition-colors">Contacto</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-200 mb-3">Legal</p>
              <ul className="space-y-2 text-xs">
                <li><Link href="/privacidad" className="hover:text-white transition-colors">Privacidad</Link></li>
                <li><Link href="/terminos" className="hover:text-white transition-colors">Términos y Condiciones</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#26406F]/80 pt-6 text-center text-xs text-slate-500">
            <p>© {new Date().getFullYear()} PromoAR. Las promociones son provistas por cada entidad financiera. Verificá vigencia y condiciones antes de usar.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
