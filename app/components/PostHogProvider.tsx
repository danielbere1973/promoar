'use client'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useSession } from 'next-auth/react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  useEffect(() => {
    if (pathname && ph) {
      const url = window.origin + pathname + (searchParams?.toString() ? `?${searchParams}` : '')
      ph.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams, ph])

  return null
}

function PostHogIdentify() {
  const { data: session } = useSession()
  const ph = usePostHog()

  useEffect(() => {
    if (session?.user?.email && ph) {
      ph.identify(session.user.email, {
        email: session.user.email,
        name: session.user.name,
      })
    }
  }, [session, ph])

  return null
}

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    capture_pageview: false, // lo hacemos manual para tener más control
    capture_pageleave: true,
    persistence: 'localStorage',
  })
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return <>{children}</>

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
        <PostHogIdentify />
      </Suspense>
      {children}
    </PHProvider>
  )
}
