'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react'

// ── Tipos de entidades externas ──────────────────────────────────────────────
type BankSegment = { id: string; name: string; bankId: string }
type EntityBank = {
  id: string; name: string; logoUrl?: string | null
  cardNetworks: { id: string; name: string }[]
  cardSegments: { id: string; name: string; cardNetworkId: string; cardType: string }[]
}
type EntityWallet = { id: string; name: string; logoUrl?: string | null }

// ── Tipos internos del wizard ─────────────────────────────────────────────────
// Caja de ahorros del banco (a lo sumo una por banco)
type AccountInfo = {
  has: boolean
  isPayroll: boolean
  isPensioner: boolean
  inModo: boolean
}

// Una opción posible de tarjeta para un banco (calculada de la DB)
type CardOption = {
  key: string           // clave única: networkId_cardType_segmentId?_cardSegmentId?
  networkId: string
  networkName: string
  cardType: 'CREDIT' | 'DEBIT' | 'PREPAID'
  segmentId?: string    // BankSegment (Selecta, Eminent)
  cardSegmentId?: string // CardSegment (Visa Infinite, MC Black)
  label: string         // texto a mostrar
}

type SelectedCard = CardOption & { inModo: boolean }

type BankConfig = {
  id: string
  name: string
  logoUrl?: string | null
  segmentId?: string   // paquete bancario (Eminent, Selecta) — aplica a todas las tarjetas
  account: AccountInfo
  wantsCards: boolean  // respuesta a "¿Tenés tarjetas?"
  cards: SelectedCard[]
}

const EMPTY_ACCOUNT: AccountInfo = { has: false, isPayroll: false, isPensioner: false, inModo: false }

// ── Tipos exportables ─────────────────────────────────────────────────────────
export type GuestCard = {
  bankId?: string
  walletId?: string
  cardNetworkId?: string
  cardType: 'CREDIT' | 'DEBIT' | 'ACCOUNT' | 'PREPAID'
  segmentId?: string
  cardSegmentId?: string
  isPayroll?: boolean
  isPensioner?: boolean
}

export type GuestProfile = { cards: GuestCard[] }

type Props = {
  open: boolean
  onClose: () => void
  onComplete: (profile: GuestProfile) => void
  onAdd?: (profile: GuestProfile) => void
  initialProfile?: GuestProfile | null
  inline?: boolean
  saveLabel?: string
  saving?: boolean
}

// ── Helpers visuales ──────────────────────────────────────────────────────────
function EntityLogo({ logoUrl, name, sm }: { logoUrl?: string | null; name: string; sm?: boolean }) {
  const cls = sm ? 'h-7 w-7' : 'h-9 w-9'
  if (logoUrl) return <img src={logoUrl} alt={name} className={`${cls} object-contain rounded-lg shrink-0`} />
  return <div className={`${cls} rounded-lg bg-gray-200 flex items-center justify-center text-[10px] font-black text-gray-400 shrink-0`}>{name.slice(0, 2).toUpperCase()}</div>
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
      {checked && <Check size={11} className="text-white" />}
    </div>
  )
}

// ── Mapa estático de opciones por red ────────────────────────────────────────
// Independiente de lo que tenga el banco en la DB
type NetOption = { cardType: 'CREDIT' | 'DEBIT' | 'PREPAID'; label: string }
const NETWORK_CARD_OPTIONS: Record<string, NetOption[]> = {
  'visa': [
    { cardType: 'CREDIT',  label: 'Visa Crédito Clásica' },
    { cardType: 'CREDIT',  label: 'Visa Crédito Gold' },
    { cardType: 'CREDIT',  label: 'Visa Crédito Platinum' },
    { cardType: 'CREDIT',  label: 'Visa Crédito Signature' },
    { cardType: 'DEBIT',   label: 'Visa Débito Clásica' },
    { cardType: 'PREPAID', label: 'Visa Prepaga Recargable' },
    { cardType: 'PREPAID', label: 'Visa Prepaga Regalo' },
  ],
  'mastercard': [
    { cardType: 'CREDIT',  label: 'Mastercard Crédito Estándar' },
    { cardType: 'CREDIT',  label: 'Mastercard Crédito Gold' },
    { cardType: 'CREDIT',  label: 'Mastercard Crédito Platinum' },
    { cardType: 'CREDIT',  label: 'Mastercard Crédito Black' },
    { cardType: 'DEBIT',   label: 'Mastercard Débito Estándar' },
    { cardType: 'DEBIT',   label: 'Mastercard Débito Platinum' },
    { cardType: 'DEBIT',   label: 'Mastercard Débito Black' },
  ],
  'american express banco': [
    { cardType: 'CREDIT',  label: 'American Express Internacional' },
    { cardType: 'CREDIT',  label: 'American Express Platinum' },
    { cardType: 'CREDIT',  label: 'American Express Gold' },
    { cardType: 'CREDIT',  label: 'American Express Icon' },
  ],
  'american express': [
    { cardType: 'CREDIT',  label: 'The Platinum Card' },
    { cardType: 'CREDIT',  label: 'The Platinum Credit Card Aerolíneas' },
    { cardType: 'CREDIT',  label: 'The Gold Card' },
    { cardType: 'CREDIT',  label: 'The Green Card' },
  ],
  'cabal': [
    { cardType: 'CREDIT',  label: 'Cabal Crédito Internacional' },
    { cardType: 'DEBIT',   label: 'Cabal Débito' },
    { cardType: 'DEBIT',   label: 'Cabal Débito Internacional' },
  ],
  'naranja x': [
    { cardType: 'CREDIT',  label: 'Naranja X Crédito' },
  ],
  'maestro': [
    { cardType: 'DEBIT',   label: 'Maestro Débito' },
  ],
  'diners': [
    { cardType: 'CREDIT',  label: 'Diners Club Crédito' },
  ],
}

