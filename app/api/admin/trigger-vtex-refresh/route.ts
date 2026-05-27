import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return NextResponse.json({ error: 'GITHUB_PAT no configurado' }, { status: 500 })
  }

  const res = await fetch(
    'https://api.github.com/repos/danielbere1973/promoar/actions/workflows/refresh-vtex-sessions.yml/dispatches',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  )

  if (res.status === 204) {
    return NextResponse.json({ ok: true })
  }
  const text = await res.text()
  return NextResponse.json({ error: text }, { status: res.status })
}
