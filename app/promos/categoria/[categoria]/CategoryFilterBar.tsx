// Barra de filtros de la página pilar — enlaces reales (sin JS) a /promos/explorar
// con el filtro ya aplicado vía query param. No reimplementa el filtrado: toda la
// lógica real vive en PromosClient.tsx (/promos/explorar), que ya lee ?bank=,
// ?wallet=, ?network=, ?commerce= y ?cats= al montar. Esta barra solo deriva las
// entidades disponibles en las promos de la categoría (mismo criterio que
// `availableEntities` en PromosClient) y las muestra como chips, para que el
// usuario pueda filtrar por banco/billetera/tarjeta/día sin perder el SSR/SEO de
// esta página (feedback de Pablo, 18/11/2026: "filtros tienen que haber").

// bit 0 = domingo, igual a Date.getDay() — mismo criterio que PromosClient.tsx (DAYS_LABELS)
const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

type Entity = { id: string; name: string; logoUrl?: string | null }

type Req = {
  bank?: Entity | null
  wallet?: Entity | null
  cardNetwork?: { id: string; name: string } | null
}

type Promo = {
  validDays: number
  requirements: Req[]
}

function dedupeByName(items: Entity[]): Entity[] {
  const map = new Map<string, Entity>()
  for (const item of items) if (item.name) map.set(item.name, item)
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export default function CategoryFilterBar({ promos, categorySlug }: { promos: Promo[]; categorySlug: string }) {
  const banks: Entity[] = []
  const wallets: Entity[] = []
  const networks: Entity[] = []
  const daysSet = new Set<number>()

  for (const p of promos) {
    for (const r of p.requirements) {
      if (r.bank?.name) banks.push(r.bank)
      if (r.wallet?.name) wallets.push(r.wallet)
      if (r.cardNetwork?.name) networks.push({ id: r.cardNetwork.id, name: r.cardNetwork.name })
    }
    for (let d = 0; d < 7; d++) if ((p.validDays >> d) & 1) daysSet.add(d)
  }

  const dedupedBanks = dedupeByName(banks).slice(0, 10)
  const dedupedWallets = dedupeByName(wallets).slice(0, 10)
  const dedupedNetworks = dedupeByName(networks).slice(0, 6)
  const days = Array.from(daysSet).sort((a, b) => a - b)

  const base = `/promos/explorar?cats=${categorySlug}`

  if (dedupedBanks.length === 0 && dedupedWallets.length === 0 && dedupedNetworks.length === 0 && days.length === 0) {
    return null
  }

  return (
    <div className="space-y-2.5">
      {(dedupedBanks.length > 0 || dedupedWallets.length > 0) && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory">
          {dedupedBanks.map(b => (
            <a
              key={`bank-${b.id}`}
              href={`${base}&bank=${b.id}`}
              className="shrink-0 snap-start flex items-center gap-1.5 bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-800 rounded-full px-3 py-1.5 text-[11px] font-bold text-[#0D1B2E] dark:text-white hover:border-[#1D3D6E] dark:hover:border-[#3A6BC4] transition-colors"
            >
              {b.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logoUrl} alt="" className="w-4 h-4 object-contain rounded shrink-0" />
              )}
              {b.name}
            </a>
          ))}
          {dedupedWallets.map(w => (
            <a
              key={`wallet-${w.id}`}
              href={`${base}&wallet=${w.id}`}
              className="shrink-0 snap-start flex items-center gap-1.5 bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-800 rounded-full px-3 py-1.5 text-[11px] font-bold text-[#0D1B2E] dark:text-white hover:border-[#1D3D6E] dark:hover:border-[#3A6BC4] transition-colors"
            >
              {w.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.logoUrl} alt="" className="w-4 h-4 object-contain rounded shrink-0" />
              )}
              {w.name}
            </a>
          ))}
        </div>
      )}

      {(dedupedNetworks.length > 0 || days.length > 0) && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {dedupedNetworks.map(n => (
            <a
              key={`net-${n.id}`}
              href={`${base}&network=${n.id}`}
              className="shrink-0 bg-[#EEF2F8] dark:bg-[#1E3055] border border-[#D0DBF0] dark:border-[#2A4070] rounded-full px-3 py-1.5 text-[11px] font-semibold text-[#1D3D6E] dark:text-[#8AADD4] hover:border-[#1D3D6E] dark:hover:border-[#3A6BC4] transition-colors"
            >
              {n.name}
            </a>
          ))}

          {days.length > 0 && dedupedNetworks.length > 0 && (
            <span className="shrink-0 w-px h-5 bg-[#E4E8EF] dark:bg-slate-700" />
          )}

          {days.map(d => (
            <a
              key={`day-${d}`}
              href={`${base}`}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-800 text-[11px] font-black text-[#1D3D6E] dark:text-[#8AADD4]"
              title="Ver con filtro de día en /promos/explorar"
            >
              {DAY_LABELS[d]}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
