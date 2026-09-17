'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Building2, MapPin, Store, Search, Plus, Trash2, Edit3,
  ExternalLink, Copy, Check, Globe, Instagram, Sparkles,
  Layers, Tag, ChevronRight, AlertCircle, Navigation,
  Map as MapIcon, Filter, CheckCircle2, X, RefreshCw,
  SlidersHorizontal, ArrowUpRight, HelpCircle
} from 'lucide-react'

// ── Tipos ───────────────────────────────────────────────────────
type LocationModel = 'UNKNOWN' | 'CHAIN_NATIONAL' | 'REGIONAL' | 'SINGLE_STORE' | 'ONLINE_ONLY'
type BankPromoStacking = 'UNKNOWN' | 'YES' | 'NO'

interface Branch {
  id: string
  commerceId: string
  name: string | null
  address: string | null
  city: string | null
  province: string | null
  lat: number
  lng: number
  source: string
  osmId?: string | null
  createdAt: string
}

interface PromoRequirement {
  id: string
  bank?: { id: string; name: string; logoUrl?: string | null } | null
  wallet?: { id: string; name: string; logoUrl?: string | null } | null
  cardNetwork?: { id: string; name: string } | null
  discountType?: string
  discountValue?: number | string
  cap?: number | string
  capPeriod?: string
}

interface PromoSummary {
  id: string
  title: string
  validUntil: string | null
  validDays: number
  status: string
  category?: { id: string; name: string; color: string; icon: string } | null
  requirements?: PromoRequirement[]
}

interface CommerceDetail {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  website: string | null
  instagramUrl: string | null
  active: boolean
  defaultCategoryId: string | null
  locationModel: LocationModel
  stacksWithBankPromos: BankPromoStacking
  activePromoCount: number
  defaultCategory?: { id: string; name: string; color: string; icon: string } | null
  branches: Branch[]
  promos: PromoSummary[]
  aliases: { id: string; alias: string }[]
  _count: {
    branches: number
    promos: number
    aliases: number
    products?: number
  }
}

interface CommerceListItem {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  website: string | null
  instagramUrl: string | null
  active: boolean
  locationModel: LocationModel
  stacksWithBankPromos: BankPromoStacking
  defaultCategory?: { id: string; name: string; color: string; icon: string } | null
  _count: {
    branches: number
    promos: number
    aliases: number
  }
}

interface CategoryOption {
  id: string
  name: string
  icon?: string
  color?: string
}

interface GeocodeCandidate {
  placeId: string
  osmId: string
  osmType: string
  lat: number
  lng: number
  displayName: string
  address: string
  city: string
  province: string
}