// Bancos que participan de la red MODO
const MODO_BANK_KEYWORDS = [
  'galicia', 'bbva', 'francés', 'frances', 'santander', 'macro', 'hsbc',
  'ciudad', 'provincia', 'nación', 'nacion', 'patagonia', 'hipotecario',
  'supervielle', 'icbc', 'comafi', 'credicoop', 'itaú', 'itau',
  'del sol', 'standard bank', 'openbank', 'bancor', 'córdoba', 'cordoba',
  'santa fe', 'entre ríos', 'entre rios', 'la pampa', 'chubut', 'formosa',
  'san juan', 'tierra del fuego', 'tucumán', 'tucuman', 'meridian',
  'del neuquén', 'del neuquen', 'santa cruz', 'del chaco',
]
function isModoBank(bankName: string): boolean {
  const n = bankName.toLowerCase()
  return MODO_BANK_KEYWORDS.some(k => n.includes(k))
}

// Segmentos estándar (para el banco package selector)
const STANDARD_SEGMENT_NAMES = ['clasic', 'internacion', 'gold', 'oro', 'platinum', 'black', 'premium', 'signature', 'infinite', 'icon', 'macro', 'regional', 'nacional', 'selecta', 'eminent', 'the gold', 'the platinum', 'the green']
function isStandardSegment(name: string) {
  const n = name.toLowerCase()
  return STANDARD_SEGMENT_NAMES.some(s => n.includes(s))
}

// Sub-pasos dentro de la configuración de un banco — cada pregunta es su propio paso,
// nada se asume: paquete (opcional) → ¿cuenta? → sueldo/jubilación → ¿MODO? → ¿tarjetas? → tarjetas
type BankSubStep = 'segment' | 'account_has' | 'account_payroll' | 'account_modo' | 'cards_has' | 'cards'
function getBankSubSteps(
  bank: EntityBank,
  allBankSegs: BankSegment[],
  config: BankConfig,
  modoWalletId: string | undefined
): BankSubStep[] {
  const progSegs = allBankSegs.filter(s => s.bankId === bank.id && isStandardSegment(s.name))
  const steps: BankSubStep[] = []
  if (progSegs.length > 0) steps.push('segment')
  steps.push('account_has')
  if (config.account.has) {
    steps.push('account_payroll')
    if (modoWalletId) steps.push('account_modo')
  }
  steps.push('cards_has')
  if (config.wantsCards) steps.push('cards')
  return steps
}

// Redes universales en Argentina — fallback cuando el banco no tiene cardNetworks cargadas
const DEFAULT_NETWORK_NAMES = ['visa', 'mastercard']

// Usa las redes del banco + mapa estático para las opciones por red
function computeCardOptions(bank: EntityBank, allNetworks: { id: string; name: string }[]): CardOption[] {
  const opts: CardOption[] = []

  // Usar las redes del banco si tiene cargadas; si no, fallback a Visa + Mastercard (universales)
  const nets = bank.cardNetworks.length > 0
    ? bank.cardNetworks
    : allNetworks.filter(n => DEFAULT_NETWORK_NAMES.includes(n.name.toLowerCase()))

  for (const net of nets) {
    const key = net.name.toLowerCase()
    const staticOpts = Object.entries(NETWORK_CARD_OPTIONS).find(([k]) => key.includes(k))?.[1]
    if (!staticOpts) continue

    staticOpts.forEach((o, i) => {
      opts.push({
        key:         `${net.id}_${o.cardType}_${i}`,
        networkId:   net.id,
        networkName: net.name,
        cardType:    o.cardType,
        label:       o.label,
      })
    })
  }
  return opts
}

// ── Mapa estático de tarjetas propias de billeteras ──────────────────────────
// Las billeteras emiten tarjetas con redes que ya existen como CardNetwork
// (Mastercard, Visa, Naranja X, Mastercard Carrefour Banco). Se resuelve el id
// de la red contra allNetworks (lista global de CardNetwork).
type WalletCardOption = { networkName: string; cardType: 'CREDIT' | 'DEBIT' | 'PREPAID'; label: string }
const WALLET_CARD_OPTIONS: Record<string, WalletCardOption[]> = {
  'mercado pago': [
    { networkName: 'Mastercard', cardType: 'CREDIT', label: 'Mastercard Crédito' },
    { networkName: 'Mastercard', cardType: 'DEBIT',  label: 'Mastercard Débito (en cuenta)' },
  ],
  'personal pay': [
    { networkName: 'Visa', cardType: 'PREPAID', label: 'Visa Prepaga' },
  ],
  'ualá': [
    { networkName: 'Mastercard', cardType: 'CREDIT', label: 'Mastercard Crédito' },
  ],
  'carrefour banco': [
    { networkName: 'Mastercard Carrefour Banco', cardType: 'CREDIT',  label: 'Mastercard Crédito' },
    { networkName: 'Mastercard Carrefour Banco', cardType: 'PREPAID', label: 'Mastercard Prepaga' },
  ],
  'naranja x': [
    { networkName: 'Naranja X',  cardType: 'CREDIT', label: 'Naranja Crédito' },
    { networkName: 'Visa',       cardType: 'CREDIT', label: 'Visa Crédito' },
    { networkName: 'Mastercard', cardType: 'CREDIT', label: 'Mastercard Crédito' },
    { networkName: 'Visa',       cardType: 'DEBIT',  label: 'Visa Débito' },
  ],
}

// Resuelve las opciones de tarjeta propia de una billetera contra la lista global de redes
function resolveWalletCardOptions(
  walletName: string,
  allNets: { id: string; name: string }[]
): { networkId: string; cardType: 'CREDIT' | 'DEBIT' | 'PREPAID'; label: string }[] {
  const opts = WALLET_CARD_OPTIONS[walletName.toLowerCase()]
  if (!opts) return []
  return opts
    .map(o => ({
      networkId: allNets.find(n => n.name.toLowerCase() === o.networkName.toLowerCase())?.id,
      cardType: o.cardType,
      label: o.label,
    }))
    .filter((o): o is { networkId: string; cardType: 'CREDIT' | 'DEBIT' | 'PREPAID'; label: string } => !!o.networkId)
}

// ── Reconstruye BankConfig desde GuestCards ───────────────────────────────────
type WalletCardSelection = { networkId: string; cardType: 'CREDIT' | 'DEBIT' | 'PREPAID'; label: string }

