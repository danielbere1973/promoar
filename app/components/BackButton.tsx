'use client'
import { useRouter } from 'next/navigation'

export default function BackButton({ label }: { label: string }) {
  const router = useRouter()
  return (
    <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
      <button
        onClick={() => router.push('/')}
        className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      </button>
      <h1 className="font-bold text-gray-900 text-sm leading-tight truncate">{label}</h1>
    </div>
  )
}
