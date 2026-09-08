'use client'

import React, { useState, useEffect } from 'react'
import {
  X, Smartphone, Layers, ExternalLink, ArrowLeft,
  Share2, ShieldCheck, Check, Edit3, Sparkles
} from 'lucide-react'
import PromoCard from '@/app/components/PromoCard'

export type PreviewViewType = 'CARD' | 'SHEET' | 'PAGE'

interface PromoMultiPreviewModalProps {
  promo: any
  initialView?: PreviewViewType
  isOpen: boolean
  onClose: () => void
  onEditInStudio?: () => void
}

const DAY_BITS = [
  { label: 'L', bit: 2 },
  { label: 'M', bit: 4 },
  { label: 'X', bit: 8 },
  { label: 'J', bit: 16 },
  { label: 'V', bit: 32 },
  { label: 'S', bit: 64 },
  { label: 'D', bit: 1 },
]

function formatDateStr(d: string | Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PromoMultiPreviewModal({
  promo,
  initialView = 'CARD',
  isOpen,
  onClose,
  onEditInStudio,
}: PromoMultiPreviewModalProps) {
  const [currentView, setCurrentView] = useState<PreviewViewType>(initialView)

  useEffect(() => {
    setCurrentView(initialView)
  }, [initialView, promo])

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !promo) return null

  // Normalizar datos de la promo para los 3 formatos
  const req = promo.requirements?.[0] || {}
  const commerceName = promo.commerce?.name || promo.commerceName || 'Comercio'
  const commerceLogo = promo.commerce?.logoUrl || promo.commerceLogo || null
  const categoryName = promo.category?.name || promo.categoryName || 'Supermercados'
  const categoryIcon = promo.category?.icon || promo.categoryIcon || '🛒'
  const categoryColor = promo.category?.color || promo.categoryColor || '#3B82F6'

  const discountVal = req.discountValue ?? promo.discountValue ?? 20
  const discountKind = req.discountType ?? promo.benefitKind ?? 'PERCENTAGE_DESCUENTO'
  const validDays = promo.validDays ?? 127
  const validFrom = promo.validFrom ?? new Date().toISOString()
  const validUntil = promo.validUntil ?? '2026-12-31'
  const cap = req.cap ?? promo.capAmount ?? (promo.capUnlimited ? null : 8000)
  const capUnlimited = req.capUnlimited ?? promo.capUnlimited ?? false
  const capPeriod = req.capPeriod ?? promo.capPeriod ?? 'MONTHLY'
  const salesChannel = promo.salesChannel ?? 'AMBOS'
  const accountType = req.accountType ?? promo.accountType ?? 'ANY'
  const paymentChannel = req.paymentChannel ?? promo.paymentChannel ?? 'ANY'
  const conditionsNote = promo.conditionsNote || promo.commerceNote || ''
  const exclusionsNote = promo.exclusionsNote || ''
  const title = promo.title || `${commerceName} – Descuento`

  const WALLET_FALLBACKS: Record<string, { name: string; logoUrl: string }> = {
    'club-la-nacion': { name: 'Club La Nación', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=lanacion.com.ar' },
    'clarin-365': { name: 'Clarín 365', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=365.clarin.com' },
    'clarin-365-plus': { name: 'Clarín 365 Plus', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=365.clarin.com' },
    'comunidad-coto': { name: 'Comunidad Coto', logoUrl: 'https://www.coto.com.ar/favicon.ico' },
    'favacard': { name: 'Favacard', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=favacard.com.ar' },
    'modo': { name: 'MODO', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=modo.com.ar' },
    'cuentadni': { name: 'Cuenta DNI', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=bancoprovincia.com.ar' },
    'mercadopago': { name: 'Mercado Pago', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=mercadopago.com.ar' },
    'personalpay': { name: 'Personal Pay', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=personalpay.com.ar' },
    'naranjax': { name: 'Naranja X', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=naranjax.com' },
    'uala': { name: 'Ualá', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=uala.com.ar' },
    'buepp': { name: 'BUEPP', logoUrl: 'https://www.bancociudad.com.ar/beneficios/assets/img/logo-banco-ciudad.svg' },
  }

  // Bancos involucrados
  const banks: Array<{ name: string; logoUrl?: string | null; slug?: string }> = []
  if (promo.requirements && Array.isArray(promo.requirements)) {
    promo.requirements.forEach((r: any) => {
      if (r.bank?.name && !banks.some(b => b.name === r.bank.name)) {
        banks.push(r.bank)
      }
    })
  }
  if (banks.length === 0 && promo.selectedBanks?.length && promo.availableBanks) {
    promo.selectedBanks.forEach((bId: string) => {
      const found = promo.availableBanks.find((x: any) => x.id === bId || x.slug === bId)
      if (found && !banks.some(b => b.name === found.name)) banks.push(found)
    })
  }

  // Billeteras y Tarjetas de Beneficios (Club La Nación, 365, MODO, etc.)
  const wallets: Array<{ name: string; logoUrl?: string | null; slug?: string }> = []
  if (promo.requirements && Array.isArray(promo.requirements)) {
    promo.requirements.forEach((r: any) => {
      if (r.wallet?.name && !wallets.some(w => w.name === r.wallet.name)) {
        const slug = r.wallet.slug || r.wallet.name.toLowerCase().replace(/\s+/g, '-')
        const fallback = WALLET_FALLBACKS[slug]
        wallets.push({
          ...r.wallet,
          name: fallback?.name || r.wallet.name,
          slug,
          logoUrl: r.wallet.logoUrl || fallback?.logoUrl || null,
        })
      }
    })
  }
  if (wallets.length === 0 && promo.selectedWallets?.length && promo.availableWallets) {
    promo.selectedWallets.forEach((wId: string) => {
      const found = promo.availableWallets.find((x: any) => x.id === wId || x.slug === wId)
      if (found && !wallets.some(w => w.name === found.name)) {
        const slug = found.slug || found.name.toLowerCase().replace(/\s+/g, '-')
        const fallback = WALLET_FALLBACKS[slug]
        wallets.push({
          ...found,
          name: fallback?.name || found.name,
          slug,
          logoUrl: found.logoUrl || fallback?.logoUrl || null,
        })
      }
    })
  }

  // Redes de tarjetas (Visa, Mastercard, etc.)
  const networks: Array<{ name: string; slug: string }> = []
  if (promo.requirements && Array.isArray(promo.requirements)) {
    promo.requirements.forEach((r: any) => {
      if (r.cardNetwork?.name && !networks.some(n => n.name === r.cardNetwork.name)) {
        networks.push(r.cardNetwork)
      }
    })
  }
  if (networks.length === 0 && promo.selectedNetworks?.length && promo.availableNetworks) {
    promo.selectedNetworks.forEach((nId: string) => {
      const found = promo.availableNetworks.find((x: any) => x.id === nId || x.slug === nId)
      if (found && !networks.some(n => n.name === found.name)) networks.push(found)
    })
  }

  const discountBadgeLabel = (() => {
    if (discountKind === 'CUOTAS_SIN_INTERES') return `${discountVal} cuotas sin interés`
    if (discountKind === 'SEGUNDA_UNIDAD') return `2da al ${discountVal}%`
    if (discountKind === 'NXM') return `${req.nxmN || 2}x${req.nxmM || 1}`
    if (discountKind === 'FIXED_AMOUNT') return `$${Number(discountVal).toLocaleString('es-AR')} OFF`
    if (discountKind === 'PERCENTAGE_REINTEGRO') return `${discountVal}% reintegro`
    return `${discountVal}% descuento`
  })()

  const entityDescriptionText = (() => {
    const allNames = [...banks.map(b => b.name), ...wallets.map(w => w.name)]
    if (allNames.length > 0) {
      return ` con ${allNames.join(' y ')}`
    }
    if (networks.length > 0) {
      return ` con tarjetas ${networks.map(n => n.name).join(' y ')}`
    }
    return ''
  })()

  // Tarjeta compatible con PromoCard
  const normalizedForCard = {
    id: promo.id || 'preview-card',
    title: title,
    commerce: { name: commerceName, logoUrl: commerceLogo },
    category: { name: categoryName, color: categoryColor, icon: categoryIcon },
    validDays,
    validFromHour: promo.validFromHour ?? null,
    validToHour: promo.validToHour ?? null,
    accountType,
    salesChannel,
    stackable: promo.stackable ?? false,
    plusDiscountNote: promo.plusDiscountNote || (promo.hasPlusBenefit ? `+${promo.plusValue}% ${promo.plusType}` : null),
    commerceNote: conditionsNote,
    requirements: [
      {
        discountType: discountKind,
        discountValue: discountVal,
        cap: capUnlimited ? null : cap,
        capUnlimited,
        capPeriod,
        paymentChannel,
        accountType,
        bank: banks[0] || null,
        wallet: wallets[0] || null,
        cardNetwork: networks[0] || null,
      }
    ],
    coverageStatus: 'TERRITORIAL',
    coverageLabel: 'Cobertura en Todo el país',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0B1527] border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* ── BARRA SUPERIOR CON SELECTOR DE VISTAS (TABS) ── */}
        <div className="bg-[#0F223D] border-b border-slate-800 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0A1628] border border-slate-700 flex items-center justify-center p-1 shrink-0 overflow-hidden">
              {commerceLogo ? (
                <img src={commerceLogo} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-sm">{categoryIcon}</span>
              )}
            </div>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                {commerceName}
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  Preview
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Visualizá cómo se ve la promo en los 3 formatos de PromoAR
              </p>
            </div>
          </div>

          {/* Selector de los 3 tipos de Tarjeta / Vistas */}
          <div className="bg-[#0A1628] border border-slate-700/80 p-1 rounded-2xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentView('CARD')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                currentView === 'CARD'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Smartphone size={13} />
              <span className="hidden sm:inline">1. Tarjeta Standard</span>
              <span className="sm:hidden">1. Tarjeta</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentView('SHEET')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                currentView === 'SHEET'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers size={13} />
              <span className="hidden sm:inline">2. Modal Rápido</span>
              <span className="sm:hidden">2. Modal</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentView('PAGE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                currentView === 'PAGE'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">3. Página Web</span>
              <span className="sm:hidden">3. Página</span>
            </button>
          </div>

          {/* Acciones derecha: Editar en Studio & Cerrar */}
          <div className="flex items-center gap-2">
            {onEditInStudio && (
              <button
                type="button"
                onClick={() => {
                  onEditInStudio()
                  onClose()
                }}
                className="text-xs font-bold px-3 py-1.5 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white rounded-xl border border-slate-700 hover:border-blue-500 transition-all flex items-center gap-1.5"
              >
                <Edit3 size={13} />
                <span className="hidden md:inline">Editar en Studio</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
              title="Cerrar vista previa (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── CUERPO DEL POPUP (CONTENIDO DE LA VISTA SELECCIONADA) ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#070D18] flex justify-center items-start">

          {/* ══════════════════════════════════════════════════════════════
              VISTA 1: TARJETA STANDARD (FEED / LANDING PAGE)
          ══════════════════════════════════════════════════════════════ */}
          {currentView === 'CARD' && (
            <div className="w-full max-w-sm space-y-4 animate-in fade-in duration-200">
              <div className="text-center space-y-1">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                  Vista 1: Landing Page & Explorador
                </span>
                <p className="text-xs text-slate-400">
                  Esta es la tarjeta compacta que ve el usuario navegando el feed.
                </p>
              </div>

              {/* Contenedor simulador de Feed */}
              <div className="bg-[#0A1628] border border-slate-800 p-6 rounded-3xl flex flex-col items-center justify-center shadow-xl">
                <div style={{ width: 185 }} className="cursor-pointer transition-transform hover:scale-[1.02]" onClick={() => setCurrentView('SHEET')}>
                  <PromoCard
                    promo={normalizedForCard as any}
                    onClick={() => setCurrentView('SHEET')}
                    fullWidth
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentView('SHEET')}
                  className="mt-5 text-xs font-bold text-indigo-300 hover:text-white bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Layers size={13} />
                  Hacé click para abrir el Modal Rápido →
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VISTA 2: MODAL RÁPIDO / BOTTOM SHEET (AL CLICKEAR EN HOME)
          ══════════════════════════════════════════════════════════════ */}
          {currentView === 'SHEET' && (
            <div className="w-full max-w-md animate-in fade-in duration-200 space-y-3">
              <div className="text-center space-y-0.5 mb-1">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-3 py-0.5 rounded-full border border-indigo-500/20">
                  Vista 2: Modal Rápido / Sheet
                </span>
                <p className="text-xs text-slate-400">
                  Se abre en pantalla superpuesta cuando el usuario toca la promo.
                </p>
              </div>

              {/* Mockup exacto de PromoDetailSheet */}
              <div className="bg-white dark:bg-[#0D1E36] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/80">
                
                {/* Header Azul Marino (#1D3D6E) */}
                <div className="relative bg-[#1D3D6E] px-6 pt-7 pb-6 text-center text-white">
                  {/* Badge Canal Físico/Online */}
                  {salesChannel !== 'AMBOS' && (
                    <div className="absolute top-3 left-3 bg-[#F59E0B] text-[#78350F] text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg shadow-sm">
                      {salesChannel === 'ONLINE' ? 'Exclusivo Online' : 'Exclusivo Físico'}
                    </div>
                  )}

                  {/* Botón cerrar X */}
                  <button
                    type="button"
                    onClick={() => setCurrentView('CARD')}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white text-xs transition-all"
                    title="Cerrar modal"
                  >
                    ✕
                  </button>

                  {/* Logo en caja blanca redondeada */}
                  <div className="w-16 h-16 rounded-2xl bg-white mx-auto flex items-center justify-center p-2.5 shadow-md mb-3">
                    {commerceLogo ? (
                      <img src={commerceLogo} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-2xl">{categoryIcon}</span>
                    )}
                  </div>

                  {/* Título y categoría */}
                  <h3 className="text-lg font-black tracking-tight uppercase leading-tight">
                    {commerceName}
                  </h3>
                  <p className="text-xs text-blue-200 mt-0.5 flex items-center justify-center gap-1">
                    <span>{categoryIcon}</span> {categoryName}
                  </p>

                  {/* Descuento Gigante Central */}
                  <div className="mt-3 flex items-baseline justify-center gap-1.5">
                    <span className="text-5xl font-black tracking-tight text-white">
                      {discountVal}
                    </span>
                    <span className="text-2xl font-black text-[#F97316]">
                      {discountKind === 'CUOTAS_SIN_INTERES' ? 'CSI' : '%'}
                    </span>
                    <span className="text-sm font-bold text-blue-200 ml-1">
                      {discountKind === 'PERCENTAGE_REINTEGRO' ? 'reintegro' : 'descuento'}
                    </span>
                  </div>
                </div>

                {/* Contenido del Sheet */}
                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                  
                  {/* Banner de Aviso / Plan Sueldo / Jubilados */}
                  {(accountType !== 'ANY' || promo.hasPlusBenefit || conditionsNote) && (
                    <div className="bg-[#FFFBEB] dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                      <span className="text-base shrink-0">⚠️</span>
                      <div className="space-y-0.5">
                        {accountType === 'HABERES' && (
                          <p className="font-bold">💼 Exclusivo Plan Sueldo / Haberes</p>
                        )}
                        {accountType === 'JUBILADO' && (
                          <p className="font-bold">👵 Exclusivo Jubilados y Pensionados</p>
                        )}
                        {promo.hasPlusBenefit && (
                          <p className="font-bold">
                            ⭐ Plus de +{promo.plusValue}% para {promo.plusType === 'HABERES' ? 'Cuenta Sueldo' : 'Jubilados'}
                          </p>
                        )}
                        <p className="leading-relaxed opacity-95">
                          {conditionsNote || 'Promoción sujeta a términos bancarios vigentes y acreditación correspondiente.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Sección Vigencia */}
                  <div className="bg-gray-50 dark:bg-[#0A1628] rounded-2xl p-4 space-y-2.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                      Vigencia
                    </p>

                    {/* Días L M X J V S D */}
                    <div className="flex gap-1.5 justify-between">
                      {DAY_BITS.map(({ label, bit }) => {
                        const active = (validDays & bit) !== 0
                        return (
                          <div
                            key={label}
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs transition-colors ${
                              active
                                ? 'bg-[#1D3D6E] text-white shadow-sm'
                                : 'bg-gray-200/80 dark:bg-slate-800 text-gray-400 dark:text-slate-600'
                            }`}
                          >
                            {label}
                          </div>
                        )
                      })}
                    </div>

                    {/* Rango de fechas */}
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Desde {formatDateStr(validFrom)} · Vence {formatDateStr(validUntil)}
                    </p>

                    {/* Tope de reintegro */}
                    <div className="pt-1">
                      {capUnlimited ? (
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/30 px-3 py-1 rounded-xl inline-flex items-center gap-1.5">
                          ✅ Sin tope de reintegro
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/30 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5">
                          🔒 Tope ${Number(cap).toLocaleString('es-AR')} por {capPeriod === 'WEEKLY' ? 'semana' : 'mes'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sección Con qué pagás */}
                  <div className="bg-gray-50 dark:bg-[#0A1628] rounded-2xl p-4 space-y-2.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                      Con qué pagás
                    </p>
                    
                    <div className="space-y-2">
                      {/* Bancos */}
                      {banks.map((b, idx) => (
                        <div key={`b-${idx}`} className="flex items-center gap-2.5 bg-white dark:bg-[#11223B] p-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
                          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                            {b.logoUrl ? (
                              <img src={b.logoUrl} alt="" className="w-5 h-5 object-contain" />
                            ) : (
                              <span className="text-xs">🏦</span>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-white">{b.name}</p>
                            <p className="text-[10px] text-gray-400">Banco emisor</p>
                          </div>
                        </div>
                      ))}

                      {/* Billeteras y Tarjetas de Beneficios */}
                      {wallets.map((w, idx) => {
                        const isBenefit = w.name?.toLowerCase().includes('club') || w.name?.toLowerCase().includes('365') || w.name?.toLowerCase().includes('comunidad')
                        return (
                          <div key={`w-${idx}`} className="flex items-center gap-2.5 bg-white dark:bg-[#11223B] p-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
                            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                              {w.logoUrl ? (
                                <img src={w.logoUrl} alt="" className="w-5 h-5 object-contain" />
                              ) : (
                                <span className="text-xs">{isBenefit ? '🗞️' : '📱'}</span>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-800 dark:text-white">{w.name}</p>
                              <p className="text-[10px] text-gray-400">
                                {isBenefit ? 'Tarjeta de beneficios' : 'Billetera virtual'}
                              </p>
                            </div>
                          </div>
                        )
                      })}

                      {/* Redes de tarjetas */}
                      {networks.map((n, idx) => (
                        <div key={`n-${idx}`} className="flex items-center gap-2 bg-white dark:bg-[#11223B] p-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
                          <span className="text-xs pl-1">💳</span>
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-white">{n.name}</p>
                            <p className="text-[10px] text-gray-400">Tarjeta de crédito / débito</p>
                          </div>
                        </div>
                      ))}

                      {banks.length === 0 && wallets.length === 0 && networks.length === 0 && (
                        <div className="p-2 text-xs text-gray-500 dark:text-slate-400 font-medium">
                          Cualquier medio de pago habilitado en el comercio
                        </div>
                      )}

                      {/* Chip de medio de pago / canal */}
                      {paymentChannel && paymentChannel !== 'ANY' && (
                        <div className="pt-1">
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/40 px-3 py-1 rounded-xl inline-block">
                            {paymentChannel === 'QR' ? '📱 QR / MODO' : paymentChannel === 'NFC' ? '📶 Sin contacto (NFC)' : paymentChannel === 'TARJETA_FISICA' ? '💳 Tarjeta física' : paymentChannel === 'TRANSFERENCIA' ? '💸 Transferencia' : '💰 Dinero en cuenta'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Términos y Condiciones */}
                  <div className="bg-gray-50 dark:bg-[#0A1628] rounded-2xl p-4 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                      Términos y Condiciones
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                      {exclusionsNote ? `Exclusiones: ${exclusionsNote}. ` : ''}
                      {conditionsNote || 'No disponemos del texto legal completo.'}
                    </p>
                  </div>

                  {/* ── BOTÓN PEDIDO POR EL USUARIO: "Ver página completa · compartir" ── */}
                  <button
                    type="button"
                    onClick={() => setCurrentView('PAGE')}
                    className="w-full flex items-center justify-center gap-2 text-xs font-bold text-[#1D3D6E] dark:text-[#8AADD4] bg-[#EEF2F8] dark:bg-[#1E3055] hover:bg-[#1D3D6E] hover:text-white dark:hover:bg-[#3A6BC4] dark:hover:text-white px-4 py-3 rounded-2xl transition-all shadow-sm group"
                  >
                    <ExternalLink size={13} className="transition-transform group-hover:scale-110" />
                    <span>Ver página completa · compartir</span>
                    <span className="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded-full ml-1 font-mono">
                      Foto 4
                    </span>
                  </button>

                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VISTA 3: PÁGINA WEB COMPLETA (/promos/[slug] - FOTO 4)
          ══════════════════════════════════════════════════════════════ */}
          {currentView === 'PAGE' && (
            <div className="w-full max-w-md animate-in fade-in duration-200 space-y-3 pb-8">
              <div className="text-center space-y-0.5 mb-1">
                <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider bg-purple-500/10 px-3 py-0.5 rounded-full border border-purple-500/20">
                  Vista 3: Página Web Completa (/promos/[slug])
                </span>
                <p className="text-xs text-slate-400">
                  Página standalone optimizada para Google, SEO y compartir enlaces.
                </p>
              </div>

              {/* Contenedor simulador de página móvil */}
              <div className="bg-gray-50 dark:bg-[#070E1A] rounded-3xl p-4 sm:p-5 border border-slate-700/80 shadow-2xl space-y-3.5">
                
                {/* Back button */}
                <div className="flex items-center gap-2 text-xs font-black text-gray-700 dark:text-slate-300 pb-1">
                  <button
                    type="button"
                    onClick={() => setCurrentView('SHEET')}
                    className="flex items-center gap-1.5 hover:text-blue-500 transition-colors"
                  >
                    <ArrowLeft size={14} /> Volver a {commerceName}
                  </button>
                </div>

                {/* ── HERO CURVED CARD DE LA FOTO 4 ── */}
                <div className="bg-gradient-to-br from-[#3B49B8] to-[#2B3896] rounded-3xl overflow-hidden shadow-lg relative text-white">
                  {/* Badge Superior Físico / Online */}
                  {salesChannel !== 'AMBOS' && (
                    <div className="absolute top-0 left-0 bg-[#F59E0B] text-[#78350F] text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-br-xl shadow-sm">
                      {salesChannel === 'ONLINE' ? 'Exclusivo Online' : 'Exclusivo Físico'}
                    </div>
                  )}

                  <div className="px-6 pt-7 pb-5">
                    {/* Categoría */}
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 flex items-center gap-1">
                      <span>{categoryIcon}</span> {categoryName}
                    </p>

                    {/* Descuento principal gigante */}
                    <div className="mt-2 mb-1">
                      <p className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-white">
                        {discountVal}% descuento
                      </p>
                    </div>

                    {/* Comercio */}
                    <p className="text-white font-black text-base mt-2 tracking-wide uppercase">
                      {commerceName}
                    </p>
                  </div>

                  {/* Sub-barra de beneficio */}
                  <div className="bg-white/10 px-6 py-2.5 border-t border-white/10 text-xs font-medium text-indigo-100">
                    Hasta {discountVal}% en {categoryName}
                  </div>
                </div>

                {/* ── PÁRRAFO DESCRIPTIVO SEO ── */}
                <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed px-1">
                  {commerceName} ofrece {discountBadgeLabel}{entityDescriptionText}. Vigente hasta el {formatDateStr(validUntil)}. Categoría: {categoryName}.
                </p>

                {/* ── BOTÓN CTA "Ver más promos como esta" (DE LA FOTO 4) ── */}
                <button
                  type="button"
                  onClick={() => alert('Simulación: navegaría a /promos?cat=' + categoryName)}
                  className="w-full flex items-center justify-between bg-gradient-to-r from-[#1D3D6E] to-[#264C87] hover:from-[#152e54] hover:to-[#1D3D6E] text-white rounded-2xl px-5 py-3.5 shadow-md transition-all"
                >
                  <span className="text-xs font-black">Ver más promos como esta →</span>
                  <div className="w-7 h-7 rounded-xl bg-[#E05333] flex items-center justify-center shrink-0 text-sm shadow-sm">
                    🎯
                  </div>
                </button>

                {/* ── TARJETA DORADA DE PROGRAMA / SUELDO (FOTO 4) ── */}
                {(accountType !== 'ANY' || promo.hasPlusBenefit) && (
                  <div className="bg-[#FFFDF5] dark:bg-amber-950/20 border border-[#FDE68A] dark:border-amber-700/50 rounded-2xl p-4 space-y-1 shadow-sm">
                    <p className="text-xs font-black text-[#92400E] dark:text-amber-300 flex items-center gap-1.5 uppercase">
                      ⭐ {accountType === 'HABERES' ? 'PLAN SUELDO' : accountType === 'JUBILADO' ? 'BENEFICIO JUBILADOS' : 'PROGRAMA EXCLUSIVO'}
                    </p>
                    <p className="text-xs text-[#78350F] dark:text-amber-200 leading-relaxed">
                      Beneficio de hasta {discountVal}% exclusivo para clientes adheridos al programa.
                      {promo.hasPlusBenefit && ` Incluye adicional de +${promo.plusValue}%.`}
                    </p>
                  </div>
                )}

                {/* ── BANNER DE ALERTA DE CONDICIONES (FOTO 4) ── */}
                <div className="bg-[#FFFBEB] dark:bg-amber-950/30 border border-[#FCD34D] dark:border-amber-700/40 rounded-2xl p-3.5 flex items-start gap-2 text-xs text-[#78350F] dark:text-amber-200">
                  <span className="text-sm shrink-0 mt-0.5">⚠️</span>
                  <p className="leading-relaxed">
                    {conditionsNote || 'Programa exclusivo con reintegro acreditado en cuenta según bases de la entidad.'}
                  </p>
                </div>

                {/* ── SECCIÓN VIGENCIA (FOTO 4) ── */}
                <div className="bg-white dark:bg-[#0C192E] rounded-2xl border border-gray-100 dark:border-slate-800 p-4 space-y-3 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                    Vigencia
                  </p>

                  {/* Días en círculos Azules Indigo (Foto 4) */}
                  <div className="flex gap-1.5 justify-between">
                    {DAY_BITS.map(({ label, bit }) => {
                      const active = (validDays & bit) !== 0
                      return (
                        <div
                          key={label}
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                            active
                              ? 'bg-[#4338CA] text-white shadow-sm'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600'
                          }`}
                        >
                          {label}
                        </div>
                      )
                    })}
                  </div>

                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Desde {formatDateStr(validFrom)} · Vence {formatDateStr(validUntil)}
                  </p>

                  {/* Tope pill */}
                  <div>
                    {capUnlimited ? (
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/30 px-3 py-1 rounded-xl inline-block">
                        ✅ Sin tope de reintegro
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/30 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5">
                        🔒 Tope ${Number(cap).toLocaleString('es-AR')} por mes
                      </span>
                    )}
                  </div>
                </div>

                {/* Botón rápido para volver al modal */}
                <button
                  type="button"
                  onClick={() => setCurrentView('SHEET')}
                  className="w-full text-center text-xs font-bold text-slate-400 hover:text-white py-2"
                >
                  ← Volver al Modal Rápido
                </button>

              </div>
            </div>
          )}

        </div>

        {/* ── FOOTER INFORMATIVO ── */}
        <div className="bg-[#0F223D] border-t border-slate-800 px-6 py-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-amber-400" />
            <span className="hidden sm:inline">Tip: Podés probar cómo fluye el usuario haciendo click entre las tarjetas o los botones de cada vista.</span>
            <span className="sm:hidden">Podés alternar entre las 3 vistas en los botones de arriba.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-300 hover:text-white px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}
