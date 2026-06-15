'use client'
import { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'

export default function Providers({ children, session }: { children: React.ReactNode, session?: Session | null }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="theme-preference">
      <SessionProvider session={session}>{children}</SessionProvider>
    </ThemeProvider>
  )
}