'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { CatalogEntity, FourLevelsCatalog } from './SimulatorPaymentSelector'

export interface TreeFilterSidebarProps {
  fullCatalog: FourLevelsCatalog
  userProfileCatalog: FourLevelsCatalog | null
  userInfo?: {
    name: string | null
    email: string | null
  } | null
  selectedMethods: string[]
  onToggleMethod: (id: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  onSelectProfileOnly: () => void
  selectedDay: string
  onSelectDay: (day: string) => void
  monthlySpend: number
  onChangeSpend: (amount: number) => void
  todayInfo: { bit: number; name: string }
  callbackUrl?: string
  className?: string
  isMobileDrawer?: boolean
  onCloseMobile?: () => void
}

const DAYS = [
  { id: 'all', label: 'Toda la semana', short: 'Todos' },
  { id: 'today', label: 'Hoy', short: 'Hoy' },
  { id: '2', label: 'Lunes', short: 'Lun', bit: 2 },
  { id: '4', label: 'Martes', short: 'Mar', bit: 4 },
  { id: '8', label: 'Miércoles', short: 'Mié', bit: 8 },
  { id: '16', label: 'Jueves', short: 'Jue', bit: 16 },
  { id: '32', label: 'Viernes', short: 'Vie', bit: 32 },
  { id: '64', label: 'Sábado', short: 'Sáb', bit: 64 },
  { id: '1', label: 'Domingo', short: 'Dom', bit: 1 },
]

const SPEND_PRESETS = [40000, 80000, 120000, 160000, 200000]

function TreeTriangle({
  isOpen,
  size = 'md',
  className = '',
}: {
  isOpen: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const dimension = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`${dimension} transition-transform duration-150 shrink-0 ${
        isOpen ? 'rotate-90 text-sky-400' : 'rotate-0 text-slate-400'
      } ${className}`}
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

export default function TreeFilterSidebar({
  fullCatalog,
  userProfileCatalog,
  userInfo,
  selectedMethods,
  onToggleMethod,
  onSelectAll,
  onClearAll,
  onSelectProfileOnly,
  selectedDay,
  onSelectDay,
  monthlySpend,
  onChangeSpend,
  todayInfo,
  callbackUrl = '/ahorro-interactivo/combustible',
  className = '',
  isMobileDrawer = false,
  onCloseMobile,
}: TreeFilterSidebarProps) {
  // Estado de ramas principales abiertas del árbol
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    profile: true,
    profileBanks: true,
    profileWallets: true,
    profileCards: true,
    profileBenefits: false,
    banks: false,
    wallets: false,
    cards: false,
    benefits: false,
    days: true,
    spend: true,
  })

  // Buscador para el catálogo general de bancos
  const [bankSearch, setBankSearch] = useState('')

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const hasProfile = !!(
    userProfileCatalog &&
    (userProfileCatalog.banks.length > 0 ||
      userProfileCatalog.wallets.length > 0 ||
      userProfileCatalog.cards.length > 0 ||
      userProfileCatalog.benefits.length > 0)
  )

