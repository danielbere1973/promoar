/**
 * Carga inicial manual de Commerce.stacksWithBankPromos (feature "¿Dónde me conviene comprar?").
 * Ver ColabClaudeGemini/cpo-a-cto-aprobacion-plan-tecnico-lista-compras-1-9-2026.md — Paso 1.
 *
 * Este campo es a nivel COMERCIO (supermercado), no a nivel medio de pago — MODO, Cuenta DNI
 * y Personal Pay son billeteras/formas de pago, no comercios, y no aparecen acá como filas
 * propias. IMPORTANTE: no existe una regla general "billetera = acumula" ni "banco = no
 * acumula" — cada promo puede o no acumular con descuentos de góndola y varía caso a caso
 * (Visa débito jueves, MercadoPago, Cuenta 365, billetera propia de Carrefour, etc.). Hasta
 * tener el dato real cargado, TODAS las entidades (banco, red, billetera) que aplican en un
 * comercio comparten el mismo valor de stacksWithBankPromos de ese comercio.
 *
 * NEVER: Coto.
 * ALWAYS: Carrefour.
 * UNKNOWN: Jumbo, Disco, Vea, Changomas, DIA (default, se dejan explícitas para auditoría).
 *
 * Uso:
 *   npx tsx scripts/seed-bank-promo-stacking.ts            → dry-run (no toca la DB)
 *   npx tsx scripts/seed-bank-promo-stacking.ts --apply    → aplica los cambios
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { PrismaClient, BankPromoStacking } from '@prisma/client'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

const ASSIGNMENTS: Array<{ name: string; value: BankPromoStacking }> = [
  { name: 'Coto', value: BankPromoStacking.NEVER },
  { name: 'Carrefour', value: BankPromoStacking.ALWAYS },
  { name: 'Jumbo', value: BankPromoStacking.UNKNOWN },
  { name: 'Disco', value: BankPromoStacking.UNKNOWN },
  { name: 'Vea', value: BankPromoStacking.UNKNOWN },
  { name: 'Changomas', value: BankPromoStacking.UNKNOWN },
  { name: 'DIA', value: BankPromoStacking.UNKNOWN },
]

async function main() {
  console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)

  for (const { name, value } of ASSIGNMENTS) {
    const commerces = await prisma.commerce.findMany({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true, stacksWithBankPromos: true },
    })

    if (commerces.length === 0) {
      console.log(`⚠️  "${name}" → sin comercio encontrado`)
      continue
    }
    if (commerces.length > 1) {
      console.log(`⚠️  "${name}" → ${commerces.length} matches exactos, revisar a mano antes de aplicar`)
    }

    console.log(`"${name}" → ${value} (${commerces.length} comercio/s)`)
    for (const c of commerces) {
      console.log(`  - ${c.name} (${c.id}) actual=${c.stacksWithBankPromos}`)
    }

    if (APPLY) {
      const result = await prisma.commerce.updateMany({
        where: { id: { in: commerces.map(c => c.id) } },
        data: { stacksWithBankPromos: value },
      })
      console.log(`  ✅ actualizados: ${result.count}`)
    }
    console.log('')
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
