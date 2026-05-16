'use client'

import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, AlertCircle, 
  ChevronDown, Search, LayoutGrid,
  Building2, Bot, X, Check
} from 'lucide-react'

type StatItem = {
  name: string
  count: number
  percent: number
  bankName?: string
  segmentName?: string
}

type StatsData = {
  totalPromos: number
  byCommerce: StatItem[]
  byCategory: StatItem[]
  byBank: StatItem[]
  byScraper: StatItem[]
  withoutCategory: { count: number; percent: number }
  byBankSegment: StatItem[]
  byCardSegment: StatItem[]
  byCardType: StatItem[]
  byAccountType: StatItem[]
}

export default function StatsView() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [metric, setMetric] = useState<'count' | 'percent'>('count')
  const [groupBy, setGroupBy] = useState<'commerce' | 'category' | 'bank' | 'scraper' | 'segments' | 'cardTypes' | 'cardSegments' | 'accountTypes'>('commerce')

  const [selectedBanks, setSelectedBanks] = useState<string[]>([])
  const [selectedBankSegments, setSelectedBankSegments] = useState<string[]>([])
  const [selectedCardNetworks, setSelectedCardNetworks] = useState<string[]>([])
  const [selectedCardSegments, setSelectedCardSegments] = useState<string[]>([])
  const [selectedAccountTypes, setSelectedAccountTypes] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedScrapers, setSelectedScrapers] = useState<string[]>([])
  const [allScrapers, setAllScrapers] = useState<string[]>([])

  const [banks, setBanks] = useState<any[]>([])
  const [categories, setCategories] = useState<{id: string, name: string}[]>([])
  const [bankSegments, setBankSegments] = useState<any[]>([])
  const [cardNetworks, setCardNetworks] = useState<any[]>([])
  const [cardSegments, setCardSegments] = useState<any[]>([])

  useEffect(() => {
    async function fetchEntities() {
      try {
        const res = await fetch('/api/admin/entities')
        if (res.ok) {
          const json = await res.json()
          setBanks(json.banks || [])
          setCategories(json.categories || [])
          setBankSegments(json.segments || [])
          setCardNetworks(json.cardNetworks || [])
          setCardSegments(json.cardSegments || [])
        }
      } catch (e) { console.error(e) }
    }
    fetchEntities()
  }, [])

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        selectedBanks.forEach(id => params.append('bankId', id))
        selectedBankSegments.forEach(id => params.append('segmentId', id))
        selectedCardNetworks.forEach(id => params.append('cardNetworkId', id))
        selectedCardSegments.forEach(id => params.append('cardSegmentId', id))
        selectedAccountTypes.forEach(t => params.append('accountType', t))
        selectedCategories.forEach(id => params.append('categoryId', id))
        selectedScrapers.forEach(s => params.append('scraper', s))

        const res = await fetch(`/api/admin/stats?${params.toString()}`)
        if (!res.ok) throw new Error('Error al cargar estadísticas')
        const json = await res.json()
        setData(json)
        // Cargar lista de scrapers activos solo en la carga inicial (sin filtros)
        if (selectedScrapers.length === 0 && json.byScraper?.length > 0) {
          setAllScrapers(prev => prev.length > 0 ? prev : json.byScraper.map((s: any) => s.name))
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [selectedBanks, selectedBankSegments, selectedCardNetworks, selectedCardSegments, selectedAccountTypes, selectedCategories, selectedScrapers])

  if (error) return (
    <div className="p-8 bg-red-50 border border-red-100 rounded-3xl text-center">
      <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
      <p className="text-red-800 font-bold">{error}</p>
      <button onClick={() => window.location.reload()} className="mt-4 text-xs font-bold text-red-600 underline">Reintentar</button>
    </div>
  )

  const activeList = (() => {
    if (!data) return []
    switch (groupBy) {
      case 'commerce': return data.byCommerce
      case 'category': return data.byCategory
      case 'bank': return data.byBank
      case 'scraper': return data.byScraper
      case 'segments': return data.byBankSegment
      case 'cardTypes': return data.byCardType
      case 'cardSegments': return data.byCardSegment
      case 'accountTypes': return data.byAccountType
      default: return data.byCommerce
    }
  })()

  const maxVal = activeList.length > 0 ? Math.max(...activeList.map(i => i.count)) : 1

  return (
    <div className="space-y-8 pb-20">
      
      <div className="bg-indigo-900/5 p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm">
        <h3 className="text-xs font-black text-indigo-900/40 uppercase tracking-widest mb-6 flex items-center gap-2">
          <Search size={14} />
          Filtros de Analisis (Multiseleccion)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MultiSelect 
            label="Bancos" 
            selected={selectedBanks} 
            onChange={(ids: string[]) => {
              setSelectedBanks(ids)
              // Reset dependent filters if they are no longer valid
              setSelectedBankSegments([])
              setSelectedCardSegments([])
            }}
            options={banks.map(b => ({ id: b.id, name: b.name }))}
            placeholder="Todos los bancos"
          />
          <MultiSelect 
            label="Segmentos Banco" 
            selected={selectedBankSegments} 
            onChange={setSelectedBankSegments}
            options={bankSegments
              .filter(s => selectedBanks.length === 0 || selectedBanks.includes(s.bankId))
              .map(s => ({ 
                id: s.id, 
                name: selectedBanks.length > 1 ? `${s.bank?.name || 'Banco'} - ${s.name}` : s.name 
              }))
              .sort((a, b) => a.name.localeCompare(b.name))}
            placeholder={selectedBanks.length === 0 ? "Seleccione un banco primero" : "Todos los segmentos"}
            disabled={selectedBanks.length === 0}
          />
          <MultiSelect 
            label="Red Tarjeta" 
            selected={selectedCardNetworks} 
            onChange={(ids: string[]) => {
              setSelectedCardNetworks(ids)
              setSelectedCardSegments([])
            }}
            options={cardNetworks.map(n => ({ id: n.id, name: n.name }))}
            placeholder="Todas las redes"
          />
          <MultiSelect 
            label="Segmentos Tarjeta" 
            selected={selectedCardSegments} 
            onChange={setSelectedCardSegments}
            options={cardSegments
              .filter(cs => {
                const matchesBank = selectedBanks.length === 0 || (cs.banks && cs.banks.some((b: any) => selectedBanks.includes(b.id)))
                const matchesNetwork = selectedCardNetworks.length === 0 || selectedCardNetworks.includes(cs.cardNetworkId)
                return matchesBank && matchesNetwork
              })
              .map(cs => ({ 
                id: cs.id, 
                name: `${cs.cardNetwork?.name || ''} ${cs.cardType} - ${cs.name}`
              }))
              .sort((a, b) => a.name.localeCompare(b.name))}
            placeholder="Todos los segmentos tarjeta"
          />
          <MultiSelect 
            label="Atributos Promo" 
            selected={selectedAccountTypes} 
            onChange={setSelectedAccountTypes}
            options={[
              { id: 'HABERES', name: 'Cuenta Sueldo / Haberes' },
              { id: 'JUBILADO', name: 'Jubilados / Pensionados' },
              { id: 'ANSES', name: 'Beneficiarios ANSES' },
            ]}
            placeholder="Sin atributos especiales"
          />
          <MultiSelect 
            label="Rubros" 
            selected={selectedCategories} 
            onChange={setSelectedCategories}
            options={categories.map(c => ({ id: c.id, name: c.name }))}
            placeholder="Todos los rubros"
          />
          <MultiSelect
            label="Fuentes"
            selected={selectedScrapers}
            onChange={setSelectedScrapers}
            options={allScrapers.map(s => ({ id: s, name: s }))}
            placeholder="Todas las fuentes"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Analizando...</p>
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard title="Promos Filtradas" value={data.totalPromos} icon={LayoutGrid} color="blue" />
            <StatCard title="Sin Categoria" value={data.withoutCategory.count} icon={AlertCircle} color="amber" />
            <StatCard title="Bancos en Vista" value={data.byBank.length} icon={Building2} color="indigo" />
            <StatCard title="Comercios" value={data.byCommerce.length} icon={Bot} color="emerald" />
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp className="text-indigo-600" size={24} />
                  Visualizacion de Datos
                </h2>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <ReportSelect 
                  label="Metrica" 
                  value={metric} 
                  onChange={(v: any) => setMetric(v)}
                  options={[
                    { value: 'count', label: 'Cantidad' },
                    { value: 'percent', label: 'Porcentaje' },
                  ]}
                />
                <ReportSelect 
                  label="Agrupar" 
                  value={groupBy} 
                  onChange={(v: any) => setGroupBy(v)}
                  options={[
                    { value: 'commerce', label: 'Comercio' },
                    { value: 'category', label: 'Rubro' },
                    { value: 'bank', label: 'Banco' },
                    { value: 'scraper', label: 'Fuente' },
                    { value: 'segments', label: 'Segm. Banco' },
                    { value: 'cardTypes', label: 'Tipo Tarjeta' },
                    { value: 'cardSegments', label: 'Segm. Tarjeta' },
                    { value: 'accountTypes', label: 'Tipo Cuenta' },
                  ]}
                />
              </div>
            </div>

            <div className="p-8">
              <div className="space-y-6">
                {activeList.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-800 text-sm">
                        {item.bankName ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-indigo-600/60 font-black text-[10px] uppercase">{item.bankName}</span>
                            <span className="text-slate-300">/</span>
                            <span>{item.segmentName}</span>
                          </span>
                        ) : (item as any).networkName ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-indigo-600/60 font-black text-[10px] uppercase">{(item as any).networkName}</span>
                            <span className="text-slate-300">/</span>
                            <span>{item.segmentName}</span>
                          </span>
                        ) : item.name}
                      </span>
                      <span className="text-sm font-black text-slate-900">
                        {metric === 'count' ? item.count : `${item.percent}%`}
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-700"
                        style={{ width: `${(item.count / maxVal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {activeList.length === 0 && (
                  <p className="text-center py-10 text-slate-400 font-medium">No hay datos para esta seleccion</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MultiSelect({ label, selected, onChange, options, placeholder, disabled }: any) {
  const [isOpen, setIsOpen] = useState(false)

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x: string) => x !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div className={`relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <label className="absolute -top-2 left-3 px-1 bg-[#fbfbfd] text-[10px] font-black text-indigo-400 uppercase tracking-wider z-10">{label}</label>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-white border border-indigo-100 rounded-2xl px-4 py-4 text-sm font-bold text-slate-700 cursor-pointer flex justify-between items-center shadow-sm min-h-[56px] ${disabled ? 'bg-slate-50' : ''}`}
      >
        <span className="truncate pr-4">
          {selected.length === 0 ? placeholder : `${selected.length} seleccionados`}
        </span>
        <ChevronDown size={18} className={`text-indigo-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-indigo-100 rounded-2xl shadow-xl z-30 max-h-60 overflow-y-auto p-2 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between p-2 border-b border-slate-50 mb-1">
              <button onClick={() => onChange(options.map((o: any) => o.id))} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Todos</button>
              <button onClick={() => onChange([])} className="text-[10px] font-black text-slate-400 uppercase hover:underline">Limpiar</button>
            </div>
            {options.map((opt: any) => (
              <div 
                key={opt.id} 
                onClick={() => toggle(opt.id)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-indigo-50 cursor-pointer transition-colors group"
              >
                <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-900">{opt.name}</span>
                {selected.includes(opt.id) && <Check size={14} className="text-indigo-600" />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ReportSelect({ label, value, onChange, options }: any) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-3 px-1 bg-white text-[9px] font-black text-slate-400 uppercase tracking-widest z-10">{label}</label>
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all cursor-pointer shadow-sm"
      >
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600"
  }
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all group">
      <div className={`w-10 h-10 rounded-xl ${colors[color]} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon size={20} />
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <h4 className="text-2xl font-black text-slate-900">{value.toLocaleString()}</h4>
    </div>
  )
}
