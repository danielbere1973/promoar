'use client'
import { useState, useEffect } from 'react'
import { ExternalLink, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlazoFijoItem = {
  codigo: number
  entidad: string
  logoUrl: string | null
  tnaClientes: number
  teaClientes: number
  tnaNoClientes: number
  teaNoClientes: number
  webUrl: string | null
  isTop10: boolean
}

export type Divisa = {
  nombre: string
  codigo: string
  compra: number
  venta: number
  per100: boolean
}

export type LecapItem = {
  ticker: string
  tipo: 'LECAP' | 'BONCAP' | 'OTRO'
  descripcion: string
  vencimiento: string | null
  diasAlVenc: number | null
  precio: number | null
  tem: number | null
  tna: number | null
  tea: number | null
}

export type IOLScraperItem = {
  simbolo: string
  precio: number
  variacion: number
  compra: number
  venta: number
  maximo: number
  minimo: number
  monto: number
  tir?: number
}

export type YahooItem = {
  symbol: string
  nombre: string
  precio: number
  variacion: number
  cambio: number
  moneda: string
  mercado: string
}

const DIVISA_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', BRL: '🇧🇷', GBP: '🇬🇧',
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

export function LoadingCards() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4 animate-pulse flex items-center gap-4">
          <div className="w-9 h-9 bg-gray-100 dark:bg-slate-700 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-2/3" />
            <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded w-1/3" />
          </div>
          <div className="h-5 bg-gray-100 dark:bg-slate-700 rounded w-12" />
        </div>
      ))}
    </div>
  )
}

export function ErrorCard() {
  return (
    <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-2xl px-4 py-5 flex items-start gap-3">
      <AlertCircle size={16} className="text-red-400 dark:text-red-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-red-700 dark:text-red-300">No se pudo cargar la información</p>
        <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">Verificá tu conexión o intentá más tarde</p>
      </div>
    </div>
  )
}

