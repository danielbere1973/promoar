/**
 * Invalida el caché público de promoar.com.ar llamando a
 * /api/internal/revalidate. Correr SIEMPRE después de cualquier script
 * suelto que escriba directo en la DB de producción — revalidateTag() solo
 * funciona dentro del runtime de Next.js, así que ese tipo de script nunca
 * invalida el caché por sí mismo.
 *
 * Uso:
 *   npm run revalidate:prod
 *   npm run revalidate:prod -- --promo-slugs=slug-1,slug-2
 *   npm run revalidate:prod -- --commerce-slugs=coto,jumbo
 */
import 'dotenv/config'

const PROD_URL = 'https://www.promoar.com.ar'

// trim + despoja comillas envolventes (por si el .env las trae literales,
// cosa que el --env-file nativo de Node no normaliza como sí hace dotenv)
const RAW_SECRET = process.env.VTEX_SESSION_SECRET
const SECRET = RAW_SECRET?.trim().replace(/^['"]|['"]$/g, '')

if (!SECRET) {
  console.error('ERROR: Falta VTEX_SESSION_SECRET en el .env')
  process.exit(1)
}

function parseListArg(flag: string): string[] {
  const arg = process.argv.find(a => a.startsWith(`${flag}=`))
  if (!arg) return []
  return arg.slice(flag.length + 1).split(',').map(s => s.trim()).filter(Boolean)
}

async function main() {
  const promoSlugs = parseListArg('--promo-slugs')
  const commerceSlugs = parseListArg('--commerce-slugs')

  console.log(`Invalidando caché de ${PROD_URL}...`)
  if (promoSlugs.length) console.log(`  promoSlugs: ${promoSlugs.join(', ')}`)
  if (commerceSlugs.length) console.log(`  commerceSlugs: ${commerceSlugs.join(', ')}`)

  const res = await fetch(`${PROD_URL}/api/internal/revalidate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRET}`,
    },
    body: JSON.stringify({ promoSlugs, commerceSlugs }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`FALLÓ: HTTP ${res.status} — ${text.slice(0, 300)}`)
    process.exit(1)
  }

  const data = await res.json()
  console.log('OK — caché invalidado:', JSON.stringify(data.invalidated, null, 2))
}

main().catch(e => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