function reconstructConfigs(
  cards: GuestCard[],
  banks: EntityBank[],
  wallets: EntityWallet[],
  allNets: { id: string; name: string }[]
): { bankIds: string[]; walletIds: string[]; configs: Record<string, BankConfig>; walletCards: Record<string, WalletCardSelection[]> } {
  const modoId = wallets.find(w => w.name.toLowerCase().includes('modo'))?.id
  const bankIdSet = new Set<string>()
  const walletIdSet = new Set<string>()

  for (const c of cards) {
    if (c.bankId) bankIdSet.add(c.bankId)
    if (c.walletId && !c.bankId) walletIdSet.add(c.walletId)
  }

  const configs: Record<string, BankConfig> = {}
  for (const bankId of Array.from(bankIdSet)) {
    const bank = banks.find(b => b.id === bankId)
    const bankCards = cards.filter(c => c.bankId === bankId)
    const opts = bank ? computeCardOptions(bank, allNets) : []

    // Cuenta (caja de ahorros) — incluir la que tiene walletId (MODO) como inModo=true
    const pureAccount = bankCards.find(c => c.cardType === 'ACCOUNT' && !c.walletId)
    const modoAccount = bankCards.find(c => c.cardType === 'ACCOUNT' && c.walletId === modoId)
    const accountCard = pureAccount ?? modoAccount
    const account: AccountInfo = accountCard ? {
      has: true,
      isPayroll: accountCard.isPayroll ?? false,
      isPensioner: accountCard.isPensioner ?? false,
      inModo: !!modoAccount,
    } : EMPTY_ACCOUNT

    // Tarjetas seleccionadas
    const selectedCards: SelectedCard[] = []
    for (const c of bankCards.filter(bc => bc.cardType !== 'ACCOUNT' && !bc.walletId)) {
      const opt = opts.find(o =>
        o.networkId === c.cardNetworkId &&
        o.cardType === (c.cardType as any) &&
        (o.cardSegmentId ?? null) === (c.cardSegmentId ?? null)
      )
      if (opt) {
        const modoLinked = bankCards.some(bc =>
          bc.walletId === modoId && bc.cardNetworkId === c.cardNetworkId && bc.cardType === c.cardType
        )
        selectedCards.push({ ...opt, inModo: modoLinked })
      }
    }

    // Restaurar segmentId del paquete desde cualquier tarjeta que lo tenga
    const restoredSegmentId = bankCards.find(c => c.segmentId && c.cardType !== 'ACCOUNT')?.segmentId

    configs[bankId] = {
      id: bankId, name: bank?.name ?? '', logoUrl: bank?.logoUrl,
      segmentId: restoredSegmentId,
      account, wantsCards: selectedCards.length > 0, cards: selectedCards,
    }
  }

  // Tarjetas propias de billeteras (Mercado Pago, Naranja X, etc.)
  const walletCards: Record<string, WalletCardSelection[]> = {}
  for (const walletId of Array.from(walletIdSet)) {
    const wallet = wallets.find(w => w.id === walletId)
    if (!wallet) continue
    const opts = resolveWalletCardOptions(wallet.name, allNets)
    if (opts.length === 0) continue
    const entries = cards.filter(c => c.walletId === walletId && !c.bankId && c.cardNetworkId)
    const matched = entries
      .map(c => opts.find(o => o.networkId === c.cardNetworkId && o.cardType === c.cardType))
      .filter((o): o is WalletCardSelection => !!o)
    if (matched.length > 0) walletCards[walletId] = matched
  }

  // MODO se considera billetera seleccionada si algún producto bancario quedó vinculado a ella
  const walletIds = Array.from(walletIdSet)
  const hasAnyInModo = Object.values(configs).some(cfg => cfg.account.inModo || cfg.cards.some(c => c.inModo))
  if (hasAnyInModo && modoId && !walletIds.includes(modoId)) walletIds.push(modoId)

  return { bankIds: Array.from(bankIdSet), walletIds, configs, walletCards }
}

