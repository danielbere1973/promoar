import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const REPO = 'danielbere1973/promoar'
const WORKFLOW_FILE = 'warm-detail-cache.yml'
const GITHUB_API = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}`

// Misma protección que app/api/admin/scrape/route.ts: Bearer VTEX_SESSION_SECRET
// (server-to-server) o sesión NextAuth con rol ADMIN.
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization') || ''
  const secret = process.env.VTEX_SESSION_SECRET
  if (secret && auth === `Bearer ${secret}`) return true

  const session = await getServerSession()
  if (!session?.user?.email) return false
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })
  return user?.role === 'ADMIN'
}

function githubHeaders(pat: string) {
  return {
    'Authorization': `Bearer ${pat}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

type GhRun = {
  id: number
  status: string // queued | in_progress | completed
  conclusion: string | null // success | failure | cancelled | null
  html_url: string
  run_started_at: string
  created_at: string
  updated_at: string
}

async function getLatestRun(pat: string): Promise<GhRun | null> {
  const res = await fetch(`${GITHUB_API}/runs?per_page=1`, { headers: githubHeaders(pat) })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json() as { workflow_runs: GhRun[] }
  return data.workflow_runs[0] ?? null
}

/**
 * GET: estado de la última corrida del workflow de warm-cache.
 * Nunca expone el token de GitHub — solo datos públicos de la corrida.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return NextResponse.json({ error: 'GITHUB_PAT no configurado en el servidor' }, { status: 500 })
  }

  try {
    const run = await getLatestRun(pat)
    if (!run) {
      return NextResponse.json({ run: null })
    }
    return NextResponse.json({
      run: {
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url,
        startedAt: run.run_started_at,
        updatedAt: run.updated_at,
      },
    })
  } catch (error: any) {
    const message = String(error?.message || '')
    if (message.includes('404')) {
      return NextResponse.json({ error: 'Workflow no encontrado en GitHub (warm-detail-cache.yml)' }, { status: 404 })
    }
    if (message.includes('401') || message.includes('403')) {
      return NextResponse.json({ error: 'Token de GitHub inválido o vencido' }, { status: 502 })
    }
    return NextResponse.json({ error: `GitHub no respondió: ${message}` }, { status: 502 })
  }
}

/**
 * POST: dispara el workflow warm-detail-cache.yml vía workflow_dispatch.
 * Rechaza si ya hay una corrida en curso (queued/in_progress) para evitar
 * pisar la DB con dos invalidaciones/calentamientos simultáneos.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return NextResponse.json({ error: 'GITHUB_PAT no configurado en el servidor' }, { status: 500 })
  }

  let revalidate = true
  try {
    const body = await req.json()
    if (typeof body?.revalidate === 'boolean') revalidate = body.revalidate
  } catch {
    // sin body -> default true
  }

  try {
    const latest = await getLatestRun(pat)
    if (latest && (latest.status === 'queued' || latest.status === 'in_progress')) {
      return NextResponse.json(
        { error: 'Ya hay una corrida en curso', run: { id: latest.id, status: latest.status, url: latest.html_url } },
        { status: 409 },
      )
    }

    const res = await fetch(`${GITHUB_API}/dispatches`, {
      method: 'POST',
      headers: { ...githubHeaders(pat), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs: { revalidate: String(revalidate) } }),
    })

    if (res.status === 204) {
      return NextResponse.json({ ok: true })
    }

    const text = await res.text()
    if (res.status === 404) {
      return NextResponse.json({ error: 'Workflow no encontrado en GitHub (warm-detail-cache.yml)' }, { status: 404 })
    }
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: 'Token de GitHub inválido o vencido' }, { status: 502 })
    }
    return NextResponse.json({ error: text.slice(0, 300) }, { status: res.status })
  } catch (error: any) {
    return NextResponse.json({ error: `GitHub no respondió: ${error?.message ?? error}` }, { status: 502 })
  }
}
