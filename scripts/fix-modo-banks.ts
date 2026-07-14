/**
 * Repara promos de MODO cuyo banco quedó mal asignado por la colisión
 * bcra_code (MODO) vs codigoModo (DB): Macro→Entre Ríos, ICBC→San Juan,
 * Supervielle→YOY, etc.
 *
 * Uso:
 *   npx tsx scripts/fix-modo-banks.ts            → dry-run (no toca la DB)
 *   npx tsx scripts/fix-modo-banks.ts --apply    → aplica los cambios
 */
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const APPLY = process.argv.includes('--apply')

// Tokens que identifican bancos en los slugs de MODO → nombre de banco en DB
const SLUG_BANK_TOKENS: Array<{ tokens: string[]; bankName: string }> = [
  { tokens: ['icbc'], bankName: 'ICBC' },
  { tokens: ['macro'], bankName: 'Banco Macro' },
  { tokens: ['comafi'], bankName: 'Banco Comafi' },
  { tokens: ['galicia-mas', 'galiciamas'], bankName: 'Galicia Más' },
  { tokens: ['galicia'], bankName: 'Banco Galicia' },
  { tokens: ['bbva'], bankName: 'Banco BBVA' },
  { tokens: ['santander'], bankName: 'Banco Santander' },
  { tokens: ['patagonia'], bankName: 'Banco Patagonia' },
  { tokens: ['supervielle'], bankName: 'Banco Supervielle' },
  { tokens: ['ciudad'], bankName: 'Banco Ciudad' },
  { tokens: ['nacion', 'bna'], bankName: 'Banco Nación' },
  { tokens: ['provincia', 'bapro'], bankName: 'Banco Provincia' },
  { tokens: ['credicoop'], bankName: 'Banco Credicoop' },
  { tokens: ['hipotecario'], bankName: 'Banco Hipotecario' },
  { tokens: ['cordoba', 'bancor'], bankName: 'Banco de la Provincia de Córdoba S.A.' },
  { tokens: ['santa-fe', 'santafe'], bankName: 'Banco Santa Fe' },
  { tokens: ['san-juan', 'sanjuan'], bankName: 'Banco San Juan' },
  { tokens: ['entre-rios', 'entrerios', 'bersa'], bankName: 'Banco Entre Ríos' },
  { tokens: ['santa-cruz', 'santacruz'], bankName: 'Banco Santa Cruz' },
  { tokens: ['chubut'], bankName: 'Banco del Chubut S.A.' },
  { tokens: ['corrientes'], bankName: 'Banco de Corrientes' },
  { tokens: ['columbia'], bankName: 'Banco Columbia' },
  { tokens: ['delsol', 'del-sol'], bankName: 'Banco del Sol' },
  { tokens: ['formosa'], bankName: 'Banco Formosa' },
  { tokens: ['neuquen', 'bpn'], bankName: 'Banco Neuquén' },
  { tokens: ['supervielle', 'yoy'], bankName: 'Banco Supervielle' },
]

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function banksInSlug(slug: string): string[] {
  const found: string[] = []
  for (const { tokens, bankName } of SLUG_BANK_TOKENS) {
    if (tokens.some(t => slug.includes(t)) && !found.includes(bankName)) found.push(bankName)
  }
  return found
}

async function main() {
  console.log(APPLY ? '═══ MODO APPLY — se van a modificar promos ═══' : '═══ DRY-RUN — no se toca la DB ═══\n')

  const banks = await prisma.bank.findMany({ select: { id: true, name: true } })
  const bankByName = new Map(banks.map(b => [b.name, b]))

  const promos = await prisma.promo.findMany({
    where: { sourceUrl: { contains: 'modo.com.ar' } },
    select: {
      id: true, title: true, status: true, sourceUrl: true,
      commerce: { select: { name: true } },
      requirements: { select: { id: true, bankId: true, bank: { select: { name: true } } } },
    }
  })

  // pares (bancoIncorrecto → bancoCorrecto) → contador por status
  const pairCounts = new Map<string, Record<string, number>>()
  const updates: Array<{ promoId: string; title: string; status: string; wrongBankIds: string[]; correctBankId: string; pair: string }> = []
  let skippedMultiBank = 0

  for (const p of promos) {
    const slug = (p.sourceUrl ?? '').split('/promos/')[1] ?? ''
    if (!slug) continue
    const slugBanks = banksInSlug(normalize(slug))
    if (slugBanks.length === 0) continue

    const reqBankNames = [...new Set(p.requirements.map(r => r.bank?.name).filter(Boolean))] as string[]
    if (reqBankNames.length === 0) continue

    const anyMatch = slugBanks.some(sb => reqBankNames.some(rb =>
      normalize(rb).includes(normalize(sb)) || normalize(sb).includes(normalize(rb))
    ))
    if (anyMatch) continue

    // Mismatch confirmado. Solo corregimos si el slug identifica UN banco inequívoco.
    if (slugBanks.length > 1) { skippedMultiBank++; continue }

    // Seguridad: solo tocar promos cuyos bancos incorrectos son EXACTAMENTE los
    // bancos-colisión conocidos (codigoModo == bcra_code de otro banco). Una promo
    // multibanco legítima (ej. slug con "cordoba" = la ciudad) nunca debe pisarse.
    const COLLISION_BANKS = new Set(['Banco Entre Ríos', 'YOY', 'Banco San Juan'])
    if (!reqBankNames.every(n => COLLISION_BANKS.has(n))) { skippedMultiBank++; continue }

    const correctBank = bankByName.get(slugBanks[0])
    if (!correctBank) { console.log(`  ⚠ Banco "${slugBanks[0]}" no existe en DB — skip ${slug}`); continue }

    const wrongBankIds = [...new Set(p.requirements.map(r => r.bankId).filter(Boolean))] as string[]
    const pair = `${reqBankNames.join('+')} → ${correctBank.name}`
    if (!pairCounts.has(pair)) pairCounts.set(pair, {})
    const pc = pairCounts.get(pair)!
    pc[p.status] = (pc[p.status] ?? 0) + 1

    updates.push({ promoId: p.id, title: p.title, status: p.status, wrongBankIds, correctBankId: correctBank.id, pair })
  }

  console.log('── Resumen por par (bancoIncorrecto → bancoCorrecto) ──')
  for (const [pair, counts] of [...pairCounts.entries()].sort((a, b) => {
    const ta = Object.values(a[1]).reduce((x, y) => x + y, 0)
    const tb = Object.values(b[1]).reduce((x, y) => x + y, 0)
    return tb - ta
  })) {
    const total = Object.values(counts).reduce((x, y) => x + y, 0)
    console.log(`  ${pair}: ${total} promos (${Object.entries(counts).map(([s, n]) => `${s}: ${n}`).join(', ')})`)
  }
  console.log(`\nTotal promos a corregir: ${updates.length}`)
  if (skippedMultiBank) console.log(`Skip (slug con >1 banco, revisar a mano): ${skippedMultiBank}`)

  if (!APPLY) {
    console.log('\n(dry-run — corré con --apply para aplicar)')
    await prisma.$disconnect()
    return
  }

  // ── Aplicar ────────────────────────────────────────────────────────────────
  let fixed = 0
  for (const u of updates) {
    await prisma.promoRequirement.updateMany({
      where: { promoId: u.promoId, bankId: { in: u.wrongBankIds } },
      data: { bankId: u.correctBankId },
    })
    fixed++
    if (fixed % 50 === 0) console.log(`  ${fixed}/${updates.length}...`)
  }
  console.log(`\n✅ Corregidas ${fixed} promos`)

  await prisma.$disconnect()
}
main().catch(console.error)
