export const runtime = 'edge'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  if (!q) return Response.json({ error: 'q requerido' }, { status: 400 })

  const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(q)}&limit=50`

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    })
    const text = await res.text()
    if (!res.ok) {
      return Response.json({ error: 'ML error', status: res.status, body: text }, { status: res.status })
    }
    return new Response(text, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=60' } })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
