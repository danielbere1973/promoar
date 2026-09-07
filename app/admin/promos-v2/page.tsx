'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import PromoCard from '@/app/components/PromoCard'
import {
  Sparkles, Plus, Search, Filter, CheckCircle2, Clock, XCircle,
  Building2, CreditCard, Calendar, Tag, ShieldCheck, ArrowRight,
  ChevronRight, ArrowLeft, Eye, Edit3, Check, Trash2, SlidersHorizontal,
  Layers, Zap, AlertCircle, RefreshCw, Smartphone, ExternalLink, HelpCircle,
  Store, Globe, Wallet, DollarSign, Percent, ChevronDown
} from 'lucide-react'

// Categorías del catálogo
const DEFAULT_CATEGORIES = [
  { id: 'cat-gastronomia', name: 'Gastronomía', icon: '🍔', color: '#F97316' },
  { id: 'cat-supermercados', name: 'Supermercados', icon: '🛒', color: '#10B981' },
  { id: 'cat-indumentaria', name: 'Indumentaria', icon: '👕', color: '#8B5CF6' },
  { id: 'cat-farmacias', name: 'Farmacias', icon: '💊', color: '#06B6D4' },
  { id: 'cat-combustible', name: 'Combustible', icon: '⛽', color: '#EF4444' },
  { id: 'cat-tecnologia', name: 'Tecnología', icon: '💻', color: '#3B82F6' },
  { id: 'cat-heladerias', name: 'Heladerías', icon: '🍦', color: '#EC4899' },
  { id: 'cat-otros', name: 'Otros', icon: '🏷️', color: '#64748B' },
]

