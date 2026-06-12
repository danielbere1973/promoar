import { headers } from 'next/headers'

export function getBaseUrl() {
  const host = headers().get('host') ?? 'promoar.com.ar'
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
  return `${protocol}://${host}`
}
