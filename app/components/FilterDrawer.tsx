'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Check, ChevronDown, ChevronUp, Search, SlidersHorizontal } from 'lucide-react'

type FilterOption = { id: string; name: string; popular?: boolean; logoUrl?: string | null }

type UserProfile = {
  banks: { bankId: string }[]
  wallets: { walletId: string }[]
  cards: { cardNetworkId: string | null }[]
} | null

type Props = {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: FilterState) => void
  currentFilters: FilterState
  forMe: boolean
  userProfile: UserProfile
  entities: {
    banks: FilterOption[]
    wallets: FilterOption[]
    cardNetworks: FilterOption[]
  }
}

export type FilterState = {
  banks: string[]
  wallets: string[]
  networks: string[]
  days: number[]
  channels: string[]
  hasCap: boolean | null
  capMin: number | null
  capMax: number | null
  capPeriods: string[]
  commerces: string[]
  discountRanges: string[]
  hasInstallments: boolean | null
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const CHANNELS = [
  { id: 'QR', label: 'QR / MODO' },
  { id: 'NFC', label: 'NFC' },
  { id: 'TARJETA_FISICA', label: 'Tarjeta física' },
  { id: 'TRANSFERENCIA', label: 'Transferencia' },
  { id: 'DINERO_EN_CUENTA', label: 'Dinero en cuenta' },
]

const DISCOUNT_RANGES = [
  { id: '0-10', label: 'Hasta 10%' },
  { id: '10-20', label: '10% – 20%' },
  { id: '20-30', label: '20% – 30%' },
  { id: '30+', label: 'Más de 30%' },
]

const defaultFilters: FilterState = {
  banks: [], wallets: [], networks: [], days: [], channels: [],
  hasCap: null, capMin: null, capMax: null, capPeriods: [],
  commerces: [], discountRanges: [], hasInstallments: null,
}

function toggle(list: string[], val: string) {
  return list.includes(val) ? list.filter(i => i !== val) : [...list, val]
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
        active
          ? 'bg-[#1D3D6E] border-[#1D3D6E] text-white shadow-sm'
          : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-[#1D3D6E]/40 hover:text-[#1D3D6E] dark:hover:border-blue-400/40 dark:hover:text-blue-300'
      }`}
    >
      {active && <Check size={10} strokeWidth={3} className="shrink-0" />}
      {label}
    </button>
  )
}

function Section({
  title, icon, count, defaultOpen = false, children
}: { title: string; icon?: string; count: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 dark:border-slate-700 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3.5 text-left group"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          <span className="text-sm font-bold text-[#0D1B2E] dark:text-white">{title}</span>
          {count > 0 && (
            <span className="bg-[#E8471C] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
              {count}
            </span>
          )}
        </div>
        <span className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <ChevronDown size={15} className="text-gray-400 dark:text-slate-500" />
        </span>
      </button>
      {open && <div className="pb-4 space-y-3">{children}</div>}
    </div>
  )
}

function GroupLabel({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${
      accent ? 'text-[#E8471C]' : 'text-gray-400 dark:text-slate-500'
    }`}>
      {children}
    </p>
  )
}

