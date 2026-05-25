'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Check, Sparkles, Plus, Trash2 } from 'lucide-react'

// ── Tipos de entidades externas ──────────────────────────────────────────────
type BankSegment = { id: string; name: string; bankId: string }
type EntityBank = {
  id: string; name: string; logoUrl?: string | null
  cardNetworks: { id: string; name: string }[]
  cardSegments: { id: string; name: string; cardNetworkId: string; cardType: string }[]
}
type EntityWallet = { id: string; name: string; logoUrl?: string | null }

// ── Tipos internos del wizard ─────────────────────────────────────────────────
type AccountEntry = {
  localId: string
  type: 'CA' | 'CC'
  currency: 'ARS' | 'USD'
  lastFive: string
  cbu: string
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

type SelectedCard = CardOption & { inModo: boolean; firstSix: string; lastFour: string }

type BankConfig = {
  id: string
  name: string
  logoUrl?: string | null
  segmentId?: string   // paquete bancario (Eminent, Selecta) — aplica a todas las tarjetas
  accounts: AccountEntry[]
  cards: SelectedCard[]
}

// ── Tipos exportables ─────────────────────────────────────────────────────────
export type GuestCard = {
  bankId?: string
  walletId?: string
  cardNetworkId?: string
  cardType: 'CREDIT' | 'DEBIT' | 'ACCOUNT' | 'PREPAID'
  segmentId?: string
  cardSegmentId?: string
  bankAccountType?: string
  currency?: string
  accountNumber?: string
  cbu?: string
  firstSix?: string
  lastFour?: string
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

// Usa las redes del banco + mapa estático para las opciones por red
function computeCardOptions(bank: EntityBank, allNetworks: { id: string; name: string }[]): CardOption[] {
  const opts: CardOption[] = []

  // Usar las redes del banco si tiene, si no usar todas las estándar como fallback
  const nets = bank.cardNetworks.length > 0 ? bank.cardNetworks : allNetworks

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

// ── Reconstruye BankConfig desde GuestCards ───────────────────────────────────
function reconstructConfigs(
  cards: GuestCard[],
  banks: EntityBank[],
  wallets: EntityWallet[],
  allNets: { id: string; name: string }[]
): { bankIds: string[]; walletIds: string[]; configs: Record<string, BankConfig> } {
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

    // Cuentas — incluir las que tienen walletId (MODO) como cuentas con inModo=true
    const pureAccounts = bankCards.filter(c => c.cardType === 'ACCOUNT' && !c.walletId)
    const modoAccounts = bankCards.filter(c => c.cardType === 'ACCOUNT' && c.walletId === modoId)
    // Usar cuentas puras si existen, sino usar las MODO como base
    const accountCards = pureAccounts.length > 0 ? pureAccounts : modoAccounts
    const hasModo = modoAccounts.length > 0
    const accounts: AccountEntry[] = accountCards.map((c, i) => ({
      localId: `restored_${i}`,
      type: (c.bankAccountType as 'CA' | 'CC') ?? 'CA',
      currency: (c.currency as 'ARS' | 'USD') ?? 'ARS',
      lastFive: c.accountNumber ?? '',
      cbu: c.cbu ?? '',
      isPayroll: c.isPayroll ?? false,
      isPensioner: c.isPensioner ?? false,
      inModo: hasModo,
    }))

    // Tarjetas seleccionadas
    const selectedCards: SelectedCard[] = []
    for (const c of bankCards.filter(bc => bc.cardType !== 'ACCOUNT' && !bc.walletId)) {
      const opt = opts.find(o =>
        o.networkId === c.cardNetworkId &&
        o.cardType === (c.cardType as any) &&
        (o.segmentId ?? null) === (c.segmentId ?? null) &&
        (o.cardSegmentId ?? null) === (c.cardSegmentId ?? null)
      )
      if (opt) {
        const modoLinked = bankCards.some(bc =>
          bc.walletId === modoId && bc.cardNetworkId === c.cardNetworkId && bc.cardType === c.cardType
        )
        selectedCards.push({ ...opt, inModo: modoLinked, firstSix: '', lastFour: '' })
      }
    }

    // Restaurar segmentId del paquete desde cualquier tarjeta que lo tenga
    const restoredSegmentId = bankCards.find(c => c.segmentId && c.cardType !== 'ACCOUNT')?.segmentId

    configs[bankId] = {
      id: bankId, name: bank?.name ?? '', logoUrl: bank?.logoUrl,
      segmentId: restoredSegmentId,
      accounts, cards: selectedCards,
    }
  }

  return { bankIds: Array.from(bankIdSet), walletIds: Array.from(walletIdSet), configs }
}

// ── Paso: configuración de un banco ──────────────────────────────────────────
function BankProductStep({
  bank, config, modoWalletId, allBankSegs, allNets, onUpdate,
}: {
  bank: EntityBank
  config: BankConfig
  modoWalletId: string | undefined
  allBankSegs: BankSegment[]
  allNets: { id: string; name: string }[]
  onUpdate: (u: Partial<BankConfig>) => void
}) {
  const cardOptions = computeCardOptions(bank, allNets)

  function addAccount() {
    const newAcc: AccountEntry = {
      localId: Date.now().toString(),
      type: 'CA', currency: 'ARS', lastFive: '', cbu: '',
      isPayroll: false, isPensioner: false, inModo: false,
    }
    onUpdate({ accounts: [...config.accounts, newAcc] })
  }

  function updateAccount(localId: string, patch: Partial<AccountEntry>) {
    onUpdate({ accounts: config.accounts.map(a => a.localId === localId ? { ...a, ...patch } : a) })
  }

  function removeAccount(localId: string) {
    onUpdate({ accounts: config.accounts.filter(a => a.localId !== localId) })
  }

  function toggleCard(opt: CardOption) {
    const exists = config.cards.some(c => c.key === opt.key)
    onUpdate({
      cards: exists
        ? config.cards.filter(c => c.key !== opt.key)
        : [...config.cards, { ...opt, inModo: false, firstSix: '', lastFour: '' }],
    })
  }

  function toggleCardModo(key: string) {
    onUpdate({ cards: config.cards.map(c => c.key === key ? { ...c, inModo: !c.inModo } : c) })
  }

  function updateCard(key: string, patch: Partial<SelectedCard>) {
    onUpdate({ cards: config.cards.map(c => c.key === key ? { ...c, ...patch } : c) })
  }

  const creditOpts  = cardOptions.filter(o => o.cardType === 'CREDIT')
  const debitOpts   = cardOptions.filter(o => o.cardType === 'DEBIT')
  const prepaidOpts = cardOptions.filter(o => o.cardType === 'PREPAID')

  // Segmentos de programa del banco (Eminent, Selecta, etc.)
  const progSegs = allBankSegs.filter(s => s.bankId === bank.id && isStandardSegment(s.name))

  return (
    <div className="space-y-6">

      {/* ── Paquete bancario ─────────────────────────────────────────────── */}
      {progSegs.length > 0 && (
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

      {/* ── Cuentas ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cuentas bancarias</p>
          <button onClick={addAccount} className="flex items-center gap-1 text-[10px] font-black text-indigo-500 hover:text-indigo-700">
            <Plus size={12} /> Agregar cuenta
          </button>
        </div>

        {config.accounts.length === 0 && (
          <button onClick={addAccount} className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-4 text-xs text-gray-400 font-bold hover:border-indigo-300 hover:text-indigo-400 transition-colors">
            + Agregar cuenta en este banco
          </button>
        )}

        <div className="space-y-3">
          {config.accounts.map(acc => (
            <div key={acc.localId} className="bg-gray-50 border border-gray-100 rounded-2xl p-3 space-y-2.5">
              {/* Tipo + Moneda */}
              <div className="flex gap-2">
                <div className="flex gap-1 flex-1">
                  {(['CA', 'CC'] as const).map(t => (
                    <button key={t} onClick={() => updateAccount(acc.localId, { type: t })}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${acc.type === t ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-200 bg-white text-gray-500'}`}>
                      {t === 'CA' ? 'Caja de Ahorros' : 'Cta. Corriente'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {(['ARS', 'USD'] as const).map(c => (
                    <button key={c} onClick={() => updateAccount(acc.localId, { currency: c })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${acc.currency === c ? 'bg-gray-800 border-gray-800 text-white' : 'border-gray-200 bg-white text-gray-500'}`}>
                      {c === 'ARS' ? '$' : 'U$D'}
                    </button>
                  ))}
                </div>
                <button onClick={() => removeAccount(acc.localId)} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Número (últimos 5) y CBU */}
              <div className="flex gap-2">
                <input type="text" maxLength={5} placeholder="Últimos 5 (opc.)"
                  value={acc.lastFive}
                  onChange={e => updateAccount(acc.localId, { lastFive: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                  className="flex-1 bg-white border border-gray-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-indigo-300" />
                <input type="text" maxLength={22} placeholder="CBU (opc.)"
                  value={acc.cbu}
                  onChange={e => updateAccount(acc.localId, { cbu: e.target.value.replace(/\D/g, '').slice(0, 22) })}
                  className="flex-1 bg-white border border-gray-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-indigo-300" />
              </div>

              {/* Sueldo / Jubilación */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: '💼 Sueldo', key: 'isPayroll' as const },
                  { label: '🧓 Jubilación', key: 'isPensioner' as const },
                ].map(({ label, key }) => (
                  <button key={key} onClick={() => updateAccount(acc.localId, { [key]: !acc[key] })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${acc[key] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200 bg-white text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* MODO para la cuenta */}
              {modoWalletId && (
                <button onClick={() => updateAccount(acc.localId, { inModo: !acc.inModo })}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border-2 transition-all ${acc.inModo ? 'border-sky-400 bg-sky-50' : 'border-gray-100 bg-white'}`}>
                  <span className={`text-xs font-bold ${acc.inModo ? 'text-sky-700' : 'text-gray-500'}`}>📱 ¿Está vinculada a MODO?</span>
                  <CheckBox checked={acc.inModo} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Tarjetas ─────────────────────────────────────────────────────── */}
      {[
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
                <div key={opt.key}>
                  <button onClick={() => toggleCard(opt)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border-2 transition-all ${sel ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                    <span className="text-base">💳</span>
                    <span className="flex-1 text-left text-sm font-bold text-gray-800">{opt.label}</span>
                    <CheckBox checked={!!sel} />
                  </button>
                  {sel && (
                    <div className="ml-4 mt-1 space-y-1.5">
                      {/* Primeros 6 y últimos 4 dígitos (opcional) */}
                      <div className="flex gap-2">
                        <input type="text" maxLength={6} placeholder="Primeros 6 (opc.)"
                          value={sel.firstSix}
                          onChange={e => updateCard(opt.key, { firstSix: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                          className="flex-1 bg-white border border-gray-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-indigo-300" />
                        <input type="text" maxLength={4} placeholder="Últimos 4 (opc.)"
                          value={sel.lastFour}
                          onChange={e => updateCard(opt.key, { lastFour: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          className="flex-1 bg-white border border-gray-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-indigo-300" />
                      </div>
                      {modoWalletId && (
                        <button onClick={() => toggleCardModo(opt.key)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border-2 transition-all ${sel.inModo ? 'border-sky-400 bg-sky-50' : 'border-gray-100 bg-white'}`}>
                          <span className={`text-xs font-bold ${sel.inModo ? 'text-sky-700' : 'text-gray-500'}`}>📱 ¿Está en MODO?</span>
                          <CheckBox checked={sel.inModo} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PromoWizard({ open, onClose, onComplete, onAdd, initialProfile, inline, saveLabel, saving }: Props) {
  const [step, setStep] = useState(1)
  const [banks, setBanks] = useState<EntityBank[]>([])
  const [wallets, setWallets] = useState<EntityWallet[]>([])
  const [allBankSegs, setAllBankSegs] = useState<BankSegment[]>([])
  const [allNetworks, setAllNetworks] = useState<{ id: string; name: string }[]>([])
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([])
  const [bankConfigs, setBankConfigs] = useState<Record<string, BankConfig>>({})
  const [selectedWalletIds, setSelectedWalletIds] = useState<string[]>([])
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
    setDone(false)
    setIsAdding(false)
    setSelectedBankIds([])
    setBankConfigs({})
    setSelectedWalletIds([])
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
          const { bankIds, walletIds, configs } = reconstructConfigs(
            initialProfile.cards, fetchedBanks, fetchedWallets, data.cardNetworks || []
          )
          setSelectedBankIds(bankIds)
          setBankConfigs(configs)
          setSelectedWalletIds(walletIds)
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
    cfg => cfg.accounts.some(a => a.inModo) || cfg.cards.some(c => c.inModo)
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
          accounts: next[bankId].accounts.map(a => ({ ...a, inModo: false })),
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

  function getConfig(bankId: string): BankConfig {
    if (bankConfigs[bankId]) return bankConfigs[bankId]
    const bank = banks.find(b => b.id === bankId)!
    return { id: bankId, name: bank?.name ?? '', logoUrl: bank?.logoUrl, accounts: [], cards: [] }
  }

  function updateConfig(bankId: string, update: Partial<BankConfig>) {
    setBankConfigs(prev => ({ ...prev, [bankId]: { ...getConfig(bankId), ...update } }))
  }

  function handleNext() {
    if (step === 1) setStep(2)
    else if (isBankConfigStep) setStep(step + 1)
    else buildAndComplete()
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

      // Cuentas
      for (const acc of cfg.accounts) {
        cards.push({
          bankId, cardType: 'ACCOUNT',
          bankAccountType: acc.type,
          currency: acc.currency,
          accountNumber: acc.lastFive || undefined,
          cbu: acc.cbu || undefined,
          isPayroll: acc.isPayroll,
          isPensioner: acc.isPensioner,
        })
        const shouldModo = acc.inModo || (modoInWallets && bankSupportsModo)
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
          firstSix: card.firstSix || undefined,
          lastFour: card.lastFour || undefined,
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
    }

    const profile: GuestProfile = { cards }
    if (!inline) localStorage.setItem('guestProfile', JSON.stringify(profile))
    setDone(true)
    if (isAdding && onAdd) { setIsAdding(false); onAdd(profile) }
    else onComplete(profile)
  }

  const stepLabel = step === 1 ? 'Tus bancos' : isBankConfigStep ? currentBank?.name : 'Billeteras'

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
              const totalItems = cfg.accounts.length + cfg.cards.length
              return (
                <div key={bankId} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedBankIds(prev => { const n = new Set(prev); n.has(bankId) ? n.delete(bankId) : n.add(bankId); return n })}>
                    <EntityLogo logoUrl={bank?.logoUrl} name={bank?.name || ''} sm />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-black text-xs text-gray-900 truncate">{bank?.name}</p>
                      <p className="text-[10px] text-gray-400">{totalItems} producto{totalItems !== 1 ? 's' : ''}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setDone(false); setStep(2 + selectedBanks.findIndex(b => b.id === bankId)) }}
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
                      {cfg.accounts.map((acc, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-sm">🏦</span>
                          <span className="text-xs text-gray-600 flex-1">
                            {acc.type === 'CC' ? 'Cta. Corriente' : 'Caja de Ahorros'} {acc.currency === 'USD' ? 'USD' : '$'}
                            {acc.isPayroll ? ' · Sueldo' : acc.isPensioner ? ' · Jubilación' : ''}
                            {acc.lastFive ? ` · ···${acc.lastFive}` : ''}
                          </span>
                          {acc.inModo && <ModoIcon />}
                        </div>
                      ))}
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
            setIsAdding(false); setExistingBankIds([]); setConfirmEditBankId(null); setDone(false)
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
            {done ? 'Tu perfil financiero' : step === 1 ? '¿En qué banco operás?' : isBankConfigStep ? `¿Qué tenés en ${currentBank?.name}?` : '¿Usás billeteras?'}
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
                              accounts: [{
                                localId: `default_${Date.now()}`,
                                type: 'CA' as const, currency: 'ARS' as const,
                                lastFive: '', cbu: '',
                                isPayroll: false, isPensioner: false, inModo: false,
                              }],
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
            bank={currentBank}
            config={getConfig(currentBank.id)}
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
                return (
                  <button key={wallet.id}
                    onClick={() => isModo
                      ? handleModoWalletClick()
                      : setSelectedWalletIds(prev => sel ? prev.filter(x => x !== wallet.id) : [...prev, wallet.id])
                    }
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${sel ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                    {sel && <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center"><Check size={10} className="text-white" /></div>}
                    {autoModo && <div className="absolute top-1.5 left-1.5 text-[8px] font-black text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded-full">Auto</div>}
                    <EntityLogo logoUrl={wallet.logoUrl} name={wallet.name} />
                    <span className="text-[10px] font-bold text-gray-700 text-center leading-tight line-clamp-2">{wallet.name}</span>
                  </button>
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
            <button onClick={() => setStep(step - 1)} className="flex items-center gap-1.5 px-5 py-3.5 rounded-2xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors">
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

  if (inline) return <>{inner}{confirmPopup}{modoRemovalModal}</>

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {inner}
      {confirmPopup}
      {modoRemovalModal}
    </div>
  )
}
