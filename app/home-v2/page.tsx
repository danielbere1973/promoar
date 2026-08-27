import type { Metadata } from 'next'
import HomeV2Client from '@/app/components/home-v2/HomeV2Client'

export const metadata: Metadata = {
  title: 'Tu Home — PromoAR',
  description: 'Las mejores decisiones de ahorro para vos, hoy.',
}

export default function HomeV2Page() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <HomeV2Client />
    </div>
  )
}
