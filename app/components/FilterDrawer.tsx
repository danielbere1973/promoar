'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Check, ChevronDown, ChevronUp, Search } from 'lucide-react'

type FilterOption = { id: string; name: string; popular?: boolean }

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
  { id: 'QR', label: '📱 QR' },
  { id: 'NFC', label: '📶 NFC' },
  { id: 'TARJETA_FISICA', label: '💳 Tarjeta física' },
  { id: 'TRANSFERENCIA', label: '💸 Transferencia' },
  { id: 'DINERO_EN_CUENTA', label: '💰 Dinero en cuenta' },
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
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
        active
          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
      }`}
    >
      {active && <Check size={11} strokeWidth={3} />}
      {label}
    </button>
  )
}

function Section({
  title, count, defaultOpen = false, children
}: { title: string; count: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 px-1 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{title}</span>
          {count > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {count}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="pb-4 space-y-2">{children}</div>}
    </div>
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

  // ── Filtrar entidades según perfil si forMe está activo ───────────────────
  const profileBankIds = new Set((userProfile?.banks ?? []).map(b => b.bankId))
  const profileWalletIds = new Set((userProfile?.wallets ?? []).map(w => w.walletId))
  const profileNetworkIds = new Set(
    (userProfile?.cards ?? []).map(c => c.cardNetworkId).filter(Boolean) as string[]
  )

  const hasProfile = profileBankIds.size > 0 || profileWalletIds.size > 0 || profileNetworkIds.size > 0

  // Si forMe Y tiene perfil → mostrar solo sus entidades primero, luego el resto
  function sortByProfile<T extends FilterOption>(items: T[], profileIds: Set<string>): { mine: T[]; others: T[] } {
    if (!forMe || !hasProfile) {
      const pop = items.filter(i => i.popular)
      const rest = items.filter(i => !i.popular)
      return { mine: pop, others: rest }
    }
    const mine = items.filter(i => profileIds.has(i.id))
    const others = items.filter(i => !profileIds.has(i.id) && i.popular)
    return { mine, others }
  }

  const { mine: myBanks, others: otherBanks } = sortByProfile(entities.banks as FilterOption[], profileBankIds)
  const { mine: myWallets, others: otherWallets } = sortByProfile(entities.wallets as FilterOption[], profileWalletIds)
  const { mine: myNetworks, others: otherNetworks } = sortByProfile(entities.cardNetworks as FilterOption[], profileNetworkIds)

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

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:justify-center lg:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-t-[40px] lg:rounded-[32px] shadow-2xl w-full max-w-lg flex flex-col animate-in slide-in-from-bottom duration-300 max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-gray-50 shrink-0">
          <div>
            <h2 className="text-xl font-black text-gray-900">Filtros</h2>
            {forMe && hasProfile && (
              <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">
                ✦ Mostrando tus entidades primero
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Secciones acordeón */}
        <div className="overflow-y-auto flex-1 px-6">

          {/* ── Bancos ── */}
          <Section title="Bancos" count={f.banks.length} defaultOpen={f.banks.length > 0}>
            {myBanks.length > 0 && (
              <>
                {forMe && hasProfile && (
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Tus bancos</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {myBanks.map(b => (
                    <Chip key={b.id} label={b.name} active={f.banks.includes(b.id)}
                      onClick={() => setF(p => ({ ...p, banks: toggle(p.banks, b.id) }))} />
                  ))}
                </div>
              </>
            )}
            {otherBanks.length > 0 && (
              <>
                {myBanks.length > 0 && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-3 mb-1">Más populares</p>}
                <div className="flex flex-wrap gap-2">
                  {otherBanks.map(b => (
                    <Chip key={b.id} label={b.name} active={f.banks.includes(b.id)}
                      onClick={() => setF(p => ({ ...p, banks: toggle(p.banks, b.id) }))} />
                  ))}
                </div>
              </>
            )}
          </Section>

          {/* ── Billeteras ── */}
          <Section title="Billeteras" count={f.wallets.length} defaultOpen={f.wallets.length > 0}>
            {myWallets.length > 0 && (
              <>
                {forMe && hasProfile && (
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Tus billeteras</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {myWallets.map(w => (
                    <Chip key={w.id} label={w.name} active={f.wallets.includes(w.id)}
                      onClick={() => setF(p => ({ ...p, wallets: toggle(p.wallets, w.id) }))} />
                  ))}
                </div>
              </>
            )}
            {otherWallets.length > 0 && (
              <>
                {myWallets.length > 0 && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-3 mb-1">Más populares</p>}
                <div className="flex flex-wrap gap-2">
                  {otherWallets.map(w => (
                    <Chip key={w.id} label={w.name} active={f.wallets.includes(w.id)}
                      onClick={() => setF(p => ({ ...p, wallets: toggle(p.wallets, w.id) }))} />
                  ))}
                </div>
              </>
            )}
          </Section>

          {/* ── Tarjetas ── */}
          <Section title="Tarjetas" count={f.networks.length} defaultOpen={f.networks.length > 0}>
            {myNetworks.length > 0 && (
              <>
                {forMe && hasProfile && (
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Tus tarjetas</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {myNetworks.map(n => (
                    <Chip key={n.id} label={n.name} active={f.networks.includes(n.id)}
                      onClick={() => setF(p => ({ ...p, networks: toggle(p.networks, n.id) }))} />
                  ))}
                </div>
              </>
            )}
            {otherNetworks.length > 0 && (
              <>
                {myNetworks.length > 0 && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-3 mb-1">Más populares</p>}
                <div className="flex flex-wrap gap-2">
                  {otherNetworks.map(n => (
                    <Chip key={n.id} label={n.name} active={f.networks.includes(n.id)}
                      onClick={() => setF(p => ({ ...p, networks: toggle(p.networks, n.id) }))} />
                  ))}
                </div>
              </>
            )}
          </Section>

          {/* ── Descuento ── */}
          <Section title="Descuento" count={f.discountRanges.length + (f.hasInstallments !== null ? 1 : 0)} defaultOpen={false}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Porcentaje de reintegro</p>
            <div className="flex flex-wrap gap-2">
              {DISCOUNT_RANGES.map(r => (
                <Chip key={r.id} label={r.label} active={f.discountRanges.includes(r.id)}
                  onClick={() => setF(p => ({ ...p, discountRanges: toggle(p.discountRanges, r.id) }))} />
              ))}
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2">Cuotas sin interés</p>
            <div className="flex gap-2">
              <Chip label="Con CSI" active={f.hasInstallments === true}
                onClick={() => setF(p => ({ ...p, hasInstallments: p.hasInstallments === true ? null : true }))} />
              <Chip label="Sin CSI" active={f.hasInstallments === false}
                onClick={() => setF(p => ({ ...p, hasInstallments: p.hasInstallments === false ? null : false }))} />
            </div>
          </Section>

          {/* ── Forma de pago ── */}
          <Section title="Forma de pago" count={f.channels.length} defaultOpen={false}>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map(c => (
                <Chip key={c.id} label={c.label} active={f.channels.includes(c.id)}
                  onClick={() => setF(p => ({ ...p, channels: toggle(p.channels, c.id) }))} />
              ))}
            </div>
          </Section>

          {/* ── Días ── */}
          <Section title="Días de aplicación" count={f.days.length} defaultOpen={false}>
            <div className="flex gap-2">
              {DIAS.map((d, i) => (
                <button key={d} onClick={() => setF(p => ({ ...p, days: toggle(p.days.map(String), String(i)).map(Number) }))}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    f.days.includes(i)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </Section>

          {/* ── Comercios ── */}
          <Section title="Comercios" count={f.commerces.length} defaultOpen={false}>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar comercio..."
                value={commerceSearch}
                onChange={e => setCommerceSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-indigo-300 outline-none transition-all"
              />
            </div>
            {!commerceSearch && (
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Top comercios</p>
            )}
            <div className="flex flex-wrap gap-2">
              {filteredCommerces.map(c => (
                <Chip key={c} label={c} active={f.commerces.includes(c)}
                  onClick={() => setF(p => ({ ...p, commerces: toggle(p.commerces, c) }))} />
              ))}
              {commerceSearch && filteredCommerces.length === 0 && (
                <p className="text-sm text-gray-400 py-2">Sin resultados para "{commerceSearch}"</p>
              )}
            </div>
          </Section>

          {/* ── Tope ── */}
          <Section title="Tope de reintegro" count={f.hasCap !== null || f.capMin !== null || f.capMax !== null ? 1 : 0} defaultOpen={false}>
            <div className="flex gap-2 mb-4">
              <Chip label="Con tope" active={f.hasCap === true}
                onClick={() => setF(p => ({ ...p, hasCap: p.hasCap === true ? null : true }))} />
              <Chip label="Sin tope" active={f.hasCap === false}
                onClick={() => setF(p => ({ ...p, hasCap: p.hasCap === false ? null : false }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 mb-1 block">Mínimo $</label>
                <input type="number" placeholder="0"
                  value={f.capMin ?? ''}
                  onChange={e => setF(p => ({ ...p, capMin: e.target.value ? parseFloat(e.target.value) : null }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 mb-1 block">Máximo $</label>
                <input type="number" placeholder="∞"
                  value={f.capMax ?? ''}
                  onChange={e => setF(p => ({ ...p, capMax: e.target.value ? parseFloat(e.target.value) : null }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:bg-white transition-all" />
              </div>
            </div>
          </Section>

          <div className="h-4" />
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-gray-50 bg-white flex gap-3 shrink-0">
          <button
            onClick={() => setF({ ...defaultFilters })}
            disabled={activeCount === 0}
            className="px-5 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            Limpiar
          </button>
          <button
            onClick={() => onApply(f)}
            className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            {activeCount > 0 ? `Aplicar (${activeCount} filtro${activeCount > 1 ? 's' : ''})` : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
