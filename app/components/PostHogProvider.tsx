'use client'
import { useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useSearchParams } from 'next/navigation'

function PostHogInit() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key || typeof window === 'undefined') return

    import('posthog-js').then(({ default: posthog }) => {
      if (!(posthog as any).__loaded) {
        posthog.init(key, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
          capture_pageview: false,
          capture_pageleave: true,
          persistence: 'localStorage',
        })
      }
      const url = window.origin + pathname + (searchParams?.toString() ? `?${searchParams}` : '')
      posthog.capture('$pageview', { $current_url: url })
    })
  }, [pathname, searchParams])

  useEffect(() => {
    if (!session?.user?.email || typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    import('posthog-js').then(({ default: posthog }) => {
      if ((posthog as any).__loaded && session?.user?.email) {
        posthog.identify(session.user.email, {
          email: session.user.email,
          name: session.user.name ?? undefined,
        })
      }
    })
  }, [session])

  return null
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return <>{children}</>
  return (
    <>
      <Suspense fallback={null}>
        <PostHogInit />
      </Suspense>
      {children}
    </>
  )
}
