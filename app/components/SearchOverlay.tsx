'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Search } from 'lucide-react'

const SESSION_KEY = 'promoar_search_overlay_seen'

type EntityItem = { id: string; name: string; popular?: boolean }
type CommerceItem = { id: string; name: string; slug: string; logoUrl: string | null; popular?: boolean }
type GuestProfile = { cards?: unknown[] } | null

type EntitiesResponse = {
  banks?: EntityItem[]
  wallets?: EntityItem[]
  cardNetworks?: EntityItem[]
}

type ResultGroup = {
  type: 'commerce' | 'bank' | 'wallet' | 'network'
  label: string
  items: { id: string; name: string; subtitle?: string }[]
}

type SearchOverlayProps = {
  /** Si se pasa, el overlay aplica el filtro en la página actual en vez de navegar. */
  onSelectCommerce?: (commerceName: string) => void
  onSelectEntity?: (type: 'bank' | 'wallet' | 'network', id: string) => void
  /** Enter/lupa con una query de producto: la página debe filtrar y mostrar las tarjetitas normales. */
  onSearchProduct?: (query: string) => void
  /** Control externo: ej. un trigger clickeable que reabre el overlay (Spotlight-style). */
  forceOpen?: boolean
  onForceOpenHandled?: () => void
  /** Perfil financiero del usuario, para que "buscar productos" devuelva solo comercios con promo que aplica. */
  forMe?: boolean
  guestProfile?: GuestProfile
}

export default function SearchOverlay({
  onSelectCommerce,
  onSelectEntity,
  onSearchProduct,
  forceOpen,
  onForceOpenHandled,
}: SearchOverlayProps) {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [query, setQuery] = useState('')
  const [commerces, setCommerces] = useState<CommerceItem[]>([])
  const [entities, setEntities] = useState<EntitiesResponse>({})

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return
    } catch {}
    setShow(true)
  }, [])

  useEffect(() => {
    if (!forceOpen) return
    setQuery('')
    setShow(true)
    onForceOpenHandled?.()
  }, [forceOpen, onForceOpenHandled])

  useEffect(() => {
    if (!show) return
    fetch('/api/public/commerces')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.commerces) setCommerces(data.commerces) })
      .catch(() => {})
    fetch('/api/public/entities')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.banks) setEntities(data) })
      .catch(() => {})
  }, [show])

  const close = () => {
    setShow(false)
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
  }

  // Enter / lupa: no se busca nada acá adentro. Se delega a la página, que
  // filtra el catálogo real y muestra las tarjetitas normales (mismo circuito
  // que el tab "Productos" ya existente en /promos/explorar).
  const submitProductSearch = () => {
    const q = query.trim()
    if (q.length < 2) return
    if (onSearchProduct) {
      onSearchProduct(q)
    } else {
      router.push(`/promos/explorar?product=${encodeURIComponent(q)}`)
    }
    close()
  }

  const popularSuggestions = useMemo(() => {
    const popularCommerces = commerces.filter(c => c.popular).slice(0, 3).map(c => c.name)
    const popularBanks = (entities.banks ?? []).filter(b => b.popular).slice(0, 2).map(b => b.name)
    const popularWallets = (entities.wallets ?? []).filter(w => w.popular).slice(0, 2).map(w => w.name)
    return [...popularCommerces, ...popularBanks, ...popularWallets].slice(0, 6)
  }, [commerces, entities])

  const results = useMemo((): ResultGroup[] => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const groups: ResultGroup[] = []

    const matchedCommerces = commerces.filter(c => c.name.toLowerCase().includes(q)).slice(0, 6)
    if (matchedCommerces.length) {
      groups.push({ type: 'commerce', label: 'Comercios', items: matchedCommerces })
    }

    const matchedBanks = (entities.banks ?? []).filter(b => b.name.toLowerCase().includes(q)).slice(0, 4)
    if (matchedBanks.length) {
      groups.push({ type: 'bank', label: 'Bancos', items: matchedBanks })
    }

    const matchedWallets = (entities.wallets ?? []).filter(w => w.name.toLowerCase().includes(q)).slice(0, 4)
    if (matchedWallets.length) {
      groups.push({ type: 'wallet', label: 'Billeteras', items: matchedWallets })
    }

    const matchedNetworks = (entities.cardNetworks ?? []).filter(n => n.name.toLowerCase().includes(q)).slice(0, 4)
    if (matchedNetworks.length) {
      groups.push({ type: 'network', label: 'Tarjetas', items: matchedNetworks })
    }
    return groups
  }, [query, commerces, entities])

  const selectCommerce = (name: string) => {
    if (onSelectCommerce) {
      onSelectCommerce(name)
    } else {
      router.push(`/promos/explorar?commerce=${encodeURIComponent(name)}`)
    }
    close()
  }

  const selectEntity = (type: 'bank' | 'wallet' | 'network', id: string) => {
    if (onSelectEntity) {
      onSelectEntity(type, id)
    } else {
      router.push(`/promos/explorar?${type}=${encodeURIComponent(id)}`)
    }
    close()
  }

  if (!show) return null

  const q = query.trim()
  const showProductCta = q.length >= 2

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={close}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#132544] rounded-2xl p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1D3D6E] dark:text-white">¿Qué descuento buscás hoy?</h2>
          <button
            onClick={close}
            aria-label="Cerrar buscador"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-stretch gap-2 mb-1.5">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitProductSearch() }}
              placeholder="Comercio, banco, billetera, tarjeta o un producto..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F2040] text-[15px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D3D6E]/30"
            />
          </div>
          {showProductCta && (
            <button
              onClick={submitProductSearch}
              aria-label="Buscar producto"
              className="shrink-0 px-4 rounded-xl text-[13px] font-bold text-white bg-[#1D3D6E] hover:opacity-90"
            >
              <Search size={16} />
            </button>
          )}
        </div>
        {q.length >= 2 && (
          <p className="text-[11px] text-slate-400 mb-3">
            Comercios, bancos, billeteras y tarjetas se filtran solos. Para buscar un producto (ej. &quot;carteras de cuero&quot;) apretá Enter o la lupa — te lleva a los resultados en la página.
          </p>
        )}

        {query.trim() === '' ? (
          popularSuggestions.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Búsquedas populares</p>
              <div className="flex flex-wrap gap-2">
                {popularSuggestions.map(name => (
                  <button
                    key={name}
                    onClick={() => setQuery(name)}
                    className="px-3 py-1.5 rounded-full text-[13px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="max-h-[360px] overflow-y-auto space-y-4">
            {results.length === 0 && (
              <p className="text-[13px] text-slate-400 py-4 text-center">
                Sin coincidencias de comercio/banco/billetera/tarjeta para &quot;{query}&quot;. Si es un producto, apretá Enter o la lupa.
              </p>
            )}

            {results.map(group => (
              <div key={group.type}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => group.type === 'commerce' ? selectCommerce(item.name) : selectEntity(group.type, item.id)}
                      className="w-full flex items-baseline justify-between gap-2 text-left px-3 py-2 rounded-lg text-[14px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                      <span>{item.name}</span>
                      {item.subtitle && (
                        <span className="text-[11px] text-slate-400 shrink-0">{item.subtitle}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