  // Bancos filtrados por búsqueda
  const filteredBanks = useMemo(() => {
    if (!bankSearch.trim()) return fullCatalog.banks
    const q = bankSearch.toLowerCase().trim()
    return fullCatalog.banks.filter(
      b => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q)
    )
  }, [fullCatalog.banks, bankSearch])

  // Helpers de selección
  const isSelected = (id: string, slug?: string) => {
    return selectedMethods.includes(id) || (slug ? selectedMethods.includes(slug) : false)
  }

  const countSelected = (items: CatalogEntity[]) => {
    return items.filter(i => isSelected(i.id, i.slug)).length
  }

  const banksSelected = countSelected(fullCatalog.banks)
  const walletsSelected = countSelected(fullCatalog.wallets)
  const cardsSelected = countSelected(fullCatalog.cards)
  const benefitsSelected = countSelected(fullCatalog.benefits)

  // Conteos del perfil guardado
  const pBanks = userProfileCatalog?.banks || []
  const pWallets = userProfileCatalog?.wallets || []
  const pCards = userProfileCatalog?.cards || []
  const pBenefits = userProfileCatalog?.benefits || []

  const pBanksSelected = countSelected(pBanks)
  const pWalletsSelected = countSelected(pWallets)
  const pCardsSelected = countSelected(pCards)
  const pBenefitsSelected = countSelected(pBenefits)

  const profileTotal = pBanks.length + pWallets.length + pCards.length + pBenefits.length
  const profileTotalSelected = pBanksSelected + pWalletsSelected + pCardsSelected + pBenefitsSelected

  // Toggle en lote para una categoría
  const toggleGroup = (items: CatalogEntity[]) => {
    const ids = items.map(i => i.id)
    const allActive = ids.every(id => selectedMethods.includes(id))
    if (allActive) {
      ids.forEach(id => {
        if (selectedMethods.includes(id)) onToggleMethod(id)
      })
    } else {
      ids.forEach(id => {
        if (!selectedMethods.includes(id)) onToggleMethod(id)
      })
    }
  }

  return (
    <div
      className={`bg-slate-900/95 border border-slate-800/80 rounded-2xl flex flex-col text-slate-200 ${
        isMobileDrawer
          ? 'w-full h-full p-4 overflow-y-auto custom-scrollbar'
          : 'p-4 lg:sticky lg:top-20 max-h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar shadow-xl'
      } ${className}`}
    >
      {/* Encabezado limpio del Árbol */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200">Filtros</span>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-800/90 px-1.5 py-0.5 rounded">
            {selectedMethods.length} activos
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={onSelectAll}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Todos
          </button>
          <span className="text-slate-600">•</span>
          <button
            onClick={onClearAll}
            className="text-slate-400 hover:text-rose-400 transition-colors"
          >
            Limpiar
          </button>
          {isMobileDrawer && onCloseMobile && (
            <>
              <span className="text-slate-600">•</span>
              <button
                onClick={onCloseMobile}
                className="text-slate-400 hover:text-white font-bold p-1"
                aria-label="Cerrar filtros"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>

      {/* Árbol Jerárquico */}
      <div className="space-y-2 text-xs flex-1">
        {/* =================================================================== */}
        {/* NODO 1: MIS GUARDADAS (ÁRBOL COMPRIMIDO)                            */}
        {/* =================================================================== */}
        {hasProfile ? (
          <div className="border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
            {/* Cabecera del nodo raíz de guardadas */}
            <div
              onClick={() => toggleSection('profile')}
              className="flex items-center justify-between p-2.5 cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <TreeTriangle isOpen={openSections.profile} />
                <span className="font-semibold text-slate-200">Mi perfil de PromoAR</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.2 rounded">
                  {profileTotalSelected}/{profileTotal}
                </span>
              </div>
            </div>

            {openSections.profile && (
              <div className="p-2 pt-0 border-t border-slate-800/60 space-y-1.5">
                <div className="flex items-center justify-between py-1 px-1">
                  <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                    {userInfo?.name || userInfo?.email || 'Cuenta'}
                  </span>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      onSelectProfileOnly()
                    }}
                    className="text-[10px] text-sky-400 hover:text-sky-300 font-medium hover:underline"
                  >
                    Solo mi perfil
                  </button>
                </div>

                {/* Sub-rama Bancos guardados */}
                {pBanks.length > 0 && (
                  <div className="border-l border-slate-800 ml-2 pl-2 space-y-1">
                    <div
                      onClick={() => toggleSection('profileBanks')}
                      className="flex items-center justify-between py-0.5 cursor-pointer hover:text-white text-slate-400 select-none text-[11px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <TreeTriangle isOpen={openSections.profileBanks} size="sm" />
                        <span>Bancos</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {pBanksSelected}/{pBanks.length}
                      </span>
                    </div>

                    {openSections.profileBanks && (
                      <div className="space-y-0.5 pl-2 border-l border-slate-800/50">
                        {pBanks.map(item => {
                          const sel = isSelected(item.id, item.slug)
                          return (
                            <label
                              key={item.id}
                              className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-slate-800/40 cursor-pointer select-none text-slate-300"
                            >
                              <input
                                type="checkbox"
                                checked={sel}
                                onChange={() => onToggleMethod(item.id)}
                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 accent-sky-500 cursor-pointer"
                              />
                              <span className="truncate text-xs">{item.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-rama Billeteras guardadas */}
                {pWallets.length > 0 && (
                  <div className="border-l border-slate-800 ml-2 pl-2 space-y-1">
                    <div
                      onClick={() => toggleSection('profileWallets')}
                      className="flex items-center justify-between py-0.5 cursor-pointer hover:text-white text-slate-400 select-none text-[11px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <TreeTriangle isOpen={openSections.profileWallets} size="sm" />
                        <span>Billeteras</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {pWalletsSelected}/{pWallets.length}
                      </span>
                    </div>

                    {openSections.profileWallets && (
                      <div className="space-y-0.5 pl-2 border-l border-slate-800/50">
                        {pWallets.map(item => {
                          const sel = isSelected(item.id, item.slug)
                          return (
                            <label
                              key={item.id}
                              className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-slate-800/40 cursor-pointer select-none text-slate-300"
                            >
                              <input
                                type="checkbox"
                                checked={sel}
                                onChange={() => onToggleMethod(item.id)}
                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 accent-sky-500 cursor-pointer"
                              />
                              <span className="truncate text-xs">{item.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-rama Tarjetas guardadas */}
                {pCards.length > 0 && (
                  <div className="border-l border-slate-800 ml-2 pl-2 space-y-1">
                    <div
                      onClick={() => toggleSection('profileCards')}
                      className="flex items-center justify-between py-0.5 cursor-pointer hover:text-white text-slate-400 select-none text-[11px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <TreeTriangle isOpen={openSections.profileCards} size="sm" />
                        <span>Tarjetas</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {pCardsSelected}/{pCards.length}
                      </span>
                    </div>

                    {openSections.profileCards && (
                      <div className="space-y-0.5 pl-2 border-l border-slate-800/50">
                        {pCards.map(item => {
                          const sel = isSelected(item.id, item.slug)
                          return (
                            <label
                              key={item.id}
                              className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-slate-800/40 cursor-pointer select-none text-slate-300"
                            >
                              <input
                                type="checkbox"
                                checked={sel}
                                onChange={() => onToggleMethod(item.id)}
                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 accent-sky-500 cursor-pointer"
                              />
                              <span className="truncate text-xs">{item.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-rama Beneficios guardados */}
                {pBenefits.length > 0 && (
                  <div className="border-l border-slate-800 ml-2 pl-2 space-y-1">
                    <div
                      onClick={() => toggleSection('profileBenefits')}
                      className="flex items-center justify-between py-0.5 cursor-pointer hover:text-white text-slate-400 select-none text-[11px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <TreeTriangle isOpen={openSections.profileBenefits} size="sm" />
                        <span>Clubes</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {pBenefitsSelected}/{pBenefits.length}
                      </span>
                    </div>

                    {openSections.profileBenefits && (
                      <div className="space-y-0.5 pl-2 border-l border-slate-800/50">
                        {pBenefits.map(item => {
                          const sel = isSelected(item.id, item.slug)
                          return (
                            <label
                              key={item.id}
                              className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-slate-800/40 cursor-pointer select-none text-slate-300"
                            >
                              <input
                                type="checkbox"
                                checked={sel}
                                onChange={() => onToggleMethod(item.id)}
                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 accent-sky-500 cursor-pointer"
                              />
                              <span className="truncate text-xs">{item.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-slate-800/80 rounded-xl bg-slate-950/40 p-3 space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
              <TreeTriangle isOpen={false} />
              <span>Mi perfil de PromoAR</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Logueate a PromoAR para ver tu perfil financiero y filtrar automáticamente con tus tarjetas.
            </p>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 text-xs font-semibold transition-colors"
            >
              <span>Iniciar sesión</span> →
            </Link>
          </div>
        )}

        {/* =================================================================== */}
        {/* NODO 2: BANCOS (CATÁLOGO GENERAL)                                   */}
        {/* =================================================================== */}
        <div className="border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
          <div
            onClick={() => toggleSection('banks')}
            className="flex items-center justify-between p-2.5 cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TreeTriangle isOpen={openSections.banks} />
              <span className="font-semibold text-slate-200">Todos los Bancos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={e => {
                  e.stopPropagation()
                  toggleGroup(fullCatalog.banks)
                }}
                className="text-[10px] text-slate-400 hover:text-white mr-1"
              >
                {banksSelected === fullCatalog.banks.length ? 'Ninguno' : 'Todos'}
              </button>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.2 rounded">
                {banksSelected}/{fullCatalog.banks.length}
              </span>
            </div>
          </div>

          {openSections.banks && (
            <div className="p-2 pt-0 border-t border-slate-800/60 space-y-1.5">
              <div className="pt-1.5">
                <input
                  type="text"
                  placeholder="Buscar banco..."
                  value={bankSearch}
                  onChange={e => setBankSearch(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
                />
              </div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5 pr-1 border-l border-slate-800 ml-1.5 pl-2">
                {filteredBanks.map(b => {
                  const sel = isSelected(b.id, b.slug)
                  return (
                    <label
                      key={b.id}
                      className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-slate-800/40 cursor-pointer select-none text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => onToggleMethod(b.id)}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 accent-sky-500 cursor-pointer"
                      />
                      <span className="truncate text-xs">{b.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* NODO 3: BILLETERAS VIRTUALES                                        */}
        {/* =================================================================== */}
        <div className="border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
          <div
            onClick={() => toggleSection('wallets')}
            className="flex items-center justify-between p-2.5 cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TreeTriangle isOpen={openSections.wallets} />
              <span className="font-semibold text-slate-200">Billeteras</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={e => {
                  e.stopPropagation()
                  toggleGroup(fullCatalog.wallets)
                }}
                className="text-[10px] text-slate-400 hover:text-white mr-1"
              >
                {walletsSelected === fullCatalog.wallets.length ? 'Ninguna' : 'Todas'}
              </button>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.2 rounded">
                {walletsSelected}/{fullCatalog.wallets.length}
              </span>
            </div>
          </div>

          {openSections.wallets && (
            <div className="p-2 pt-0 border-t border-slate-800/60">
              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5 pr-1 border-l border-slate-800 ml-1.5 pl-2 pt-1">
                {fullCatalog.wallets.map(w => {
                  const sel = isSelected(w.id, w.slug)
                  return (
                    <label
                      key={w.id}
                      className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-slate-800/40 cursor-pointer select-none text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => onToggleMethod(w.id)}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 accent-sky-500 cursor-pointer"
                      />
                      <span className="truncate text-xs">{w.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* NODO 4: TARJETAS (REDES)                                            */}
        {/* =================================================================== */}
        <div className="border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
          <div
            onClick={() => toggleSection('cards')}
            className="flex items-center justify-between p-2.5 cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TreeTriangle isOpen={openSections.cards} />
              <span className="font-semibold text-slate-200">Tarjetas / Redes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={e => {
                  e.stopPropagation()
                  toggleGroup(fullCatalog.cards)
                }}
                className="text-[10px] text-slate-400 hover:text-white mr-1"
              >
                {cardsSelected === fullCatalog.cards.length ? 'Ninguna' : 'Todas'}
              </button>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.2 rounded">
                {cardsSelected}/{fullCatalog.cards.length}
              </span>
            </div>
          </div>

          {openSections.cards && (
            <div className="p-2 pt-0 border-t border-slate-800/60">
              <div className="space-y-0.5 border-l border-slate-800 ml-1.5 pl-2 pt-1">
                {fullCatalog.cards.map(c => {
                  const sel = isSelected(c.id, c.slug)
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-slate-800/40 cursor-pointer select-none text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => onToggleMethod(c.id)}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 accent-sky-500 cursor-pointer"
                      />
                      <span className="truncate text-xs">{c.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* NODO 5: CLUBES DE BENEFICIOS                                       */}
        {/* =================================================================== */}
        {fullCatalog.benefits.length > 0 && (
          <div className="border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
            <div
              onClick={() => toggleSection('benefits')}
              className="flex items-center justify-between p-2.5 cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <TreeTriangle isOpen={openSections.benefits} />
                <span className="font-semibold text-slate-200">Clubes de Beneficios</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.2 rounded">
                {benefitsSelected}/{fullCatalog.benefits.length}
              </span>
            </div>

            {openSections.benefits && (
              <div className="p-2 pt-0 border-t border-slate-800/60">
                <div className="space-y-0.5 border-l border-slate-800 ml-1.5 pl-2 pt-1">
                  {fullCatalog.benefits.map(be => {
                    const sel = isSelected(be.id, be.slug)
                    return (
                      <label
                        key={be.id}
                        className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-slate-800/40 cursor-pointer select-none text-slate-300"
                      >
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => onToggleMethod(be.id)}
                          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 accent-sky-500 cursor-pointer"
                        />
                        <span className="truncate text-xs">{be.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* NODO 6: DÍA DE LA SEMANA                                            */}
        {/* =================================================================== */}
        <div className="border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
          <div
            onClick={() => toggleSection('days')}
            className="flex items-center justify-between p-2.5 cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TreeTriangle isOpen={openSections.days} />
              <span className="font-semibold text-slate-200">Día de Carga</span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {selectedDay === 'today'
                ? `Hoy (${todayInfo.name})`
                : DAYS.find(d => d.id === selectedDay)?.short}
            </span>
          </div>

          {openSections.days && (
            <div className="p-2 pt-0 border-t border-slate-800/60">
              <div className="grid grid-cols-2 gap-1 pt-1.5">
                {DAYS.map(day => (
                  <button
                    key={day.id}
                    onClick={() => onSelectDay(day.id)}
                    className={`px-2 py-1 rounded text-left text-xs transition-colors ${
                      selectedDay === day.id
                        ? 'bg-slate-800 text-white font-semibold border border-slate-700'
                        : 'bg-slate-950/50 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* NODO 7: GASTO MENSUAL                                               */}
        {/* =================================================================== */}
        <div className="border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
          <div
            onClick={() => toggleSection('spend')}
            className="flex items-center justify-between p-2.5 cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TreeTriangle isOpen={openSections.spend} />
              <span className="font-semibold text-slate-200">Gasto Estimado</span>
            </div>
            <span className="text-xs font-mono text-slate-200">
              ${monthlySpend.toLocaleString('es-AR')}
            </span>
          </div>

          {openSections.spend && (
            <div className="p-2 pt-0 border-t border-slate-800/60 space-y-2">
              <div className="grid grid-cols-5 gap-1 pt-1.5">
                {SPEND_PRESETS.map(amount => (
                  <button
                    key={amount}
                    onClick={() => onChangeSpend(amount)}
                    className={`py-1 rounded text-[11px] font-mono text-center transition-colors ${
                      monthlySpend === amount
                        ? 'bg-slate-800 text-white font-semibold border border-slate-700'
                        : 'bg-slate-950/50 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    ${amount / 1000}k
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={20000}
                max={300000}
                step={10000}
                value={monthlySpend}
                onChange={e => onChangeSpend(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-500"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