export default function FilterDrawer({ isOpen, onClose, onApply, currentFilters, entities, userProfile, forMe }: Props) {
  const [f, setF] = useState<FilterState>({ ...defaultFilters, ...currentFilters })
  const [commerceSearch, setCommerceSearch] = useState('')
  const [commerces, setCommerces] = useState<string[]>([])
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setF({ ...defaultFilters, ...currentFilters })
    setCommerceSearch('')
    fetch('/api/public/commerces')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.commerces) setCommerces(data.commerces.map((c: any) => c.name)) })
      .catch(() => {})
  }, [isOpen])

  if (!isOpen) return null

  const profileBankIds = new Set((userProfile?.banks ?? []).map(b => b.bankId))
  const profileWalletIds = new Set((userProfile?.wallets ?? []).map(w => w.walletId))
  const profileNetworkIds = new Set(
    (userProfile?.cards ?? []).map(c => c.cardNetworkId).filter(Boolean) as string[]
  )
  const hasProfile = profileBankIds.size > 0 || profileWalletIds.size > 0 || profileNetworkIds.size > 0

  function sortByProfile<T extends FilterOption>(items: T[], profileIds: Set<string>): { mine: T[]; others: T[] } {
    if (!forMe || !hasProfile) {
      return { mine: items.filter(i => i.popular), others: items.filter(i => !i.popular) }
    }
    return {
      mine: items.filter(i => profileIds.has(i.id)),
      others: items.filter(i => !profileIds.has(i.id) && i.popular),
    }
  }

  const { mine: myBanks, others: otherBanks } = sortByProfile(entities.banks, profileBankIds)
  const { mine: myWallets, others: otherWallets } = sortByProfile(entities.wallets, profileWalletIds)
  const { mine: myNetworks, others: otherNetworks } = sortByProfile(entities.cardNetworks, profileNetworkIds)

  const activeCount = (
    f.banks.length + f.wallets.length + f.networks.length +
    f.days.length + f.channels.length + f.discountRanges.length +
    f.commerces.length +
    (f.hasCap !== null ? 1 : 0) +
    (f.hasInstallments !== null ? 1 : 0)
  )

  const filteredCommerces = commerceSearch.trim()
    ? commerces.filter(c => c.toLowerCase().includes(commerceSearch.toLowerCase()))
    : commerces.slice(0, 12)

  function EntityChips({ items, selected, onToggle }: { items: FilterOption[]; selected: string[]; onToggle: (id: string) => void }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
              selected.includes(item.id)
                ? 'bg-[#1D3D6E] border-[#1D3D6E] text-white shadow-sm'
                : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-[#1D3D6E]/40 hover:text-[#1D3D6E] dark:hover:border-blue-400/40 dark:hover:text-blue-300'
            }`}
          >
            {item.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.logoUrl} alt="" className="w-4 h-4 object-contain rounded-sm shrink-0" />
            )}
            {selected.includes(item.id) && !item.logoUrl && <Check size={10} strokeWidth={3} className="shrink-0" />}
            {item.name}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:justify-center lg:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-[#0F1E35] rounded-t-[32px] lg:rounded-[28px] shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]"
        style={{ animation: 'modalIn 0.22s ease-out' }}>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-1 rounded-full bg-[#E8471C] opacity-50" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-2 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1D3D6E] flex items-center justify-center shrink-0">
              <SlidersHorizontal size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#0D1B2E] dark:text-white leading-tight">Filtros</h2>
              {forMe && hasProfile && (
                <p className="text-[10px] text-[#E8471C] font-bold leading-none mt-0.5">
                  ✦ Tus entidades primero
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Secciones */}
        <div className="overflow-y-auto flex-1 px-6">

          {/* ── Bancos ── */}
          <Section title="Bancos" icon="🏦" count={f.banks.length} defaultOpen={f.banks.length > 0}>
            {myBanks.length > 0 && (
              <>
                {forMe && hasProfile && <GroupLabel accent>Tus bancos</GroupLabel>}
                <EntityChips items={myBanks} selected={f.banks}
                  onToggle={id => setF(p => ({ ...p, banks: toggle(p.banks, id) }))} />
              </>
            )}
            {otherBanks.length > 0 && (
              <>
                {myBanks.length > 0 && <GroupLabel>Más populares</GroupLabel>}
                <EntityChips items={otherBanks} selected={f.banks}
                  onToggle={id => setF(p => ({ ...p, banks: toggle(p.banks, id) }))} />
              </>
            )}
          </Section>

          {/* ── Billeteras ── */}
          <Section title="Billeteras" icon="📱" count={f.wallets.length} defaultOpen={f.wallets.length > 0}>
            {myWallets.length > 0 && (
              <>
                {forMe && hasProfile && <GroupLabel accent>Tus billeteras</GroupLabel>}
                <EntityChips items={myWallets} selected={f.wallets}
                  onToggle={id => setF(p => ({ ...p, wallets: toggle(p.wallets, id) }))} />
              </>
            )}
            {otherWallets.length > 0 && (
              <>
                {myWallets.length > 0 && <GroupLabel>Más populares</GroupLabel>}
                <EntityChips items={otherWallets} selected={f.wallets}
                  onToggle={id => setF(p => ({ ...p, wallets: toggle(p.wallets, id) }))} />
              </>
            )}
          </Section>

          {/* ── Tarjetas ── */}
          <Section title="Tarjetas" icon="💳" count={f.networks.length} defaultOpen={f.networks.length > 0}>
            {myNetworks.length > 0 && (
              <>
                {forMe && hasProfile && <GroupLabel accent>Tus tarjetas</GroupLabel>}
                <EntityChips items={myNetworks} selected={f.networks}
                  onToggle={id => setF(p => ({ ...p, networks: toggle(p.networks, id) }))} />
              </>
            )}
            {otherNetworks.length > 0 && (
              <>
                {myNetworks.length > 0 && <GroupLabel>Más populares</GroupLabel>}
                <EntityChips items={otherNetworks} selected={f.networks}
                  onToggle={id => setF(p => ({ ...p, networks: toggle(p.networks, id) }))} />
              </>
            )}
          </Section>

          {/* ── Descuento ── */}
          <Section title="Descuento" icon="%" count={f.discountRanges.length + (f.hasInstallments !== null ? 1 : 0)} defaultOpen={false}>
            <GroupLabel>Porcentaje de reintegro</GroupLabel>
            <div className="flex flex-wrap gap-1.5">
              {DISCOUNT_RANGES.map(r => (
                <Chip key={r.id} label={r.label} active={f.discountRanges.includes(r.id)}
                  onClick={() => setF(p => ({ ...p, discountRanges: toggle(p.discountRanges, r.id) }))} />
              ))}
            </div>
            <GroupLabel>Cuotas sin interés</GroupLabel>
            <div className="flex gap-1.5">
              <Chip label="Con CSI" active={f.hasInstallments === true}
                onClick={() => setF(p => ({ ...p, hasInstallments: p.hasInstallments === true ? null : true }))} />
              <Chip label="Sin CSI" active={f.hasInstallments === false}
                onClick={() => setF(p => ({ ...p, hasInstallments: p.hasInstallments === false ? null : false }))} />
            </div>
          </Section>

          {/* ── Forma de pago ── */}
          <Section title="Forma de pago" icon="⚡" count={f.channels.length} defaultOpen={false}>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map(c => (
                <Chip key={c.id} label={c.label} active={f.channels.includes(c.id)}
                  onClick={() => setF(p => ({ ...p, channels: toggle(p.channels, c.id) }))} />
              ))}
            </div>
          </Section>

          {/* ── Días ── */}
          <Section title="Días" icon="📅" count={f.days.length} defaultOpen={false}>
            <div className="flex rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-600 divide-x divide-gray-200 dark:divide-slate-600">
              {DIAS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => setF(p => ({ ...p, days: toggle(p.days.map(String), String(i)).map(Number) }))}
                  className={`flex-1 py-2.5 text-[11px] font-black transition-colors ${
                    f.days.includes(i)
                      ? 'bg-[#1D3D6E] text-white'
                      : 'bg-white dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-600'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Section>

          {/* ── Comercios ── */}
          <Section title="Comercios" icon="🏪" count={f.commerces.length} defaultOpen={false}>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar comercio..."
                value={commerceSearch}
                onChange={e => setCommerceSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:bg-white dark:focus:bg-slate-600 focus:border-[#1D3D6E] dark:focus:border-blue-400 outline-none transition-all dark:text-white"
              />
            </div>
            {!commerceSearch && <GroupLabel>Top comercios</GroupLabel>}
            <div className="flex flex-wrap gap-1.5">
              {filteredCommerces.map(c => (
                <Chip key={c} label={c} active={f.commerces.includes(c)}
                  onClick={() => setF(p => ({ ...p, commerces: toggle(p.commerces, c) }))} />
              ))}
              {commerceSearch && filteredCommerces.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-slate-500 py-2">Sin resultados para &ldquo;{commerceSearch}&rdquo;</p>
              )}
            </div>
          </Section>

          {/* ── Tope ── */}
          <Section title="Tope de reintegro" icon="🔝" count={f.hasCap !== null || f.capMin !== null || f.capMax !== null ? 1 : 0} defaultOpen={false}>
            <div className="flex gap-1.5 mb-4">
              <Chip label="Con tope" active={f.hasCap === true}
                onClick={() => setF(p => ({ ...p, hasCap: p.hasCap === true ? null : true }))} />
              <Chip label="Sin tope" active={f.hasCap === false}
                onClick={() => setF(p => ({ ...p, hasCap: p.hasCap === false ? null : false }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">Mínimo $</label>
                <input type="number" placeholder="0"
                  value={f.capMin ?? ''}
                  onChange={e => setF(p => ({ ...p, capMin: e.target.value ? parseFloat(e.target.value) : null }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1D3D6E] dark:focus:border-blue-400 focus:bg-white dark:text-white transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-1.5 block">Máximo $</label>
                <input type="number" placeholder="∞"
                  value={f.capMax ?? ''}
                  onChange={e => setF(p => ({ ...p, capMax: e.target.value ? parseFloat(e.target.value) : null }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1D3D6E] dark:focus:border-blue-400 focus:bg-white dark:text-white transition-all" />
              </div>
            </div>
          </Section>

          <div className="h-4" />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-[#0F1E35] flex gap-3 shrink-0">
          <button
            onClick={() => setF({ ...defaultFilters })}
            disabled={activeCount === 0}
            className="px-5 py-3 rounded-2xl border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 font-bold text-sm hover:border-[#E8471C] hover:text-[#E8471C] transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            Limpiar
          </button>
          <button
            onClick={() => onApply(f)}
            className="flex-1 py-3 rounded-2xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #1D3D6E 0%, #2A5298 100%)' }}
          >
            {activeCount > 0
              ? <>Aplicar <span className="bg-[#E8471C] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{activeCount}</span></>
              : 'Ver promos'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
