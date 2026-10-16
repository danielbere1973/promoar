'use client'
import { useRouter } from 'next/navigation'

export default function BackLink({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter()
  return (
    <a
      href={fallbackHref}
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault()
          router.back()
        }
      }}
      className="text-gray-500 hover:text-gray-700"
    >
      &larr; Promos
    </a>
  )
}
