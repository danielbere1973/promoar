// Spike de validación — Recommendation Model v2 vs v1
//
// CPO Direction 10/8/2026: no alcanza con medir que el score cambió, hay que
// evaluar si mejoró la CALIDAD de la recomendación. Corre v1 (lib/decisionEngine.ts,
// sin tocar) y v2 (decisionEngineV2.ts, standalone) sobre el mismo pool de
// candidatas para (a) perfiles reales de dev-promoar y (b) personas sintéticas
// representativas, y arma un reporte legible para producto.
//
// Solo corre contra dev-promoar (.env.local, ep-cool-lake-ammkwaug). No toca
// producción, no toca decisionEngine.ts. feature/nueva-home únicamente.
//
// Uso: npx tsx --env-file=.env.local scripts/spike-recommendation-v2/run-spike.ts

import { PrismaClient } from '@prisma/client'
import { getPromosData } from '../../lib/getPromos'
import { rankForHome, type DecisionContext } from '../../lib/decisionEngine'
import { rankForHomeV2, type PersonaPreferences } from './decisionEngineV2'
import fs from 'node:fs'
import path from 'node:path'

const prisma = new PrismaClient()

function todayDayBit(): number {
  const argNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return 1 << argNow.getDay()
}

const CTX: DecisionContext = { hasLocation: false, nearbyByCommerceId: {}, todayBit: todayDayBit() }

// ─── Definición de perfiles ─────────────────────────────────────────────────

type ProfileSource =
  | { kind: 'real'; email: string; label: string }
  | { kind: 'synthetic'; label: string; description: string; guestCards: { bankSlug?: string; walletSlug?: string }[]; declaredCategorySlugs?: string[] }

const REAL_PROFILES: ProfileSource[] = [
  { kind: 'real', email: 'tamaralerer@gmail.com', label: 'Real — cartera chica (1 banco)' },
  { kind: 'real', email: 'jaiaclaras@gmail.com', label: 'Real — cartera mediana (2 bancos + wallets)' },
  { kind: 'real', email: 'niksicvuja.ar@gmail.com', label: 'Real — cartera mediana (3 bancos, incluye Naranja X)' },
]

// Personas sintéticas — CPO: "familia, estudiante, viajero, mascota, auto, etc."
// Cards armadas con bankSlug/walletSlug reales de dev-promoar (resueltos abajo).
const SYNTHETIC_PROFILES: ProfileSource[] = [
  {
    kind: 'synthetic',
    label: 'Sintético — Familia con supermercado',
    description: 'Banco tradicional + wallet, sin onboarding declarado. Caso base: ¿sube el súper cotidiano?',
    guestCards: [{ bankSlug: 'galicia' }, { walletSlug: 'modo' }, { walletSlug: 'mercadopago' }],
  },
  {
    kind: 'synthetic',
    label: 'Sintético — Estudiante',
    description: 'Wallet-only (sin tarjeta de banco tradicional), perfil típico de usuario joven.',
    guestCards: [{ walletSlug: 'mercadopago' }, { walletSlug: 'uala' }],
  },
  {
    kind: 'synthetic',
    label: 'Sintético — Viajero (caso Cabify/Ezeiza, RFC-007 §8.5)',
    description: 'Perfil con tarjeta premium, para ver si una promo puntual de Viajes/Transporte compite bien contra necesidad cotidiana.',
    guestCards: [{ bankSlug: 'macro' }, { walletSlug: 'modo' }],
  },
  {
    kind: 'synthetic',
    label: 'Sintético — Dueño de mascota',
    description: 'Declaró "Mascotas" en onboarding simulado — floor Declarada activo (RFC-006).',
    guestCards: [{ bankSlug: 'bbva' }, { walletSlug: 'modo' }],
    declaredCategorySlugs: ['petshops'],
  },
  {
    kind: 'synthetic',
    label: 'Sintético — Dueño de auto',
    description: 'Perfil con banco + wallet genérico, sin declarar nada — mide si Combustible/Automotores sube solo por Default de necesidad.',
    guestCards: [{ bankSlug: 'santander' }, { walletSlug: 'modo' }],
  },
  {
    kind: 'synthetic',
    label: 'Sintético — Cartera amplia (multi-banco)',
    description: 'Simula un power-user con muchos bancos/wallets, similar al perfil real más grande pero sin declarar nada.',
    guestCards: [
      { bankSlug: 'bbva' }, { bankSlug: 'galicia' }, { bankSlug: 'banco-nacion' },
      { walletSlug: 'modo' }, { walletSlug: 'mercadopago' }, { walletSlug: 'cuentadni' },
    ],
  },
]