// ── Paso: configuración de un banco ──────────────────────────────────────────
function BankProductStep({
  bank, config, subStep, modoWalletId, allBankSegs, allNets, onUpdate,
}: {
  bank: EntityBank
  config: BankConfig
  subStep: BankSubStep
  modoWalletId: string | undefined
  allBankSegs: BankSegment[]
  allNets: { id: string; name: string }[]
  onUpdate: (u: Partial<BankConfig>) => void
}) {
  const cardOptions = computeCardOptions(bank, allNets)
  // Tarjeta recién seleccionada — se le pregunta por MODO en un popup
  const [pendingModoCard, setPendingModoCard] = useState<CardOption | null>(null)

  function updateAccount(patch: Partial<AccountInfo>) {
    onUpdate({ account: { ...config.account, ...patch } })
  }

  function toggleCard(opt: CardOption) {
    const exists = config.cards.some(c => c.key === opt.key)
    if (exists) {
      onUpdate({ cards: config.cards.filter(c => c.key !== opt.key) })
      return
    }
    onUpdate({ cards: [...config.cards, { ...opt, inModo: false }] })
    if (modoWalletId) setPendingModoCard(opt)
  }

  function answerCardModo(inModo: boolean) {
    if (!pendingModoCard) return
    const key = pendingModoCard.key
    onUpdate({ cards: config.cards.map(c => c.key === key ? { ...c, inModo } : c) })
    setPendingModoCard(null)
  }

  const creditOpts  = cardOptions.filter(o => o.cardType === 'CREDIT')
  const debitOpts   = cardOptions.filter(o => o.cardType === 'DEBIT')
  const prepaidOpts = cardOptions.filter(o => o.cardType === 'PREPAID')

  // Segmentos de programa del banco (Eminent, Selecta, etc.)
  const progSegs = allBankSegs.filter(s => s.bankId === bank.id && isStandardSegment(s.name))

  return (
    <div className="space-y-6">

      {/* ── Paquete bancario ─────────────────────────────────────────────── */}
      {subStep === 'segment' && progSegs.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">¿Qué paquete tenés?</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onUpdate({ segmentId: undefined })}
              className={`px-4 py-2 rounded-2xl text-sm font-bold border-2 transition-all ${!config.segmentId ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-500 bg-white'}`}>
              Clásica
            </button>
            {progSegs.map(seg => (
              <button key={seg.id} onClick={() => onUpdate({ segmentId: seg.id })}
                className={`px-4 py-2 rounded-2xl text-sm font-bold border-2 transition-all ${config.segmentId === seg.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-500 bg-white'}`}>
                {seg.name}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 ml-1">Aplica a todas las tarjetas de este banco.</p>
        </div>
      )}

      {/* ── ¿Tenés cuenta? ──────────────────────────────────────────────── */}
      {subStep === 'account_has' && (
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">¿Tenés cuenta en {bank.name}?</p>
        <div className="flex gap-2">
          <button onClick={() => updateAccount({ has: true })}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all ${config.account.has ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-500 bg-white'}`}>
            Sí, caja de ahorros
          </button>
          <button onClick={() => updateAccount({ ...EMPTY_ACCOUNT })}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all ${!config.account.has ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-500 bg-white'}`}>
            No, solo tarjeta
          </button>
        </div>
      </div>
      )}

      {/* ── Sueldo / Jubilación ──────────────────────────────────────────── */}
      {subStep === 'account_payroll' && (
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">¿Cobrás sueldo o jubilación en esta cuenta?</p>
        <div className="flex gap-2 flex-wrap">
          {[
            { label: '💼 Sueldo', key: 'isPayroll' as const },
            { label: '🧓 Jubilación', key: 'isPensioner' as const },
          ].map(({ label, key }) => (
            <button key={key} onClick={() => updateAccount({ [key]: !config.account[key] })}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${config.account[key] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200 bg-white text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* ── ¿Cuenta vinculada a MODO? ────────────────────────────────────── */}
      {subStep === 'account_modo' && (
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">¿Tu caja de ahorros está vinculada a MODO?</p>
        <div className="flex gap-2">
          <button onClick={() => updateAccount({ inModo: true })}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all ${config.account.inModo ? 'bg-sky-500 border-sky-500 text-white' : 'border-gray-200 text-gray-500 bg-white'}`}>
            Sí
          </button>
          <button onClick={() => updateAccount({ inModo: false })}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all ${!config.account.inModo ? 'bg-sky-500 border-sky-500 text-white' : 'border-gray-200 text-gray-500 bg-white'}`}>
            No
          </button>
        </div>
      </div>
      )}

      {/* ── ¿Tenés tarjetas? ─────────────────────────────────────────────── */}
      {subStep === 'cards_has' && (
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">¿Tenés tarjetas de {bank.name}?</p>
        <div className="flex gap-2">
          <button onClick={() => onUpdate({ wantsCards: true })}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all ${config.wantsCards ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-500 bg-white'}`}>
            Sí
          </button>
          <button onClick={() => onUpdate({ wantsCards: false, cards: [] })}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all ${!config.wantsCards ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-500 bg-white'}`}>
            No
          </button>
        </div>
      </div>
      )}

      {/* ── Tarjetas ─────────────────────────────────────────────────────── */}
      {subStep === 'cards' && [
        { label: 'Tarjetas de Crédito', opts: creditOpts },
        { label: 'Tarjetas de Débito', opts: debitOpts },
        { label: 'Prepagas', opts: prepaidOpts },
      ].map(({ label, opts }) => opts.length === 0 ? null : (
        <div key={label}>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{label}</p>
          <div className="space-y-1.5">
            {opts.map(opt => {
              const sel = config.cards.find(c => c.key === opt.key)
              return (
                <button key={opt.key} onClick={() => toggleCard(opt)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border-2 transition-all ${sel ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                  <span className="text-base">💳</span>
                  <span className="flex-1 text-left text-sm font-bold text-gray-800">{opt.label}</span>
                  {sel?.inModo && <span className="text-[9px] font-black text-sky-600 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded-full">MODO</span>}
                  <CheckBox checked={!!sel} />
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {subStep === 'cards' && creditOpts.length === 0 && debitOpts.length === 0 && prepaidOpts.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">No hay tarjetas disponibles para este banco.</p>
      )}

      {/* ── Popup: ¿esta tarjeta está en MODO? ───────────────────────────── */}
      {pendingModoCard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPendingModoCard(null)} />
          <div className="relative bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl">
            <div className="text-3xl mb-3 text-center">📱</div>
            <h3 className="font-black text-sm text-gray-900 text-center mb-2">{pendingModoCard.label}</h3>
            <p className="text-xs text-gray-500 text-center mb-5">¿Tenés esta tarjeta vinculada a MODO?</p>
            <div className="flex gap-2">
              <button onClick={() => answerCardModo(false)}
                className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50">
                No
              </button>
              <button onClick={() => answerCardModo(true)}
                className="flex-1 py-2.5 rounded-2xl bg-sky-500 text-white text-sm font-black hover:bg-sky-600">
                Sí
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PromoWizard({ open, onClose, onComplete, onAdd, initialProfile, inline, saveLabel, saving }: Props) {
  const [step, setStep] = useState(1)
  const [subStep, setSubStep] = useState(0)
  const [banks, setBanks] = useState<EntityBank[]>([])
  const [wallets, setWallets] = useState<EntityWallet[]>([])
  const [allBankSegs, setAllBankSegs] = useState<BankSegment[]>([])
  const [allNetworks, setAllNetworks] = useState<{ id: string; name: string }[]>([])
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([])
  const [bankConfigs, setBankConfigs] = useState<Record<string, BankConfig>>({})
  const [selectedWalletIds, setSelectedWalletIds] = useState<string[]>([])
  const [walletCards, setWalletCards] = useState<Record<string, WalletCardSelection[]>>({})
  const [pendingWalletCardsId, setPendingWalletCardsId] = useState<string | null>(null)
  const [pendingWalletCardSelections, setPendingWalletCardSelections] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [existingBankIds, setExistingBankIds] = useState<string[]>([])
  const [confirmEditBankId, setConfirmEditBankId] = useState<string | null>(null)
  const [expandedBankIds, setExpandedBankIds] = useState<Set<string>>(new Set())
  const [confirmModoRemoval, setConfirmModoRemoval] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setStep(1)
    setSubStep(0)
    setDone(false)
    setIsAdding(false)
    setSelectedBankIds([])
    setBankConfigs({})
    setSelectedWalletIds([])
    setWalletCards({})
    setPendingWalletCardsId(null)
    setPendingWalletCardSelections(new Set())
    fetch('/api/public/entities')
      .then(r => r.json())
      .then(data => {
        const fetchedBanks: EntityBank[] = data.banks || []
        const fetchedWallets: EntityWallet[] = data.wallets || []
        setBanks(fetchedBanks)
        setWallets(fetchedWallets)
        setAllBankSegs(data.segments || [])
        setAllNetworks(data.cardNetworks || [])

        if (initialProfile?.cards?.length) {
          const { bankIds, walletIds, configs, walletCards: restoredWalletCards } = reconstructConfigs(
            initialProfile.cards, fetchedBanks, fetchedWallets, data.cardNetworks || []
          )
          setSelectedBankIds(bankIds)
          setBankConfigs(configs)
          setSelectedWalletIds(walletIds)
          setWalletCards(restoredWalletCards)
          if (inline) setDone(true)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [open])

  if (!open) return null

  const modoWalletId = wallets.find(w => w.name.toLowerCase().includes('modo'))?.id
  const selectedBanks = banks.filter(b => selectedBankIds.includes(b.id))

  // MODO auto-seleccionado si cualquier producto bancario tiene inModo=true
  const hasAnyProductInModo = Object.values(bankConfigs).some(
    cfg => cfg.account.inModo || cfg.cards.some(c => c.inModo)
  )
  const modoEffectivelySelected = !!modoWalletId && (
    selectedWalletIds.includes(modoWalletId) || hasAnyProductInModo
  )

  function handleModoWalletClick() {
    if (!modoWalletId) return
    if (modoEffectivelySelected) {
      if (hasAnyProductInModo) {
        setConfirmModoRemoval(true)
      } else {
        setSelectedWalletIds(prev => prev.filter(id => id !== modoWalletId))
      }
    } else {
      setSelectedWalletIds(prev => [...prev, modoWalletId])
    }
  }

  function confirmRemoveModo() {
    setBankConfigs(prev => {
      const next = { ...prev }
      for (const bankId of Object.keys(next)) {
        next[bankId] = {
          ...next[bankId],
          account: { ...next[bankId].account, inModo: false },
          cards: next[bankId].cards.map(c => ({ ...c, inModo: false })),
        }
      }
      return next
    })
    setSelectedWalletIds(prev => prev.filter(id => id !== modoWalletId))
    setConfirmModoRemoval(false)
  }
  const totalSteps = 1 + selectedBanks.length + 1
  const isBankConfigStep = step >= 2 && step < 2 + selectedBanks.length
  const bankConfigIdx = step - 2
  const isWalletStep = step === 2 + selectedBanks.length
  const currentBank = isBankConfigStep ? selectedBanks[bankConfigIdx] : null
  const bankSubSteps = currentBank ? getBankSubSteps(currentBank, allBankSegs, getConfig(currentBank.id), isModoBank(currentBank.name) ? modoWalletId : undefined) : []
  const currentSubStep: BankSubStep = bankSubSteps[subStep] ?? 'account_has'
  const subStepTitles: Record<BankSubStep, string> = {
    segment: 'Paquete',
    account_has: 'Cuenta',
    account_payroll: 'Sueldo/Jubilación',
    account_modo: 'MODO',
    cards_has: 'Tarjetas',
    cards: 'Tus tarjetas',
  }

  function getConfig(bankId: string): BankConfig {
    if (bankConfigs[bankId]) return bankConfigs[bankId]
    const bank = banks.find(b => b.id === bankId)!
    return { id: bankId, name: bank?.name ?? '', logoUrl: bank?.logoUrl, account: { ...EMPTY_ACCOUNT, has: true }, wantsCards: false, cards: [] }
  }

  function updateConfig(bankId: string, update: Partial<BankConfig>) {
    const next = { ...getConfig(bankId), ...update }
    setBankConfigs(prev => ({ ...prev, [bankId]: next }))
    // Si algún producto quedó vinculado a MODO, marcar MODO como billetera seleccionada
    const nowInModo = next.account.inModo || next.cards.some(c => c.inModo)
    if (nowInModo && modoWalletId) {
      setSelectedWalletIds(prev => prev.includes(modoWalletId) ? prev : [...prev, modoWalletId])
    }
  }

  function handleNext() {
    if (step === 1) { setStep(2); setSubStep(0) }
    else if (isBankConfigStep) {
      if (subStep < bankSubSteps.length - 1) setSubStep(subStep + 1)
      else { setStep(step + 1); setSubStep(0) }
    }
    else buildAndComplete()
  }

  function handleBack() {
    if (isBankConfigStep && subStep > 0) { setSubStep(subStep - 1); return }
    const newStep = step - 1
    setStep(newStep)
    if (newStep >= 2 && newStep < 2 + selectedBanks.length) {
      const prevBank = selectedBanks[newStep - 2]
      const prevSubSteps = getBankSubSteps(prevBank, allBankSegs, getConfig(prevBank.id), isModoBank(prevBank.name) ? modoWalletId : undefined)
      setSubStep(prevSubSteps.length - 1)
    } else {
      setSubStep(0)
    }
  }

  function buildAndComplete(overrideBankIds?: string[], overrideConfigs?: Record<string, BankConfig>, overrideWalletIds?: string[]) {
    const cards: GuestCard[] = []
    const bankIds = overrideBankIds ?? selectedBankIds
    const configs = overrideConfigs ?? bankConfigs
    const walletIds = overrideWalletIds ?? selectedWalletIds

    // Si MODO está seleccionado en billeteras, aplicar a todos los productos de bancos MODO-compatibles
    const modoInWallets = modoWalletId ? walletIds.includes(modoWalletId) : false
    const modoApplied = new Set<string>() // evitar duplicados: "bankId|type|networkId"

    for (const bankId of bankIds) {
      const cfg = configs[bankId] ?? getConfig(bankId)
      const bank = banks.find(b => b.id === bankId)
      const bankSupportsModo = modoWalletId && bank && isModoBank(bank.name)

      // Cuenta (caja de ahorros)
      if (cfg.account.has) {
        cards.push({
          bankId, cardType: 'ACCOUNT',
          isPayroll: cfg.account.isPayroll,
          isPensioner: cfg.account.isPensioner,
        })
        const shouldModo = cfg.account.inModo || (modoInWallets && bankSupportsModo)
        const modoKey = `${bankId}|ACCOUNT|`
        if (shouldModo && modoWalletId && !modoApplied.has(modoKey)) {
          modoApplied.add(modoKey)
          cards.push({ bankId, walletId: modoWalletId, cardType: 'ACCOUNT' })
        }
      }

      // Tarjetas seleccionadas — heredan el segmentId del paquete del banco
      for (const card of cfg.cards) {
        cards.push({
          bankId,
          cardNetworkId: card.networkId,
          cardType: card.cardType,
          segmentId: cfg.segmentId ?? card.segmentId,
          cardSegmentId: card.cardSegmentId,
        })
        const shouldModo = card.inModo || (modoInWallets && bankSupportsModo)
        const modoKey = `${bankId}|${card.cardType}|${card.networkId}`
        if (shouldModo && modoWalletId && !modoApplied.has(modoKey)) {
          modoApplied.add(modoKey)
          cards.push({ bankId, walletId: modoWalletId, cardNetworkId: card.networkId, cardType: card.cardType })
        }
      }
    }

    // Billeteras independientes (MODO como independiente si no fue aplicado a ningún banco)
    for (const walletId of walletIds) {
      if (walletId === modoWalletId && modoApplied.size > 0) continue // ya aplicado a bancos
      cards.push({ walletId, cardType: 'CREDIT' })
      for (const wc of walletCards[walletId] ?? []) {
        cards.push({ walletId, cardNetworkId: wc.networkId, cardType: wc.cardType })
      }
    }

    const profile: GuestProfile = { cards }
    if (!inline) localStorage.setItem('guestProfile', JSON.stringify(profile))
    setDone(true)
    if (isAdding && onAdd) { setIsAdding(false); onAdd(profile) }
    else onComplete(profile)
  }

  const stepLabel = step === 1 ? 'Tus bancos'
    : isBankConfigStep ? `${currentBank?.name} · ${subStepTitles[currentSubStep]} (${subStep + 1}/${bankSubSteps.length})`
    : 'Billeteras'

  // ── Resumen colapsable ────────────────────────────────────────────────────
  const summary = done && !saving ? (() => {
    const modoLogo = wallets.find(w => w.name.toLowerCase().includes('modo'))?.logoUrl
    const ModoIcon = () => modoLogo
      ? <img src={modoLogo} className="h-3.5 w-3.5 object-contain shrink-0" title="MODO" />
      : <span className="text-[9px] font-black text-sky-600">MODO</span>

    return (
      <>
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-2xl px-3 py-2.5">
          <Check size={15} className="shrink-0" />
          <p className="text-xs font-bold">{inline ? '¡Perfil guardado!' : '¡Listo!'}</p>
        </div>

        <div className="space-y-1.5">
          <button onClick={() => {
            setExistingBankIds([...selectedBankIds])
            setIsAdding(true)
            setSelectedBankIds([])
            setBankConfigs({})
            setSelectedWalletIds([])
            setDone(false)
            setStep(1)
            setSubStep(0)
          }} className="w-full py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-black tracking-wide hover:bg-indigo-700 transition-colors">
            + Agregar Producto Financiero
          </button>

          {selectedBankIds.length > 0 && (
            <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 pt-1">Bancos y Billeteras</p>
            {selectedBankIds.map((bankId) => {
              const bank = banks.find(b => b.id === bankId)
              const cfg = getConfig(bankId)
              const isExpanded = expandedBankIds.has(bankId)
              const totalItems = (cfg.account.has ? 1 : 0) + cfg.cards.length
              return (
                <div key={bankId} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedBankIds(prev => { const n = new Set(prev); n.has(bankId) ? n.delete(bankId) : n.add(bankId); return n })}>
                    <EntityLogo logoUrl={bank?.logoUrl} name={bank?.name || ''} sm />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-black text-xs text-gray-900 truncate">{bank?.name}</p>
                      <p className="text-[10px] text-gray-400">{totalItems} producto{totalItems !== 1 ? 's' : ''}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setDone(false); setSubStep(0); setStep(2 + selectedBanks.findIndex(b => b.id === bankId)) }}
                      className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 transition-colors" title="Editar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={e => {
                      e.stopPropagation()
                      const newIds = selectedBankIds.filter(id => id !== bankId)
                      const newCfgs = { ...bankConfigs }; delete newCfgs[bankId]
                      setSelectedBankIds(newIds)
                      setBankConfigs(newCfgs)
                      if (inline) buildAndComplete(newIds, newCfgs, selectedWalletIds)
                    }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors" title="Eliminar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-gray-300 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-50 px-3 py-2 space-y-1.5">
                      {cfg.account.has && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🏦</span>
                          <span className="text-xs text-gray-600 flex-1">
                            Caja de Ahorros
                            {cfg.account.isPayroll ? ' · Sueldo' : cfg.account.isPensioner ? ' · Jubilación' : ''}
                          </span>
                          {cfg.account.inModo && <ModoIcon />}
                        </div>
                      )}
                      {cfg.cards.map(card => (
                        <div key={card.key} className="flex items-center gap-2">
                          <span className="text-sm">💳</span>
                          <span className="text-xs text-gray-600 flex-1">{card.label}</span>
                          {card.inModo && <ModoIcon />}
                        </div>
                      ))}
                      {totalItems === 0 && <p className="text-xs text-gray-400 italic">Sin productos</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        </div>

        {selectedWalletIds.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Billeteras</p>
            {selectedWalletIds.map(wid => {
              const w = wallets.find(x => x.id === wid)
              return w ? (
                <div key={wid} className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl px-3 py-2">
                  <EntityLogo logoUrl={w.logoUrl} name={w.name} sm />
                  <span className="text-xs font-bold text-gray-700 flex-1">{w.name}</span>
                  <button onClick={() => {
                    const newWids = selectedWalletIds.filter(id => id !== wid)
                    setSelectedWalletIds(newWids)
                    if (inline) buildAndComplete(selectedBankIds, bankConfigs, newWids)
                  }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              ) : null
            })}
          </div>
        )}
      </>
    )
  })() : null

  // ── Popup confirmación banco ya cargado ───────────────────────────────────
  const confirmBank = confirmEditBankId ? banks.find(b => b.id === confirmEditBankId) : null
  const confirmPopup = confirmBank ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmEditBankId(null)} />
      <div className="relative bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <EntityLogo logoUrl={confirmBank.logoUrl} name={confirmBank.name} sm />
          <p className="font-black text-sm text-gray-900">{confirmBank.name}</p>
        </div>
        <p className="text-sm text-gray-600 mb-5">Ya tenés un registro de <span className="font-bold">{confirmBank.name}</span>. ¿Querés editarlo?</p>
        <div className="flex gap-2">
          <button onClick={() => setConfirmEditBankId(null)} className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50">Cancelar</button>
          <button onClick={() => {
            setSelectedBankIds([...existingBankIds])
            const restoredConfigs: Record<string, BankConfig> = {}
            for (const bid of existingBankIds) { if (bankConfigs[bid]) restoredConfigs[bid] = bankConfigs[bid] }
            setBankConfigs(restoredConfigs)
            setIsAdding(false); setExistingBankIds([]); setConfirmEditBankId(null); setDone(false); setSubStep(0)
            const idx = existingBankIds.indexOf(confirmEditBankId!)
            setStep(2 + (idx >= 0 ? idx : 0))
          }} className="flex-1 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700">Editar</button>
        </div>
      </div>
    </div>
  ) : null

  // ── Inner (contenido sin modal wrapper) ──────────────────────────────────
  const inner = (
    <div className={inline ? 'flex flex-col' : 'relative bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden'}>

      {/* Header */}
      <div className={`flex items-center justify-between ${inline ? 'pb-4 border-b border-gray-100' : 'px-6 pt-6 pb-4 border-b border-gray-100 dark:border-slate-800'}`}>
        <div>
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">
            {done ? 'Resumen' : `Paso ${step} de ${totalSteps} — ${stepLabel}`}
          </p>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">
            {done ? 'Tu perfil financiero'
              : step === 1 ? '¿En qué banco operás?'
              : isBankConfigStep
                ? (currentSubStep === 'segment' ? `¿Qué paquete tenés en ${currentBank?.name}?`
                  : currentSubStep === 'account_has' ? `¿Tenés cuenta en ${currentBank?.name}?`
                  : currentSubStep === 'account_payroll' ? '¿Sueldo o jubilación?'
                  : currentSubStep === 'account_modo' ? '¿Vinculada a MODO?'
                  : currentSubStep === 'cards_has' ? `¿Tenés tarjetas de ${currentBank?.name}?`
                  : `¿Qué tarjetas tenés de ${currentBank?.name}?`)
              : '¿Usás billeteras?'}
          </h2>
        </div>
        {!inline && <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors shrink-0"><X size={20} /></button>}
      </div>

      {/* Body */}
      <div className={`flex-1 ${inline ? 'py-5' : 'overflow-y-auto px-6 py-5 no-scrollbar'}`}>

        {/* Resumen */}
        {done && (
          <div className="space-y-3">
            {saving ? (
              <div className="flex items-center justify-center py-10 gap-3 text-indigo-600">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="font-bold text-sm">Guardando...</span>
              </div>
            ) : summary}
          </div>
        )}

        {/* Cargando */}
        {!done && loading && <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Cargando...</div>}

        {/* Paso 1: Bancos */}
        {!done && !loading && step === 1 && (
          <div>
            <p className="text-sm text-gray-500 mb-4">Tocá los que usás. Podés elegir varios.</p>
            <div className="grid grid-cols-3 gap-2.5">
              {banks.map(bank => {
                const sel = selectedBankIds.includes(bank.id)
                const alreadyExists = isAdding && existingBankIds.includes(bank.id)
                return (
                  <button key={bank.id}
                    onClick={() => {
                      if (alreadyExists) { setConfirmEditBankId(bank.id) }
                      else if (!sel) {
                        setSelectedBankIds(prev => [...prev, bank.id])
                        if (!bankConfigs[bank.id]) {
                          setBankConfigs(prev => ({
                            ...prev,
                            [bank.id]: {
                              id: bank.id, name: bank.name, logoUrl: bank.logoUrl,
                              account: { ...EMPTY_ACCOUNT, has: true },
                              wantsCards: false,
                              cards: [],
                            }
                          }))
                        }
                      } else {
                        setSelectedBankIds(prev => prev.filter(x => x !== bank.id))
                      }
                    }}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${alreadyExists ? 'border-amber-200 bg-amber-50' : sel ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                    {sel && !alreadyExists && <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center"><Check size={10} className="text-white" /></div>}
                    {alreadyExists && <div className="absolute top-1.5 right-1.5 text-[8px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">Cargado</div>}
                    <EntityLogo logoUrl={bank.logoUrl} name={bank.name} />
                    <span className={`text-[10px] font-bold text-center leading-tight line-clamp-2 ${alreadyExists ? 'text-amber-700' : 'text-gray-700'}`}>{bank.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Pasos 2..N: config por banco */}
        {!done && !loading && isBankConfigStep && currentBank && (
          <BankProductStep
            key={currentBank.id}
            bank={currentBank}
            config={getConfig(currentBank.id)}
            subStep={currentSubStep}
            modoWalletId={isModoBank(currentBank.name) ? modoWalletId : undefined}
            allBankSegs={allBankSegs}
            allNets={allNetworks}
            onUpdate={u => updateConfig(currentBank.id, u)}
          />
        )}

        {/* Billeteras */}
        {!done && !loading && isWalletStep && (
          <div>
            <p className="text-sm text-gray-500 mb-1">Tocá las que usás o saltá si no usás ninguna.</p>
            {hasAnyProductInModo && (
              <p className="text-xs text-sky-600 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2 mb-3">
                📱 MODO se activó automáticamente porque vinculaste productos bancarios a MODO.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2.5">
              {wallets.map(wallet => {
                const isModo = wallet.id === modoWalletId
                const sel = isModo ? modoEffectivelySelected : selectedWalletIds.includes(wallet.id)
                const autoModo = isModo && hasAnyProductInModo && !selectedWalletIds.includes(wallet.id)
                const cardOpts = isModo ? [] : resolveWalletCardOptions(wallet.name, allNetworks)
                const selectedCount = walletCards[wallet.id]?.length ?? 0
                return (
                  <div key={wallet.id} className="flex flex-col gap-1">
                    <button
                      onClick={() => {
                        if (isModo) { handleModoWalletClick(); return }
                        if (sel) {
                          setSelectedWalletIds(prev => prev.filter(x => x !== wallet.id))
                          setWalletCards(prev => { const n = { ...prev }; delete n[wallet.id]; return n })
                        } else {
                          setSelectedWalletIds(prev => [...prev, wallet.id])
                          if (cardOpts.length > 0) {
                            setPendingWalletCardsId(wallet.id)
                            setPendingWalletCardSelections(new Set())
                          }
                        }
                      }}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all w-full ${sel ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                      {sel && <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center"><Check size={10} className="text-white" /></div>}
                      {autoModo && <div className="absolute top-1.5 left-1.5 text-[8px] font-black text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded-full">Auto</div>}
                      <EntityLogo logoUrl={wallet.logoUrl} name={wallet.name} />
                      <span className="text-[10px] font-bold text-gray-700 text-center leading-tight line-clamp-2">{wallet.name}</span>
                    </button>
                    {sel && cardOpts.length > 0 && (
                      <button onClick={() => {
                        setPendingWalletCardsId(wallet.id)
                        setPendingWalletCardSelections(new Set((walletCards[wallet.id] ?? []).map(c => `${c.networkId}_${c.cardType}`)))
                      }} className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 text-center">
                        💳 {selectedCount > 0 ? `${selectedCount} tarjeta${selectedCount > 1 ? 's' : ''}` : 'Agregar tarjeta'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!done && (
        <div className={`${inline ? 'pt-4' : 'px-6 pb-safe pt-4 border-t border-gray-100 dark:border-slate-800'} flex gap-3`}>
          {step > 1 && (
            <button onClick={handleBack} className="flex items-center gap-1.5 px-5 py-3.5 rounded-2xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors">
              <ChevronLeft size={16} /> Atrás
            </button>
          )}
          <button onClick={handleNext} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-sm tracking-wide hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-60">
            {isWalletStep ? <><Sparkles size={16} /> {saveLabel ?? 'Ver mis promos'}</> : <>Siguiente <ChevronRight size={16} /></>}
          </button>
        </div>
      )}
      {isWalletStep && !done && !inline && (
        <p className="text-center text-[10px] text-gray-400 pb-5 px-6">Tu perfil se guarda temporalmente. Registrate gratis para no perderlo.</p>
      )}
    </div>
  )

  const modoRemovalModal = confirmModoRemoval ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmModoRemoval(false)} />
      <div className="relative bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl">
        <div className="text-3xl mb-3 text-center">📱</div>
        <h3 className="font-black text-sm text-gray-900 text-center mb-2">¿Desvinculás MODO?</h3>
        <p className="text-xs text-gray-500 text-center mb-5">
          Tenés productos bancarios vinculados a MODO. Si confirmás, se eliminarán todos esos vínculos de tus tarjetas y cuentas.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setConfirmModoRemoval(false)}
            className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={confirmRemoveModo}
            className="flex-1 py-2.5 rounded-2xl bg-red-500 text-white text-sm font-black hover:bg-red-600">
            Desvincular
          </button>
        </div>
      </div>
    </div>
  ) : null

  // ── Popup: tarjetas propias de una billetera ──────────────────────────────
  const pendingWallet = pendingWalletCardsId ? wallets.find(w => w.id === pendingWalletCardsId) : null
  const walletCardModal = pendingWallet ? (() => {
    const opts = resolveWalletCardOptions(pendingWallet.name, allNetworks)
    function toggle(key: string) {
      setPendingWalletCardSelections(prev => {
        const n = new Set(prev)
        if (n.has(key)) n.delete(key); else n.add(key)
        return n
      })
    }
    function confirm() {
      const selected = opts
        .filter(o => pendingWalletCardSelections.has(`${o.networkId}_${o.cardType}`))
        .map(o => ({ networkId: o.networkId, cardType: o.cardType, label: o.label }))
      setWalletCards(prev => ({ ...prev, [pendingWallet!.id]: selected }))
      setPendingWalletCardsId(null)
    }
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPendingWalletCardsId(null)} />
        <div className="relative bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl">
          <div className="flex items-center gap-3 mb-3">
            <EntityLogo logoUrl={pendingWallet.logoUrl} name={pendingWallet.name} sm />
            <p className="font-black text-sm text-gray-900">{pendingWallet.name}</p>
          </div>
          <p className="text-xs text-gray-500 mb-3">¿Tenés alguna de estas tarjetas asociadas?</p>
          <div className="space-y-1.5 mb-5">
            {opts.map(o => {
              const key = `${o.networkId}_${o.cardType}`
              const checked = pendingWalletCardSelections.has(key)
              return (
                <button key={key} onClick={() => toggle(key)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border-2 transition-all ${checked ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                  <span className="text-base">💳</span>
                  <span className="flex-1 text-left text-sm font-bold text-gray-800">{o.label}</span>
                  <CheckBox checked={checked} />
                </button>
              )
            })}
          </div>
          <button onClick={confirm} className="w-full py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700">
            Listo
          </button>
        </div>
      </div>
    )
  })() : null

  if (inline) return <>{inner}{confirmPopup}{modoRemovalModal}{walletCardModal}</>

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {inner}
      {confirmPopup}
      {modoRemovalModal}
      {walletCardModal}
    </div>
  )
}
