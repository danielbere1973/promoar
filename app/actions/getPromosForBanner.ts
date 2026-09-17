'use server'

import { prisma } from '@/lib/prisma'
import { getPromosData } from '@/lib/getPromos'

export async function getPromosForBanner(slug: string, type: 'bancos' | 'comercios') {
  const params: any = {}
  
  if (type === 'bancos') {
    const bank = await prisma.bank.findUnique({ where: { slug } })
    if (bank) {
      params.bankIds = [bank.id]
    } else {
      const wallet = await prisma.wallet.findUnique({ where: { slug } })
      if (wallet) {
        params.walletIds = [wallet.id]
      }
    }
  } else if (type === 'comercios') {
    const commerce = await prisma.commerce.findUnique({ where: { slug } })
    if (commerce) {
      params.commerceIds = [commerce.name]
      params.searchMode = 'exact'
    }
  }

  // Fetch the promos using the robust getPromosData engine
  const data = await getPromosData(params, null, false)
  
  // Ordenamiento personalizado solicitado por el usuario:
  // 1. Promos específicas de hoy
  // 2. Promos de "Todos los días"
  // 3. Promos de otros días
  const argNow = new Date(new Date().getTime() - 3 * 60 * 60 * 1000)
  const todayBit = 1 << argNow.getUTCDay()

  const sortedPromos = data.promos.sort((a: any, b: any) => {
    const getTier = (p: any) => {
      const mask = p.validDays || 127
      const isAllDays = mask === 127
      const isValidToday = (mask & todayBit) !== 0
      
      if (isValidToday && !isAllDays) return 1
      if (isAllDays) return 2
      return 3
    }
    
    return getTier(a) - getTier(b)
  })
  
  // Retornar top 50 (aumentado para que se vean más opciones en el modal)
  return sortedPromos.slice(0, 50)
}