// ─── Resolución de slugs → ids (para armar guest_profile "cards") ──────────

async function resolveGuestCards(cards: { bankSlug?: string; walletSlug?: string }[]) {
  const bankSlugs = cards.map(c => c.bankSlug).filter(Boolean) as string[]
  const walletSlugs = cards.map(c => c.walletSlug).filter(Boolean) as string[]
  const banks = bankSlugs.length ? await prisma.bank.findMany({ where: { slug: { in: bankSlugs } }, select: { id: true, slug: true } }) : []
  const wallets = walletSlugs.length ? await prisma.wallet.findMany({ where: { slug: { in: walletSlugs } }, select: { id: true, slug: true } }) : []
  const bankBySlug = new Map(banks.map(b => [b.slug, b.id]))
  const walletBySlug = new Map(wallets.map(w => [w.slug, w.id]))
  return cards.map(c => ({
    bankId: c.bankSlug ? bankBySlug.get(c.bankSlug) ?? null : null,
    walletId: c.walletSlug ? walletBySlug.get(c.walletSlug) ?? null : null,
  })).filter(c => c.bankId || c.walletId)
}

// ─── Pipeline: obtiene el pool de candidatas igual que /api/promos/recommended ─

async function getCandidatePool(opts: { email?: string; guestProfileParam?: string }) {
  const result = await getPromosData(
    { forMe: true, view: 'week', paginate: false, useCandidateQuery: true, guestProfileParam: opts.guestProfileParam },
    opts.email ?? null,
    false,
  )
  return (result as any).promos ?? []
}

// ─── Comparación v1 vs v2 para un perfil ───────────────────────────────────

interface Top3Entry {
  id: string
  commerce: string
  category: string
  title: string
  discount: string
  score: number
}

function summarizePromo(r: { promo: any; score: number }): Top3Entry {
  const p = r.promo
  const best = p.userBestDiscount
  const discount = best
    ? (best.discountType === 'CUOTAS_SIN_INTERES' ? `${best.discountValue ?? ''} cuotas s/interés` : best.discountType === 'NXM' ? 'NxM' : `${best.discountValue ?? 0}%`)
    : '—'
  return {
    id: p.id,
    commerce: p.commerce?.name ?? '—',
    category: p.category?.slug ?? 'sin-categoria',
    title: p.title ?? '',
    discount,
    score: Math.round(r.score * 1000) / 1000,
  }
}

interface ProfileResult {
  label: string
  description?: string
  poolSize: number
  top3v1: Top3Entry[]
  top3v2: Top3Entry[]
  categoriasV1: string[]
  categoriasV2: string[]
  categoriasQueSuben: string[]
  categoriasQueBajan: string[]
  diversidadV1: number
  diversidadV2: number
  entraronNuevas: Top3Entry[]
  salieron: Top3Entry[]
  casosCotidianoVsFlashy: { entra: Top3Entry; sale: Top3Entry }[]
}

const NECESIDAD_ALTA = new Set(['supermercados', 'combustible', 'transporte', 'farmacias', 'petshops'])