export function UpdatedAt({ value }: { value: string | null }) {
  if (!value) return null
  const d = new Date(value)
  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      <RefreshCw size={10} className="text-gray-300 dark:text-slate-600" />
      <p className="text-[10px] text-gray-300 dark:text-slate-500 font-medium">
        Actualizado {d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}

// ─── Section: Plazo Fijo ─────────────────────────────────────────────────────

export function PlazoFijoSection({ initialData }: { initialData?: { items: PlazoFijoItem[]; updatedAt: string | null } }) {
  const [items, setItems] = useState<PlazoFijoItem[]>(initialData?.items ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState(false)
  const [modo, setModo] = useState<'clientes' | 'no_clientes'>('clientes')
  const [showAll, setShowAll] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialData?.updatedAt ?? null)

  useEffect(() => {
    if (initialData) return
    setLoading(true)
    fetch('/api/finanzas/plazo-fijo')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setItems(d.items ?? [])
        setUpdatedAt(d.updatedAt)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [initialData])

  const sorted = [...items].sort((a, b) =>
    modo === 'clientes'
      ? b.tnaClientes - a.tnaClientes
      : b.tnaNoClientes - a.tnaNoClientes
  ).filter(i => modo === 'clientes' ? i.tnaClientes > 0 : i.tnaNoClientes > 0)

  const visible = showAll ? sorted : sorted.slice(0, 10)

  if (loading) return <LoadingCards />
  if (error) return <ErrorCard />

  return (
    <div className="space-y-4">

      {/* Toggle clientes / no clientes */}
      <div className="flex bg-gray-100 dark:bg-slate-700 dark:bg-slate-700 p-1 rounded-2xl">
        {(['clientes', 'no_clientes'] as const).map(m => (
          <button key={m} onClick={() => setModo(m)}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${modo === m ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 dark:text-slate-400'}`}>
            {m === 'clientes' ? 'Clientes' : 'No clientes'}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[28px] overflow-hidden shadow-sm">
        {visible.map((item, idx) => {
          const tna = modo === 'clientes' ? item.tnaClientes : item.tnaNoClientes
          const tea = modo === 'clientes' ? item.teaClientes : item.teaNoClientes
          const isTop = idx < 3

          return (
            <div key={item.codigo}
              className={`flex items-center gap-4 px-5 py-4 ${idx < visible.length - 1 ? 'border-b border-gray-50 dark:border-slate-700' : ''}`}>
              {/* Posición */}
              <span className={`text-xs font-black w-5 text-center shrink-0 ${isTop ? 'text-emerald-500' : 'text-gray-300 dark:text-slate-600'}`}>
                {idx + 1}
              </span>

              {/* Logo / inicial */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black
                ${isTop ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-gray-50 dark:bg-slate-700 dark:bg-slate-700 text-gray-500 dark:text-slate-400 dark:text-slate-400'}`}>
                {item.logoUrl
                  ? <img src={item.logoUrl} alt="" className="w-7 h-7 object-contain rounded-lg" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : item.entidad.slice(0, 2).toUpperCase()
                }
              </div>

              {/* Nombre + TEA */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white dark:text-white truncate">{item.entidad}</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 dark:text-slate-500 font-medium mt-0.5">TEA {tea}%</p>
              </div>

              {/* TNA + Online */}
              <div className="text-right shrink-0 flex items-center gap-2">
                {item.webUrl && (
                  <a href={item.webUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors">
                    Online <ExternalLink size={9} />
                  </a>
                )}
                <div>
                  <p className={`text-base font-black ${isTop ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-800 dark:text-slate-200 dark:text-slate-300'}`}>{tna}%</p>
                  <p className="text-[9px] text-gray-400 dark:text-slate-500 dark:text-slate-500 font-bold uppercase tracking-widest text-right">TNA</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Ver más */}
      {sorted.length > 10 && (
        <button onClick={() => setShowAll(s => !s)}
          className="w-full py-3 text-xs font-bold text-gray-500 dark:text-slate-400 dark:text-slate-400 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl hover:bg-gray-50 dark:bg-slate-700 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5">
          {showAll ? 'Ver menos' : `Ver todos (${sorted.length})`}
          <ChevronRight size={13} className={`transition-transform ${showAll ? 'rotate-90' : ''}`} />
        </button>
      )}

      <UpdatedAt value={updatedAt} />
    </div>
  )
}

// ─── Section: Divisas ─────────────────────────────────────────────────────────

export function DivisasSection({ initialData }: { initialData?: { divisas: Divisa[]; fecha: string | null; hora: string | null; updatedAt: string | null } }) {
  const [divisas, setDivisas] = useState<Divisa[]>(initialData?.divisas ?? [])
  const [fecha, setFecha] = useState<string | null>(initialData?.fecha ?? null)
  const [hora, setHora] = useState<string | null>(initialData?.hora ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialData?.updatedAt ?? null)

  useEffect(() => {
    if (initialData) return
    fetch('/api/finanzas/divisas')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setDivisas(d.divisas ?? [])
        setFecha(d.fecha)
        setHora(d.hora)
        setUpdatedAt(d.updatedAt)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [initialData])

  if (loading) return <LoadingCards />
  if (error) return <ErrorCard />

  return (
    <div className="space-y-4">

      {/* Header BNA */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Banco Nación Argentina</p>
        {fecha && hora && (
          <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">{fecha} · {hora} hs</p>
        )}
      </div>

      {/* Cards de divisas */}
      <div className="space-y-3">
        {divisas.map(d => (
          <div key={d.codigo}
            className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[24px] px-5 py-4 shadow-sm flex items-center gap-4">
            {/* Flag + código */}
            <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-2xl shrink-0">
              {DIVISA_FLAGS[d.codigo] ?? '💱'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{d.nombre}</p>
                {d.per100 && (
                  <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">c/100</span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium mt-0.5">{d.codigo}</p>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center gap-3 justify-end">
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Compra</p>
                  <p className="text-sm font-black text-gray-700 dark:text-slate-300">${d.compra.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="w-px h-8 bg-gray-100 dark:bg-slate-700" />
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Venta</p>
                  <p className="text-sm font-black text-blue-700">${d.venta.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Spread note */}
      <div className="bg-gray-50 dark:bg-slate-700 border border-gray-100 rounded-2xl px-4 py-3">
        <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
          Cotizaciones oficiales del Banco de la Nación Argentina. Tipo de cambio minorista para transacciones hasta U$S 200.
        </p>
      </div>

      <UpdatedAt value={updatedAt} />
    </div>
  )
}

// ─── Section: LECAPs / BONCAPs ───────────────────────────────────────────────

export function LecapsSection({ initialData }: { initialData?: { items: LecapItem[]; updatedAt: string | null } }) {
  const [items, setItems] = useState<LecapItem[]>(initialData?.items ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialData?.updatedAt ?? null)
  const [showAll, setShowAll] = useState(false)
  const [filtro, setFiltro] = useState<'todos' | 'LECAP' | 'BONCAP'>('todos')

  useEffect(() => {
    if (initialData) return
    fetch('/api/finanzas/lecaps')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setItems(d.items ?? [])
        setUpdatedAt(d.updatedAt)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [initialData])

  if (loading) return <LoadingCards />
  if (error)   return <ErrorCard />

  const filtered = filtro === 'todos' ? items : items.filter(i => i.tipo === filtro)
  const visible  = showAll ? filtered : filtered.slice(0, 15)

  return (
    <div className="space-y-4">

      {/* Toggle LECAP / BONCAP */}
      <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-2xl">
        {(['todos', 'LECAP', 'BONCAP'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${filtro === f ? 'bg-white text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}>
            {f === 'todos' ? 'Todos' : f}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[28px] overflow-hidden shadow-sm">
        {visible.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-10">Sin datos disponibles</p>
        )}
        {visible.map((item, idx) => (
          <div key={item.ticker}
            className={`flex items-center gap-3 px-4 py-3.5 ${idx < visible.length - 1 ? 'border-b border-gray-50' : ''}`}>

            {/* Ticker + descripción + vencimiento */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-black text-gray-900 dark:text-white tracking-tight">{item.ticker}</p>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  item.tipo === 'LECAP'  ? 'bg-emerald-50 text-emerald-700' :
                  item.tipo === 'BONCAP' ? 'bg-purple-50 text-purple-700' :
                  'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                }`}>{item.tipo}</span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium mt-0.5">
                Vto: {item.vencimiento
                  ? new Date(item.vencimiento + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' })
                  : '—'}
                {item.diasAlVenc != null && (
                  <span className="text-gray-400 dark:text-slate-500 ml-1">({item.diasAlVenc}d)</span>
                )}
              </p>
            </div>

            {/* TNA + TEM + Precio */}
            <div className="text-right shrink-0 space-y-0.5">
              {item.tna != null && (
                <p className="text-base font-black text-emerald-600">
                  {item.tna}% <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500">TNA</span>
                </p>
              )}
              {item.tem != null && (
                <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">TEM {item.tem}%</p>
              )}
              {item.precio != null && (
                <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                  ${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 15 && (
        <button onClick={() => setShowAll(s => !s)}
          className="w-full py-3 text-xs font-bold text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl hover:bg-gray-50 dark:bg-slate-700 transition-colors flex items-center justify-center gap-1.5">
          {showAll ? 'Ver menos' : `Ver todos (${filtered.length})`}
          <ChevronRight size={13} className={`transition-transform ${showAll ? 'rotate-90' : ''}`} />
        </button>
      )}

      <UpdatedAt value={updatedAt} />
    </div>
  )
}

// ─── Section: IOL Scraper (CEDEARs, Bonos, ONs, Acciones AR, Cauciones) ──────

export function IOLScraperSection({ tipo, initialData }: { tipo: string; initialData?: { items: IOLScraperItem[]; updatedAt: string | null } }) {
  const [items, setItems] = useState<IOLScraperItem[]>(initialData?.items ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialData?.updatedAt ?? null)
  const [showAll, setShowAll] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    if (initialData) return
    setLoading(true)
    setError(false)
    setBusqueda('')
    setShowAll(false)
    fetch(`/api/finanzas/iol-scraper/${tipo}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setItems(d.items ?? [])
        setUpdatedAt(d.updatedAt)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [tipo, initialData])

  if (loading) return <LoadingCards />
  if (error)   return <ErrorCard />

  const LABEL: Record<string, string> = { cedears: 'CEDEARs', bonos: 'Bonos', ons: 'ONs', acciones: 'Acciones', cauciones: 'Cauciones' }
  const esCaucion = tipo === 'cauciones'

  const filtered = busqueda
    ? items.filter(i => i.simbolo.toLowerCase().includes(busqueda.toLowerCase()))
    : items

  const visible = showAll ? filtered : filtered.slice(0, 20)
  const varColor = (v: number) => v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-gray-400 dark:text-slate-500'

  // Render especial para cauciones
  if (esCaucion) return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[28px] overflow-hidden shadow-sm">
        {items.length === 0 && <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-10">Sin datos</p>}
        {items.map((item: any, idx: number) => (
          <div key={item.simbolo + item.moneda}
            className={`flex items-center gap-4 px-5 py-4 ${idx < items.length - 1 ? 'border-b border-gray-50' : ''}`}>
            <div className="flex-1">
              <p className="text-sm font-black text-gray-900 dark:text-white">{item.plazo} días</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium mt-0.5">{item.moneda}</p>
            </div>
            <div className="text-right">
              {item.tasa > 0 && (
                <p className="text-base font-black text-emerald-600">{item.tasa}% <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500">TNA</span></p>
              )}
              <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                ${(item.montoPesos / 1e9).toFixed(1)}B operado
              </p>
            </div>
          </div>
        ))}
      </div>
      <UpdatedAt value={updatedAt} />
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Buscador */}
      <div className="relative">
        <input
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setShowAll(true) }}
          placeholder={`Buscar ${LABEL[tipo] ?? tipo}...`}
          className="w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-medium text-gray-800 dark:text-slate-200 placeholder-gray-300 focus:outline-none focus:border-gray-300 shadow-sm"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[28px] overflow-hidden shadow-sm">
        {visible.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-10">Sin resultados</p>
        )}
        {visible.map((item, idx) => (
          <div key={item.simbolo}
            className={`flex items-center gap-3 px-4 py-3.5 ${idx < visible.length - 1 ? 'border-b border-gray-50' : ''}`}>

            {/* Símbolo */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-gray-900 dark:text-white tracking-tight">{item.simbolo}</p>
              {item.tir != null && item.tir !== 0 && (
                <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium mt-0.5">TIR {item.tir}%</p>
              )}
              <p className="text-[10px] text-gray-300 mt-0.5">
                Monto: ${(item.monto / 1_000_000).toFixed(1)}M
              </p>
            </div>

            {/* Precio + variación */}
            <div className="text-right shrink-0">
              <p className="text-sm font-black text-gray-900 dark:text-white">
                ${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className={`text-[11px] font-bold mt-0.5 ${varColor(item.variacion)}`}>
                {item.variacion > 0 ? '+' : ''}{item.variacion}%
              </p>
              {item.compra > 0 && item.venta > 0 && (
                <p className="text-[10px] text-gray-300 mt-0.5">
                  {item.compra.toLocaleString('es-AR', {maximumFractionDigits: 0})} / {item.venta.toLocaleString('es-AR', {maximumFractionDigits: 0})}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!busqueda && filtered.length > 20 && (
        <button onClick={() => setShowAll(s => !s)}
          className="w-full py-3 text-xs font-bold text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl hover:bg-gray-50 dark:bg-slate-700 transition-colors flex items-center justify-center gap-1.5">
          {showAll ? 'Ver menos' : `Ver todos (${filtered.length})`}
          <ChevronRight size={13} className={`transition-transform ${showAll ? 'rotate-90' : ''}`} />
        </button>
      )}

      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] text-gray-300">Fuente: IOL · Datos cada 20 min</p>
        <UpdatedAt value={updatedAt} />
      </div>
    </div>
  )
}

// ─── Section: Yahoo Finance (Acciones USA + Índices + Acciones AR) ───────────

export function YahooSection({ tipo, initialData }: { tipo: string; initialData?: { items: YahooItem[]; updatedAt: string | null } }) {
  const [items, setItems] = useState<YahooItem[]>(initialData?.items ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialData?.updatedAt ?? null)
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultadoBusqueda, setResultadoBusqueda] = useState<YahooItem | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (initialData) return
    setLoading(true)
    setError(false)
    setBusqueda('')
    setResultadoBusqueda(null)
    fetch(`/api/finanzas/yahoo?tipo=${tipo}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setItems(d.items ?? [])
        setUpdatedAt(d.updatedAt)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [tipo, initialData])

  async function handleBuscar() {
    const sym = busqueda.trim().toUpperCase()
    if (!sym) return
    setBuscando(true)
    setNotFound(false)
    setResultadoBusqueda(null)
    try {
      const res = await fetch(`/api/finanzas/yahoo?symbol=${sym}`)
      const d = await res.json()
      if (d.items?.length > 0) {
        setResultadoBusqueda(d.items[0])
      } else {
        setNotFound(true)
      }
    } catch {
      setNotFound(true)
    } finally {
      setBuscando(false)
    }
  }

  if (loading) return <LoadingCards />
  if (error)   return <ErrorCard />

  const varColor = (v: number) => v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-gray-400 dark:text-slate-500'

  const renderItem = (item: YahooItem, idx: number, total: number) => (
    <div key={item.symbol}
      className={`flex items-center gap-3 px-4 py-3.5 ${idx < total - 1 ? 'border-b border-gray-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-black text-gray-900 dark:text-white tracking-tight">{item.symbol}</p>
          <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">{item.moneda}</span>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium mt-0.5 truncate">{item.nombre}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-black text-gray-900 dark:text-white">
          {item.precio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className={`text-[11px] font-bold mt-0.5 ${varColor(item.variacion)}`}>
          {item.variacion > 0 ? '+' : ''}{item.variacion}%
        </p>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Buscador por ticker */}
      <div className="flex gap-2">
        <input
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value.toUpperCase()); setResultadoBusqueda(null); setNotFound(false) }}
          onKeyDown={e => e.key === 'Enter' && handleBuscar()}
          placeholder="Buscar ticker (ej: AAPL, TSLA, BTC-USD...)"
          className="flex-1 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm font-medium text-gray-800 dark:text-slate-200 placeholder-gray-300 focus:outline-none focus:border-gray-300 shadow-sm uppercase"
        />
        <button onClick={handleBuscar} disabled={buscando || !busqueda.trim()}
          className="px-4 py-3 bg-gray-900 text-white text-xs font-bold rounded-2xl disabled:opacity-40 shrink-0">
          {buscando ? '...' : 'Buscar'}
        </button>
      </div>

      {/* Resultado de búsqueda */}
      {resultadoBusqueda && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-[24px] overflow-hidden">
          {renderItem(resultadoBusqueda, 0, 1)}
        </div>
      )}
      {notFound && (
        <p className="text-xs text-center text-gray-400 dark:text-slate-500 py-2">Ticker no encontrado — verificá el símbolo</p>
      )}

      {/* Lista curada */}
      <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[28px] overflow-hidden shadow-sm">
        {items.length === 0 && <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-10">Sin datos</p>}
        {items.map((item, idx) => renderItem(item, idx, items.length))}
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] text-gray-300">Yahoo Finance · ~15 min delay</p>
        <UpdatedAt value={updatedAt} />
      </div>
    </div>
  )
}
