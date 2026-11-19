import Link from 'next/link'

// Header propio de la página pilar — a diferencia de BackButton.tsx (mobile-only,
// sin logo), esta página no vive dentro del shell de PromosClient.tsx (sidebar
// desktop con logo), así que necesita su propia marca visible en ambos breakpoints
// para no sentirse una landing SEO desconectada de PromoAR (feedback de Pablo,
// 18/11/2026: "no tiene nada de promoar, ni el logo").
export default function CategoryPageHeader({ categoryName }: { categoryName: string }) {
  return (
    <div className="bg-white dark:bg-[#0A1428] border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 lg:px-10 py-3 flex items-center gap-3">
        <Link href="/promos" className="shrink-0 flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/promoar_logo.webp" alt="PromoAR" className="h-8 w-auto" />
        </Link>
        <span className="text-gray-300 dark:text-slate-600 text-lg font-light">/</span>
        <h1 className="font-bold text-gray-900 dark:text-white text-sm leading-tight truncate">{categoryName}</h1>
      </div>
    </div>
  )
}
