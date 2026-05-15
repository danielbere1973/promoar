'use client'
import { X } from 'lucide-react'

export const CARD_NETWORK_LOGOS: Record<string, string> = {
  'visa':                   'https://www.visa.com/favicon.ico',
  'visa-debito':            'https://www.visa.com/favicon.ico',
  'visa-prepaga':           'https://www.visa.com/favicon.ico',
  'visa-recargable':        'https://www.visa.com/favicon.ico',
  'mastercard':             'https://www.google.com/s2/favicons?sz=128&domain=mastercard.com',
  'mastercrd-debito':       'https://www.google.com/s2/favicons?sz=128&domain=mastercard.com',
  'mastercard-prepaga':     'https://www.google.com/s2/favicons?sz=128&domain=mastercard.com',
  'amex':                   'https://www.americanexpress.com/favicon.ico',
  'american-express-banco': 'https://www.americanexpress.com/favicon.ico',
  'naranja-x':              'https://www.google.com/s2/favicons?sz=128&domain=naranjax.com',
  'diners':                 'https://www.google.com/s2/favicons?sz=128&domain=dinersclub.com',
}

const CARD_TYPE_LABEL: Record<string, string> = {
  CREDIT: 'Crédito', DEBIT: 'Débito', PREPAID: 'Prepaga',
}

const CHANNEL_LABEL: Record<string, string> = {
  QR: 'QR / MODO', NFC: 'Sin contacto (NFC)', TARJETA_FISICA: 'Tarjeta física',
  TRANSFERENCIA: 'Transferencia', DINERO_EN_CUENTA: 'Dinero en cuenta',
}

const CAP_LABELS: Record<string, string> = {
  PER_TRANSACTION: '/trx', DAILY: '/día', WEEKLY: '/sem', MONTHLY: '/mes', TOTAL: ' total',
}

type Req = {
  bank?: { name: string; logoUrl?: string | null } | null
  wallet?: { name: string; logoUrl?: string | null } | null
  cardNetwork?: { name: string; slug: string } | null
  cardType?: string | null
  paymentChannel?: string | null
  segment?: string | null
  cap?: number | null
  capPeriod?: string | null
  minPurchase?: number | null
}

type Props = {
  commerceName: string
  requirements: Req[]
  onCloseAction: () => void
}

function LogoSmall({ src, alt }: { src?: string | null; alt: string }) {
  return src ? (
    <img src={src} alt={alt}
      className="w-8 h-8 rounded-lg object-contain bg-white border border-gray-100 p-0.5 shrink-0"
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
  ) : (
    <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-[11px] font-black text-gray-500 shrink-0">
      {alt[0].toUpperCase()}
    </div>
  )
}

function Row({ logo, primary, secondary }: { logo: React.ReactNode; primary: string; secondary?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-gray-50 last:border-0">
      {logo}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{primary}</p>
        {secondary && <p className="text-[11px] text-gray-400 leading-tight">{secondary}</p>}
      </div>
    </div>
  )
}

export default function EntitiesSheet({ commerceName, requirements, onCloseAction }: Props) {
  const banks   = new Map<string, { name: string; logoUrl?: string | null; segment?: string | null }>()
  const wallets = new Map<string, { name: string; logoUrl?: string | null }>()
  const networks = new Map<string, { name: string; slug: string; cardType?: string | null }>()
  const channels = new Set<string>()

  for (const r of requirements) {
    if (r.bank?.name)    banks.set(r.bank.name, { ...r.bank, segment: r.segment })
    if (r.wallet?.name)  wallets.set(r.wallet.name, r.wallet)
    if (r.cardNetwork?.slug) {
      networks.set(r.cardNetwork.slug + (r.cardType ?? ''), { ...r.cardNetwork, cardType: r.cardType })
    }
    if (r.paymentChannel && r.paymentChannel !== 'ANY') channels.add(r.paymentChannel)
  }

  const bankList    = Array.from(banks.values())
  const walletList  = Array.from(wallets.values())
  const networkList = Array.from(networks.values())
  const channelList = Array.from(channels)
  const capReq      = requirements.find(r => r.cap)
  const minReq      = requirements.find(r => r.minPurchase)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-150">
      <div className="absolute inset-0 bg-black/30" onClick={onCloseAction} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xs animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
          <span className="text-xs font-bold text-gray-700 truncate">{commerceName}</span>
          <button
            onClick={onCloseAction}
            className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 active:scale-90 transition-all shrink-0 ml-2"
          >
            <X size={12} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Bancos */}
          {bankList.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Banco</p>
              {bankList.map(b => (
                <Row key={b.name}
                  logo={<LogoSmall src={b.logoUrl} alt={b.name} />}
                  primary={b.name}
                  secondary={b.segment ?? undefined}
                />
              ))}
            </div>
          )}

          {/* Billeteras */}
          {walletList.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Billetera</p>
              {walletList.map(w => (
                <Row key={w.name}
                  logo={<LogoSmall src={w.logoUrl} alt={w.name} />}
                  primary={w.name}
                />
              ))}
            </div>
          )}

          {/* Redes de tarjeta */}
          {networkList.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tarjeta</p>
              {networkList.map(n => (
                <Row key={n.slug + (n.cardType ?? '')}
                  logo={<LogoSmall src={CARD_NETWORK_LOGOS[n.slug]} alt={n.name} />}
                  primary={n.name}
                  secondary={n.cardType ? CARD_TYPE_LABEL[n.cardType] : undefined}
                />
              ))}
            </div>
          )}

          {/* Forma de pago + límites en una línea */}
          {(channelList.length > 0 || capReq || minReq) && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {channelList.map(ch => (
                <span key={ch} className="text-[11px] bg-amber-50 text-amber-700 font-semibold px-2 py-1 rounded-lg">
                  {CHANNEL_LABEL[ch] ?? ch}
                </span>
              ))}
              {capReq && (
                <span className="text-[11px] bg-red-50 text-red-700 font-semibold px-2 py-1 rounded-lg">
                  Tope ${capReq.cap!.toLocaleString('es-AR')}{capReq.capPeriod ? CAP_LABELS[capReq.capPeriod] ?? '' : ''}
                </span>
              )}
              {minReq && (
                <span className="text-[11px] bg-orange-50 text-orange-700 font-semibold px-2 py-1 rounded-lg">
                  Mín. ${minReq.minPurchase!.toLocaleString('es-AR')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