const LOCATION_MODEL_LABELS: Record<LocationModel, { label: string; icon: string; bg: string; text: string; border: string }> = {
  CHAIN_NATIONAL: { label: 'Cadena Nacional', icon: '🏬', bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
  REGIONAL: { label: 'Regional', icon: '🗺️', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  SINGLE_STORE: { label: 'Sucursal única', icon: '📍', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  ONLINE_ONLY: { label: 'Solo Online', icon: '🌐', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  UNKNOWN: { label: 'Sin Definir', icon: '❓', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
}

export default function CommercesManagerView({
  onSelectCommerceForPromo,
}: {
  onSelectCommerceForPromo?: (commerceId: string) => void
}) {
  // Lista y filtros
  const [commerces, setCommerces] = useState<CommerceListItem[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [branchesFilter, setBranchesFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [modelFilter, setModelFilter] = useState<string>('')

  // Detalle seleccionado
  const [selectedCommerceId, setSelectedCommerceId] = useState<string | null>(null)
  const [commerceDetail, setCommerceDetail] = useState<CommerceDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [activeTab, setActiveTab] = useState<'branches' | 'promos' | 'settings'>('branches')

  // Modal / Form nuevo comercio
  const [showNewCommerceModal, setShowNewCommerceModal] = useState(false)
  const [newCommerceName, setNewCommerceName] = useState('')
  const [newCommerceCategory, setNewCommerceCategory] = useState('')
  const [newCommerceModel, setNewCommerceModel] = useState<LocationModel>('UNKNOWN')
  const [creatingCommerce, setCreatingCommerce] = useState(false)

  // Geocodificación y nueva sucursal
  const [geocodeQuery, setGeocodeQuery] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<GeocodeCandidate | null>(null)
  const [branchNameInput, setBranchNameInput] = useState('')
  const [savingBranch, setSavingBranch] = useState(false)
  const [showAddBranchCard, setShowAddBranchCard] = useState(false)

  // Copiado al portapapeles
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Feedback y mensajes
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text })
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  // 1. Cargar lista de comercios
  const fetchCommerces = useCallback(async () => {
    setLoadingList(true)
    try {
      const params = new URLSearchParams()
      if (searchText.trim()) params.set('search', searchText.trim())
      if (selectedCategory) params.set('categoryId', selectedCategory)
      if (branchesFilter !== 'all') params.set('hasBranches', branchesFilter)
      if (modelFilter) params.set('locationModel', modelFilter)
      params.set('limit', '80')

      const res = await fetch(`/api/admin/commerces?${params.toString()}`)
      if (!res.ok) throw new Error('Error al cargar lista')
      const data = await res.json()

      setCommerces(data.commerces || [])
      if (data.categories?.length) setCategories(data.categories)

      // Auto-seleccionar el primero si no hay selección o quedó huérfana
      if (data.commerces?.length > 0) {
        if (!selectedCommerceId || !data.commerces.some((c: any) => c.id === selectedCommerceId)) {
          setSelectedCommerceId(data.commerces[0].id)
        }
      } else {
        setSelectedCommerceId(null)
        setCommerceDetail(null)
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Error de red')
    } finally {
      setLoadingList(false)
    }
  }, [searchText, selectedCategory, branchesFilter, modelFilter, selectedCommerceId])

  useEffect(() => {
    fetchCommerces()
  }, [fetchCommerces])

  // 2. Cargar detalle de comercio seleccionado
  const fetchCommerceDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/admin/commerces/${id}`)
      if (!res.ok) throw new Error('No se pudo obtener el comercio')
      const data = await res.json()
      setCommerceDetail(data.commerce)
    } catch (err: any) {
      showFeedback('error', err.message)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (selectedCommerceId) {
      fetchCommerceDetail(selectedCommerceId)
      setShowAddBranchCard(false)
      setCandidates([])
      setSelectedCandidate(null)
      setGeocodeQuery('')
      setBranchNameInput('')
    }
  }, [selectedCommerceId, fetchCommerceDetail])

  // 3. Crear comercio nuevo
  const handleCreateCommerce = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommerceName.trim()) return
    setCreatingCommerce(true)
    try {
      const res = await fetch('/api/admin/commerces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCommerceName.trim(),
          defaultCategoryId: newCommerceCategory || null,
          locationModel: newCommerceModel,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear comercio')

      showFeedback('success', `Comercio "${data.commerce.name}" creado con éxito`)
      setShowNewCommerceModal(false)
      setNewCommerceName('')
      setNewCommerceCategory('')
      setNewCommerceModel('UNKNOWN')
      fetchCommerces()
      setSelectedCommerceId(data.commerce.id)
    } catch (err: any) {
      showFeedback('error', err.message)
    } finally {
      setCreatingCommerce(false)
    }
  }

  // 4. Actualizar comercio actual
  const handleUpdateCommerce = async (fields: Partial<CommerceDetail>) => {
    if (!commerceDetail) return
    try {
      const res = await fetch(`/api/admin/commerces/${commerceDetail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al actualizar')
      setCommerceDetail(prev => prev ? { ...prev, ...data.commerce } : null)
      setCommerces(prev => prev.map(c => c.id === commerceDetail.id ? { ...c, ...data.commerce } : c))
      showFeedback('success', 'Comercio actualizado')
    } catch (err: any) {
      showFeedback('error', err.message)
    }
  }

  // 5. Geocodificar dirección con OpenStreetMap
  const handleGeocode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!geocodeQuery.trim()) return
    setGeocoding(true)
    setCandidates([])
    setSelectedCandidate(null)
    try {
      const res = await fetch('/api/admin/commerces/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: geocodeQuery.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo geocodificar')
      if (!data.results || data.results.length === 0) {
        showFeedback('error', 'No se encontraron resultados en Argentina para esa dirección. Probá agregando localidad o provincia.')
      } else {
        setCandidates(data.results)
        setSelectedCandidate(data.results[0]) // Auto preseleccionar el mejor candidato
      }
    } catch (err: any) {
      showFeedback('error', err.message)
    } finally {
      setGeocoding(false)
    }
  }

  // 6. Guardar sucursal seleccionada
  const handleSaveBranch = async () => {
    if (!commerceDetail || !selectedCandidate) return
    setSavingBranch(true)
    try {
      const res = await fetch(`/api/admin/commerces/${commerceDetail.id}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: branchNameInput.trim() || selectedCandidate.address || 'Sucursal',
          address: selectedCandidate.address,
          city: selectedCandidate.city,
          province: selectedCandidate.province,
          lat: selectedCandidate.lat,
          lng: selectedCandidate.lng,
          source: 'MANUAL',
          osmId: selectedCandidate.osmId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar sucursal')

      showFeedback('success', 'Sucursal agregada y geolocalizada con éxito')
      setGeocodeQuery('')
      setCandidates([])
      setSelectedCandidate(null)
      setBranchNameInput('')
      setShowAddBranchCard(false)

      // Actualizar detalle y lista
      fetchCommerceDetail(commerceDetail.id)
      setCommerces(prev => prev.map(c => c.id === commerceDetail.id ? { ...c, _count: { ...c._count, branches: c._count.branches + 1 } } : c))
    } catch (err: any) {
      showFeedback('error', err.message)
    } finally {
      setSavingBranch(false)
    }
  }

  // 7. Eliminar sucursal
  const handleDeleteBranch = async (branchId: string) => {
    if (!commerceDetail) return
    if (!confirm('¿Estás seguro de eliminar esta sucursal?')) return
    try {
      const res = await fetch(`/api/admin/commerces/${commerceDetail.id}/branches/${branchId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Error al eliminar sucursal')
      showFeedback('success', 'Sucursal eliminada')
      setCommerceDetail(prev => prev ? {
        ...prev,
        branches: prev.branches.filter(b => b.id !== branchId),
        _count: { ...prev._count, branches: Math.max(0, prev._count.branches - 1) },
      } : null)
      setCommerces(prev => prev.map(c => c.id === commerceDetail.id ? { ...c, _count: { ...c._count, branches: Math.max(0, c._count.branches - 1) } } : c))
    } catch (err: any) {
      showFeedback('error', err.message)
    }
  }

  // Copiar coordenadas
  const copyCoords = (lat: number, lng: number, id: string) => {
    navigator.clipboard.writeText(`${lat}, ${lng}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-950 text-emerald-100 border-emerald-800 shadow-emerald-950/20'
            : 'bg-rose-950 text-rose-100 border-rose-800 shadow-rose-950/20'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" /> : <AlertCircle size={18} className="text-rose-400 shrink-0" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* ── HEADER PRINCIPAL DE SECCIÓN ── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Store size={20} />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Comercios, Sucursales y Promociones</h1>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Mapeo geográfico de locales con <b>OpenStreetMap</b>, vinculación de beneficios bancarios y parametrización de cobertura para el Decision Engine.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowNewCommerceModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition-all shadow-sm hover:shadow-indigo-500/25 active:scale-95"
          >
            <Plus size={16} />
            Nuevo Comercio
          </button>
        </div>
      </div>

      {/* ── WORKSTATION SPLIT VIEW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── COLUMNA IZQUIERDA: EXPLORADOR Y BUSCADOR (4 cols) ── */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-[820px]">
          {/* Barra de Filtros */}
          <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
            {/* Buscador */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o alias..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 text-xs font-medium rounded-2xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchText && (
                <button onClick={() => setSearchText('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filtro por Categoría y Cobertura */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Todas las categorías</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon || '🏷️'} {c.name}</option>
                ))}
              </select>

              <select
                value={branchesFilter}
                onChange={e => setBranchesFilter(e.target.value as any)}
                className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Todas las sucursales</option>
                <option value="yes">📍 Con sucursales</option>
                <option value="no">⚠️ Sin geolocalizar</option>
              </select>
            </div>

            {/* Quick Pills de modelo */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
              <button
                onClick={() => setModelFilter('')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  modelFilter === '' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setModelFilter(modelFilter === 'CHAIN_NATIONAL' ? '' : 'CHAIN_NATIONAL')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  modelFilter === 'CHAIN_NATIONAL' ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                }`}
              >
                Cadenas
              </button>
              <button
                onClick={() => setModelFilter(modelFilter === 'REGIONAL' ? '' : 'REGIONAL')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  modelFilter === 'REGIONAL' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Regionales
              </button>
              <button
                onClick={() => setModelFilter(modelFilter === 'SINGLE_STORE' ? '' : 'SINGLE_STORE')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  modelFilter === 'SINGLE_STORE' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Locales únicos
              </button>
            </div>
          </div>

          {/* Listado con scroll */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
            {loadingList ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <RefreshCw size={24} className="animate-spin mx-auto text-indigo-500" />
                <p className="text-xs font-medium">Buscando comercios...</p>
              </div>
            ) : commerces.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Store size={32} className="mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No se encontraron comercios</p>
                <p className="text-[11px] text-slate-400">Probá con otro término de búsqueda o filtro</p>
              </div>
            ) : (
              commerces.map(comm => {
                const isSelected = selectedCommerceId === comm.id
                const modelBadge = LOCATION_MODEL_LABELS[comm.locationModel] || LOCATION_MODEL_LABELS.UNKNOWN
                const hasBranches = (comm._count?.branches || 0) > 0

                return (
                  <button
                    key={comm.id}
                    onClick={() => setSelectedCommerceId(comm.id)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-all ${
                      isSelected
                        ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600'
                        : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    {/* Avatar / Logo */}
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 shrink-0 overflow-hidden flex items-center justify-center">
                      {comm.logoUrl ? (
                        <img src={comm.logoUrl} alt={comm.name} className="w-full h-full object-contain p-0.5" />
                      ) : (
                        <span className="text-xs font-black text-slate-500 uppercase">
                          {comm.name.slice(0, 2)}
                        </span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                          {comm.name}
                        </h3>
                        {comm.defaultCategory && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {comm.defaultCategory.icon || '🏷️'}
                          </span>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                          hasBranches
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                            : 'bg-rose-50 text-rose-700 border-rose-200/60'
                        }`}>
                          <MapPin size={10} />
                          {comm._count?.branches || 0}
                        </span>

                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
                          <Tag size={10} />
                          {comm._count?.promos || 0} promos
                        </span>

                        <span className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${modelBadge.bg} ${modelBadge.text}`}>
                          {modelBadge.label}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer conteo */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] font-semibold text-slate-500">
            {commerces.length} comercios visualizados
          </div>
        </div>

        {/* ── COLUMNA DERECHA: COMMAND CENTER DEL COMERCIO SELECCIONADO (8 cols) ── */}
        <div className="lg:col-span-8 space-y-6">
          {loadingDetail ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200/80 shadow-sm text-center text-slate-400 space-y-3">
              <RefreshCw size={28} className="animate-spin mx-auto text-indigo-500" />
              <p className="text-xs font-semibold text-slate-600">Cargando ficha del comercio...</p>
            </div>
          ) : !commerceDetail ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200/80 shadow-sm text-center text-slate-400 space-y-3">
              <Building2 size={40} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Seleccioná un comercio del panel izquierdo</p>
              <p className="text-xs text-slate-400">Podrás ver y editar sus sucursales, promociones vigentes y modelo de cobertura.</p>
            </div>
          ) : (
            <>
              {/* ── HERO HEADER DEL COMERCIO ── */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  
                  {/* Info e Imagen */}
                  <div className="flex items-start gap-4">
                    <div className="relative group w-16 h-16 rounded-2xl bg-slate-50 border-2 border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                      {commerceDetail.logoUrl ? (
                        <img src={commerceDetail.logoUrl} alt={commerceDetail.name} className="w-full h-full object-contain p-1" />
                      ) : (
                        <span className="text-lg font-black text-slate-400 uppercase">
                          {commerceDetail.name.slice(0, 2)}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">
                          {commerceDetail.name}
                        </h2>
                        {commerceDetail.defaultCategory && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs"
                            style={{
                              backgroundColor: `${commerceDetail.defaultCategory.color}15`,
                              borderColor: `${commerceDetail.defaultCategory.color}40`,
                              color: commerceDetail.defaultCategory.color,
                            }}
                          >
                            <span>{commerceDetail.defaultCategory.icon || '🏷️'}</span>
                            {commerceDetail.defaultCategory.name}
                          </span>
                        )}
                        {!commerceDetail.active && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            Inactivo
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 font-mono">
                        slug: <span className="text-slate-600">{commerceDetail.slug}</span>
                      </p>

                      {/* Enlaces externos rápidos */}
                      <div className="flex items-center gap-3 pt-1 text-xs font-semibold text-slate-600">
                        {commerceDetail.website && (
                          <a
                            href={commerceDetail.website.startsWith('http') ? commerceDetail.website : `https://${commerceDetail.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
                          >
                            <Globe size={13} className="text-slate-400" />
                            Sitio Web
                            <ArrowUpRight size={11} className="text-slate-400" />
                          </a>
                        )}
                        {commerceDetail.instagramUrl && (
                          <a
                            href={commerceDetail.instagramUrl.startsWith('http') ? commerceDetail.instagramUrl : `https://instagram.com/${commerceDetail.instagramUrl.replace('@', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-pink-600 transition-colors"
                          >
                            <Instagram size={13} className="text-slate-400" />
                            Instagram
                            <ArrowUpRight size={11} className="text-slate-400" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones de Promo */}
                  {onSelectCommerceForPromo && (
                    <button
                      onClick={() => onSelectCommerceForPromo(commerceDetail.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl transition-all self-start"
                    >
                      <Plus size={14} />
                      Crear Promo para este Comercio
                    </button>
                  )}
                </div>

                {/* Barrita de configuración rápida (Modelo de ubicación + Stacking) */}
                <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Selector Modelo de Ubicación */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <Navigation size={12} className="text-slate-400" />
                      Modelo de Presencia Geográfica
                    </label>
                    <select
                      value={commerceDetail.locationModel}
                      onChange={e => handleUpdateCommerce({ locationModel: e.target.value as LocationModel })}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="UNKNOWN">❓ Desconocido (Incertidumbre)</option>
                      <option value="CHAIN_NATIONAL">🏬 Cadena Nacional (Alta presencia en todo el país)</option>
                      <option value="REGIONAL">🗺️ Regional (Cadena del interior o provincial)</option>
                      <option value="SINGLE_STORE">📍 Local Único (Comercio físico barrial o puntual)</option>
                      <option value="ONLINE_ONLY">🌐 Solo Online (Sin sucursales a pie)</option>
                    </select>
                  </div>

                  {/* Selector Apila Promos Bancarias */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <Layers size={12} className="text-slate-400" />
                      Apilamiento con Promociones Bancarias
                    </label>
                    <select
                      value={commerceDetail.stacksWithBankPromos}
                      onChange={e => handleUpdateCommerce({ stacksWithBankPromos: e.target.value as BankPromoStacking })}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="UNKNOWN">❓ Desconocido</option>
                      <option value="YES">✅ Sí, acumula descuento propio con reintegro bancario</option>
                      <option value="NO">🚫 No acumula con otras promociones</option>
                    </select>
                  </div>
                </div>

                {/* Tabs de Navegación del Workspace */}
                <div className="flex items-center gap-2 border-b border-slate-100 pt-2">
                  <button
                    onClick={() => setActiveTab('branches')}
                    className={`flex items-center gap-2 pb-2.5 px-2 text-xs font-bold border-b-2 transition-all ${
                      activeTab === 'branches'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <MapPin size={15} />
                    Sucursales ({commerceDetail.branches?.length || 0})
                  </button>

                  <button
                    onClick={() => setActiveTab('promos')}
                    className={`flex items-center gap-2 pb-2.5 px-2 text-xs font-bold border-b-2 transition-all ${
                      activeTab === 'promos'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Tag size={15} />
                    Promociones Activas ({commerceDetail.promos?.length || 0})
                  </button>

                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex items-center gap-2 pb-2.5 px-2 text-xs font-bold border-b-2 transition-all ${
                      activeTab === 'settings'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <SlidersHorizontal size={15} />
                    Configuración & Alias ({commerceDetail.aliases?.length || 0})
                  </button>
                </div>
              </div>

              {/* ── CONTENIDO DEL TAB: SUCURSALES ── */}
              {activeTab === 'branches' && (
                <div className="space-y-4">
                  {/* Top Bar de Sucursales */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Locales y Sucursales Georreferenciadas</h3>
                      <p className="text-xs text-slate-500">
                        Puntos físicos utilizados para calcular distancia milimétrica en el Decision Engine.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowAddBranchCard(!showAddBranchCard)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl transition-all shadow-xs active:scale-95"
                    >
                      <Plus size={14} />
                      {showAddBranchCard ? 'Cerrar Formulario' : 'Agregar Sucursal'}
                    </button>
                  </div>

                  {/* TARJETA DE AGREGAR SUCURSAL CON AUTO-GEOCODING */}
                  {showAddBranchCard && (
                    <div className="bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 rounded-3xl p-6 border-2 border-indigo-200/80 shadow-md space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                            <Sparkles size={14} />
                          </div>
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                            Carga Rápida con Auto-Geocoding (OpenStreetMap)
                          </h4>
                        </div>
                        <button
                          onClick={() => setShowAddBranchCard(false)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Input de dirección */}
                      <form onSubmit={handleGeocode} className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Ej: Av. Cabildo 2040, Belgrano, CABA o San Martín 500, Mendoza..."
                              value={geocodeQuery}
                              onChange={e => setGeocodeQuery(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 text-xs font-medium bg-white border border-slate-300 rounded-2xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                              autoFocus
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={geocoding || !geocodeQuery.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-2xl flex items-center justify-center gap-2 transition-all shrink-0"
                          >
                            {geocoding ? <RefreshCw size={14} className="animate-spin" /> : <Navigation size={14} />}
                            {geocoding ? 'Buscando en mapa...' : 'Ubicar Coordenadas'}
                          </button>
                        </div>
                      </form>

                      {/* Lista de candidatos encontrados */}
                      {candidates.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <p className="text-[11px] font-bold text-slate-500">
                            Candidatos detectados ({candidates.length}) — Seleccioná el más preciso:
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {candidates.map(cand => {
                              const isCandSelected = selectedCandidate?.placeId === cand.placeId
                              return (
                                <button
                                  key={cand.placeId}
                                  type="button"
                                  onClick={() => setSelectedCandidate(cand)}
                                  className={`text-left p-3 rounded-2xl border transition-all ${
                                    isCandSelected
                                      ? 'bg-indigo-50/90 border-indigo-500 shadow-xs'
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-slate-800 truncate">
                                      {cand.address || cand.displayName.split(',')[0]}
                                    </span>
                                    {isCandSelected && <CheckCircle2 size={14} className="text-indigo-600 shrink-0" />}
                                  </div>
                                  <p className="text-[10px] text-slate-500 line-clamp-2">
                                    {cand.displayName}
                                  </p>
                                  <p className="text-[9px] font-mono text-indigo-700 mt-1">
                                    {cand.lat.toFixed(4)}, {cand.lng.toFixed(4)} ({cand.city}, {cand.province})
                                  </p>
                                </button>
                              )
                            })}
                          </div>

                          {/* Previsualización del candidato seleccionado con Mini Mapa y Confirmación */}
                          {selectedCandidate && (
                            <div className="bg-white rounded-2xl p-4 border border-indigo-200 shadow-sm space-y-3 mt-3">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-bold text-slate-800">
                                  Confirmar datos para esta sucursal:
                                </h5>
                                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                  Coordenadas listas
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                    Nombre o Referencia de la Sucursal (Opcional):
                                  </label>
                                  <input
                                    type="text"
                                    placeholder={`Ej: ${commerceDetail.name} ${selectedCandidate.city}`}
                                    value={branchNameInput}
                                    onChange={e => setBranchNameInput(e.target.value)}
                                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                                  />
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                    Dirección que se mostrará:
                                  </label>
                                  <input
                                    type="text"
                                    value={selectedCandidate.address}
                                    readOnly
                                    className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600"
                                  />
                                </div>
                              </div>

                              {/* Mini mapa embebido OSM */}
                              <div className="h-44 w-full rounded-xl overflow-hidden border border-slate-200 relative">
                                <iframe
                                  title="OpenStreetMap Preview"
                                  width="100%"
                                  height="100%"
                                  frameBorder="0"
                                  scrolling="no"
                                  marginHeight={0}
                                  marginWidth={0}
                                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedCandidate.lng - 0.005}%2C${selectedCandidate.lat - 0.005}%2C${selectedCandidate.lng + 0.005}%2C${selectedCandidate.lat + 0.005}&layer=mapnik&marker=${selectedCandidate.lat}%2C${selectedCandidate.lng}`}
                                />
                              </div>

                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCandidate(null)}
                                  className="text-xs font-bold text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl transition-all"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveBranch}
                                  disabled={savingBranch}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                                >
                                  {savingBranch ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                  Guardar Sucursal
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* LISTADO DE SUCURSALES EXISTENTES */}
                  {commerceDetail.branches?.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                        <MapPin size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-800">
                          Este comercio aún no tiene sucursales geolocalizadas
                        </h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          El Decision Engine aplica una penalización por incertidumbre si el usuario está cerca pero el comercio no tiene coordenadas.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAddBranchCard(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-all"
                      >
                        <Plus size={14} />
                        Agregar la primera sucursal ahora
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {commerceDetail.branches.map(branch => (
                        <div
                          key={branch.id}
                          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                                  📍
                                </span>
                                <h4 className="text-xs font-bold text-slate-800 truncate">
                                  {branch.name || branch.address || 'Sucursal'}
                                </h4>
                              </div>

                              <button
                                onClick={() => handleDeleteBranch(branch.id)}
                                title="Eliminar sucursal"
                                className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {branch.address && (
                              <p className="text-xs text-slate-600 font-medium pl-7">
                                {branch.address}
                              </p>
                            )}

                            <div className="flex items-center gap-1.5 pl-7 flex-wrap text-[10px]">
                              {branch.city && (
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                                  {branch.city}
                                </span>
                              )}
                              {branch.province && (
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                                  {branch.province}
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-400 font-mono text-[9px]">
                                {branch.source}
                              </span>
                            </div>
                          </div>

                          {/* Coordenadas & Enlaces */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            <button
                              type="button"
                              onClick={() => copyCoords(branch.lat, branch.lng, branch.id)}
                              className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-600 hover:text-indigo-600 transition-colors"
                            >
                              {copiedId === branch.id ? (
                                <>
                                  <Check size={11} className="text-emerald-500" />
                                  <span className="text-emerald-600 font-bold">Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  <span>{branch.lat.toFixed(4)}, {branch.lng.toFixed(4)}</span>
                                </>
                              )}
                            </button>

                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${branch.lat},${branch.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              Maps <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── CONTENIDO DEL TAB: PROMOCIONES ACTIVAS ── */}
              {activeTab === 'promos' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Promociones Activas en PromoAR</h3>
                      <p className="text-xs text-slate-500">
                        Beneficios bancarios y propios detectados para {commerceDetail.name}.
                      </p>
                    </div>

                    {onSelectCommerceForPromo && (
                      <button
                        onClick={() => onSelectCommerceForPromo(commerceDetail.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl transition-all shadow-xs"
                      >
                        <Plus size={14} />
                        Nueva Promo
                      </button>
                    )}
                  </div>

                  {commerceDetail.promos?.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm text-center space-y-2">
                      <Tag size={32} className="mx-auto text-slate-300" />
                      <h4 className="text-xs font-bold text-slate-700">Sin promociones activas registradas</h4>
                      <p className="text-[11px] text-slate-400">
                        Podés dar de alta promociones directas del comercio o esperar al próximo ciclo de scraping.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {commerceDetail.promos.map(promo => {
                        const bankName = promo.requirements?.[0]?.bank?.name || promo.requirements?.[0]?.wallet?.name || 'Promoción Directa'
                        const bankLogo = promo.requirements?.[0]?.bank?.logoUrl || promo.requirements?.[0]?.wallet?.logoUrl

                        return (
                          <div
                            key={promo.id}
                            className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {bankLogo && (
                                  <img src={bankLogo} alt={bankName} className="w-5 h-5 rounded-md object-contain" />
                                )}
                                <span className="text-[11px] font-bold text-slate-700">
                                  {bankName}
                                </span>
                              </div>

                              {promo.category && (
                                <span
                                  className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: `${promo.category.color}15`,
                                    color: promo.category.color,
                                  }}
                                >
                                  {promo.category.name}
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs font-black text-slate-900 leading-snug">
                              {promo.title}
                            </h4>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                              <span>
                                {promo.validUntil
                                  ? `Vence ${new Date(promo.validUntil).toLocaleDateString('es-AR')}`
                                  : 'Vigencia permanente'}
                              </span>
                              <span className="font-semibold text-emerald-600">
                                Activa en feed
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── CONTENIDO DEL TAB: CONFIGURACIÓN & ALIAS ── */}
              {activeTab === 'settings' && (
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 mb-1">Ficha y Normalización de Marca</h3>
                    <p className="text-xs text-slate-500">
                      Editá los datos institucionales del comercio y sus alias para evitar duplicados al scrapear.
                    </p>
                  </div>

                  {/* Formulario de edición */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Nombre del Comercio</label>
                      <input
                        type="text"
                        value={commerceDetail.name}
                        onChange={e => setCommerceDetail({ ...commerceDetail, name: e.target.value })}
                        onBlur={e => handleUpdateCommerce({ name: e.target.value })}
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Categoría Predeterminada</label>
                      <select
                        value={commerceDetail.defaultCategoryId || ''}
                        onChange={e => handleUpdateCommerce({ defaultCategoryId: e.target.value || null })}
                        className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Sin categoría asignada</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.icon || '🏷️'} {c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">URL del Logo (local o CDN)</label>
                      <input
                        type="text"
                        value={commerceDetail.logoUrl || ''}
                        placeholder="/logos/comercio.jpg"
                        onChange={e => setCommerceDetail({ ...commerceDetail, logoUrl: e.target.value })}
                        onBlur={e => handleUpdateCommerce({ logoUrl: e.target.value })}
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Sitio Web Oficial</label>
                      <input
                        type="text"
                        value={commerceDetail.website || ''}
                        placeholder="https://..."
                        onChange={e => setCommerceDetail({ ...commerceDetail, website: e.target.value })}
                        onBlur={e => handleUpdateCommerce({ website: e.target.value })}
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">Usuario o URL de Instagram</label>
                      <input
                        type="text"
                        value={commerceDetail.instagramUrl || ''}
                        placeholder="@comercio"
                        onChange={e => setCommerceDetail({ ...commerceDetail, instagramUrl: e.target.value })}
                        onBlur={e => handleUpdateCommerce({ instagramUrl: e.target.value })}
                        className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 flex items-center justify-between pt-6">
                      <div>
                        <label className="text-xs font-bold text-slate-800 block">Comercio Activo</label>
                        <span className="text-[10px] text-slate-400">Si está inactivo, no se mostrará en búsquedas públicas</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={commerceDetail.active}
                        onChange={e => handleUpdateCommerce({ active: e.target.checked })}
                        className="w-5 h-5 accent-indigo-600 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Sección de Alias de Normalización */}
                  <div className="pt-6 border-t border-slate-100 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800">
                      Alias Vinculados ({commerceDetail.aliases?.length || 0})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Nombres alternativos detectados por los scrapers que se fusionan automáticamente en este comercio.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {commerceDetail.aliases?.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No hay alias vinculados actualmente</span>
                      ) : (
                        commerceDetail.aliases.map(al => (
                          <span
                            key={al.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
                          >
                            <span>{al.alias}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── MODAL NUEVO COMERCIO ── */}
      {showNewCommerceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Store size={18} />
                </div>
                <h3 className="text-sm font-black text-slate-900">Dar de Alta Comercio</h3>
              </div>
              <button onClick={() => setShowNewCommerceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCommerce} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Nombre del Comercio *</label>
                <input
                  type="text"
                  placeholder="Ej: Coto, Freddo, Lucciano's..."
                  value={newCommerceName}
                  onChange={e => setNewCommerceName(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Categoría Principal</label>
                <select
                  value={newCommerceCategory}
                  onChange={e => setNewCommerceCategory(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Seleccionar categoría...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon || '🏷️'} {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Modelo de Presencia</label>
                <select
                  value={newCommerceModel}
                  onChange={e => setNewCommerceModel(e.target.value as LocationModel)}
                  className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="UNKNOWN">❓ Desconocido</option>
                  <option value="CHAIN_NATIONAL">🏬 Cadena Nacional</option>
                  <option value="REGIONAL">🗺️ Regional</option>
                  <option value="SINGLE_STORE">📍 Local Único</option>
                  <option value="ONLINE_ONLY">🌐 Solo Online</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewCommerceModal(false)}
                  className="text-xs font-bold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingCommerce || !newCommerceName.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm"
                >
                  {creatingCommerce ? 'Guardando...' : 'Crear Comercio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