// Lista exhaustiva de Bancos
const ALL_BANKS = [
  { id: 'b-galicia', name: 'Banco Galicia', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=galicia.ar' },
  { id: 'b-santander', name: 'Santander', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=santander.com.ar' },
  { id: 'b-bbva', name: 'BBVA', logoUrl: 'https://www.bbva.com.ar/favicon.ico' },
  { id: 'b-macro', name: 'Banco Macro', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=macro.com.ar' },
  { id: 'b-nacion', name: 'Banco Nación', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=bna.com.ar' },
  { id: 'b-icbc', name: 'ICBC', logoUrl: 'https://logo-teka.com/wp-content/uploads/2026/01/icbc-vertical-logo.svg' },
  { id: 'b-ciudad', name: 'Banco Ciudad', logoUrl: 'https://www.bancociudad.com.ar/beneficios/assets/img/logo-banco-ciudad.svg' },
  { id: 'b-supervielle', name: 'Supervielle', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=supervielle.com.ar' },
  { id: 'b-patagonia', name: 'Banco Patagonia', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=bancopatagonia.com.ar' },
  { id: 'b-bancor', name: 'Bancor (Córdoba)', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=bancor.com.ar' },
  { id: 'b-provincia', name: 'Banco Provincia', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=bancoprovincia.com.ar' },
  { id: 'b-credicoop', name: 'Credicoop', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=bancocredicoop.coop' },
  { id: 'b-brubank', name: 'Brubank', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=brubank.com' },
]

// Lista exhaustiva de Billeteras
const ALL_WALLETS = [
  { id: 'w-modo', name: 'MODO', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=modo.com.ar' },
  { id: 'w-cuentadni', name: 'Cuenta DNI', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=bancoprovincia.com.ar' },
  { id: 'w-mercadopago', name: 'Mercado Pago', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=mercadopago.com.ar' },
  { id: 'w-personalpay', name: 'Personal Pay', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=personalpay.com.ar' },
  { id: 'w-naranjax', name: 'Naranja X', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=naranjax.com' },
  { id: 'w-uala', name: 'Ualá', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=uala.com.ar' },
  { id: 'w-buepp', name: 'BUEPP (Ciudad)', logoUrl: 'https://www.bancociudad.com.ar/beneficios/assets/img/logo-banco-ciudad.svg' },
]

// Redes de Tarjeta
const ALL_NETWORKS = [
  { id: 'net-visa', name: 'Visa', slug: 'visa' },
  { id: 'net-mastercard', name: 'Mastercard', slug: 'mastercard' },
  { id: 'net-amex', name: 'American Express', slug: 'amex' },
  { id: 'net-cabal', name: 'Cabal', slug: 'cabal' },
  { id: 'net-naranjax', name: 'Naranja X', slug: 'naranja-x' },
  { id: 'net-diners', name: 'Diners Club', slug: 'diners' },
]

// Segmentos bancarios VIP / Premium
const BANK_SEGMENTS = [
  { id: 'seg-eminent', name: 'Galicia Eminent', bank: 'Galicia' },
  { id: 'seg-selecta', name: 'Macro Selecta', bank: 'Macro' },
  { id: 'seg-black', name: 'Santander Black / Select', bank: 'Santander' },
  { id: 'seg-platinum', name: 'Santander Platinum', bank: 'Santander' },
  { id: 'seg-duo', name: 'Santander Dúo', bank: 'Santander' },
  { id: 'seg-bbva-premium', name: 'BBVA Premium World', bank: 'BBVA' },
  { id: 'seg-icbc-exclusive', name: 'ICBC Exclusive Banking', bank: 'ICBC' },
  { id: 'seg-identite', name: 'Supervielle Identité', bank: 'Supervielle' },
  { id: 'seg-singular', name: 'Patagonia Singular', bank: 'Patagonia' },
]

// Segmentos de Tarjetas (Tier)
const CARD_SEGMENTS = [
  { id: 'cs-signature', name: 'Visa Signature' },
  { id: 'cs-infinite', name: 'Visa Infinite' },
  { id: 'cs-mc-black', name: 'Mastercard Black' },
  { id: 'cs-platinum', name: 'Visa / MC Platinum' },
  { id: 'cs-gold', name: 'Visa / MC Gold' },
  { id: 'cs-amex-black', name: 'AmEx Black' },
]

// Formas de pago
const PAYMENT_CHANNELS = [
  { id: 'ANY', label: 'Cualquier forma de pago', desc: 'Tarjeta física, contactless, QR o web' },
  { id: 'QR', label: 'QR / MODO', desc: 'Escaneando con app bancaria o billetera' },
  { id: 'NFC', label: 'Sin contacto (NFC)', desc: 'Contactless con tarjeta o celular' },
  { id: 'TARJETA_FISICA', label: 'Tarjeta física', desc: 'Presentando el plástico en la terminal' },
  { id: 'TRANSFERENCIA', label: 'Transferencia directa', desc: 'Alias / CBU' },
  { id: 'DINERO_EN_CUENTA', label: 'Dinero en cuenta', desc: 'Débito directo sin tarjeta' },
]

// Tipos de cuenta bancaria
const ACCOUNT_TYPES = [
  { id: 'ANY', label: 'Cualquier cuenta', desc: 'Sin requisito laboral o previsional' },
  { id: 'HABERES', label: 'Cuenta Sueldo (Plan Sueldo)', desc: 'Para clientes que cobran haberes en la entidad' },
  { id: 'JUBILADO', label: 'Jubilados / Pensionados', desc: 'Para adultos mayores que perciben jubilación' },
  { id: 'ANSES', label: 'Beneficiarios ANSES / AUH', desc: 'Cobro de asignaciones y programas sociales' },
]

const DAYS_KEYS = [
  { bit: 1, label: 'D', name: 'Domingo' },
  { bit: 2, label: 'L', name: 'Lunes' },
  { bit: 4, label: 'M', name: 'Martes' },
  { bit: 8, label: 'M', name: 'Miércoles' },
  { bit: 16, label: 'J', name: 'Jueves' },
  { bit: 32, label: 'V', name: 'Viernes' },
  { bit: 64, label: 'S', name: 'Sábado' },
]

export default function AdminPromosV2Page() {
  const [viewRole, setViewRole] = useState<'ADMIN' | 'MERCHANT'>('ADMIN')
  const [activeTab, setActiveTab] = useState<'LIST' | 'STUDIO'>('STUDIO')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'EXCLUSIVE' | 'ACTIVE' | 'EXPIRED'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Pasos del Studio
  const [step, setStep] = useState<1 | 2 | 3 | 4>(2)

  // Estado completo del Formulario
  const [formData, setFormData] = useState({
    id: '',
    // 1. Comercio y Canales
    commerceName: 'Supermercados Coto',
    commerceLogo: 'https://www.coto.com.ar/favicon.ico',
    categoryId: 'cat-supermercados',
    categoryName: 'Supermercados',
    categoryColor: '#10B981',
    categoryIcon: '🛒',
    salesChannel: 'AMBOS', // PRESENCIAL, ONLINE, AMBOS

    // 2. Beneficio
    benefitKind: 'PERCENTAGE_REINTEGRO', // PERCENTAGE_DESCUENTO, PERCENTAGE_REINTEGRO, CUOTAS_SIN_INTERES, NXM, SEGUNDA_UNIDAD, FIXED_AMOUNT
    discountValue: 20,
    installmentsCount: 6,
    nxmN: 2,
    nxmM: 1,
    segundaUnidadPct: 70, // 2do al 70%
    fixedAmountValue: 5000,
    hasCap: true,
    capAmount: 8000,
    capPeriod: 'MONTHLY', // MONTHLY, WEEKLY, DAILY, PER_TRANSACTION
    capUnlimited: false,
    minPurchase: 0,

    // Beneficio Plus / Adicional (Punto de feedback del usuario)
    hasPlusBenefit: true,
    plusType: 'HABERES', // 'HABERES' | 'JUBILADO' | 'SEGMENT'
    plusValue: 5, // ej. +5% adicional
    plusCapAmount: 4000,

    // 3. Financiación y Requisitos (Punto 2 de feedback)
    isExclusivePromoAR: false, // true = directo de comercio; false = requiere bancos/tarjetas
    selectedBanks: ['b-galicia'],
    selectedWallets: ['w-modo'],
    selectedNetworks: ['net-visa', 'net-mastercard'],
    cardType: 'CREDIT', // ANY, CREDIT, DEBIT, PREPAID
    selectedSegment: '', // Segmento banco VIP (ej. Eminent)
    selectedCardSegment: '', // Segmento tarjeta (ej. Signature)
    accountType: 'ANY', // ANY, HABERES (Cuenta sueldo), JUBILADO, ANSES
    paymentChannel: 'QR', // ANY, QR, NFC, TARJETA_FISICA, TRANSFERENCIA, DINERO_EN_CUENTA

    // 4. Vigencia y Horarios
    validDays: 32, // Viernes
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '2026-12-31',
    hasExpiration: true,
    hasTimeRestriction: false,
    validFromHour: 20,
    validToHour: 0,
    stackable: false, // Acumulabilidad con otras promos
    exclusionsNote: 'No aplica a compras online ni electrodomésticos',
    conditionsNote: 'Tope de reintegro unificado pagando con QR MODO y tarjetas de crédito Galicia.',
    status: 'ACTIVE',
  })

  // Lista de promociones mock / pre-cargadas
  const [promosList, setPromosList] = useState([
    {
      id: 'promo-excl-1',
      title: '25% de descuento exclusivo en Cenas',
      commerce: { id: 'c-1', name: 'La Panera Rosa', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=lapanerarosa.com' },
      category: { name: 'Gastronomía', color: '#F97316', icon: '🍔' },
      isExclusivePromoAR: true,
      status: 'ACTIVE',
      validDays: 112,
      commerceNote: 'Exclusivo PromoAR · Mostrando la app en caja',
      requirements: [{
        discountType: 'PERCENTAGE_DESCUENTO',
        discountValue: 25,
        cap: 10000,
        capPeriod: 'MONTHLY',
        capUnlimited: false,
        note: 'Válido de 20 a 00 hs',
      }],
      submittedByMerchant: true,
      merchantContact: 'Martín (Dueño)',
      stats: { views: 1240, clicks: 88, saved: 42 },
    },
    {
      id: 'promo-coto-2',
      title: '70% en la 2da unidad – Coto',
      commerce: { id: 'c-2', name: 'Coto', logoUrl: 'https://www.coto.com.ar/favicon.ico' },
      category: { name: 'Supermercados', color: '#10B981', icon: '🛒' },
      isExclusivePromoAR: false,
      status: 'ACTIVE',
      validDays: 127,
      commerceNote: 'En productos seleccionados de almacén y perfumería',
      requirements: [{
        discountType: 'SEGUNDA_UNIDAD',
        discountValue: 70,
        capUnlimited: true,
      }],
      submittedByMerchant: false,
      stats: { views: 4500, clicks: 310, saved: 190 },
    },
    {
      id: 'promo-sueldo-3',
      title: '30% reintegro Cuenta Sueldo',
      commerce: { id: 'c-3', name: 'YPF', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=ypf.com' },
      category: { name: 'Combustible', color: '#EF4444', icon: '⛽' },
      isExclusivePromoAR: false,
      status: 'ACTIVE',
      validDays: 32,
      commerceNote: 'Exclusivo para clientes que cobran haberes en Banco Galicia',
      requirements: [{
        bank: { name: 'Banco Galicia', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=galicia.ar' },
        discountType: 'PERCENTAGE_REINTEGRO',
        discountValue: 30,
        cap: 12000,
        capPeriod: 'MONTHLY',
        paymentChannel: 'QR',
        accountType: 'HABERES',
      }],
      submittedByMerchant: false,
      stats: { views: 8950, clicks: 610, saved: 340 },
    }
  ])

  // Helper para alternar días en bitmask
  const handleToggleDay = (bit: number) => {
    setFormData(prev => ({
      ...prev,
      validDays: prev.validDays ^ bit,
    }))
  }

  // Generación reactiva del objeto Promo exacto para el Live PromoCard Studio
  const livePromoForCard = useMemo(() => {
    const primaryBank = ALL_BANKS.find(b => formData.selectedBanks.includes(b.id))
    const primaryWallet = ALL_WALLETS.find(w => formData.selectedWallets.includes(w.id))
    const primaryNetwork = ALL_NETWORKS.find(n => formData.selectedNetworks.includes(n.id))
    const segmentObj = BANK_SEGMENTS.find(s => s.id === formData.selectedSegment)
    const cardSegmentObj = CARD_SEGMENTS.find(cs => cs.id === formData.selectedCardSegment)

    let discountType = 'PERCENTAGE_DESCUENTO'
    let discountValue = formData.discountValue
    let nxmN: number | null = null
    let nxmM: number | null = null

    if (formData.benefitKind === 'PERCENTAGE_REINTEGRO') {
      discountType = 'PERCENTAGE_REINTEGRO'
      discountValue = formData.discountValue
    } else if (formData.benefitKind === 'PERCENTAGE_DESCUENTO') {
      discountType = 'PERCENTAGE_DESCUENTO'
      discountValue = formData.discountValue
    } else if (formData.benefitKind === 'CUOTAS_SIN_INTERES') {
      discountType = 'CUOTAS_SIN_INTERES'
      discountValue = formData.installmentsCount
    } else if (formData.benefitKind === 'NXM') {
      discountType = 'NXM'
      nxmN = formData.nxmN
      nxmM = formData.nxmM
      discountValue = Math.round((1 - (formData.nxmM / formData.nxmN)) * 100)
    } else if (formData.benefitKind === 'SEGUNDA_UNIDAD') {
      discountType = 'SEGUNDA_UNIDAD'
      discountValue = formData.segundaUnidadPct
    } else if (formData.benefitKind === 'FIXED_AMOUNT') {
      discountType = 'FIXED_AMOUNT'
      discountValue = formData.fixedAmountValue
    }

    let plusDiscountNote: string | null = null
    if (formData.hasPlusBenefit) {
      const audience = formData.plusType === 'HABERES' ? 'Cuenta Sueldo' : formData.plusType === 'JUBILADO' ? 'Jubilados' : 'VIP'
      plusDiscountNote = `+${formData.plusValue}% ${audience}`
    }

    const conditionsList: string[] = []
    if (formData.accountType === 'HABERES') conditionsList.push('Cuenta Sueldo')
    if (formData.accountType === 'JUBILADO') conditionsList.push('Jubilados')
    if (formData.accountType === 'ANSES') conditionsList.push('Beneficio ANSES')
    if (formData.hasTimeRestriction) conditionsList.push(`De ${formData.validFromHour} a ${formData.validToHour} hs`)
    if (formData.salesChannel === 'PRESENCIAL') conditionsList.push('Solo presencial')
    if (formData.salesChannel === 'ONLINE') conditionsList.push('Solo online')
    if (!formData.stackable) conditionsList.push('No acumulable')
    if (formData.exclusionsNote) conditionsList.push(`Excluye: ${formData.exclusionsNote}`)
    if (formData.conditionsNote) conditionsList.push(formData.conditionsNote)

    const finalNote = conditionsList.join(' · ')

    return {
      id: formData.id || 'preview-temp-id',
      title: `${formData.commerceName} – Descuento`,
      validDays: formData.validDays,
      validFromHour: formData.hasTimeRestriction ? formData.validFromHour : null,
      validToHour: formData.hasTimeRestriction ? formData.validToHour : null,
      plusDiscountNote,
      stackable: formData.stackable,
      commerceNote: formData.isExclusivePromoAR
        ? `⭐ Exclusivo PromoAR · ${finalNote || 'Mostrando la app'}`
        : (finalNote || null),
      category: {
        name: formData.categoryName,
        color: formData.categoryColor,
        icon: formData.categoryIcon,
      },
      commerce: {
        name: formData.commerceName || 'Tu Comercio',
        logoUrl: formData.commerceLogo || null,
      },
      requirements: [{
        discountType,
        discountValue,
        nxmN,
        nxmM,
        cap: formData.capUnlimited ? null : (Number(formData.capAmount) || null),
        capPeriod: formData.capUnlimited ? null : formData.capPeriod,
        capUnlimited: formData.capUnlimited,
        minPurchase: Number(formData.minPurchase) > 0 ? Number(formData.minPurchase) : null,
        paymentChannel: formData.paymentChannel,
        cardSegment: cardSegmentObj ? { name: cardSegmentObj.name } : (segmentObj ? { name: segmentObj.name } : null),
        bank: (!formData.isExclusivePromoAR && primaryBank) ? { name: primaryBank.name, logoUrl: primaryBank.logoUrl } : null,
        wallet: (!formData.isExclusivePromoAR && primaryWallet) ? { name: primaryWallet.name, logoUrl: primaryWallet.logoUrl } : null,
        cardNetwork: (!formData.isExclusivePromoAR && primaryNetwork) ? { name: primaryNetwork.name, slug: primaryNetwork.slug } : null,
        note: finalNote || null,
      }],
    }
  }, [formData])

  return (
    <div className="min-h-screen bg-[#0A1628] text-slate-100 flex flex-col font-sans">
      {/* ── Header Studio ── */}
      <header className="bg-[#0F223D] border-b border-slate-800/80 px-4 lg:px-8 py-3 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/promos/explorar" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[#1D3D6E] border border-blue-400/30 flex items-center justify-center font-black text-white text-sm">
              %
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                PromoAR <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-400/30 font-bold">Studio V2</span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium">Panel Integral de Promociones & Portal Comercios</p>
            </div>
          </Link>
        </div>

        {/* Switcher Admin / Comercio y Vista */}
        <div className="flex items-center gap-3">
          <div className="bg-[#0A1628] p-1 rounded-xl border border-slate-700/60 flex items-center gap-1 text-xs font-bold">
            <button
              onClick={() => { setViewRole('ADMIN'); setFormData(f => ({ ...f, isExclusivePromoAR: false })) }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewRole === 'ADMIN' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck size={14} /> Backoffice Admin (Todos los campos)
            </button>
            <button
              onClick={() => { setViewRole('MERCHANT'); setFormData(f => ({ ...f, isExclusivePromoAR: true })) }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewRole === 'MERCHANT' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 size={14} /> Portal Comercio (Self-Serve)
            </button>
          </div>

          <button
            onClick={() => setActiveTab(activeTab === 'LIST' ? 'STUDIO' : 'LIST')}
            className={`text-xs font-black px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all ${
              activeTab === 'STUDIO'
                ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold'
            }`}
          >
            {activeTab === 'STUDIO' ? (
              <><ArrowLeft size={14} /> Ver Bandeja de Promos</>
            ) : (
              <><Plus size={15} /> Crear Promoción</>
            )}
          </button>
        </div>
      </header>

      {/* ── Contenido Principal ── */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8">
        {activeTab === 'STUDIO' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* ── COLUMNA IZQUIERDA (7 COLS): EL FORMULARIO COMPLETO ── */}
            <div className="lg:col-span-7 bg-[#0F223D] border border-slate-800/90 rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <Sparkles className="text-amber-400" size={18} />
                    {viewRole === 'MERCHANT' ? 'Cargar Promoción de mi Comercio' : 'Editor Avanzado de Promoción'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Todos los campos bancarios, previsionales, de tarjetas y vigencia están disponibles.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-[#0A1628] p-1 rounded-xl border border-slate-800 text-xs font-bold">
                  {[1, 2, 3, 4].map(s => (
                    <button
                      key={s}
                      onClick={() => setStep(s as any)}
                      className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${
                        step === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabs de navegación por secciones */}
              <div className="grid grid-cols-4 gap-1.5 bg-[#0A1628] p-1.5 rounded-2xl border border-slate-800 text-[11px] font-bold text-center">
                <button onClick={() => setStep(1)} className={`py-2 rounded-xl transition-all ${step === 1 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  1. Comercio
                </button>
                <button onClick={() => setStep(2)} className={`py-2 rounded-xl transition-all ${step === 2 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  2. Beneficios
                </button>
                <button onClick={() => setStep(3)} className={`py-2 rounded-xl transition-all ${step === 3 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  3. Financiación
                </button>
                <button onClick={() => setStep(4)} className={`py-2 rounded-xl transition-all ${step === 4 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                  4. Vigencia
                </button>
              </div>

              {/* ── PASO 1: COMERCIO Y CANAL DE VENTA ── */}
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">Nombre del Comercio o Marca</label>
                      <input
                        type="text"
                        value={formData.commerceName}
                        onChange={e => setFormData({ ...formData, commerceName: e.target.value })}
                        placeholder="Ej: Coto, YPF, Farmacity, Café Martínez"
                        className="w-full bg-[#0A1628] border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">URL del Logo (Opcional)</label>
                      <input
                        type="text"
                        value={formData.commerceLogo}
                        onChange={e => setFormData({ ...formData, commerceLogo: e.target.value })}
                        placeholder="https://..."
                        className="w-full bg-[#0A1628] border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* g) Canal de venta: Comercio online / físico / ambos */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      Canal de venta adherido (Online / Físico)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'PRESENCIAL', label: 'Local Físico', icon: <Store size={15} /> },
                        { id: 'ONLINE', label: 'Online / Web / App', icon: <Globe size={15} /> },
                        { id: 'AMBOS', label: 'Ambos (Físico y Web)', icon: <Sparkles size={15} /> },
                      ].map(ch => (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, salesChannel: ch.id })}
                          className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                            formData.salesChannel === ch.id
                              ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                              : 'bg-[#0A1628] border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {ch.icon} {ch.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Categoría */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Rubro / Categoría</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {DEFAULT_CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            categoryId: cat.id,
                            categoryName: cat.name,
                            categoryColor: cat.color,
                            categoryIcon: cat.icon,
                          })}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                            formData.categoryId === cat.id
                              ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                              : 'bg-[#0A1628] border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-base">{cat.icon}</span>
                          <span className="truncate">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASO 2: BENEFICIOS (2x1, 3x2, 2do al 70%, Cuotas, Reintegro...) ── */}
              {step === 2 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-2">
                      Tipo de Beneficio o Promoción
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'PERCENTAGE_REINTEGRO', label: '% Reintegro Bancario', badge: 'Reintegro' },
                        { id: 'PERCENTAGE_DESCUENTO', label: '% Descuento Directo', badge: 'Descuento' },
                        { id: 'CUOTAS_SIN_INTERES', label: 'Cuotas Sin Interés', badge: 'Cuotas' },
                        { id: 'NXM', label: '2x1, 3x2, 4x3 (NxM)', badge: 'Promo' },
                        { id: 'SEGUNDA_UNIDAD', label: '2da Unidad al X% (70%, 50%)', badge: '2da Unidad' },
                        { id: 'FIXED_AMOUNT', label: 'Monto Fijo ($ OFF)', badge: 'Monto Fijo' },
                      ].map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, benefitKind: item.id })}
                          className={`p-3 rounded-2xl border text-xs font-bold transition-all text-left flex flex-col justify-between gap-1 ${
                            formData.benefitKind === item.id
                              ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                              : 'bg-[#0A1628] border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-[10px] uppercase font-black tracking-wider text-blue-400">{item.badge}</span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Detalle específico según el beneficio seleccionado */}
                  <div className="bg-[#0A1628] p-4 rounded-2xl border border-slate-800/90 space-y-4">
                    {/* Caso % Descuento o % Reintegro */}
                    {(formData.benefitKind === 'PERCENTAGE_DESCUENTO' || formData.benefitKind === 'PERCENTAGE_REINTEGRO') && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-300">
                            Porcentaje de Ahorro: <span className="text-blue-400 font-black text-sm">{formData.discountValue}%</span>
                          </label>
                          <span className="text-[11px] text-slate-400">Presets rápidos:</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                          {[10, 15, 20, 25, 30, 35, 40, 50, 100].map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setFormData({ ...formData, discountValue: v })}
                              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                formData.discountValue === v
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {v}%
                            </button>
                          ))}
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          step={5}
                          value={formData.discountValue}
                          onChange={e => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    )}

                    {/* Caso Cuotas sin interés */}
                    {formData.benefitKind === 'CUOTAS_SIN_INTERES' && (
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-2">Cantidad de Cuotas Sin Interés</label>
                        <div className="flex flex-wrap gap-2">
                          {[3, 6, 9, 12, 18, 24].map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setFormData({ ...formData, installmentsCount: c })}
                              className={`px-4 py-2 rounded-xl text-sm font-black border transition-all ${
                                formData.installmentsCount === c
                                  ? 'bg-blue-600 border-blue-500 text-white'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {c} cuotas
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Caso 2x1, 3x2, 4x3 (NxM) */}
                    {formData.benefitKind === 'NXM' && (
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-300 block">Configuración de NxM (Llevás N, Pagás M)</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { n: 2, m: 1, label: '2x1 (50% OFF)' },
                            { n: 3, m: 2, label: '3x2 (33% OFF)' },
                            { n: 4, m: 3, label: '4x3 (25% OFF)' },
                            { n: 5, m: 4, label: '5x4 (20% OFF)' },
                          ].map(opt => (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => setFormData({ ...formData, nxmN: opt.n, nxmM: opt.m })}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                                formData.nxmN === opt.n && formData.nxmM === opt.m
                                  ? 'bg-blue-600 border-blue-500 text-white'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div>
                            <span className="text-[11px] text-slate-400 block mb-1">Llevás (N):</span>
                            <input
                              type="number"
                              value={formData.nxmN}
                              onChange={e => setFormData({ ...formData, nxmN: Number(e.target.value) })}
                              className="w-full bg-[#11223B] border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 block mb-1">Pagás (M):</span>
                            <input
                              type="number"
                              value={formData.nxmM}
                              onChange={e => setFormData({ ...formData, nxmM: Number(e.target.value) })}
                              className="w-full bg-[#11223B] border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Caso 2da unidad al 70% / 50% */}
                    {formData.benefitKind === 'SEGUNDA_UNIDAD' && (
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-300 block">Descuento en la 2da Unidad</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { pct: 50, label: '2da al 50%' },
                            { pct: 70, label: '2da al 70% (Clásico Supermercados)' },
                            { pct: 80, label: '2da al 80%' },
                          ].map(opt => (
                            <button
                              key={opt.pct}
                              type="button"
                              onClick={() => setFormData({ ...formData, segundaUnidadPct: opt.pct })}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                                formData.segundaUnidadPct === opt.pct
                                  ? 'bg-blue-600 border-blue-500 text-white'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <input
                          type="range"
                          min={30}
                          max={90}
                          step={10}
                          value={formData.segundaUnidadPct}
                          onChange={e => setFormData({ ...formData, segundaUnidadPct: Number(e.target.value) })}
                          className="w-full accent-blue-500 mt-2"
                        />
                      </div>
                    )}

                    {/* Caso Monto Fijo */}
                    {formData.benefitKind === 'FIXED_AMOUNT' && (
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">Monto de Descuento ($)</label>
                        <input
                          type="number"
                          value={formData.fixedAmountValue}
                          onChange={e => setFormData({ ...formData, fixedAmountValue: Number(e.target.value) })}
                          className="w-full bg-[#11223B] border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-black text-white focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Configuración de Tope de Reintegro */}
                    <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">Tope de reintegro / ahorro</span>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, capUnlimited: !formData.capUnlimited })}
                          className={`text-xs font-black px-3 py-1 rounded-full border transition-all ${
                            formData.capUnlimited
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {formData.capUnlimited ? '∞ Sin Tope' : 'Con Tope Definido'}
                        </button>
                      </div>

                      {!formData.capUnlimited && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <span className="text-[11px] text-slate-400 block mb-1">Monto del Tope ($)</span>
                            <input
                              type="number"
                              value={formData.capAmount}
                              onChange={e => setFormData({ ...formData, capAmount: Number(e.target.value) })}
                              placeholder="Ej: 8000"
                              className="w-full bg-[#11223B] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-black focus:outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 block mb-1">Frecuencia de renovación</span>
                            <select
                              value={formData.capPeriod}
                              onChange={e => setFormData({ ...formData, capPeriod: e.target.value })}
                              className="w-full bg-[#11223B] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none font-bold"
                            >
                              <option value="MONTHLY">Por Mes</option>
                              <option value="WEEKLY">Por Semana</option>
                              <option value="DAILY">Por Día</option>
                              <option value="PER_TRANSACTION">Por Compra</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Beneficio Plus / Adicional (Cuenta Sueldo, Jubilados, Segmento VIP) */}
                    <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <Zap size={13} className="text-amber-400" /> Beneficio Adicional / Plus (Cuenta Sueldo o VIP)
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Ej: 10% base + 5% adicional si cobrás el sueldo en el banco.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, hasPlusBenefit: !formData.hasPlusBenefit })}
                          className={`text-xs font-black px-3 py-1 rounded-full border transition-all ${
                            formData.hasPlusBenefit
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {formData.hasPlusBenefit ? 'Con Plus Adicional' : 'Sin Plus'}
                        </button>
                      </div>

                      {formData.hasPlusBenefit && (
                        <div className="bg-[#11223B] p-3 rounded-xl border border-slate-700 space-y-3 mt-1">
                          <div>
                            <span className="text-[11px] font-bold text-slate-300 block mb-1">¿Para quién es el plus?</span>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { id: 'HABERES', label: 'Cuenta Sueldo' },
                                { id: 'JUBILADO', label: 'Jubilados / ANSES' },
                                { id: 'SEGMENT', label: 'Segmento VIP' },
                              ].map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, plusType: p.id as any })}
                                  className={`py-1 px-2 rounded-lg text-xs font-bold border transition-all ${
                                    formData.plusType === p.id
                                      ? 'bg-amber-500 text-slate-950 font-black border-amber-400'
                                      : 'bg-slate-900 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-[11px] font-bold text-slate-300 block mb-1">Porcentaje del Plus (%)</span>
                              <input
                                type="number"
                                value={formData.plusValue}
                                onChange={e => setFormData({ ...formData, plusValue: Number(e.target.value) })}
                                className="w-full bg-[#0A1628] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-black focus:outline-none"
                              />
                            </div>
                            <div>
                              <span className="text-[11px] font-bold text-slate-300 block mb-1">Tope adicional ($ opcional)</span>
                              <input
                                type="number"
                                value={formData.plusCapAmount}
                                onChange={e => setFormData({ ...formData, plusCapAmount: Number(e.target.value) })}
                                placeholder="Ej: 4000"
                                className="w-full bg-[#0A1628] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="text-[11px] text-amber-300/90 font-semibold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                            💡 Resultado: <strong>{formData.discountValue}%</strong> base + <strong>{formData.plusValue}%</strong> por {formData.plusType === 'HABERES' ? 'Cuenta Sueldo' : formData.plusType === 'JUBILADO' ? 'Jubilados' : 'Segmento VIP'} = <span className="underline font-black text-amber-300">{Number(formData.discountValue) + Number(formData.plusValue)}% Total</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASO 3: FINANCIACIÓN Y REQUISITOS (BANCOS, BILLETERAS, TARJETAS, CUENTA SUELDO, ANSES, FORMAS DE PAGO) ── */}
              {step === 3 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Switch Exclusivo PromoAR vs Bancario */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isExclusivePromoAR: true })}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        formData.isExclusivePromoAR
                          ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-500/20'
                          : 'bg-[#0A1628] border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black text-white">
                        <span>⭐</span> Descuento Exclusivo PromoAR
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Cargado por el comercio sin intermediarios bancarios (mostrando la app o cupón).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isExclusivePromoAR: false })}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        !formData.isExclusivePromoAR
                          ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/20'
                          : 'bg-[#0A1628] border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black text-white">
                        <CreditCard size={15} className="text-blue-400" /> Promoción Bancaria / Financiera
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Requiere tarjetas, bancos, billeteras, cuenta sueldo o beneficios ANSES.
                      </p>
                    </button>
                  </div>

                  {/* Si es bancaria, desplegar TODOS los requisitos solicitados */}
                  {!formData.isExclusivePromoAR && (
                    <div className="space-y-4">
                      {/* a) Bancos y Billeteras */}
                      <div className="bg-[#0A1628] p-4 rounded-2xl border border-slate-800/80 space-y-3">
                        <label className="text-xs font-black text-white block">
                          a) Bancos y Billeteras Virtuales Adheridas
                        </label>
                        <div>
                          <span className="text-[11px] text-slate-400 font-bold block mb-1.5">Bancos:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_BANKS.map(b => {
                              const active = formData.selectedBanks.includes(b.id)
                              return (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData(f => ({
                                      ...f,
                                      selectedBanks: active
                                        ? f.selectedBanks.filter(id => id !== b.id)
                                        : [...f.selectedBanks, b.id],
                                    }))
                                  }}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                                    active
                                      ? 'bg-blue-600/30 border-blue-500 text-white'
                                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                                  }`}
                                >
                                  <img src={b.logoUrl} alt={b.name} className="w-3.5 h-3.5 object-contain rounded" />
                                  <span>{b.name}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] text-slate-400 font-bold block mb-1.5">Billeteras:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_WALLETS.map(w => {
                              const active = formData.selectedWallets.includes(w.id)
                              return (
                                <button
                                  key={w.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData(f => ({
                                      ...f,
                                      selectedWallets: active
                                        ? f.selectedWallets.filter(id => id !== w.id)
                                        : [...f.selectedWallets, w.id],
                                    }))
                                  }}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                                    active
                                      ? 'bg-purple-600/30 border-purple-500 text-white'
                                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                                  }`}
                                >
                                  <img src={w.logoUrl} alt={w.name} className="w-3.5 h-3.5 object-contain rounded" />
                                  <span>{w.name}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>

                      {/* b) y d) Redes de tarjeta y Tipo de tarjeta */}
                      <div className="bg-[#0A1628] p-4 rounded-2xl border border-slate-800/80 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-black text-white block mb-1.5">
                              b) Redes de Tarjeta
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {ALL_NETWORKS.map(net => {
                                const active = formData.selectedNetworks.includes(net.id)
                                return (
                                  <button
                                    key={net.id}
                                    type="button"
                                    onClick={() => {
                                      setFormData(f => ({
                                        ...f,
                                        selectedNetworks: active
                                          ? f.selectedNetworks.filter(id => id !== net.id)
                                          : [...f.selectedNetworks, net.id],
                                      }))
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                      active
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-slate-900 border-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {net.name}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-black text-white block mb-1.5">
                              d) Tipo de Tarjeta
                            </label>
                            <div className="grid grid-cols-2 gap-1.5">
                              {[
                                { id: 'ANY', label: 'Cualquier tipo' },
                                { id: 'CREDIT', label: 'Crédito' },
                                { id: 'DEBIT', label: 'Débito' },
                                { id: 'PREPAID', label: 'Prepaga' },
                              ].map(t => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, cardType: t.id })}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border text-center transition-all ${
                                    formData.cardType === t.id
                                      ? 'bg-blue-600 border-blue-500 text-white'
                                      : 'bg-slate-900 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* c) y e) Segmentos Bancarios VIP y Segmentos de Tarjetas */}
                      <div className="bg-[#0A1628] p-4 rounded-2xl border border-slate-800/80 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-black text-white block mb-1.5">
                              c) Segmento de Banco VIP (Opcional)
                            </label>
                            <select
                              value={formData.selectedSegment}
                              onChange={e => setFormData({ ...formData, selectedSegment: e.target.value })}
                              className="w-full bg-[#11223B] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                            >
                              <option value="">Aplica a todos los clientes del banco</option>
                              {BANK_SEGMENTS.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.bank})</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-black text-white block mb-1.5">
                              e) Segmento de Tarjeta (Tier)
                            </label>
                            <select
                              value={formData.selectedCardSegment}
                              onChange={e => setFormData({ ...formData, selectedCardSegment: e.target.value })}
                              className="w-full bg-[#11223B] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                            >
                              <option value="">Cualquier segmento de tarjeta</option>
                              {CARD_SEGMENTS.map(cs => (
                                <option key={cs.id} value={cs.id}>{cs.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Cuenta Sueldo y Jubilados/ANSES */}
                      <div className="bg-[#0A1628] p-4 rounded-2xl border border-slate-800/80 space-y-2">
                        <label className="text-xs font-black text-white block mb-1">
                          Tipo de Cuenta Laboral / Previsional (Cuenta Sueldo, Jubilados, ANSES)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {ACCOUNT_TYPES.map(at => (
                            <button
                              key={at.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, accountType: at.id })}
                              className={`p-2.5 rounded-xl border text-left transition-all ${
                                formData.accountType === at.id
                                  ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className="text-xs font-black">{at.label}</div>
                              <div className="text-[10px] text-slate-400">{at.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* f) Formas de Pago (Cualquiera, QR, NFC, Físico, etc.) */}
                      <div className="bg-[#0A1628] p-4 rounded-2xl border border-slate-800/80 space-y-2">
                        <label className="text-xs font-black text-white block mb-1">
                          f) Canal o Forma de Pago Exclusiva
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {PAYMENT_CHANNELS.map(pc => (
                            <button
                              key={pc.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, paymentChannel: pc.id })}
                              className={`p-2.5 rounded-xl border text-left transition-all ${
                                formData.paymentChannel === pc.id
                                  ? 'bg-blue-600/20 border-blue-500 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className="text-xs font-bold">{pc.label}</div>
                              <div className="text-[10px] text-slate-400 truncate">{pc.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── PASO 4: VIGENCIA, HORARIOS Y CONDICIONES ── */}
              {step === 4 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Días de la semana */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-300">Días de la semana en que aplica</label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, validDays: 127 })}
                        className="text-[11px] text-blue-400 font-bold hover:underline"
                      >
                        Marcar Todos los Días
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {DAYS_KEYS.map(d => {
                        const active = (formData.validDays & d.bit) !== 0
                        return (
                          <button
                            key={d.bit}
                            type="button"
                            onClick={() => handleToggleDay(d.bit)}
                            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                              active
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-[#0A1628] border border-slate-800 text-slate-500 hover:border-slate-700'
                            }`}
                            title={d.name}
                          >
                            {d.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Fechas de Vigencia */}
                  <div className="bg-[#0A1628] p-4 rounded-2xl border border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-white">Vigencia de la Promoción (Fechas)</label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, hasExpiration: !formData.hasExpiration })}
                        className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${
                          !formData.hasExpiration
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {!formData.hasExpiration ? 'Indefinida / Sin fin' : 'Con fecha de fin'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-1">Fecha de inicio:</span>
                        <input
                          type="date"
                          value={formData.validFrom}
                          onChange={e => setFormData({ ...formData, validFrom: e.target.value })}
                          className="w-full bg-[#11223B] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                      {formData.hasExpiration && (
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-1">Fecha de vencimiento:</span>
                          <input
                            type="date"
                            value={formData.validUntil}
                            onChange={e => setFormData({ ...formData, validUntil: e.target.value })}
                            className="w-full bg-[#11223B] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Franja horaria */}
                  <div className="bg-[#0A1628] p-4 rounded-2xl border border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-white">Restricción de Horario</label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, hasTimeRestriction: !formData.hasTimeRestriction })}
                        className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${
                          formData.hasTimeRestriction
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {formData.hasTimeRestriction ? 'Horario Específico' : 'Todo el día'}
                      </button>
                    </div>

                    {formData.hasTimeRestriction && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-1">Desde hora:</span>
                          <input
                            type="number"
                            min={0}
                            max={23}
                            value={formData.validFromHour}
                            onChange={e => setFormData({ ...formData, validFromHour: Number(e.target.value) })}
                            className="w-full bg-[#11223B] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none font-bold"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-1">Hasta hora:</span>
                          <input
                            type="number"
                            min={0}
                            max={23}
                            value={formData.validToHour}
                            onChange={e => setFormData({ ...formData, validToHour: Number(e.target.value) })}
                            className="w-full bg-[#11223B] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acumulabilidad con otras promociones */}
                  <div className="bg-[#0A1628] p-4 rounded-2xl border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-white flex items-center gap-1.5">
                          <Layers size={14} className="text-blue-400" /> Acumulabilidad con otras promociones
                        </label>
                        <p className="text-[11px] text-slate-400">
                          Indica si este descuento se puede sumar a otras promociones vigentes.
                        </p>
                      </div>
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${
                        !formData.stackable
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {!formData.stackable ? 'No Acumulable' : 'Acumulable'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, stackable: false })}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          !formData.stackable
                            ? 'bg-amber-500/10 border-amber-500/50 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-black flex items-center gap-1.5">
                          🚫 No acumulable (Estándar bancario)
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          No acumulable con otras promociones, convenios ni descuentos del local.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, stackable: true })}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          formData.stackable
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-black flex items-center gap-1.5">
                          ✅ Acumulable con otras ofertas
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Se puede sumar a rebajas del comercio, precios de oferta o cuotas vigentes.
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Exclusiones de la Promoción */}
                  <div className="bg-[#0A1628] p-4 rounded-2xl border border-slate-800/80 space-y-3">
                    <div>
                      <label className="text-xs font-black text-white flex items-center gap-1.5">
                        <AlertCircle size={14} className="text-amber-400" /> Exclusiones de Productos o Categorías
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Productos, líneas o rubros excluidos de la promoción.
                      </p>
                    </div>

                    {/* Chips de exclusiones típicas en Argentina */}
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1.5 font-bold uppercase tracking-wider">
                        Exclusiones frecuentes (clic para sumar / quitar):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Electrodomésticos y tecnología',
                          'Carnes y pescados frescos',
                          'Precios Justos / Cuidados',
                          'Compras mayoristas',
                          'Venta Online / Web',
                          'Bodegas y vinos alta gama',
                          'Menús ejecutivos / combos',
                          'Cigarrillos y telefonía',
                        ].map(item => {
                          const isIncluded = formData.exclusionsNote.toLowerCase().includes(item.toLowerCase())
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => {
                                if (isIncluded) {
                                  // Remover de la nota
                                  const parts = formData.exclusionsNote
                                    .split(',')
                                    .map(s => s.trim())
                                    .filter(s => s.toLowerCase() !== item.toLowerCase())
                                  setFormData({ ...formData, exclusionsNote: parts.join(', ') })
                                } else {
                                  // Agregar a la nota
                                  const current = formData.exclusionsNote.trim()
                                  const updated = current ? `${current}, ${item}` : item
                                  setFormData({ ...formData, exclusionsNote: updated })
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                isIncluded
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              {isIncluded ? '✓ ' : '+ '} {item}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <textarea
                        rows={2}
                        value={formData.exclusionsNote}
                        onChange={e => setFormData({ ...formData, exclusionsNote: e.target.value })}
                        placeholder="Ej: Electrodomésticos, Precios Justos, productos de venta mayorista."
                        className="w-full bg-[#11223B] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Condiciones generales y Letra Chica */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      Condiciones particulares y Letra Chica (Visible en la tarjeta)
                    </label>
                    <textarea
                      rows={2}
                      value={formData.conditionsNote}
                      onChange={e => setFormData({ ...formData, conditionsNote: e.target.value })}
                      placeholder="Ej: Válido abonando con tarjeta física en el local. Reintegro dentro de los 30 días."
                      className="w-full bg-[#0A1628] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Botones de Navegación del Wizard */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((step - 1) as any)}
                    className="text-xs font-bold text-slate-400 hover:text-white px-3 py-2"
                  >
                    ← Anterior
                  </button>
                ) : <div />}

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={() => setStep((step + 1) as any)}
                    className="text-xs font-black bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
                  >
                    Siguiente paso <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      alert('¡Promoción guardada exitosamente con todos los campos!')
                      setActiveTab('LIST')
                    }}
                    className="text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    {viewRole === 'MERCHANT' ? 'Enviar para Aprobación' : 'Publicar Inmediatamente'}
                  </button>
                )}
              </div>
            </div>

            {/* ── COLUMNA DERECHA (5 COLS STICKY): LIVE PROMO CARD STUDIO ── */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
              <div className="bg-[#0F223D] border border-slate-800 rounded-3xl p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Smartphone size={16} className="text-blue-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Live Preview</h3>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Actualización en vivo
                  </span>
                </div>

                {/* Renderizado en Vivo de la PromoCard Real */}
                <div className="bg-[#0A1628] p-6 rounded-2xl border border-slate-800 flex justify-center items-center">
                  <div style={{ width: 175 }}>
                    <PromoCard
                      promo={livePromoForCard as any}
                      onClick={() => {}}
                      fullWidth
                    />
                  </div>
                </div>

                {/* Resumen de configuración en vivo */}
                <div className="mt-4 p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 text-[11px] text-slate-400 space-y-2">
                  <p className="font-black text-slate-200 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" /> Resumen de lo configurado:
                  </p>
                  <ul className="space-y-1 text-[11px]">
                    <li>• <strong>Beneficio:</strong> {formData.benefitKind} ({formData.discountValue}%)</li>
                    <li>• <strong>Canal:</strong> {formData.salesChannel}</li>
                    <li>• <strong>Cuenta:</strong> {formData.accountType}</li>
                    <li>• <strong>Forma de pago:</strong> {formData.paymentChannel}</li>
                    {!formData.isExclusivePromoAR && (
                      <li>• <strong>Bancos/Tarjetas:</strong> {formData.selectedBanks.length} bancos · {formData.selectedNetworks.length} redes</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* ── BANDEJA DE PROMOS ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white">Bandeja de Promociones</h2>
              <button
                onClick={() => setActiveTab('STUDIO')}
                className="text-xs font-black px-4 py-2 bg-blue-600 text-white rounded-xl flex items-center gap-1.5"
              >
                <Plus size={14} /> Nueva Promoción
              </button>
            </div>
            <div className="grid gap-3">
              {promosList.map(p => (
                <div key={p.id} className="bg-[#0F223D] border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-white">{p.commerce.name}</h3>
                    <p className="text-xs text-slate-300">{p.title}</p>
                    <span className="text-[10px] text-slate-400">{p.commerceNote}</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('STUDIO')}
                    className="text-xs font-bold px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl border border-slate-700"
                  >
                    Editar en Studio
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
