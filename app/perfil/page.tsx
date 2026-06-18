'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Building2, Wallet, CreditCard, LogOut, X, Trash2, Plus, Heart, Mail, Pencil, Bell } from 'lucide-react'
import BottomNav from '../components/BottomNav'
import PromoWizard, { GuestProfile } from '../components/PromoWizard'
import NotificationSettings from '../components/NotificationSettings'

// ─── Types ────────────────────────────────────────────────────────────────────
type BankSegment = { id: string; name: string; bankId: string }
type EntityItem = { id: string; name: string; slug: string; segments?: BankSegment[]; cardNetworks?: { id: string; name: string }[] }
type FinancialProduct = {
  id: string
  cardType: string   // CREDIT | DEBIT | PREPAID | ACCOUNT
  segmentRef?: { id: string; name: string } | null
  bank?: { id: string; name: string } | null
  cardNetwork?: { id: string; name: string } | null
  wallet?: { id: string; name: string } | null
  lastFour?: string | null
  accountNumber?: string | null
  shortAccountNumber?: string | null
  bankAccountType?: string | null
  currency?: string | null
  alias?: string | null
  isPayroll?: boolean
  isPensioner?: boolean
  cardSegmentId?: string | null
  cardSegmentRef?: { id: string; name: string; cardType: string; cardNetwork: { name: string } } | null
}
type Profile = {
  banks: { bankId: string; bank: EntityItem }[]
  wallets: { walletId: string; wallet: EntityItem }[]
  cards: FinancialProduct[]
}
type Entities = {
  banks: EntityItem[]
  wallets: EntityItem[]
  cardNetworks: EntityItem[]
  segments: BankSegment[]
  currencies: { id: string; name: string; code: string; symbol: string }[]
  accountTypes: { id: string; name: string; description: string }[]
}
type UserData = {
  id: string; name: string | null; lastName: string | null; email: string; role: string
  phoneMobile: string | null; phoneFixed: string | null
  documentType: string | null; documentNumber: string | null
  addressStreet: string | null; addressNumber: string | null
  addressFloor: string | null; addressApt: string | null
  addressZipCode: string | null; addressCity: string | null
  addressState: string | null; addressCountry: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CARD_TYPE_LABELS: Record<string, string> = {
  CREDIT: 'Crédito', DEBIT: 'Débito', PREPAID: 'Prepaga', ACCOUNT: 'Cuenta',
}

/**
 * Reglas de visualización:
 *  - Banco + Cuenta   → "Cuenta Bancaria · CBU: <número completo>"
 *  - Banco + Tarjeta  → "Tarjeta de Crédito · Visa · **** **** **** XXXX"
 *  - Billetera + Tarjeta → "Tarjeta de Débito · Mastercard · **** **** **** XXXX  |  CVU: <número completo>"
 */
function productLabel(p: FinancialProduct): { entity: string; detail: string } {
  const bankName = p.bank?.name
  const walletName = p.wallet?.name
  const isModo = walletName?.toLowerCase().includes('modo')

  // Si tiene banco y es MODO, mostrar "Banco (MODO)"
  // Si tiene solo banco, mostrar "Banco"
  // Si tiene solo wallet, mostrar "Wallet"
  let entity = bankName || walletName || 'Sin entidad'
  if (bankName && isModo) {
    entity = `${bankName} (MODO)`
  }

  const segment = p.segmentRef?.name ? ` · ${p.segmentRef.name}` : ''
  const isAccount = p.cardType === 'ACCOUNT'

  let detail: string
  if (isAccount) {
    // Banco + Cuenta
    const typeLabel = p.bankAccountType === 'CC' ? 'Cuenta Corriente' : 'Caja de Ahorros'
    const currLabel = p.currency === 'USD' ? 'Dólares' : 'Pesos'
    detail = `${typeLabel} en ${currLabel}`
    if (p.isPayroll) detail += ' · Cuenta Sueldo'
    if (p.isPensioner) detail += ' · Jubilación'
    if (p.shortAccountNumber) detail += ` · Nro: ${p.shortAccountNumber}`
    if (p.accountNumber) detail += ` | CBU: ${p.accountNumber}`
    if (p.alias) detail += ` | Alias: ${p.alias}`
  } else if (p.wallet) {
    // Billetera + Tarjeta
    detail = `Tarjeta de ${CARD_TYPE_LABELS[p.cardType] ?? p.cardType}`
    if (p.cardNetwork?.name) detail += ` · ${p.cardNetwork.name}`
    if (p.lastFour) detail += `  ·  **** **** **** ${p.lastFour}`
    if (p.accountNumber) detail += ` | CVU: ${p.accountNumber}`
    if (p.alias) detail += ` | Alias: ${p.alias}`
  } else {
    // Banco + Tarjeta
    detail = `Tarjeta de ${CARD_TYPE_LABELS[p.cardType] ?? p.cardType}`
    if (p.cardNetwork?.name) detail += ` · ${p.cardNetwork.name}`
    if (p.lastFour) detail += `  ·  **** **** **** ${p.lastFour}`
  }

  return { entity: entity + segment, detail }
}

function productIcon(p: FinancialProduct) {
  if (p.wallet) return { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-600 dark:text-purple-400', Icon: Wallet }
  if (p.cardType === 'ACCOUNT') return { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400', Icon: Building2 }
  return { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-600 dark:text-orange-400', Icon: CreditCard }
}

// Clases reutilizables
const inp = 'w-full bg-gray-50 dark:bg-slate-700 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 text-sm font-medium text-gray-900 dark:text-white dark:text-white px-4 py-3 rounded-2xl focus:bg-white dark:focus:bg-slate-600 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all outline-none'
const sel = 'w-full bg-gray-50 dark:bg-slate-700 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 text-sm font-medium text-gray-900 dark:text-white dark:text-white px-4 py-3 rounded-2xl focus:bg-white dark:focus:bg-slate-600 outline-none appearance-none'
const inpInd = 'w-full bg-gray-50 dark:bg-slate-700 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 text-sm font-medium text-gray-900 dark:text-white dark:text-white px-4 py-3 rounded-2xl focus:bg-white dark:focus:bg-slate-600 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all outline-none'
const selInd = 'w-full bg-gray-50 dark:bg-slate-700 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 text-sm font-medium text-gray-900 dark:text-white dark:text-white px-4 py-3 rounded-2xl focus:bg-white dark:focus:bg-slate-600 focus:border-indigo-400 outline-none appearance-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-gray-400 dark:text-slate-500 dark:text-slate-500 uppercase tracking-wide ml-1 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PerfilPage() {
  const { data: session, update: updateSession } = useSession()
  const email = session?.user?.email

  const [userData, setUserData] = useState<UserData | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [entities, setEntities] = useState<Entities | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [activeTab, setActiveTab] = useState<'personal' | 'finance' | 'notif'>('personal')

  const [showSaved, setShowSaved] = useState(false)
  const [savedPromos, setSavedPromos] = useState<any[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  // ── Formulario datos personales ──
  const [pf, setPf] = useState({
    name: '', lastName: '', phoneMobile: '', phoneFixed: '',
    documentType: 'DNI', documentNumber: '',
    addressStreet: '', addressNumber: '', addressFloor: '', addressApt: '',
    addressZipCode: '', addressCity: '', addressState: '', addressCountry: 'Argentina',
  })

  useEffect(() => {
    if (!userData) return
    setPf({
      name: userData.name || '',
      lastName: userData.lastName || '',
      phoneMobile: userData.phoneMobile || '',
      phoneFixed: userData.phoneFixed || '',
      documentType: userData.documentType || 'DNI',
      documentNumber: userData.documentNumber || '',
      addressStreet: userData.addressStreet || '',
      addressNumber: userData.addressNumber || '',
      addressFloor: userData.addressFloor || '',
      addressApt: userData.addressApt || '',
      addressZipCode: userData.addressZipCode || '',
      addressCity: userData.addressCity || '',
      addressState: userData.addressState || '',
      addressCountry: userData.addressCountry || 'Argentina',
    })
  }, [userData])

  // ── Formulario nuevo producto financiero ──
  const [productNetworks, setProductNetworks] = useState<{ id: string; name: string }[]>([])
  const [productCardSegments, setProductCardSegments] = useState<{ id: string; name: string; cardNetworkId: string; cardType: string }[]>([])
  const [addingProduct, setAddingProduct] = useState(false)

  // MODO es una app de pago vinculada al banco, no una entidad independiente.
  // Lo resolvemos desde la lista de wallets para usarlo como toggle.
  const modoWallet = entities?.wallets.find(w => w.name.toLowerCase().includes('modo'))

  const emptyProduct = {
    entityType: '' as 'bank' | 'wallet' | '',
    bankId: '', walletId: '', segmentId: '',
    productType: 'CARD' as 'CARD' | 'ACCOUNT',
    // ⚠️ DEPRECATED: cardType ya no se usa solo, ahora cada network tiene su tipo
    cardType: 'CREDIT',
    // Cada item es una combinación de RED + TIPO + SEGMENTO + MODO
    selectedCards: [] as { networkId: string; cardType: 'CREDIT' | 'DEBIT' | 'PREPAID'; segmentId: string | null; modo: boolean }[],
    lastFour: '',
    accountNumber: '',
    shortAccountNumber: '',
    bankAccountType: 'CA',
    currency: 'ARS',
    alias: '',
    isPayroll: false,
    isPensioner: false,
    modoEnabled: false, // para Cuentas (ACCOUNT) seguimos usando un toggle simple
  }
  const [np, setNp] = useState(emptyProduct)

  function resetForm() { setNp(emptyProduct); setProductNetworks([]); setProductCardSegments([]) }

  // Nueva función: toggle una combinación de Red + Tipo + Segmento
  const toggleCard = (networkId: string, cardType: 'CREDIT' | 'DEBIT' | 'PREPAID', segmentId: string | null) => {
    setNp(n => {
      const exists = n.selectedCards.find(x => x.networkId === networkId && x.cardType === cardType && x.segmentId === segmentId)
      if (exists) {
        // Desmarcar
        return { ...n, selectedCards: n.selectedCards.filter(x => !(x.networkId === networkId && x.cardType === cardType && x.segmentId === segmentId)) }
      } else {
        // Marcar
        return { ...n, selectedCards: [...n.selectedCards, { networkId, cardType, segmentId, modo: false }] }
      }
    })
  }

  // Toggle MODO en una card específica
  const toggleCardModo = (e: React.MouseEvent, networkId: string, cardType: 'CREDIT' | 'DEBIT' | 'PREPAID', segmentId: string | null) => {
    e.stopPropagation()
    setNp(n => ({
      ...n,
      selectedCards: n.selectedCards.map(x =>
        (x.networkId === networkId && x.cardType === cardType && x.segmentId === segmentId)
          ? { ...x, modo: !x.modo }
          : x
      )
    }))
  }

  function handleEntityChange(entityId: string) {
    const bank = entities?.banks.find(b => b.id === entityId)
    if (bank) {
      setNp(n => ({
        ...n,
        entityType: 'bank', bankId: entityId, walletId: '', segmentId: '',
        productType: 'CARD', lastFour: '', accountNumber: '',
        shortAccountNumber: '', bankAccountType: 'CA', currency: 'ARS',
        alias: '', isPayroll: false, isPensioner: false, modoEnabled: false,
      }))
      setProductNetworks(bank.cardNetworks || [])
      setProductCardSegments((bank as any).cardSegments || [])
      return
    }
    // Solo las billeteras que NO son MODO se pueden agregar como entidad independiente
    const wallet = entities?.wallets.find(w => w.id === entityId)
    if (wallet) {
      setNp(n => ({
        ...n,
        entityType: 'wallet', walletId: entityId, bankId: '', segmentId: '',
        productType: 'CARD', lastFour: '', accountNumber: '',
        shortAccountNumber: '', bankAccountType: 'CA', currency: 'ARS',
        alias: '', isPayroll: false, isPensioner: false, modoEnabled: false,
      }))
      return
    }
    setNp(n => ({ ...n, entityType: '', bankId: '', walletId: '', segmentId: '', lastFour: '', accountNumber: '', modoEnabled: false }))
    setProductNetworks([])
    setProductCardSegments([])
  }

  function handleEditProduct(p: FinancialProduct) {
    const bank = entities?.banks.find(b => b.id === p.bank?.id)
    const wallet = entities?.wallets.find(w => w.id === p.wallet?.id)
    const isModo = wallet?.name.toLowerCase().includes('modo') ?? false

    setEditingId(p.id)
    setAddingProduct(true)

    setNp({
      entityType: bank ? 'bank' : (wallet && !isModo) ? 'wallet' : '',
      bankId: p.bank?.id || '',
      walletId: (wallet && !isModo) ? (p.wallet?.id || '') : '',
      segmentId: p.segmentRef?.id || '',
      productType: p.cardType === 'ACCOUNT' ? 'ACCOUNT' : 'CARD',
      cardType: p.cardType === 'ACCOUNT' ? 'CREDIT' : p.cardType, // legacy, no se usa
      // ✅ Convertir la card existente a formato selectedCards
      selectedCards: p.cardNetwork?.id
        ? [{ networkId: p.cardNetwork.id, cardType: p.cardType as 'CREDIT' | 'DEBIT' | 'PREPAID', segmentId: p.cardSegmentId || null, modo: isModo }]
        : [],
      lastFour: p.lastFour || '',
      accountNumber: p.accountNumber || '',
      shortAccountNumber: p.shortAccountNumber || '',
      bankAccountType: p.bankAccountType || 'CA',
      currency: p.currency || 'ARS',
      alias: p.alias || '',
      isPayroll: !!p.isPayroll,
      isPensioner: !!p.isPensioner,
      modoEnabled: isModo,  // Si era una cuenta, usamos el toggle
    })

    if (bank) {
      setProductNetworks(bank.cardNetworks || [])
      setProductCardSegments((bank as any).cardSegments || [])
    } else {
      setProductNetworks([])
      setProductCardSegments([])
    }
  }

  // ── API ──
  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
  }), [])

  const fetchProfile = useCallback(async () => {
    if (!email) return
    setLoading(true)
    try {
      const res = await fetch('/api/perfil', { headers: headers() })
      if (res.ok) { const d = await res.json(); setUserData(d.user); setProfile(d.profile) }
    } finally { setLoading(false) }
  }, [email, headers])

  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch('/api/public/entities')
      if (res.ok) {
        const data = await res.json()
        setEntities(data)
      }
    } catch (e) {
      console.error('Error fetching entities:', e)
    }
  }, [])

  useEffect(() => { fetchProfile(); fetchEntities() }, [fetchProfile, fetchEntities])

  async function callApi(action: string, extra: Record<string, any> = {}) {
    setSaving(true)
    try {
      const res = await fetch('/api/perfil', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) throw new Error()
      await fetchProfile()
    } catch { alert('Hubo un error al guardar los cambios') }
    finally { setSaving(false) }
  }

  async function handleUpdateProfile() {
    await callApi('update_profile', pf)
    if (updateSession) await updateSession({ name: pf.name })
    alert('Perfil actualizado correctamente')
  }

  async function handleAddProduct() {
    console.log('[handleAddProduct] productType:', np.productType, 'selectedCards:', JSON.stringify(np.selectedCards), 'bankId:', np.bankId, 'segmentId:', np.segmentId)
    if (np.productType === 'CARD') {
      // Creación de múltiples tarjetas (una por cada combinación de red + tipo)
      await Promise.all(np.selectedCards.map(async (card) => {
        const payload = {
          cardId: editingId || undefined,
          cardBankId: np.bankId || undefined,
          cardWalletId: (card.modo && modoWallet) ? modoWallet.id : (np.walletId || null),
          segmentId: np.segmentId || undefined,
          cardSegmentId: card.segmentId || undefined,
          cardType: card.cardType,  // ✅ Ahora cada card tiene su propio tipo
          cardNetworkIds: [card.networkId],
          lastFour: np.lastFour || undefined,
          accountNumber: np.accountNumber || undefined,
          shortAccountNumber: np.shortAccountNumber || undefined,
          bankAccountType: np.bankAccountType || undefined,
          currency: np.currency || undefined,
          alias: np.alias || undefined,
          isPayroll: np.isPayroll || false,
          isPensioner: np.isPensioner || false,
        }
        await callApi(editingId ? 'update_card' : 'add_card', payload)
      }))
    } else {
      // Creación de cuenta
      const payload = {
        cardId: editingId || undefined,
        cardBankId: np.bankId || undefined,
        cardWalletId: (np.modoEnabled && modoWallet) ? modoWallet.id : null,
        segmentId: np.segmentId || undefined,
        cardType: 'ACCOUNT',
        cardNetworkIds: [],
        lastFour: np.lastFour || undefined,
        accountNumber: np.accountNumber || undefined,
        shortAccountNumber: np.shortAccountNumber || undefined,
        bankAccountType: np.bankAccountType || undefined,
        currency: np.currency || undefined,
        alias: np.alias || undefined,
        isPayroll: np.isPayroll || false,
        isPensioner: np.isPensioner || false,
      }
      await callApi(editingId ? 'update_card' : 'add_card', payload)
    }

    setAddingProduct(false)
    setEditingId(null)
    resetForm()
  }

  // Convierte el perfil DB al formato GuestProfile para el wizard
  const profileAsGuestProfile: GuestProfile | null = profile ? {
    cards: profile.cards.map((c: any) => ({
      bankId: c.bank?.id ?? undefined,
      walletId: c.wallet?.id ?? undefined,
      cardNetworkId: c.cardNetwork?.id ?? undefined,
      cardType: c.cardType,
      segmentId: c.segmentRef?.id ?? undefined,
      cardSegmentId: c.cardSegmentId ?? undefined,
      isPayroll: c.isPayroll ?? false,
      isPensioner: c.isPensioner ?? false,
    }))
  } : null

  async function handleSaveProfile(guestProfile: GuestProfile) {
    console.log('[handleSaveProfile] cards:', JSON.stringify(guestProfile.cards))
    setSavingProfile(true)
    try {
      const res = await fetch('/api/perfil/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: guestProfile.cards }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('Error al guardar el perfil: ' + (err.error ?? res.status))
        return
      }
      // Recargar el perfil desde DB
      const r = await fetch('/api/perfil')
      if (r.ok) {
        const data = await r.json()
        if (data.profile) setProfile(data.profile)
      }
    } catch (e) {
      console.error('Error guardando perfil:', e)
      alert('Error al guardar el perfil. Revisá la consola para más detalles.')
    } finally {
      setSavingProfile(false)
    }
  }

  // Completitud
  const completeness = Math.min(100,
    (pf.name ? 10 : 0) + (pf.lastName ? 10 : 0) +
    (pf.documentNumber ? 10 : 0) + (pf.phoneMobile ? 10 : 0) +
    (pf.addressStreet ? 10 : 0) + (pf.addressCity ? 10 : 0) +
    ((profile?.cards.length ?? 0) > 0 ? 25 : 0) +
    (pf.addressState ? 5 : 0) + (pf.addressZipCode ? 5 : 0) +
    (pf.phoneFixed ? 5 : 0)
  )

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-700/50">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 px-5 py-5 sticky top-0 z-10 shadow-sm shadow-black/[0.02]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Mi Perfil</h1>
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-red-600 transition-colors px-3 py-2 rounded-xl hover:bg-red-50">
            <LogOut size={16} /><span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>

        <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-2xl gap-1">
          {(['personal', 'finance', 'notif'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === tab ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-300 hover:text-gray-700 dark:hover:text-white'}`}>
              {tab === 'personal' ? 'Personal' : tab === 'finance' ? 'Financiero' : <><Bell size={13} />Alertas</>}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Completitud del perfil</span>
            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{completeness}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-700 ease-out" style={{ width: `${completeness}%` }} />
          </div>
        </div>
      </div>

      <div className="px-5 py-6 pb-32 max-w-lg mx-auto">
        {loading ? (
          <div className="space-y-4 py-10">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl p-5 animate-pulse">
                <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded w-1/3 mb-4" />
                <div className="h-10 bg-gray-100 dark:bg-slate-700 rounded-xl w-full" />
              </div>
            ))}
          </div>

        ) : activeTab === 'personal' ? (
          /* ══════════ TAB DATOS PERSONALES ══════════ */
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

            {/* Email read-only */}
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl px-6 py-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <Mail size={13} className="text-gray-400 dark:text-slate-500" />
                <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Correo electrónico</span>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{userData?.email}</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">El email no se puede modificar</p>
            </div>

            {/* Identificación */}
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
              <h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-5">Identificación</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nombre">
                    <input value={pf.name} onChange={e => setPf(p => ({ ...p, name: e.target.value }))} className={inp} />
                  </Field>
                  <Field label="Apellido">
                    <input value={pf.lastName} onChange={e => setPf(p => ({ ...p, lastName: e.target.value }))} className={inp} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Tipo Doc.">
                    <select value={pf.documentType} onChange={e => setPf(p => ({ ...p, documentType: e.target.value }))} className={sel}>
                      <option value="DNI">DNI</option>
                      <option value="CUIL">CUIL</option>
                      <option value="CUIT">CUIT</option>
                      <option value="Pasaporte">Pasaporte</option>
                    </select>
                  </Field>
                  <div className="col-span-2">
                    <Field label="Número de documento">
                      <input value={pf.documentNumber} onChange={e => setPf(p => ({ ...p, documentNumber: e.target.value }))} className={inp} />
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
              <h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-5">Contacto</h2>
              <div className="space-y-4">
                <Field label="Celular">
                  <input type="tel" placeholder="+54 9 11 1234-5678" value={pf.phoneMobile} onChange={e => setPf(p => ({ ...p, phoneMobile: e.target.value }))} className={inp} />
                </Field>
                <Field label="Teléfono Fijo">
                  <input type="tel" placeholder="011 4321-0000" value={pf.phoneFixed} onChange={e => setPf(p => ({ ...p, phoneFixed: e.target.value }))} className={inp} />
                </Field>
              </div>
            </div>

            {/* Domicilio */}
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
              <h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-5">Domicilio</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3">
                    <Field label="Calle">
                      <input value={pf.addressStreet} onChange={e => setPf(p => ({ ...p, addressStreet: e.target.value }))} className={inp} />
                    </Field>
                  </div>
                  <Field label="Nro.">
                    <input value={pf.addressNumber} onChange={e => setPf(p => ({ ...p, addressNumber: e.target.value }))} className={inp} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Piso">
                    <input value={pf.addressFloor} onChange={e => setPf(p => ({ ...p, addressFloor: e.target.value }))} className={inp} />
                  </Field>
                  <Field label="Depto">
                    <input value={pf.addressApt} onChange={e => setPf(p => ({ ...p, addressApt: e.target.value }))} className={inp} />
                  </Field>
                  <Field label="Cód. Postal">
                    <input value={pf.addressZipCode} onChange={e => setPf(p => ({ ...p, addressZipCode: e.target.value }))} className={inp} />
                  </Field>
                </div>
                <Field label="Localidad / Ciudad">
                  <input value={pf.addressCity} onChange={e => setPf(p => ({ ...p, addressCity: e.target.value }))} className={inp} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Provincia">
                    <input value={pf.addressState} onChange={e => setPf(p => ({ ...p, addressState: e.target.value }))} className={inp} />
                  </Field>
                  <Field label="País">
                    <input value={pf.addressCountry} onChange={e => setPf(p => ({ ...p, addressCountry: e.target.value }))} className={inp} />
                  </Field>
                </div>
              </div>
            </div>

            <button onClick={handleUpdateProfile} disabled={saving}
              className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-lg shadow-black/10 active:scale-[0.98] transition-all disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar Información Personal'}
            </button>
          </div>

        ) : activeTab === 'notif' ? (
          /* ══════════ TAB NOTIFICACIONES ══════════ */
          <NotificationSettings />

        ) : (
          /* ══════════ TAB PERFIL FINANCIERO ══════════ */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <PromoWizard
              open={true}
              inline={true}
              onClose={() => {}}
              initialProfile={profileAsGuestProfile}
              onComplete={handleSaveProfile}
              onAdd={async (gp) => {
                setSavingProfile(true)
                try {
                  await fetch('/api/perfil/import-guest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cards: gp.cards }),
                  })
                  const r = await fetch('/api/perfil')
                  if (r.ok) { const d = await r.json(); if (d.profile) setProfile(d.profile) }
                } catch (e) { console.error(e) }
                finally { setSavingProfile(false) }
              }}
              saveLabel="Guardar perfil"
              saving={savingProfile}
            />
          </div>
        )}
        {false && (<div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-blue-700 font-medium leading-relaxed">
                Agregá tus productos financieros para que PromoAR muestre solo las promos que aplican a tus tarjetas y cuentas.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl"><CreditCard size={20} /></div>
                  <div>
                    <h2 className="font-bold text-gray-900 dark:text-white text-sm">Mis Productos Financieros</h2>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Tarjetas, cuentas y billeteras</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700 px-2.5 py-1 rounded-full">{profile?.cards.length ?? 0}</span>
              </div>

              <div className="flex flex-col gap-3">

                {/* Estado vacío */}
                {(profile?.cards.length ?? 0) === 0 && !addingProduct && (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <CreditCard size={22} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-bold text-gray-400 dark:text-slate-500">Todavía no agregaste productos</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Agregá tu primera tarjeta o cuenta bancaria</p>
                  </div>
                )}

                {/* Lista de productos existentes */}
                {profile?.cards.map(p => {
                  const { entity, detail } = productLabel(p)
                  const { bg, text, Icon } = productIcon(p)
                  return (
                    <div key={p.id} className="flex items-center gap-4 bg-gray-50 dark:bg-slate-700/80 border border-gray-100 px-4 py-3.5 rounded-2xl hover:bg-white hover:shadow-sm transition-all">
                      <div className={`${bg} ${text} p-2.5 rounded-xl shrink-0`}><Icon size={18} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{entity}</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium mt-0.5 break-all">{detail}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleEditProduct(p)} disabled={saving}
                          className="text-gray-300 hover:text-indigo-500 transition-colors p-2 hover:bg-indigo-50 rounded-xl">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => callApi('remove_card', { cardId: p.id })} disabled={saving}
                          className="text-gray-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-xl">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* ── Formulario agregar producto ── */}
                {addingProduct ? (
                  <div className="bg-white border-2 border-indigo-100 rounded-3xl p-5 mt-2 space-y-4 animate-in zoom-in-95 duration-200">
                    <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Nuevo producto financiero</p>

                    {/* Paso 1 · Entidad */}
                    <Field label="Entidad Financiera *">
                      <select
                        value={np.bankId || np.walletId}
                        onChange={e => handleEntityChange(e.target.value)}
                        className={selInd}
                      >
                        <option value="">Seleccioná una entidad...</option>
                        {entities?.banks && entities.banks.length > 0 && (
                          <optgroup label="── Bancos">
                            {entities.banks.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {/* MODO NO aparece aquí — se vincula al banco mediante toggle */}
                        {entities?.wallets && entities.wallets.filter(w => !w.name.toLowerCase().includes('modo')).length > 0 && (
                          <optgroup label="── Billeteras Virtuales">
                            {entities.wallets
                              .filter(w => !w.name.toLowerCase().includes('modo'))
                              .map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                              ))}
                          </optgroup>
                        )}
                      </select>
                    </Field>

                    {/* Paso 2 · Segmento (solo bancos con segmentos) */}
                    {np.entityType === 'bank' && np.bankId && (
                      <Field label="Segmento del Banco (Opcional)">
                        <select
                          value={np.segmentId}
                          onChange={e => setNp(n => ({ ...n, segmentId: e.target.value }))}
                          className={selInd}
                        >
                          <option value="">Cliente General / Sin segmento</option>
                          {entities?.segments
                            ?.filter(s => s.bankId === np.bankId)
                            .map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))
                          }
                        </select>
                      </Field>
                    )}

                    {/* Atributos de la cuenta + toggle MODO (solo para bancos) */}
                    {np.entityType === 'bank' && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-3 px-1 py-1">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" checked={np.isPayroll} onChange={e => setNp(n => ({ ...n, isPayroll: e.target.checked }))}
                              className="w-5 h-5 rounded-lg border-2 border-gray-200 text-indigo-600 focus:ring-indigo-500 transition-all checked:bg-indigo-600" />
                            <span className="text-xs font-bold text-gray-600 group-hover:text-indigo-600 transition-colors">Cuenta Sueldo</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" checked={np.isPensioner} onChange={e => setNp(n => ({ ...n, isPensioner: e.target.checked }))}
                              className="w-5 h-5 rounded-lg border-2 border-gray-200 text-indigo-600 focus:ring-indigo-500 transition-all checked:bg-indigo-600" />
                            <span className="text-xs font-bold text-gray-600 group-hover:text-indigo-600 transition-colors">Jubilación / Pensión (ANSES)</span>
                          </label>
                        </div>

                        {/* Toggle MODO para CUENTA: solo si existe MODO y es una cuenta */}
                        {modoWallet && np.productType === 'ACCOUNT' && (
                          <button
                            type="button"
                            onClick={() => setNp(n => ({ ...n, modoEnabled: !n.modoEnabled }))}
                            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${np.modoEnabled
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-100 bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-200'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black ${np.modoEnabled ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400 dark:text-slate-500'
                                }`}>
                                M
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-bold">Esta cuenta está en MODO</p>
                                <p className="text-[10px] opacity-70 mt-0.5">Activo si usás la app MODO con esta cuenta</p>
                              </div>
                            </div>
                            <div className={`w-11 h-6 rounded-full transition-all relative ${np.modoEnabled ? 'bg-blue-500' : 'bg-gray-200'
                              }`}>
                              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${np.modoEnabled ? 'left-6' : 'left-1'
                                }`} />
                            </div>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Paso 3 · Tipo de producto — solo para bancos (billetera siempre es tarjeta) */}
                    {np.entityType === 'bank' && (
                      <div>
                        <label className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide ml-1 mb-2 block">Tipo de producto *</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['CARD', 'ACCOUNT'] as const).map(pt => (
                            <button key={pt}
                              onClick={() => setNp(n => ({ ...n, productType: pt, lastFour: '', accountNumber: '' }))}
                              className={`py-3 rounded-2xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-2 ${np.productType === pt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-200'}`}>
                              {pt === 'CARD' ? <><CreditCard size={14} /> Tarjeta</> : <><Building2 size={14} /> Cuenta</>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Paso 4a · TARJETA → Grid Multi-Select (Red + Tipo) */}
                    {np.productType === 'CARD' && (
                      <div className="space-y-3">
                        <label className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide ml-1 block">
                          Seleccioná tus tarjetas (podés elegir varias)
                        </label>

                        <div className="space-y-2">
                          {np.entityType === 'bank' ? (
                            productNetworks.length === 0 ? (
                              <p className="text-sm font-medium text-gray-500 dark:text-slate-400 py-4 text-center">
                                Este banco aún no tiene tarjetas configuradas.
                              </p>
                            ) : (
                              productNetworks.map(cn => {
                                const networkName = cn.name.toLowerCase()
                                const availableTypes: ('CREDIT' | 'DEBIT' | 'PREPAID')[] = (() => {
                                  if (networkName.includes('american express') || networkName.includes('amex')) {
                                    if (networkName.includes('banco')) return ['CREDIT']
                                    return ['CREDIT', 'PREPAID']
                                  }
                                  if (networkName.includes('cabal') || networkName.includes('maestro')) {
                                    return ['CREDIT', 'DEBIT']
                                  }
                                  return ['CREDIT', 'DEBIT', 'PREPAID']
                                })()

                                const typeLabels: Record<string, string> = { CREDIT: 'Crédito', DEBIT: 'Débito', PREPAID: 'Prepaga / Compra' }

                                return (
                                  <div key={cn.id} className="bg-gray-50 dark:bg-slate-700 rounded-2xl p-3 space-y-1.5">
                                    <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                      {cn.name}
                                    </p>
                                    <div className="grid grid-cols-1 gap-1.5">
                                      {availableTypes.map(type => {
                                        // Buscar si hay segmentos específicos para este tipo
                                        const typeSegments = productCardSegments.filter(cs => cs.cardNetworkId === cn.id && cs.cardType === type)

                                        if (typeSegments.length > 0) {
                                          // Renderizar los segmentos estrictos (ej: Visa Crédito Gold)
                                          return typeSegments.map(cs => {
                                            const isSelected = !!np.selectedCards.find(x => x.segmentId === cs.id)
                                            const inModo = np.selectedCards.find(x => x.segmentId === cs.id)?.modo ?? false

                                            return (
                                              <div
                                                key={cs.id}
                                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${isSelected
                                                    ? 'border-indigo-500 bg-indigo-50/50'
                                                    : 'border-gray-100 bg-white text-gray-400 dark:text-slate-500 hover:border-gray-200'
                                                  }`}
                                                onClick={() => toggleCard(cn.id, type, cs.id)}
                                              >
                                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-transparent'}`}>
                                                  <Plus size={10} strokeWidth={4} />
                                                </div>
                                                <span className={`text-xs font-bold flex-1 ${isSelected ? 'text-indigo-900' : 'text-gray-500 dark:text-slate-400'}`}>
                                                  {typeLabels[type]} · <span className="font-medium text-[11px] opacity-80 uppercase tracking-tight">{cs.name}</span>
                                                </span>
                                                {isSelected && modoWallet && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => toggleCardModo(e, cn.id, type, cs.id)}
                                                    className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border-2 transition-all ${inModo ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-400 dark:text-slate-500'}`}
                                                  >
                                                    <span className="text-[9px] font-black italic">MODO</span>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${inModo ? 'bg-white' : 'bg-gray-300'}`} />
                                                  </button>
                                                )}
                                              </div>
                                            )
                                          })
                                        } else {
                                          // Renderizar opción genérica si el banco no le cargó segmentos específicos a este tipo
                                          const isSelected = !!np.selectedCards.find(x => x.networkId === cn.id && x.cardType === type && !x.segmentId)
                                          const inModo = np.selectedCards.find(x => x.networkId === cn.id && x.cardType === type && !x.segmentId)?.modo ?? false

                                          return (
                                            <div
                                              key={`${cn.id}-${type}`}
                                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${isSelected
                                                  ? 'border-indigo-500 bg-indigo-50/50'
                                                  : 'border-gray-100 bg-white text-gray-400 dark:text-slate-500 hover:border-gray-200'
                                                }`}
                                              onClick={() => toggleCard(cn.id, type, null)}
                                            >
                                              <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-transparent'}`}>
                                                <Plus size={10} strokeWidth={4} />
                                              </div>
                                              <span className={`text-xs font-bold flex-1 ${isSelected ? 'text-indigo-900' : 'text-gray-500 dark:text-slate-400'}`}>
                                                {typeLabels[type]}
                                              </span>
                                              {isSelected && modoWallet && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => toggleCardModo(e, cn.id, type, null)}
                                                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border-2 transition-all ${inModo ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-400 dark:text-slate-500'}`}
                                                >
                                                  <span className="text-[9px] font-black italic">MODO</span>
                                                  <div className={`w-1.5 h-1.5 rounded-full ${inModo ? 'bg-white' : 'bg-gray-300'}`} />
                                                </button>
                                              )}
                                            </div>
                                          )
                                        }
                                      })}
                                    </div>
                                  </div>
                                )
                              })
                            )
                          ) : (
                            /* Lógica genérica para billeteras (las billeteras no tienen cardSegments estrictos) */
                            entities?.cardNetworks?.map(cn => {
                              const availableTypes: ('CREDIT' | 'DEBIT' | 'PREPAID')[] = (() => {
                                const networkName = cn.name.toLowerCase()
                                if (networkName.includes('american express') || networkName.includes('amex')) {
                                  if (networkName.includes('banco')) return ['CREDIT']
                                  return ['CREDIT', 'PREPAID']
                                }
                                if (networkName.includes('cabal') || networkName.includes('maestro')) {
                                  return ['CREDIT', 'DEBIT']
                                }
                                return ['CREDIT', 'DEBIT', 'PREPAID']
                              })()

                              const typeLabels: Record<string, string> = {
                                CREDIT: 'Crédito', DEBIT: 'Débito', PREPAID: 'Prepaga / Compra'
                              }

                              return (
                                <div key={cn.id} className="bg-gray-50 dark:bg-slate-700 rounded-2xl p-3 space-y-1.5">
                                  <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                    {cn.name}
                                  </p>
                                  <div className="grid grid-cols-1 gap-1.5">
                                    {availableTypes.map(type => {
                                      const cardData = np.selectedCards.find(x => x.networkId === cn.id && x.cardType === type && !x.segmentId)
                                      const isSelected = !!cardData

                                      return (
                                        <div
                                          key={`${cn.id}-${type}`}
                                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${isSelected
                                              ? 'border-indigo-500 bg-indigo-50/50'
                                              : 'border-gray-100 bg-white text-gray-400 dark:text-slate-500 hover:border-gray-200'
                                            }`}
                                          onClick={() => toggleCard(cn.id, type, null)}
                                        >
                                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isSelected
                                              ? 'bg-indigo-600 border-indigo-600 text-white'
                                              : 'bg-white border-gray-300 text-transparent'
                                            }`}>
                                            <Plus size={10} strokeWidth={4} />
                                          </div>
                                          <span className={`text-xs font-bold flex-1 ${isSelected ? 'text-indigo-900' : 'text-gray-500 dark:text-slate-400'}`}>
                                            {typeLabels[type]}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>

                        {np.selectedCards.length === 0 && (
                          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-2">
                            ⚠️ Seleccioná al menos una tarjeta para continuar
                          </p>
                        )}
                      </div>
                    )}

                    {/* Paso 4b · TARJETA → últimos 4 dígitos (banco o billetera) */}
                    {np.productType === 'CARD' && (
                      <Field label="Últimos 4 números de la tarjeta (opcional)">
                        <input type="text" maxLength={4} placeholder="1234"
                          value={np.lastFour}
                          onChange={e => setNp(n => ({ ...n, lastFour: e.target.value.replace(/\D/g, '') }))}
                          className={`${inpInd} font-mono tracking-widest`}
                        />
                        {np.lastFour && (
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 ml-1">Se verá como: **** **** **** {np.lastFour}</p>
                        )}
                      </Field>
                    )}

                    {/* Paso 4c · BANCO + CUENTA → Detalle completo */}
                    {np.entityType === 'bank' && np.productType === 'ACCOUNT' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Tipo de Cuenta">
                            <select value={np.bankAccountType} onChange={e => setNp(n => ({ ...n, bankAccountType: e.target.value }))} className={selInd}>
                              {entities?.accountTypes.map(at => (
                                <option key={at.id} value={at.name}>{at.name}</option>
                              ))}
                              {(!entities?.accountTypes || entities.accountTypes.length === 0) && (
                                <>
                                  <option value="CA">Caja de Ahorros</option>
                                  <option value="CC">Cuenta Corriente</option>
                                </>
                              )}
                            </select>
                          </Field>
                          <Field label="Moneda">
                            <select value={np.currency} onChange={e => setNp(n => ({ ...n, currency: e.target.value }))} className={selInd}>
                              {entities?.currencies?.map(c => (
                                <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                              ))}
                              {(!entities?.currencies || entities.currencies.length === 0) && (
                                <>
                                  <option value="ARS">Pesos (ARS)</option>
                                  <option value="USD">Dólares (USD)</option>
                                </>
                              )}
                            </select>
                          </Field>
                        </div>

                        <Field label="Número de Cuenta (opcional)">
                          <input type="text" placeholder="Ej: 123-45678/9"
                            value={np.shortAccountNumber}
                            onChange={e => setNp(n => ({ ...n, shortAccountNumber: e.target.value }))}
                            className={inpInd}
                          />
                        </Field>

                        <Field label="CBU (opcional)">
                          <input type="text" maxLength={22} placeholder="22 dígitos"
                            value={np.accountNumber}
                            onChange={e => setNp(n => ({ ...n, accountNumber: e.target.value.replace(/\D/g, '') }))}
                            className={`${inpInd} font-mono tracking-wider`}
                          />
                        </Field>

                        <Field label="Alias de CBU (opcional)">
                          <input type="text" placeholder="Ej: mi.alias.re.copado"
                            value={np.alias}
                            onChange={e => setNp(n => ({ ...n, alias: e.target.value }))}
                            className={inpInd}
                          />
                        </Field>
                      </div>
                    )}

                    {/* Paso 4d · BILLETERA → CVU + Alias + Tarjeta */}
                    {np.entityType === 'wallet' && (
                      <div className="space-y-4">
                        <Field label="CVU (opcional)">
                          <input type="text" maxLength={22} placeholder="22 dígitos"
                            value={np.accountNumber}
                            onChange={e => setNp(n => ({ ...n, accountNumber: e.target.value.replace(/\D/g, '') }))}
                            className={`${inpInd} font-mono tracking-wider`}
                          />
                        </Field>

                        <Field label="Alias de CVU (opcional)">
                          <input type="text" placeholder="Ej: mi.cuenta.mp"
                            value={np.alias}
                            onChange={e => setNp(n => ({ ...n, alias: e.target.value }))}
                            className={inpInd}
                          />
                        </Field>
                      </div>
                    )}

                    {/* Botones */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleAddProduct}
                        disabled={saving || (!np.bankId && !np.walletId) || (np.productType === 'CARD' && np.selectedCards.length === 0)}
                        className="flex-1 py-3.5 bg-gray-900 text-white text-sm font-bold rounded-2xl disabled:opacity-40 active:scale-[0.98] transition-all">
                        {saving ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Agregar Producto')}
                      </button>
                      <button onClick={() => { setAddingProduct(false); setEditingId(null); resetForm() }}
                        className="px-5 py-3.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded-2xl text-sm font-bold">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingProduct(true)}
                    className="flex items-center justify-center gap-2 text-sm w-full py-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border-2 border-dashed border-gray-200 text-gray-500 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-all font-bold mt-1">
                    <Plus size={18} /> Agregar Producto Financiero
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700 border border-gray-100 rounded-2xl px-4 py-3.5">
              <p className="text-[11px] text-gray-400 dark:text-slate-500 text-center leading-relaxed">
                CBU y CVU son opcionales.
              </p>
            </div>
          </div>)}
      </div>

      {/* Modal Promos Guardadas */}
      {showSaved && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-black/40 backdrop-blur-sm p-4 sm:p-0">
          <div className="bg-gray-50 dark:bg-slate-700 w-full max-w-sm h-[80vh] rounded-[32px] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 border border-white/20">
            <div className="bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Heart size={18} className="text-red-500 fill-red-500" />
                <h2 className="font-bold text-gray-900 dark:text-white">Promos Guardadas</h2>
              </div>
              <button onClick={() => setShowSaved(false)} className="p-1.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded-full hover:bg-gray-200 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {loadingSaved ? (
                <div className="py-10 text-center text-sm font-medium text-gray-400 dark:text-slate-500 animate-pulse">Cargando tus promos...</div>
              ) : savedPromos.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-center">
                  <div className="bg-white p-4 rounded-full mb-3 shadow-sm border border-gray-50">
                    <Heart size={24} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Aún no guardaste ninguna promo</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-[200px]">Tocá el corazón en las tarjetas de ahorro para tenerlas a mano acá.</p>
                </div>
              ) : savedPromos.map(promo => {
                const reqs = promo.requirements ?? []
                const bestReq = reqs.length > 0
                  ? reqs.reduce((max: any, r: any) => ((r.discountValue ?? 0) > (max?.discountValue ?? 0) ? r : max), reqs[0])
                  : null
                let dLabel = bestReq?.discountValue?.toString() ?? ''
                if (bestReq?.discountType === 'PERCENTAGE_REINTEGRO' || bestReq?.discountType === 'PERCENTAGE_DESCUENTO') dLabel = bestReq.discountValue + '%'
                if (bestReq?.discountType === 'BONIFICACION') dLabel = bestReq.discountValue + '% BON.'
                if (bestReq?.discountType === 'FIXED_AMOUNT') dLabel = '$' + bestReq?.discountValue
                const prefix = reqs.length > 1 ? 'Hasta ' : ''
                return (
                  <div key={promo.id} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{promo.category?.name || 'Varios'}</p>
                        <h3 className="font-bold text-gray-900 dark:text-white text-[15px] mt-0.5 leading-tight">{promo.commerce?.name || promo.title}</h3>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">{promo.description}</p>
                      </div>
                      <div className="shrink-0 bg-gradient-to-br from-green-400 to-green-600 shadow-sm shadow-green-200 text-white rounded-xl px-2 py-1.5 flex items-center justify-center min-w-[55px]">
                        <span className="text-sm font-bold tracking-tight">{prefix}{dLabel}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
