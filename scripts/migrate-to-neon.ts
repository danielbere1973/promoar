import { Client } from 'pg'

const COCKROACH_URL = 'postgresql://danielbere:YLiz1r4WbVxPTpebwOuYhA@newer-newfie-26605.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=require'
const NEON_URL = 'postgresql://neondb_owner:npg_3NnDXmfLcI8W@ep-fragrant-bird-am3uvyq5-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'

// Orden respetando foreign keys
const TABLES = [
  // Base sin dependencias
  'users',
  'banks',
  'wallets',
  'card_networks',
  'categories',
  'currencies',
  'financial_account_types',
  // Dependen de base
  'card_segments',
  'bank_segments',
  'commerces',
  'sessions',
  'trusted_devices',
  'verification_tokens',
  // Dependen de commerces/banks/wallets
  'commerce_aliases',
  'commerce_branches',
  'commerce_products',
  'financial_profiles',
  'notification_preferences',
  'push_subscriptions',
  'scraper_runs',
  'scraper_schedules',
  'user_banks',
  'user_wallets',
  'user_cards',
  'user_events',
  // Promos
  'promos',
  'promo_requirements',
  'promo_reports',
  'promo_calendar',
  'promo_clicks',
  'saved_promos',
  'vtex_promo_cache',
  // Comunidad
  'community_posts',
  'post_likes',
  // Finance
  'finance_items',
  // Relaciones M-M
  '_BankToCardNetwork',
  '_BankToCardSegment',
  '_WalletToCardNetwork',
  '_WalletToCardSegment',
]

const BATCH = 500

async function migrateTable(src: Client, dst: Client, table: string) {
  const countRes = await src.query(`SELECT COUNT(*) FROM "${table}"`)
  const total = parseInt(countRes.rows[0].count)
  if (total === 0) {
    console.log(`  ${table}: vacía, skip`)
    return
  }

  // Deshabilitar triggers/checks temporalmente
  await dst.query(`ALTER TABLE IF EXISTS "${table}" DISABLE TRIGGER ALL`).catch(() => {})

  let offset = 0
  let inserted = 0

  while (offset < total) {
    const res = await src.query(`SELECT * FROM "${table}" LIMIT ${BATCH} OFFSET ${offset}`)
    if (res.rows.length === 0) break

    const cols = res.fields.map(f => `"${f.name}"`).join(', ')

    // Intentar batch primero, si falla → fila por fila
    try {
      const placeholders = res.rows.map((_, ri) =>
        `(${res.fields.map((_, ci) => `$${ri * res.fields.length + ci + 1}`).join(', ')})`
      ).join(', ')
      const values = res.rows.flatMap(row => res.fields.map(f => row[f.name]))
      await dst.query(
        `INSERT INTO "${table}" (${cols}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        values
      )
      inserted += res.rows.length
    } catch {
      // Reintentar fila por fila
      for (const row of res.rows) {
        try {
          const ph = res.fields.map((_, ci) => `$${ci + 1}`).join(', ')
          const vals = res.fields.map(f => row[f.name])
          await dst.query(
            `INSERT INTO "${table}" (${cols}) VALUES (${ph}) ON CONFLICT DO NOTHING`,
            vals
          )
          inserted++
        } catch {
          // Saltear fila con FK violation
        }
      }
    }

    offset += BATCH
    process.stdout.write(`\r  ${table}: ${inserted}/${total}`)
  }

  await dst.query(`ALTER TABLE IF EXISTS "${table}" ENABLE TRIGGER ALL`).catch(() => {})
  console.log(`\r  ${table}: ${inserted}/${total} ✓`)
}

async function main() {
  const src = new Client({ connectionString: COCKROACH_URL })
  const dst = new Client({ connectionString: NEON_URL })

  console.log('Conectando...')
  await src.connect()
  await dst.connect()
  console.log('Conectado a ambas DBs.\n')

  for (const table of TABLES) {
    try {
      await migrateTable(src, dst, table)
    } catch (e: any) {
      console.error(`\n  ERROR en ${table}:`, e.message)
    }
  }

  await src.end()
  await dst.end()
  console.log('\nMigración completa.')
}

main().catch(console.error)
