// Envía una notificación push de prueba a todas las suscripciones guardadas.
// Uso: npx ts-node scripts/send-test-push.ts
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { prisma } from '../lib/prisma'
import webpush from '../lib/webpush'

async function main() {
  const subscriptions = await prisma.pushSubscription.findMany()

  if (subscriptions.length === 0) {
    console.log('No hay suscripciones guardadas.')
    return
  }

  const payload = JSON.stringify({
    title: 'PromoAR',
    body: '¡Notificación de prueba! Si ves esto, el push funciona 🎉',
    url: '/promos',
  })

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      console.log(`OK -> ${sub.endpoint.slice(0, 60)}...`)
    } catch (error: any) {
      console.error(`ERROR -> ${sub.endpoint.slice(0, 60)}...`, error?.statusCode, error?.body)

      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } })
        console.log('  Suscripción expirada eliminada.')
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
