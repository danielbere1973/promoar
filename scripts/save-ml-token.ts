/**
 * Intercambia un código TG de MercadoLibre por un access token y lo guarda en la DB.
 * Uso: npx ts-node scripts/save-ml-token.ts TG-XXXXXXXXXXXXXXXXXX-XXXXXX
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const code = process.argv[2]
  if (!code || !code.startsWith('TG-')) {
    console.error('Uso: npx ts-node scripts/save-ml-token.ts TG-XXXXXXXXXX')
    process.exit(1)
  }

  const clientId = process.env.ML_CLIENT_ID
  const clientSecret = process.env.ML_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error('Falta ML_CLIENT_ID o ML_CLIENT_SECRET en .env')
    process.exit(1)
  }

  const redirectUri = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/ml-oauth/callback`
    : 'https://www.promoar.com.ar/api/ml-oauth/callback'

  console.log(`client_id:    ${clientId}`)
  console.log(`redirect_uri: ${redirectUri}`)
  console.log(`code:         ${code}`)
  console.log('Intercambiando con ML...')

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })

  const text = await res.text()
  console.log(`\nRespuesta ML (${res.status}):`, text)

  if (!res.ok) {
    console.error('\nERROR: ML rechazó el código.')
    process.exit(1)
  }

  const data = JSON.parse(text)
  const expiresAt = Date.now() + (data.expires_in - 300) * 1000

  if (data.refresh_token) {
    await prisma.siteConfig.upsert({
      where: { key: 'ml_refresh_token' },
      update: { value: data.refresh_token },
      create: { key: 'ml_refresh_token', value: data.refresh_token },
    })
    console.log('\n✓ refresh_token guardado en DB')
  } else {
    await prisma.siteConfig.upsert({
      where: { key: 'ml_access_token' },
      update: { value: JSON.stringify({ token: data.access_token, expiresAt }) },
      create: { key: 'ml_access_token', value: JSON.stringify({ token: data.access_token, expiresAt }) },
    })
    console.log('\n✓ access_token guardado en DB')
  }

  console.log(`scope: ${data.scope}`)
  console.log(`expires_in: ${data.expires_in}s`)
  console.log('\nListo. Verificá en https://www.promoar.com.ar/api/ml-oauth/token')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
