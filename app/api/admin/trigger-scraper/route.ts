import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { scraperId } = await req.json() as { scraperId: string }
  if (!scraperId) return NextResponse.json({ error: 'Missing scraperId' }, { status: 400 })

  const pat = process.env.GITHUB_PAT
  if (!pat) return NextResponse.json({ error: 'GITHUB_PAT no configurado' }, { status: 500 })

  const res = await fetch(
    'https://api.github.com/repos/danielbere1973/promoar/actions/workflows/run-scrapers.yml/dispatches',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs: { scraper_id: scraperId } }),
    }
  )

  if (res.status === 204) return NextResponse.json({ ok: true })
  const text = await res.text()
  return NextResponse.json({ error: text }, { status: res.status })
}