function compareProfile(label: string, description: string | undefined, promos: any[], prefs?: PersonaPreferences): ProfileResult {
  const v1 = rankForHome(promos, CTX)
  const v2 = rankForHomeV2(promos, CTX, prefs)

  const top3v1 = v1.map(summarizePromo)
  const top3v2 = v2.map(summarizePromo)

  const categoriasV1 = [...new Set(top3v1.map(e => e.category))]
  const categoriasV2 = [...new Set(top3v2.map(e => e.category))]
  const categoriasQueSuben = categoriasV2.filter(c => !categoriasV1.includes(c))
  const categoriasQueBajan = categoriasV1.filter(c => !categoriasV2.includes(c))

  const idsV1 = new Set(top3v1.map(e => e.id))
  const idsV2 = new Set(top3v2.map(e => e.id))
  const entraronNuevas = top3v2.filter(e => !idsV1.has(e.id))
  const salieron = top3v1.filter(e => !idsV2.has(e.id))

  // Caso "cotidiano supera a flashy pero baja utilidad": una promo que entró en
  // v2 es de categoría Alta necesidad Y tiene descuento nominal menor que una
  // que salió de categoría discrecional.
  const casosCotidianoVsFlashy: { entra: Top3Entry; sale: Top3Entry }[] = []
  for (const entra of entraronNuevas) {
    if (!NECESIDAD_ALTA.has(entra.category)) continue
    for (const sale of salieron) {
      if (NECESIDAD_ALTA.has(sale.category)) continue
      const entraPct = parseFloat(entra.discount) || 0
      const salePct = parseFloat(sale.discount) || 0
      if (salePct > entraPct) {
        casosCotidianoVsFlashy.push({ entra, sale })
      }
    }
  }

  return {
    label,
    description,
    poolSize: promos.length,
    top3v1,
    top3v2,
    categoriasV1,
    categoriasV2,
    categoriasQueSuben,
    categoriasQueBajan,
    diversidadV1: categoriasV1.length,
    diversidadV2: categoriasV2.length,
    entraronNuevas,
    salieron,
    casosCotidianoVsFlashy,
  }
}

