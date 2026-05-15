'use client'
import { useState, useEffect } from 'react'
import { X, Check, Building2, CreditCard, Calendar, Smartphone, Tag, RefreshCcw, Store, Percent, Receipt } from 'lucide-react'

type FilterOption = { id: string; name: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: FilterState) => void
  currentFilters: FilterState
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
  // NUEVOS FILTROS
  commerces: string[]
  discountRanges: string[]
  hasInstallments: boolean | null
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const CHANNELS = [
  { id: 'QR', label: 'QR', icon: Smartphone },
  { id: 'NFC', label: 'NFC', icon: Smartphone },
  { id: 'TARJETA_FISICA', label: 'Físico', icon: CreditCard },
]
const PERIODS = [
  { id: 'DAILY', label: 'Diario' },
  { id: 'WEEKLY', label: 'Semanal' },
  { id: 'MONTHLY', label: 'Mensual' },
  { id: 'PER_TRANSACTION', label: 'Por Trx' },
]

// NUEVO: Rangos de descuento
const DISCOUNT_RANGES = [
  { id: '0-10', label: '0-10%' },
  { id: '10-20', label: '10-20%' },
  { id: '20-30', label: '20-30%' },
  { id: '30+', label: '30% o más' },
]

export default function FilterDrawer({ isOpen, onClose, onApply, currentFilters, entities }: Props) {
  const [localFilters, setLocalFilters] = useState<FilterState>(currentFilters)
  const [commerces, setCommerces] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      setLocalFilters(currentFilters)
      
      // Fetch comercios únicos
      fetch('/api/promos')
        .then(r => {
          if (!r.ok) throw new Error('Failed to fetch')
          return r.json()
        })
        .then(data => {
          const uniqueCommerces = Array.from(
            new Set(data.promos?.map((p: any) => p.commerce.name) || [])
          ).sort() as string[]
          setCommerces(uniqueCommerces)
        })
        .catch(err => {
          console.error('Error loading commerces:', err)
          setCommerces([])
        })
    }
  }, [isOpen, currentFilters])

  if (!isOpen) return null

  const toggle = (list: any[], val: any) => 
    list.includes(val) ? list.filter(i => i !== val) : [...list, val]

  const Section = ({ title, icon: Icon, children }: any) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon size={16} className="text-gray-400" />
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  )

  const Chip = ({ active, label, onClick }: any) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
        active 
          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' 
          : 'bg-white border-gray-100 text-gray-500 hover:border-gray-300'
      }`}
    >
      {active && <Check size={12} strokeWidth={3} />}
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:justify-center lg:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white rounded-t-[40px] lg:rounded-[32px] shadow-2xl w-full max-w-lg lg:max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-50">
          <h2 className="text-xl font-black text-gray-900">Filtrar Promos</h2>
          <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* NUEVO: Filtro de Comercios */}
          <Section title="Comercios" icon={Store}>
            <div className="w-full max-h-40 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50">
              <div className="flex flex-wrap gap-1.5">
                {commerces.map(c => (
                  <Chip 
                    key={c} 
                    label={c} 
                    active={localFilters.commerces.includes(c)} 
                    onClick={() => setLocalFilters(f => ({ ...f, commerces: toggle(f.commerces, c) }))} 
                  />
                ))}
              </div>
            </div>
          </Section>

          {/* NUEVO: Filtro de Rango de Descuento */}
          <Section title="Rango de Descuento" icon={Percent}>
            {DISCOUNT_RANGES.map(r => (
              <Chip 
                key={r.id} 
                label={r.label} 
                active={localFilters.discountRanges.includes(r.id)} 
                onClick={() => setLocalFilters(f => ({ ...f, discountRanges: toggle(f.discountRanges, r.id) }))} 
              />
            ))}
          </Section>

          {/* NUEVO: Filtro de Cuotas Sin Interés */}
          <Section title="Financiación" icon={Receipt}>
            <Chip 
              label="Con Cuotas Sin Interés" 
              active={localFilters.hasInstallments === true} 
              onClick={() => setLocalFilters(f => ({ ...f, hasInstallments: f.hasInstallments === true ? null : true }))} 
            />
            <Chip 
              label="Sin Cuotas" 
              active={localFilters.hasInstallments === false} 
              onClick={() => setLocalFilters(f => ({ ...f, hasInstallments: f.hasInstallments === false ? null : false }))} 
            />
          </Section>
          
          <Section title="Entidades Financieras" icon={Building2}>
            {entities.banks.map(b => (
              <Chip 
                key={b.id} 
                label={b.name} 
                active={localFilters.banks.includes(b.id)} 
                onClick={() => setLocalFilters(f => ({ ...f, banks: toggle(f.banks, b.id) }))} 
              />
            ))}
            {entities.wallets.map(w => (
              <Chip 
                key={w.id} 
                label={w.name} 
                active={localFilters.wallets.includes(w.id)} 
                onClick={() => setLocalFilters(f => ({ ...f, wallets: toggle(f.wallets, w.id) }))} 
              />
            ))}
          </Section>

          <Section title="Tarjetas / Redes" icon={CreditCard}>
            {entities.cardNetworks.map(cn => (
              <Chip 
                key={cn.id} 
                label={cn.name} 
                active={localFilters.networks.includes(cn.id)} 
                onClick={() => setLocalFilters(f => ({ ...f, networks: toggle(f.networks, cn.id) }))} 
              />
            ))}
          </Section>

          <Section title="Días de Aplicación" icon={Calendar}>
            {DIAS.map((d, i) => (
              <Chip 
                key={d} 
                label={d} 
                active={localFilters.days.includes(i)} 
                onClick={() => setLocalFilters(f => ({ ...f, days: toggle(f.days, i) }))} 
              />
            ))}
          </Section>

          <Section title="Modalidad de Pago" icon={Smartphone}>
            {CHANNELS.map(c => (
              <Chip 
                key={c.id} 
                label={c.label} 
                active={localFilters.channels.includes(c.id)} 
                onClick={() => setLocalFilters(f => ({ ...f, channels: toggle(f.channels, c.id) }))} 
              />
            ))}
          </Section>

          <Section title="Renovación del Reintegro" icon={RefreshCcw}>
            {PERIODS.map(p => (
              <Chip 
                key={p.id} 
                label={p.label} 
                active={localFilters.capPeriods.includes(p.id)} 
                onClick={() => setLocalFilters(f => ({ ...f, capPeriods: toggle(f.capPeriods, p.id) }))} 
              />
            ))}
          </Section>

          <Section title="Topes" icon={Tag}>
            <div className="w-full space-y-4">
              <div className="flex gap-2">
                <Chip 
                  label="Con Tope" 
                  active={localFilters.hasCap === true} 
                  onClick={() => setLocalFilters(f => ({ ...f, hasCap: f.hasCap === true ? null : true }))} 
                />
                <Chip 
                  label="Sin Tope" 
                  active={localFilters.hasCap === false} 
                  onClick={() => setLocalFilters(f => ({ ...f, hasCap: f.hasCap === false ? null : false }))} 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Monto Mín.</label>
                  <input 
                    type="number" 
                    placeholder="Min $" 
                    value={localFilters.capMin || ''}
                    onChange={e => setLocalFilters(f => ({ ...f, capMin: e.target.value ? parseFloat(e.target.value) : null }))}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:border-indigo-300 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Monto Máx.</label>
                  <input 
                    type="number" 
                    placeholder="Max $" 
                    value={localFilters.capMax || ''}
                    onChange={e => setLocalFilters(f => ({ ...f, capMax: e.target.value ? parseFloat(e.target.value) : null }))}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:border-indigo-300 transition-all outline-none"
                  />
                </div>
              </div>
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-50 bg-gray-50/30 flex gap-3">
          <button 
            onClick={() => {
              setLocalFilters({ 
                banks: [], 
                wallets: [], 
                networks: [], 
                days: [], 
                channels: [], 
                hasCap: null, 
                capMin: null, 
                capMax: null, 
                capPeriods: [],
                commerces: [],
                discountRanges: [],
                hasInstallments: null,
              })
            }}
            className="flex-1 px-6 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-100 transition-colors"
          >
            Reiniciar
          </button>
          <button 
            onClick={() => onApply(localFilters)}
            className="flex-[1.5] px-6 py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] transition-all"
          >
            Aplicar Filtros
          </button>
        </div>
      </div>
    </div>
  )
}
