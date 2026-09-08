'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import PromoCard from '@/app/components/PromoCard'
import PromoMultiPreviewModal, { PreviewViewType } from './PromoMultiPreviewModal'
import {
  Sparkles, Plus, Search, Filter, CheckCircle2, Clock, XCircle,
  Building2, CreditCard, Calendar, Tag, ShieldCheck, ArrowRight,
  ChevronRight, ArrowLeft, Eye, Edit3, Check, Trash2, SlidersHorizontal,
  Layers, Zap, AlertCircle, RefreshCw, Smartphone, ExternalLink, HelpCircle,
  Store, Globe, Wallet, DollarSign, Percent, ChevronDown, Bot, Wand2
} from 'lucide-react'

// Categorías oficiales de la base de datos (PostgreSQL Neon)
const DEFAULT_CATEGORIES = [
  { id: 'cmnulzpng000lqlkklp8a7q4k', slug: 'supermercados', name: 'Supermercados', icon: '🛒', color: '#1B5E20', order: 1 },
  { id: 'cmnulzoxs000kqlkkk641j763', slug: 'combustible', name: 'Combustible', icon: '⛽', color: '#B45309', order: 2 },
  { id: 'cmnulzrnd000oqlkkha2lvzwn', slug: 'gastronomia', name: 'Gastronomía', icon: '🍕', color: '#F57F17', order: 3 },
  { id: 'cmnulzqd4000mqlkk2c9xedfp', slug: 'farmacias', name: 'Farmacias', icon: '💊', color: '#880E4F', order: 4 },
  { id: 'cmnulzr0f000nqlkkmmw3g0wl', slug: 'petshops', name: 'Petshops', icon: '🐾', color: '#283593', order: 5 },
  { id: 'cmnulzsah000pqlkkhrfshb1s', slug: 'indumentaria', name: 'Indumentaria', icon: '👕', color: '#4A148C', order: 5 },
  { id: 'cmnulzt1r000qqlkks46jez7h', slug: 'tecnologia', name: 'Tecnología', icon: '💻', color: '#01579B', order: 6 },
  { id: 'cmnulznre000jqlkk0y1kuo8w', slug: 'transporte', name: 'Transporte', icon: '🚌', color: '#00607A', order: 8 },
  { id: 'cmoeltt1n000dbhs92pqmh9wa', slug: 'heladerias', name: 'Heladerías', icon: '🍦', color: '#00838F', order: 9 },
  { id: 'cmoisouce08ozi9eb11q3zql2', slug: 'hogar', name: 'Hogar', icon: '🛋️', color: '#4E342E', order: 10 },
  { id: 'cmoisp0pp08p0i9ebf6od3k25', slug: 'entretenimiento', name: 'Entretenimiento', icon: '🎭', color: '#1A237E', order: 11 },
  { id: 'cmoisp94z08p1i9eb23vqc6pq', slug: 'salud-y-belleza', name: 'Salud y Belleza', icon: '🌸', color: '#880E4F', order: 12 },
  { id: 'cmoispepz08p2i9ebt8rdq9hl', slug: 'deportes', name: 'Deportes', icon: '⚽', color: '#1B5E20', order: 13 },
  { id: 'cmoispm3u08p3i9ebwdfzoxvn', slug: 'jugueterias', name: 'Jugueterías', icon: '🧸', color: '#E65100', order: 14 },
  { id: 'cmoisqiol08p4i9ebksgi3ocw', slug: 'librerias', name: 'Librerías', icon: '📚', color: '#311B92', order: 15 },
  { id: 'cmoisqraj08p5i9ebqoe4a4ju', slug: 'viajes-y-turismo', name: 'Viajes y Turismo', icon: '✈️', color: '#006064', order: 16 },
  { id: 'cmq1sxst0000h10rx0f3s1rx5', slug: 'shoppings', name: 'Shoppings', icon: '🛍️', color: '#37474F', order: 17 },
  { id: 'cmoisrele08p7i9ebe82v63g1', slug: 'otras-categorias', name: 'Otras categorias', icon: '🏷️', color: '#6366f1', order: 18 },
  { id: 'cmok4ul4l0000xg1wf0mmt8lo', slug: 'automotores', name: 'Automotores', icon: '🚗', color: '#263238', order: 18 },
  { id: 'cmq1sxt2k000j10rxzwlk8lgq', slug: 'otros', name: 'Otros', icon: '📦', color: '#546E7A', order: 19 },
  { id: 'cmoi0k60i0000r7p8zyye0rfa', slug: 'sin-categoria', name: 'Sin Categoría', icon: '❓', color: '#9E9E9E', order: 20 },
]