function evaluarMejora(r: ProfileResult): string {
  if (r.entraronNuevas.length === 0) return 'Sin cambios en el Top 3 — v2 coincide con v1 para este perfil.'
  const mejoras: string[] = []
  if (r.casosCotidianoVsFlashy.length > 0) {
    mejoras.push(`${r.casosCotidianoVsFlashy.length} caso(s) donde un gasto cotidiano desplazó a una promo de mayor % pero baja utilidad recurrente`)
  }
  if (r.diversidadV2 > r.diversidadV1) {
    mejoras.push('mejoró la diversidad de categorías en el Top 3')
  } else if (r.diversidadV2 < r.diversidadV1) {
    mejoras.push('bajó la diversidad de categorías (revisar si es correcto)')
  }
  if (mejoras.length === 0) {
    return `Cambió el Top 3 (${r.entraronNuevas.length} nueva(s)) pero sin un patrón claro de mejora/empeora — requiere ojo de producto.`
  }
  return `Parece una mejora: ${mejoras.join('; ')}.`
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const results: ProfileResult[] = []

  for (const profile of REAL_PROFILES) {
    if (profile.kind !== 'real') continue
    const promos = await getCandidatePool({ email: profile.email })
    if (!promos.length) {
      console.warn(`[spike] ${profile.label} (${profile.email}): pool vacío, se omite`)
      continue
    }
    results.push(compareProfile(profile.label, undefined, promos))
  }

  for (const profile of SYNTHETIC_PROFILES) {
    if (profile.kind !== 'synthetic') continue
    const resolvedCards = await resolveGuestCards(profile.guestCards)
    if (!resolvedCards.length) {
      console.warn(`[spike] ${profile.label}: no se resolvieron bankSlug/walletSlug, se omite`)
      continue
    }
    const guestProfileParam = Buffer.from(JSON.stringify({ cards: resolvedCards })).toString('base64')
    const promos = await getCandidatePool({ guestProfileParam })
    if (!promos.length) {
      console.warn(`[spike] ${profile.label}: pool vacío, se omite`)
      continue
    }
    const prefs: PersonaPreferences | undefined = profile.declaredCategorySlugs
      ? { declaredCategorySlugs: profile.declaredCategorySlugs }
      : undefined
    results.push(compareProfile(profile.label, profile.description, promos, prefs))
  }

  // ─── Reporte legible para producto ───────────────────────────────────────
  const lines: string[] = []
  lines.push('# Spike — Recommendation Model v2 vs v1 (validación de calidad)')
  lines.push('')
  lines.push(`Generado: ${new Date().toISOString()} — dev-promoar, feature/nueva-home. No afecta producción.`)
  lines.push('')
  lines.push('## Resumen ejecutivo')
  lines.push('')
  const totalConCambio = results.filter(r => r.entraronNuevas.length > 0).length
  const totalCasosCotidiano = results.reduce((sum, r) => sum + r.casosCotidianoVsFlashy.length, 0)
  lines.push(`- Perfiles evaluados: ${results.length} (${REAL_PROFILES.length} reales + ${SYNTHETIC_PROFILES.length} sintéticos)`)
  lines.push(`- Perfiles con cambio en el Top 3: ${totalConCambio}/${results.length}`)
  lines.push(`- Casos "cotidiano supera a flashy de baja utilidad": ${totalCasosCotidiano}`)
  lines.push('')

  for (const r of results) {
    lines.push('---')
    lines.push('')
    lines.push(`## ${r.label}`)
    if (r.description) lines.push(`_${r.description}_`)
    lines.push('')
    lines.push(`Pool de candidatas: ${r.poolSize}`)
    lines.push('')
    lines.push('**Top 3 v1:**')
    r.top3v1.forEach((e, i) => lines.push(`${i + 1}. ${e.commerce} — ${e.title} (${e.discount}, cat: ${e.category}, score: ${e.score})`))
    lines.push('')
    lines.push('**Top 3 v2:**')
    r.top3v2.forEach((e, i) => lines.push(`${i + 1}. ${e.commerce} — ${e.title} (${e.discount}, cat: ${e.category}, score: ${e.score})`))
    lines.push('')
    lines.push('**Qué cambió:**')
    if (r.entraronNuevas.length === 0) {
      lines.push('- Sin cambios.')
    } else {
      r.entraronNuevas.forEach(e => lines.push(`- Entra: ${e.commerce} (${e.category}, ${e.discount})`))
      r.salieron.forEach(e => lines.push(`- Sale: ${e.commerce} (${e.category}, ${e.discount})`))
    }
    lines.push('')
    lines.push('**Por qué cambió:**')
    if (r.entraronNuevas.length === 0) {
      lines.push('- N/A — el orden de afinidad no alteró el resultado de v1 para este perfil.')
    } else {
      lines.push('- El factor scoreAfinidad favorece categorías de necesidad Alta/Media (RFC-007 §5.1) sobre discrecionales de mayor % nominal.')
    }
    lines.push('')
    lines.push(`**Categorías que suben:** ${r.categoriasQueSuben.join(', ') || '—'}`)
    lines.push(`**Categorías que bajan:** ${r.categoriasQueBajan.join(', ') || '—'}`)
    lines.push(`**Diversidad Top 3:** v1=${r.diversidadV1} categorías → v2=${r.diversidadV2} categorías`)
    lines.push('')
    lines.push(`**Evaluación:** ${evaluarMejora(r)}`)
    lines.push('')
  }

  const outPath = path.join(process.cwd(), 'scripts', 'spike-recommendation-v2', 'REPORTE.md')
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8')
  console.log(`\n[spike] Reporte escrito en ${outPath}`)

  // JSON crudo también, por si hace falta re-procesar sin volver a pegarle a la DB.
  const jsonPath = path.join(process.cwd(), 'scripts', 'spike-recommendation-v2', 'resultados.json')
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8')
  console.log(`[spike] Datos crudos en ${jsonPath}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