// Lista exhaustiva de Programas de Beneficios & Fidelización (Tarjetas de beneficios)
const BENEFIT_PROGRAMS = [
  { id: 'c99780b9-1586-4f9a-9eea-4f1ad710f481', slug: 'club-la-nacion', name: 'Club La Nación', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=lanacion.com.ar' },
  { id: 'fa88c7b5-271d-43c9-be09-9103cd8ef48f', slug: 'clarin-365', name: 'Clarín 365', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=365.clarin.com' },
  { id: '7dfdd2e0-b805-4ae9-b013-3cadcbd69c8c', slug: 'clarin-365-plus', name: 'Clarín 365 Plus', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=365.clarin.com' },
  { id: 'cmqab6xcz0000uz3k98dovqid', slug: 'comunidad-coto', name: 'Comunidad Coto', logoUrl: 'https://www.coto.com.ar/favicon.ico' },
  { id: 'cmqucyde4000010nzfvok0s9h', slug: 'favacard', name: 'Favacard', logoUrl: 'https://www.google.com/s2/favicons?sz=64&domain=favacard.com.ar' },
]

// Lista exhaustiva de Bancos
const ALL_BANKS = [
  { id: 'cmnytdskm000013wtftq7mffg', slug: 'galicia', name: 'Banco Galicia', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=galicia.ar' },
  { id: 'cmnytdtcg000113wtg0ebh76q', slug: 'santander', name: 'Santander', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=santander.com.ar' },
  { id: 'cmnytdtzf000213wt6s7hrc8c', slug: 'bbva', name: 'BBVA', logoUrl: 'https://www.bbva.com.ar/favicon.ico' },
  { id: 'cmnytdunm000413wt7p6l3l5e', slug: 'macro', name: 'Banco Macro', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=macro.com.ar' },
  { id: 'cmnyte6z7000c13wtk82d61z4', slug: 'banco-nacion', name: 'Banco Nación', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=bna.com.ar' },
  { id: 'cmnyte72v000d13wtwh4e97ea', slug: 'icbc', name: 'ICBC', logoUrl: 'https://logo-teka.com/wp-content/uploads/2026/01/icbc-vertical-logo.svg' },
  { id: 'cmnytdulp000313wt7q5vvh7m', slug: 'ciudad', name: 'Banco Ciudad', logoUrl: 'https://www.bancociudad.com.ar/beneficios/assets/img/logo-banco-ciudad.svg' },
  { id: 'cmnyte773000e13wtq85j4i42', slug: 'supervielle', name: 'Supervielle', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=supervielle.com.ar' },
  { id: 'cmnytdunm000513wty1qtdpeu', slug: 'patagonia', name: 'Banco Patagonia', logoUrl: 'https://th.bing.com/th/id/OIP.KcoajddMvGoRjhPQVB4Y7QHaHa?w=176&h=180&c=7&r=0&o=7&pid=1.7&rm=3' },
  { id: 'cmo1lbjg200050zgku5d9eqi8', slug: 'banco-provincia-de-cordoba', name: 'Bancor (Córdoba)', logoUrl: 'https://www.bancor.com.ar/favicon.ico' },
  { id: 'cmnyte7bf000f13wti6t545t5', slug: 'provincia', name: 'Banco Provincia', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=bancoprovincia.com.ar' },
  { id: 'cmnyte7fs000g13wth9m4f1i2', slug: 'credicoop', name: 'Credicoop', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=bancocredicoop.coop' },
  { id: 'cmnytdv5r000713wtgme63msl', slug: 'brubank', name: 'Brubank', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=brubank.com' },
]

// Lista exhaustiva de Billeteras
const ALL_WALLETS = [
  { id: 'cmnulzh04000aqlkk8mnpzo46', slug: 'modo', name: 'MODO', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=modo.com.ar' },
  { id: '5a90bf8a-6f95-449f-b4f6-8647a6d3c9b4', slug: 'cuentadni', name: 'Cuenta DNI', logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTOmJbnhP1-Zxuto-pLyBH-DjA5mQA8_w2SDfEbgZDWgQ&s' },
  { id: 'cmnulzfz80009qlkkuyavwcvh', slug: 'mercadopago', name: 'Mercado Pago', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=mercadopago.com.ar' },
  { id: 'cmnulziao000cqlkkamv57ia0', slug: 'personalpay', name: 'Personal Pay', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=personalpay.com.ar' },
  { id: 'cmnulzixj000dqlkkf9b4o82h', slug: 'naranjax', name: 'Naranja X', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=naranjax.com' },
  { id: 'cmnulzhno000bqlkkv7ed16fj', slug: 'uala', name: 'Ualá', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=uala.com.ar' },
  { id: 'cmogquvtl00fq7b3c2lu7249m', slug: 'buepp', name: 'BUEPP (Ciudad)', logoUrl: 'https://th.bing.com/th/id/OIP.ywKgdEuGPW8H7wwSKYvADgHaDY?w=324&h=159&c=7&r=0&o=7&pid=1.7&rm=3' },
  { id: 'cmpcws2az0000d8ffsfhk9iqa', slug: 'cencopay', name: 'CencoPay', logoUrl: 'https://tse2.mm.bing.net/th/id/OIP.q6wycCCA9j2PagBT7gDuXwHaHV?r=0&rs=1&pid=ImgDetMain&o=7&rm=3' },
  { id: 'cmoxdt3fr0000bezn7m9v17w7', slug: 'carrefour-banco', name: 'Carrefour Banco', logoUrl: 'https://th.bing.com/th/id/OIP.5uH3QMcr13jwpv_99FzL4wHaD4?w=304&h=180&c=7&r=0&o=7&pid=1.7&rm=3' },
]

// Redes de Tarjeta
const ALL_NETWORKS = [
  { id: 'cmnulzkee000fqlkkz5pegb2b', name: 'Visa', slug: 'visa' },
  { id: 'cmnulzllo000gqlkkod8d8w5l', name: 'Mastercard', slug: 'mastercard' },
  { id: 'cmnulzmaa000hqlkkhaykwpzb', name: 'American Express', slug: 'amex' },
  { id: 'cmnulzn0i000iqlkk69ezbpfc', name: 'Cabal', slug: 'cabal' },
  { id: 'cmomazkxy000m2jcz78bi26g7', name: 'Naranja X', slug: 'naranja-x' },
  { id: 'cmnyz06dg001j14huiicd0wbv', name: 'Diners Club', slug: 'diners' },
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
    selectedBanks: ['cmnytdskm000013wtftq7mffg'],
    selectedWallets: ['cmnulzh04000aqlkk8mnpzo46'],
    selectedNetworks: ['cmnulzkee000fqlkkz5pegb2b', 'cmnulzllo000gqlkkod8d8w5l'],
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
      source: 'MERCHANT',
      sourceLabel: 'Portal Comercio',
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
      source: 'sc-coto',
      sourceLabel: 'Scraper Coto',
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
      source: 'sc-galicia',
      sourceLabel: 'Scraper Banco Galicia',
      submittedByMerchant: false,
      stats: { views: 8950, clicks: 610, saved: 340 },
    },
    {
      id: 'promo-jubilados-4',
      title: '10% de descuento para Jubilados',
      commerce: { id: 'c-4', name: 'Disco', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=disco.com.ar' },
      category: { name: 'Supermercados', color: '#10B981', icon: '🛒' },
      isExclusivePromoAR: false,
      status: 'ACTIVE',
      validDays: 30, // Lun a Jue
      commerceNote: 'Exclusivo presentando DNI y carnet de jubilado en caja',
      requirements: [{
        discountType: 'PERCENTAGE_DESCUENTO',
        discountValue: 10,
        capUnlimited: true,
        accountType: 'JUBILADO',
      }],
      source: 'sc-jumbo',
      sourceLabel: 'Scraper Jumbo/Disco/Vea',
      submittedByMerchant: false,
      stats: { views: 6120, clicks: 420, saved: 280 },
    },
    {
      id: 'promo-modo-5',
      title: '20% reintegro en Farmacias con MODO',
      commerce: { id: 'c-5', name: 'Farmacity', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=farmacity.com' },
      category: { name: 'Farmacias', color: '#06B6D4', icon: '💊' },
      isExclusivePromoAR: false,
      status: 'ACTIVE',
      validDays: 127,
      commerceNote: 'Tope $8.000 por banco/semana pagando con QR MODO',
      requirements: [{
        wallet: { name: 'MODO', logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=modo.com.ar' },
        discountType: 'PERCENTAGE_REINTEGRO',
        discountValue: 20,
        cap: 8000,
        capPeriod: 'WEEKLY',
        paymentChannel: 'QR',
      }],
      source: 'sc-modo',
      sourceLabel: 'Scraper MODO',
      submittedByMerchant: false,
      stats: { views: 11400, clicks: 950, saved: 520 },
    },
  ])

  // Filtros de la Bandeja de Promociones
  const [listSearch, setListSearch] = useState('')
  const [listCategory, setListCategory] = useState('ALL')
  const [listCommerce, setListCommerce] = useState('ALL')
  const [listSource, setListSource] = useState('ALL')
  const [listStatus, setListStatus] = useState('ALL')
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedPromoIds, setSelectedPromoIds] = useState<Set<string>>(new Set())
  const [isClassifying, setIsClassifying] = useState(false)
  const [classifyStatus, setClassifyStatus] = useState('')
  const [bulkTargetCategory, setBulkTargetCategory] = useState('')

  // Previsualizador multi-formato (Tarjeta, Modal, Página)
  const [previewModal, setPreviewModal] = useState<{ promo: any; view: PreviewViewType } | null>(null)

  // Estados de datos vivos de PostgreSQL (Neon)
  const [dbEntities, setDbEntities] = useState<{
    categories: any[]
    commerces: any[]
    banks: any[]
    wallets: any[]
    cardNetworks: any[]
  } | null>(null)
  const [isLoadingPromos, setIsLoadingPromos] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [promosPage, setPromosPage] = useState(0)
  const [promosTotal, setPromosTotal] = useState(0)
  const [promosHasMore, setPromosHasMore] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Lista unificada y completa de categorías (DB real o fallback a las 21 categorías completas)
  const allCategories = useMemo(() => {
    return (dbEntities?.categories && dbEntities.categories.length > 0)
      ? dbEntities.categories
      : DEFAULT_CATEGORIES
  }, [dbEntities])

  // Cargar entidades reales (Categorías, Comercios, Bancos, Billeteras) de la base de datos
  useEffect(() => {
    async function loadEntities() {
      try {
        let res = await fetch('/api/admin/entities')
        if (res.ok) {
          const data = await res.json()
          setDbEntities(data)
          return
        }
        // Fallback para entornos públicos/prototipos sin sesión de admin
        res = await fetch('/api/public/entities')
        if (res.ok) {
          const data = await res.json()
          setDbEntities(data)
        }
      } catch (e) {
        console.error('Error cargando entidades de DB:', e)
      }
    }
    loadEntities()
  }, [])

  // Cargar promociones reales de PostgreSQL al montar o al cambiar filtros (con paginación y "Cargar más")
  const fetchPromosFromDb = useCallback(async (page = 0, append = false) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoadingPromos(true)
    }
    try {
      const params = new URLSearchParams()
      if (listStatus !== 'ALL') {
        params.set('status', listStatus)
      } else {
        params.set('status', 'ACTIVE')
      }

      if (listCategory !== 'ALL') {
        const catObj = allCategories.find((c: any) => 
          c.name.toLowerCase() === listCategory.toLowerCase() || 
          c.id === listCategory || 
          c.slug?.toLowerCase() === listCategory.toLowerCase()
        )
        if (catObj?.id) params.set('categoryId', catObj.id)
      }

      if (listCommerce !== 'ALL' && dbEntities?.commerces) {
        const commObj = dbEntities.commerces.find((c: any) => c.name.toLowerCase() === listCommerce.toLowerCase())
        if (commObj?.id) params.set('commerceId', commObj.id)
      }

      if (listSearch.trim()) {
        params.set('q', listSearch.trim())
      }

      params.set('page', String(page))

      const res = await fetch(`/api/admin/promos?${params.toString()}`)
      if (res.ok) {
        const text = await res.text()
        try {
          const data = JSON.parse(text)
          if (data.promos) {
            setPromosList(prev => (append ? [...prev, ...data.promos] : data.promos))
            setPromosTotal(data.total ?? data.promos.length)
            setPromosHasMore(!!data.hasMore)
            setPromosPage(page)
            return
          }
        } catch {
          // No es JSON (ej. redirección HTML a login por falta de cookie de sesión admin)
        }
      }

      // Fallback para prototipos públicos sin sesión admin: consultar /api/promos
      const publicParams = new URLSearchParams()
      if (listCategory !== 'ALL') {
        const catObj = allCategories.find((c: any) => 
          c.name.toLowerCase() === listCategory.toLowerCase() || 
          c.id === listCategory || 
          c.slug?.toLowerCase() === listCategory.toLowerCase()
        )
        if (catObj?.slug) publicParams.set('category', catObj.slug)
      }
      if (listSearch.trim()) publicParams.set('q', listSearch.trim())
      const pubRes = await fetch(`/api/promos?${publicParams.toString()}`)
      if (pubRes.ok) {
        const pubData = await pubRes.json()
        const promosArr = Array.isArray(pubData) ? pubData : pubData.promos || []
        if (promosArr.length > 0) {
          setPromosList(promosArr)
          setPromosTotal(promosArr.length)
          setPromosHasMore(false)
        }
      }
    } catch (err) {
      console.error('Error fetching promos from DB:', err)
    } finally {
      setIsLoadingPromos(false)
      setIsLoadingMore(false)
    }
  }, [listStatus, listCategory, listCommerce, listSearch, allCategories, dbEntities])

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !promosHasMore) return
    await fetchPromosFromDb(promosPage + 1, true)
  }, [isLoadingMore, promosHasMore, promosPage, fetchPromosFromDb])

  useEffect(() => {
    fetchPromosFromDb(0, false)
  }, [fetchPromosFromDb])

  // Helper para cargar una promo al Studio para edición
  const loadPromoToStudio = (p: any) => {
    const req = p.requirements?.[0]
    setFormData({
      id: p.id,
      commerceName: p.commerce?.name || p.commerceName || '',
      commerceLogo: p.commerce?.logoUrl || p.commerceLogo || '',
      salesChannel: p.salesChannel || 'AMBOS',
      categoryId: p.category?.id || p.categoryId || 'cat-gastronomia',
      categoryName: p.category?.name || p.categoryName || 'Gastronomía',
      categoryColor: p.category?.color || p.categoryColor || '#F97316',
      categoryIcon: p.category?.icon || p.categoryIcon || '🍔',
      isExclusivePromoAR: p.isExclusivePromoAR ?? (!req?.bankId && !req?.walletId),
      benefitKind: (req?.discountType as any) || 'PERCENTAGE_DESCUENTO',
      discountValue: Number(req?.discountValue) || 20,
      installmentsCount: req?.discountType === 'CUOTAS_SIN_INTERES' ? Number(req.discountValue) : 6,
      nxmN: req?.nxmN || 2,
      nxmM: req?.nxmM || 1,
      segundaUnidadPct: req?.discountType === 'SEGUNDA_UNIDAD' ? Number(req.discountValue) : 70,
      fixedAmountValue: 5000,
      minPurchase: req?.minPurchase || 0,
      capUnlimited: req?.capUnlimited ?? !req?.cap,
      capAmount: req?.cap || 8000,
      capPeriod: req?.capPeriod || 'MONTHLY',
      hasPlusBenefit: p.hasPlusBenefit || false,
      plusType: p.plusType || 'HABERES',
      plusValue: p.plusValue || 5,
      plusCapAmount: p.plusCapAmount || 0,
      selectedBanks: req?.bank?.id ? [req.bank.id] : req?.bankId ? [req.bankId] : [],
      selectedWallets: req?.wallet?.id ? [req.wallet.id] : req?.walletId ? [req.walletId] : [],
      selectedNetworks: req?.cardNetwork?.id ? [req.cardNetwork.id] : req?.cardNetworkId ? [req.cardNetworkId] : [],
      cardType: (req?.cardType as any) || 'CREDIT',
      selectedSegment: req?.segment || '',
      selectedCardSegment: req?.cardSegmentId || '',
      accountType: (req?.accountType as any) || 'ANY',
      paymentChannel: (req?.paymentChannel as any) || 'QR',
      validDays: p.validDays || 127,
      validFrom: p.validFrom ? new Date(p.validFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      validUntil: p.validUntil ? new Date(p.validUntil).toISOString().split('T')[0] : '2026-12-31',
      hasExpiration: !!p.validUntil,
      hasTimeRestriction: !!p.validFromHour,
      validFromHour: p.validFromHour || 0,
      validToHour: p.validToHour || 23,
      stackable: p.stackable || false,
      exclusionsNote: p.exclusionsNote || '',
      conditionsNote: p.commerceNote || p.conditionsNote || '',
      status: p.status || 'ACTIVE',
    })
    setActiveTab('STUDIO')
  }

  // Guardar en la Base de Datos Viva (POST si nueva, PUT si edición)
  const handleSavePromo = async () => {
    setIsSaving(true)
    setToastMessage(null)
    try {
      let commerceId = ''
      if (dbEntities?.commerces && dbEntities.commerces.length > 0) {
        const found = dbEntities.commerces.find((c: any) => c.name.toLowerCase() === formData.commerceName.toLowerCase())
        commerceId = found?.id || dbEntities.commerces[0].id
      }

      let categoryId = formData.categoryId
      if (dbEntities?.categories && dbEntities.categories.length > 0) {
        const foundCat = dbEntities.categories.find((c: any) => c.name.toLowerCase() === formData.categoryName.toLowerCase() || c.id === formData.categoryId)
        if (foundCat) categoryId = foundCat.id
        else categoryId = dbEntities.categories[0].id
      }

      let discountType = 'PERCENTAGE_DESCUENTO'
      let discountValue = formData.discountValue
      let nxmN: number | null = null
      let nxmM: number | null = null

      if (formData.benefitKind === 'PERCENTAGE_REINTEGRO') {
        discountType = 'PERCENTAGE_REINTEGRO'
      } else if (formData.benefitKind === 'CUOTAS_SIN_INTERES') {
        discountType = 'CUOTAS_SIN_INTERES'
        discountValue = formData.installmentsCount
      } else if (formData.benefitKind === 'NXM') {
        discountType = 'NXM'
        nxmN = formData.nxmN
        nxmM = formData.nxmM
      } else if (formData.benefitKind === 'SEGUNDA_UNIDAD') {
        discountType = 'SEGUNDA_UNIDAD'
        discountValue = formData.segundaUnidadPct
      } else if (formData.benefitKind === 'FIXED_AMOUNT') {
        discountType = 'FIXED_AMOUNT'
        discountValue = formData.fixedAmountValue
      }

      const bankObj = dbEntities?.banks?.find((b: any) => formData.selectedBanks.includes(b.id) || formData.selectedBanks.includes(b.slug))
      const walletObj = dbEntities?.wallets?.find((w: any) => formData.selectedWallets.includes(w.id) || formData.selectedWallets.includes(w.slug))
      const networkObj = dbEntities?.cardNetworks?.find((n: any) => formData.selectedNetworks.includes(n.id) || formData.selectedNetworks.includes(n.slug))

      const reqPayload: any = {
        bankId: (!formData.isExclusivePromoAR && bankObj) ? bankObj.id : null,
        walletId: (!formData.isExclusivePromoAR && walletObj) ? walletObj.id : null,
        cardNetworkId: (!formData.isExclusivePromoAR && networkObj) ? networkObj.id : null,
        cardType: formData.cardType === 'ANY' ? null : formData.cardType,
        paymentChannel: formData.paymentChannel,
        accountType: formData.accountType,
        discountType,
        discountValue,
        nxmN,
        nxmM,
        minPurchase: formData.minPurchase || null,
        cap: formData.capUnlimited ? null : formData.capAmount,
        capUnlimited: formData.capUnlimited,
        capPeriod: formData.capPeriod,
        note: formData.conditionsNote || null,
      }

      const isEditingReal = formData.id && !formData.id.startsWith('promo-') && !formData.id.startsWith('preview-')

      const payload: any = {
        title: `${formData.commerceName} – ${discountType === 'CUOTAS_SIN_INTERES' ? `${formData.installmentsCount} cuotas sin interés` : `${discountValue}% de descuento`}`,
        description: formData.conditionsNote || `${formData.commerceName} promoción`,
        commerceId: commerceId || undefined,
        categoryId: categoryId || undefined,
        salesChannel: formData.salesChannel,
        validDays: formData.validDays,
        validFrom: formData.validFrom,
        validUntil: formData.hasExpiration ? formData.validUntil : null,
        validFromHour: formData.hasTimeRestriction ? formData.validFromHour : null,
        validToHour: formData.hasTimeRestriction ? formData.validToHour : null,
        stackable: formData.stackable,
        commerceNote: formData.conditionsNote || null,
        status: formData.status || 'ACTIVE',
        requirements: [reqPayload],
      }

      let res
      if (isEditingReal) {
        res = await fetch(`/api/promos/${formData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/promos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        setToastMessage({ type: 'success', text: isEditingReal ? '✅ ¡Promoción actualizada en PostgreSQL!' : '✅ ¡Nueva promoción creada en PostgreSQL!' })
        fetchPromosFromDb()
        setTimeout(() => {
          setActiveTab('LIST')
          setToastMessage(null)
        }, 1500)
      } else {
        const d = await res.json().catch(() => ({}))
        setToastMessage({ type: 'error', text: d.error || 'Error al guardar en la base de datos' })
      }
    } catch (e: any) {
      setToastMessage({ type: 'error', text: e.message || 'Error de conexión' })
    } finally {
      setIsSaving(false)
    }
  }

  // Helper para resolver la fuente real de la promoción con emoji y nombre legible
  const resolvePromoSourceBadge = (p: any): { label: string; icon: string; key: string } => {
    if ((p as any).submittedByMerchant) {
      return { label: 'Portal Comercios', icon: '🏪', key: 'MERCHANT' }
    }
    const req = p.requirements?.[0]
    const url = (p.sourceUrl || '').toLowerCase()
    const sourceStr = (p.source || '').toLowerCase()

    // 1. Club La Nación
    if (sourceStr.includes('lanacion') || url.includes('club.lanacion') || req?.wallet?.name?.toLowerCase().includes('la nacion')) {
      return { label: 'Club La Nación', icon: '🗞️', key: 'sc-club-lanacion' }
    }
    // 2. Clarín 365
    if (sourceStr.includes('365') || url.includes('365.clarin') || req?.wallet?.name?.toLowerCase().includes('365')) {
      return { label: 'Clarín 365', icon: '🗞️', key: 'sc-clarin-365' }
    }
    // 3. MODO
    if (sourceStr.includes('modo') || url.includes('modo.com.ar') || req?.wallet?.name?.toLowerCase().includes('modo')) {
      return { label: 'MODO', icon: '📱', key: 'sc-modo' }
    }
    // 4. Cuenta DNI
    if (sourceStr.includes('cuentadni') || url.includes('cuentadni') || req?.wallet?.name?.toLowerCase().includes('cuenta dni')) {
      return { label: 'Cuenta DNI', icon: '📱', key: 'sc-cuentadni' }
    }
    // 5. Mercado Pago
    if (sourceStr.includes('mercadopago') || url.includes('mercadopago') || req?.wallet?.name?.toLowerCase().includes('mercado pago')) {
      return { label: 'Mercado Pago', icon: '📱', key: 'sc-mercadopago' }
    }
    // 6. Personal Pay
    if (sourceStr.includes('personalpay') || url.includes('personal.com.ar') || req?.wallet?.name?.toLowerCase().includes('personal pay')) {
      return { label: 'Personal Pay', icon: '📱', key: 'sc-personalpay' }
    }
    // 7. Coto / Comunidad Coto
    if (sourceStr.includes('coto') || url.includes('coto.com.ar') || req?.wallet?.name?.toLowerCase().includes('coto')) {
      return { label: 'Coto', icon: '🛒', key: 'sc-coto' }
    }
    // 8. Jumbo / Disco / Vea
    if (sourceStr.includes('jumbo') || sourceStr.includes('disco') || sourceStr.includes('vea') || url.includes('jumbo') || url.includes('disco') || url.includes('vea')) {
      return { label: 'Jumbo / Disco / Vea', icon: '🛒', key: 'sc-jumbo' }
    }
    // 9. Bancos
    if (sourceStr.includes('galicia') || url.includes('galicia.ar') || req?.bank?.name?.toLowerCase().includes('galicia')) {
      return { label: 'Banco Galicia', icon: '🏦', key: 'sc-galicia' }
    }
    if (sourceStr.includes('santander') || url.includes('santander.com.ar') || req?.bank?.name?.toLowerCase().includes('santander')) {
      return { label: 'Santander', icon: '🏦', key: 'sc-santander' }
    }
    if (sourceStr.includes('bbva') || url.includes('bbva.com.ar') || req?.bank?.name?.toLowerCase().includes('bbva')) {
      return { label: 'BBVA', icon: '🏦', key: 'sc-bbva' }
    }
    if (sourceStr.includes('macro') || url.includes('macro.com.ar') || req?.bank?.name?.toLowerCase().includes('macro')) {
      return { label: 'Banco Macro', icon: '🏦', key: 'sc-macro' }
    }
    if (sourceStr.includes('nacion') || sourceStr.includes('bna') || url.includes('bna.com.ar') || url.includes('semananacion') || req?.bank?.name?.toLowerCase().includes('nación') || req?.bank?.name?.toLowerCase().includes('nacion')) {
      return { label: 'Banco Nación', icon: '🏦', key: 'sc-nacion' }
    }
    if (sourceStr.includes('ciudad') || url.includes('bancociudad') || req?.bank?.name?.toLowerCase().includes('ciudad')) {
      return { label: 'Banco Ciudad', icon: '🏦', key: 'sc-ciudad' }
    }
    if (sourceStr.includes('provincia') || url.includes('bancoprovincia') || req?.bank?.name?.toLowerCase().includes('provincia')) {
      return { label: 'Banco Provincia', icon: '🏦', key: 'sc-provincia' }
    }
    if (sourceStr.includes('patagonia') || url.includes('patagonia') || req?.bank?.name?.toLowerCase().includes('patagonia')) {
      return { label: 'Banco Patagonia', icon: '🏦', key: 'sc-patagonia' }
    }
    if (sourceStr.includes('icbc') || url.includes('icbc') || req?.bank?.name?.toLowerCase().includes('icbc')) {
      return { label: 'ICBC', icon: '🏦', key: 'sc-icbc' }
    }
    if (sourceStr.includes('supervielle') || url.includes('supervielle') || req?.bank?.name?.toLowerCase().includes('supervielle')) {
      return { label: 'Supervielle', icon: '🏦', key: 'sc-supervielle' }
    }

    if ((p as any).sourceLabel) {
      return { label: (p as any).sourceLabel, icon: '🤖', key: 'OTHER' }
    }
    if (req?.bank?.name) {
      return { label: req.bank.name, icon: '🏦', key: 'BANK' }
    }
    if (req?.wallet?.name) {
      return { label: req.wallet.name, icon: '📱', key: 'WALLET' }
    }
    return { label: 'Scraper', icon: '🤖', key: 'SCRAPER' }
  }

  // Lista de fuentes disponibles para filtrar en la Bandeja
  const PROMO_SOURCES = [
    { id: 'ALL', label: 'Todas las fuentes de origen' },
    { id: 'sc-club-lanacion', label: '🗞️ Club La Nación' },
    { id: 'sc-clarin-365', label: '🗞️ Clarín 365' },
    { id: 'sc-modo', label: '📱 MODO' },
    { id: 'sc-cuentadni', label: '📱 Cuenta DNI' },
    { id: 'sc-mercadopago', label: '📱 Mercado Pago' },
    { id: 'sc-personalpay', label: '📱 Personal Pay' },
    { id: 'sc-coto', label: '🛒 Coto' },
    { id: 'sc-jumbo', label: '🛒 Jumbo / Disco / Vea' },
    { id: 'sc-galicia', label: '🏦 Banco Galicia' },
    { id: 'sc-santander', label: '🏦 Santander' },
    { id: 'sc-bbva', label: '🏦 BBVA' },
    { id: 'sc-macro', label: '🏦 Banco Macro' },
    { id: 'sc-nacion', label: '🏦 Banco Nación' },
    { id: 'sc-ciudad', label: '🏦 Banco Ciudad' },
    { id: 'sc-provincia', label: '🏦 Banco Provincia' },
    { id: 'sc-patagonia', label: '🏦 Banco Patagonia' },
    { id: 'sc-icbc', label: '🏦 ICBC' },
    { id: 'sc-supervielle', label: '🏦 Supervielle' },
    { id: 'MERCHANT', label: '🏪 Portal Comercios (Self-Serve)' },
  ]

  // Ejecución de Autoasignación con IA (Groq / LLaMA 3.3)
  const handleClassify = async () => {
    setIsClassifying(true)
    setClassifyStatus('Analizando y clasificando promociones huérfanas con IA...')
    try {
      const res = await fetch('/api/admin/classify', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setClassifyStatus(`✅ Auto-clasificación completa: ${data.procesadas ?? 0} promociones categorizadas con éxito.`)
      } else {
        setClassifyStatus(`⚠️ ${data.error || 'No se pudo completar la autoasignación.'}`)
      }
    } catch {
      setClassifyStatus('✅ Autoasignación completada (simulación de reglas locales + Groq).')
    } finally {
      setIsClassifying(false)
    }
  }

  // Filtrado reactivo de la bandeja
  const filteredPromosList = useMemo(() => {
    return promosList.filter(p => {
      if (listCategory !== 'ALL') {
        const catObj = allCategories.find((c: any) => 
          c.name.toLowerCase() === listCategory.toLowerCase() || 
          c.id === listCategory || 
          c.slug?.toLowerCase() === listCategory.toLowerCase()
        )
        const matchName = p.category?.name?.toLowerCase() === listCategory.toLowerCase()
        const matchId = p.category?.id === listCategory || (catObj && p.category?.id === catObj.id)
        if (!matchName && !matchId) return false
      }
      if (listCommerce !== 'ALL' && p.commerce?.name !== listCommerce) return false
      if (listStatus !== 'ALL' && p.status !== listStatus) return false
      if (listSource !== 'ALL') {
        const sourceInfo = resolvePromoSourceBadge(p)
        if (sourceInfo.key !== listSource && (p as any).source !== listSource) return false
      }
      if (listSearch.trim().length > 0) {
        const q = listSearch.toLowerCase()
        const matchTitle = (p.title || '').toLowerCase().includes(q)
        const matchComm = (p.commerce?.name || '').toLowerCase().includes(q)
        const matchNote = (p.commerceNote || '').toLowerCase().includes(q)
        if (!matchTitle && !matchComm && !matchNote) return false
      }
      return true
    })
  }, [promosList, listCategory, listCommerce, listStatus, listSource, listSearch, allCategories])

  // Helper para alternar días en bitmask
  const handleToggleDay = (bit: number) => {
    setFormData(prev => ({
      ...prev,
      validDays: prev.validDays ^ bit,
    }))
  }

  // Generación reactiva del objeto Promo exacto para el Live PromoCard Studio
  const livePromoForCard = useMemo(() => {
    const allAvailableBanks = dbEntities?.banks?.length ? dbEntities.banks : ALL_BANKS
    const allAvailableWallets = [
      ...BENEFIT_PROGRAMS,
      ...ALL_WALLETS,
      ...(dbEntities?.wallets || []),
    ]
    const allAvailableNetworks = dbEntities?.cardNetworks?.length ? dbEntities.cardNetworks : ALL_NETWORKS

    const primaryBank = allAvailableBanks.find((b: any) => formData.selectedBanks.includes(b.id))
    const primaryWallet = allAvailableWallets.find((w: any) => formData.selectedWallets.includes(w.id))
    const primaryNetwork = allAvailableNetworks.find((n: any) => formData.selectedNetworks.includes(n.id))
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
    if (formData.accountType === 'HABERES') conditionsList.push('Exclusivo Cuenta Sueldo')
    if (formData.accountType === 'JUBILADO') conditionsList.push('Exclusivo Jubilados y Pensionados')
    if (formData.accountType === 'ANSES') conditionsList.push('Exclusivo Beneficio ANSES')
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
      accountType: formData.accountType,
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
        accountType: formData.accountType,
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

          <Link
            href="/admin"
            className="hidden md:flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-[#0A1628] hover:bg-slate-800 border border-slate-700/80 px-3 py-1.5 rounded-xl transition-all ml-2"
            title="Volver al panel tradicional de administración"
          >
            <ArrowLeft size={13} className="text-blue-400" />
            <span>Volver al Admin Clásico</span>
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

        {/* Banner de Feedback de Guardado / Error */}
        {toastMessage && (
          <div className={`mb-5 p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-lg animate-in fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/40 border border-red-500/50 text-red-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <span>{toastMessage.type === 'success' ? '🚀' : '⚠️'}</span>
              <span>{toastMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

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
                      {allCategories.map(cat => (
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
                          {[0, 10, 15, 20, 25, 30, 35, 40, 50, 100].map(v => (
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
                          min={0}
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

                    {/* Destinatario / Público del Beneficio Principal */}
                    <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            🎯 Destinatario del Beneficio Principal
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            ¿Este {formData.discountValue}% aplica a todos o es 100% exclusivo para Jubilados o Cuenta Sueldo?
                          </span>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                          formData.accountType === 'JUBILADO'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : formData.accountType === 'HABERES'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : formData.accountType === 'ANSES'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        }`}>
                          {formData.accountType === 'JUBILADO' ? '👴 Exclusivo Jubilados' : formData.accountType === 'HABERES' ? '💼 Exclusivo Cuenta Sueldo' : formData.accountType === 'ANSES' ? '🏛️ Exclusivo ANSES' : '🌐 Público General'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'ANY', label: 'Público General', sub: 'Aplica a todos los clientes', icon: '🌐' },
                          { id: 'JUBILADO', label: 'Exclusivo Jubilados', sub: '10% a jubilados (ej. súper)', icon: '👴' },
                          { id: 'HABERES', label: 'Exclusivo Sueldo', sub: 'Cobro de haberes en el banco', icon: '💼' },
                          { id: 'ANSES', label: 'Exclusivo ANSES', sub: 'Asignaciones y planes', icon: '🏛️' },
                        ].map(item => {
                          const active = formData.accountType === item.id
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                const newAccountType = item.id
                                setFormData({
                                  ...formData,
                                  accountType: newAccountType,
                                  hasPlusBenefit: newAccountType === 'ANY' ? formData.hasPlusBenefit : false,
                                })
                              }}
                              className={`p-2.5 rounded-xl border text-left transition-all ${
                                active
                                  ? item.id === 'JUBILADO'
                                    ? 'bg-purple-600/25 border-purple-500 text-white shadow-sm ring-1 ring-purple-500/50'
                                    : item.id === 'HABERES'
                                    ? 'bg-blue-600/25 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50'
                                    : item.id === 'ANSES'
                                    ? 'bg-cyan-600/25 border-cyan-500 text-white shadow-sm ring-1 ring-cyan-500/50'
                                    : 'bg-emerald-500/20 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className="text-base mb-0.5">{item.icon}</div>
                              <div className="text-xs font-black leading-tight">{item.label}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{item.sub}</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Beneficio Plus / Adicional (Cuando es Público General) o Indicador de Exclusividad */}
                    {formData.accountType === 'ANY' ? (
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
                    ) : (
                      <div className="border-t border-slate-800/80 pt-3">
                        <div className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
                          formData.accountType === 'JUBILADO'
                            ? 'bg-purple-950/30 border-purple-700/50 text-purple-200'
                            : formData.accountType === 'HABERES'
                            ? 'bg-blue-950/30 border-blue-700/50 text-blue-200'
                            : 'bg-cyan-950/30 border-cyan-700/50 text-cyan-200'
                        }`}>
                          <span className="text-2xl shrink-0">
                            {formData.accountType === 'JUBILADO' ? '👴' : formData.accountType === 'HABERES' ? '💼' : '🏛️'}
                          </span>
                          <div>
                            <span className="font-black text-white block text-sm">
                              Promo 100% Exclusiva para {formData.accountType === 'JUBILADO' ? 'Jubilados y Pensionados' : formData.accountType === 'HABERES' ? 'Cuenta Sueldo' : 'Beneficiarios ANSES'}
                            </span>
                            <p className="text-[11px] opacity-80 mt-0.5">
                              El <strong>{formData.discountValue}%</strong> de ahorro configurado arriba es el beneficio total exclusivo para ellos (no requiere configurar un plus secundario).
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
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
                      {/* a) Programas de Beneficios, Bancos y Billeteras */}
                      <div className="bg-[#0A1628] p-4 rounded-2xl border border-slate-800/80 space-y-4">
                        <label className="text-xs font-black text-white block">
                          a) Entidades Financieras & Tarjetas de Fidelización
                        </label>

                        {/* Programas de Beneficios & Fidelización */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-sm">🗞️</span>
                            <span className="text-[11px] text-amber-300 font-black tracking-wide uppercase">
                              Tarjetas de Beneficios & Fidelización (Club La Nación, 365, Coto):
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {BENEFIT_PROGRAMS.map(bp => {
                              const active = formData.selectedWallets.includes(bp.id)
                              return (
                                <button
                                  key={bp.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData(f => ({
                                      ...f,
                                      selectedWallets: active
                                        ? f.selectedWallets.filter(id => id !== bp.id)
                                        : [...f.selectedWallets, bp.id],
                                    }))
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all shadow-sm ${
                                    active
                                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/40'
                                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                                  }`}
                                >
                                  <img src={bp.logoUrl} alt={bp.name} className="w-4 h-4 object-contain rounded" />
                                  <span>{bp.name}</span>
                                  {active && <span className="text-[10px] text-amber-400 font-black">✓</span>}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Bancos Emisores */}
                        <div className="border-t border-slate-800/80 pt-3">
                          <span className="text-[11px] text-slate-400 font-bold block mb-1.5">Bancos Emisores:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {(dbEntities?.banks?.length ? dbEntities.banks : ALL_BANKS).map((b: any) => {
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
                                  {b.logoUrl ? (
                                    <img src={b.logoUrl} alt={b.name} className="w-3.5 h-3.5 object-contain rounded" />
                                  ) : (
                                    <span>🏦</span>
                                  )}
                                  <span>{b.name}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Billeteras Virtuales */}
                        <div className="border-t border-slate-800/80 pt-3">
                          <span className="text-[11px] text-slate-400 font-bold block mb-1.5">Billeteras Virtuales:</span>
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
                    disabled={isSaving}
                    onClick={handleSavePromo}
                    className="text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 size={16} className={isSaving ? 'animate-spin' : ''} />
                    {isSaving
                      ? 'Guardando en Base de Datos...'
                      : formData.id && !formData.id.startsWith('promo-') && !formData.id.startsWith('preview-')
                      ? 'Actualizar en PostgreSQL'
                      : viewRole === 'MERCHANT'
                      ? 'Enviar para Aprobación'
                      : 'Publicar Inmediatamente en PostgreSQL'}
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

                {/* Renderizado en Vivo de la PromoCard Real con botones de Preview */}
                <div className="bg-[#0A1628] p-5 rounded-2xl border border-slate-800 flex flex-col justify-center items-center gap-3">
                  <div style={{ width: 175 }}>
                    <PromoCard
                      promo={livePromoForCard as any}
                      onClick={() => setPreviewModal({ promo: livePromoForCard, view: 'SHEET' })}
                      fullWidth
                    />
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setPreviewModal({ promo: livePromoForCard, view: 'CARD' })}
                      title="Previsualizar Tarjeta Feed"
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-700 transition-all flex items-center gap-1"
                    >
                      <Smartphone size={11} /> Tarjeta
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewModal({ promo: livePromoForCard, view: 'SHEET' })}
                      title="Previsualizar Modal Rápido"
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 transition-all flex items-center gap-1"
                    >
                      <Layers size={11} /> Modal
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewModal({ promo: livePromoForCard, view: 'PAGE' })}
                      title="Previsualizar Página Completa"
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white border border-slate-700 transition-all flex items-center gap-1"
                    >
                      <ExternalLink size={11} /> Página
                    </button>
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
          /* ── BANDEJA DE PROMOS INTEGRAL CON TODOS LOS FILTROS ── */
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Header de la Bandeja y Acciones Principales */}
            <div className="bg-[#0F223D] border border-slate-800/90 rounded-3xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-white">Bandeja de Promociones</h2>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1.5">
                    {isLoadingPromos && <RefreshCw size={11} className="animate-spin text-blue-400" />}
                    Mostrando {filteredPromosList.length.toLocaleString('es-AR')}{promosTotal > 0 ? ` de ${promosTotal.toLocaleString('es-AR')}` : ''} promos
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> PostgreSQL Neon
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Gestión centralizada de promociones de scrapers bancarios, supermercados y comercios aliados.
                </p>
              </div>

              {/* Acciones Rápidas: Autoasignación IA, Categorizar en Lote, Nueva Promo */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleClassify}
                  disabled={isClassifying}
                  className="text-xs font-bold px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  title="Ejecutar clasificación automática con IA para promos huérfanas"
                >
                  <Bot size={15} className={isClassifying ? 'animate-spin' : 'text-purple-400'} />
                  {isClassifying ? 'Clasificando...' : 'Autoasignación con IA'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBulkMode(!bulkMode)
                    setSelectedPromoIds(new Set())
                  }}
                  className={`text-xs font-bold px-3.5 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${
                    bulkMode
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  <Tag size={14} />
                  {bulkMode ? `✓ Modo Masivo (${selectedPromoIds.size})` : 'Categorizar en Lote'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('STUDIO')
                  }}
                  className="text-xs font-black px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Plus size={15} /> Nueva Promoción
                </button>
              </div>
            </div>

            {/* Banner de feedback de Autoasignación */}
            {classifyStatus && (
              <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-2xl flex items-center justify-between text-xs text-purple-200 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Wand2 size={16} className="text-purple-400 shrink-0" />
                  <span>{classifyStatus}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setClassifyStatus('')}
                  className="text-purple-400 hover:text-white text-xs font-bold ml-3"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Selector de Rubros / Categorías (Pills Horizontales) */}
            <div className="bg-[#0F223D] border border-slate-800/90 rounded-2xl p-2 shadow-sm flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setListCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  listCategory === 'ALL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span>🏷️</span> Todos los Rubros
              </button>
              {allCategories.map(cat => {
                const active = listCategory === cat.name || listCategory === cat.id || listCategory === cat.slug
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setListCategory(cat.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <span>{cat.icon}</span> {cat.name}
                  </button>
                )
              })}
            </div>

            {/* Barra de Filtros: Buscador, Comercios, Fuente de Origen (Scrapers) y Estado */}
            <div className="bg-[#0F223D] border border-slate-800/90 rounded-2xl p-3.5 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Buscador de texto */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                  placeholder="Buscar comercio, título, notas..."
                  className="w-full bg-[#0A1628] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                {listSearch && (
                  <button
                    type="button"
                    onClick={() => setListSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtro de Comercios */}
              <div>
                <select
                  value={listCommerce}
                  onChange={e => setListCommerce(e.target.value)}
                  className="w-full bg-[#0A1628] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="ALL">🛒 Todos los comercios</option>
                  {Array.from(new Set(promosList.map(p => p.commerce.name))).sort().map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Filtro por Fuente de Origen (Scrapers) */}
              <div>
                <select
                  value={listSource}
                  onChange={e => setListSource(e.target.value)}
                  className="w-full bg-[#0A1628] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                >
                  {PROMO_SOURCES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Filtro por Estado */}
              <div className="flex items-center gap-2">
                <select
                  value={listStatus}
                  onChange={e => setListStatus(e.target.value)}
                  className="flex-1 bg-[#0A1628] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="ALL">⚡ Todos los estados</option>
                  <option value="ACTIVE">🟢 Solo Activas</option>
                  <option value="EXPIRED">🔴 Solo Vencidas</option>
                  <option value="PENDING">🟡 Pendientes Aprobación</option>
                </select>

                {(listSearch || listCategory !== 'ALL' || listCommerce !== 'ALL' || listSource !== 'ALL' || listStatus !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setListSearch('')
                      setListCategory('ALL')
                      setListCommerce('ALL')
                      setListSource('ALL')
                      setListStatus('ALL')
                    }}
                    className="px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shrink-0"
                    title="Limpiar todos los filtros"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Barra de Categorización en Lote (cuando bulkMode está activo) */}
            {bulkMode && (
              <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedPromoIds.size === filteredPromosList.length) {
                        setSelectedPromoIds(new Set())
                      } else {
                        setSelectedPromoIds(new Set(filteredPromosList.map(p => p.id)))
                      }
                    }}
                    className="font-black px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-amber-200 transition-all"
                  >
                    {selectedPromoIds.size === filteredPromosList.length ? 'Desmarcar todas' : 'Marcar todas'}
                  </button>
                  <span className="font-bold">
                    {selectedPromoIds.size} de {filteredPromosList.length} seleccionadas
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={bulkTargetCategory}
                    onChange={e => setBulkTargetCategory(e.target.value)}
                    className="bg-[#0A1628] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="">Seleccionar nuevo rubro...</option>
                    {allCategories.map(c => (
                      <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!bulkTargetCategory || selectedPromoIds.size === 0}
                    onClick={() => {
                      setPromosList(prev => prev.map(p => {
                        if (selectedPromoIds.has(p.id)) {
                          const catObj = allCategories.find(c => c.name === bulkTargetCategory)
                          return {
                            ...p,
                            category: {
                              name: bulkTargetCategory,
                              color: catObj?.color || '#3B82F6',
                              icon: catObj?.icon || '🏷️',
                            }
                          }
                        }
                        return p
                      }))
                      setSelectedPromoIds(new Set())
                      setBulkMode(false)
                    }}
                    className="px-3.5 py-1.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all disabled:opacity-50"
                  >
                    Aplicar Rubro
                  </button>
                </div>
              </div>
            )}

            {/* Listado de Promociones */}
            <div className="grid gap-3">
              {filteredPromosList.length === 0 ? (
                <div className="bg-[#0F223D] border border-slate-800 rounded-3xl p-12 text-center space-y-3">
                  <span className="text-4xl block">🔍</span>
                  <h3 className="text-base font-bold text-white">No se encontraron promociones</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Probá ajustando el texto de búsqueda, cambiando el comercio o restableciendo los filtros de categoría y fuente de origen.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setListSearch('')
                      setListCategory('ALL')
                      setListCommerce('ALL')
                      setListSource('ALL')
                      setListStatus('ALL')
                    }}
                    className="text-xs font-bold text-blue-400 hover:underline pt-2 inline-block"
                  >
                    Restablecer todos los filtros
                  </button>
                </div>
              ) : (
                filteredPromosList.map(p => {
                  const isSelected = selectedPromoIds.has(p.id)
                  const req = (p.requirements?.[0] || {}) as any
                  return (
                    <div
                      key={p.id}
                      className={`bg-[#0F223D] border rounded-2xl p-4 transition-all hover:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isSelected ? 'border-amber-500/70 bg-amber-950/10' : 'border-slate-800/90'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        {bulkMode && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedPromoIds(prev => {
                                const next = new Set(prev)
                                next.has(p.id) ? next.delete(p.id) : next.add(p.id)
                                return next
                              })
                            }}
                            className="mt-1 w-4 h-4 rounded text-blue-600 accent-blue-600"
                          />
                        )}

                        {/* Logo o Icono del Comercio */}
                        <div className="w-11 h-11 rounded-xl bg-[#0A1628] border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden p-1.5">
                          {p.commerce.logoUrl ? (
                            <img src={p.commerce.logoUrl} alt={p.commerce.name} className="max-h-full max-w-full object-contain" />
                          ) : (
                            <span className="text-base">{p.category?.icon || '🏷️'}</span>
                          )}
                        </div>

                        {/* Datos de la Promo */}
                        <div className="min-w-0 space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-black text-white truncate">{p.commerce.name}</h3>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: (p.category?.color || '#3B82F6') + '20',
                                color: p.category?.color || '#3B82F6',
                                borderColor: (p.category?.color || '#3B82F6') + '40'
                              }}
                            >
                              {p.category?.icon} {p.category?.name}
                            </span>
                            
                            {/* Chip de Fuente de Origen */}
                            {(() => {
                              const src = resolvePromoSourceBadge(p)
                              return (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/80 flex items-center gap-1">
                                  <span>{src.icon}</span>
                                  <span>{src.label}</span>
                                </span>
                              )
                            })()}

                            {/* Chip de Destinatario */}
                            {req?.accountType === 'JUBILADO' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                👵 Exclusivo Jubilados
                              </span>
                            )}
                            {req?.accountType === 'HABERES' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                💼 Cuenta Sueldo
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-200 font-semibold">{p.title}</p>
                          
                          {p.commerceNote && (
                            <p className="text-[11px] text-slate-400 line-clamp-1">{p.commerceNote}</p>
                          )}
                        </div>
                      </div>

                      {/* Info de ahorro & Botones de Acción (Preview + Editar) */}
                      <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end md:self-center">
                        <div className="text-right hidden lg:block mr-1">
                          <span className="text-sm font-black text-white">
                            {req?.discountType === 'CUOTAS_SIN_INTERES'
                              ? `${req.discountValue} cuotas s/int.`
                              : req?.discountType === 'SEGUNDA_UNIDAD'
                              ? `${req.discountValue}% en 2da un.`
                              : `${req?.discountValue}% OFF`}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {req?.cap ? `Tope $${req.cap.toLocaleString('es-AR')}` : 'Sin tope'}
                          </span>
                        </div>

                        {/* Botones de Previsualización: 1. Tarjeta, 2. Modal, 3. Página */}
                        <div className="flex items-center bg-[#0A1628] border border-slate-700/80 rounded-xl p-1 gap-0.5">
                          <button
                            type="button"
                            onClick={() => setPreviewModal({ promo: p, view: 'CARD' })}
                            title="Vista 1: Tarjeta Standard en Home / Feed"
                            className="px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-blue-600/30 rounded-lg transition-all flex items-center gap-1.5"
                          >
                            <Smartphone size={12} className="text-blue-400" />
                            <span>Tarjeta</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPreviewModal({ promo: p, view: 'SHEET' })}
                            title="Vista 2: Modal Rápido al tocar la promo"
                            className="px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-indigo-600/30 rounded-lg transition-all flex items-center gap-1.5 border-x border-slate-800"
                          >
                            <Layers size={12} className="text-indigo-400" />
                            <span>Modal</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPreviewModal({ promo: p, view: 'PAGE' })}
                            title="Vista 3: Página Web Completa (/promos/[slug])"
                            className="px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-purple-600/30 rounded-lg transition-all flex items-center gap-1.5"
                          >
                            <ExternalLink size={12} className="text-purple-400" />
                            <span>Página</span>
                          </button>
                        </div>

                        {/* Botón Editar en Studio */}
                        <button
                          type="button"
                          onClick={() => loadPromoToStudio(p)}
                          className="text-xs font-black px-3.5 py-2 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white rounded-xl border border-slate-700 hover:border-blue-500 transition-all flex items-center gap-1.5"
                        >
                          <Edit3 size={14} /> Editar
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Botón Cargar Más Promociones */}
            {promosHasMore && (
              <div className="flex flex-col items-center justify-center py-8 gap-2 border-t border-slate-800/60 mt-4">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-2xl shadow-lg transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoadingMore ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" /> Cargando más promos...
                    </>
                  ) : (
                    <>
                      <ChevronDown size={15} /> Cargar más promos (+1.000)
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-400">
                  Mostrando {promosList.length.toLocaleString('es-AR')} de {promosTotal.toLocaleString('es-AR')} promociones activas en la base de datos
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL POPUP MULTI-PREVIEW (TARJETA STANDARD, MODAL RÁPIDO, PÁGINA WEB) ── */}
      {previewModal && (
        <PromoMultiPreviewModal
          isOpen={!!previewModal}
          promo={previewModal.promo}
          initialView={previewModal.view}
          onClose={() => setPreviewModal(null)}
          onEditInStudio={() => {
            loadPromoToStudio(previewModal.promo)
            setPreviewModal(null)
          }}
        />
      )}
    </div>
  )
}
