/**
 * Migración de datos Supabase → CockroachDB
 * Lee de Supabase con pg, escribe en CockroachDB con pg.
 * Ejecutar: node scripts/migrate-db.js
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const { Pool } = require('pg')

const SOURCE = new Pool({
  connectionString: 'postgresql://postgres.hsaieohgmsbzrwobvzyt:Ethabhaec0k3@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require',
})

const TARGET = new Pool({
  connectionString: 'postgresql://danielbere:YLiz1r4WbVxPTpebwOuYhA@newer-newfie-26605.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full',
  ssl: { rejectUnauthorized: true },
})

async function copyTable(tableName, opts = {}) {
  const { orderBy = 'id', skip = false, transform } = opts
  if (skip) { console.log(`  ⏭  ${tableName} (skipped)`); return 0 }

  const { rows } = await SOURCE.query(`SELECT * FROM "${tableName}" ORDER BY "${orderBy}"`)
  if (rows.length === 0) { console.log(`  ○  ${tableName}: vacío`); return 0 }

  const processed = transform ? rows.map(transform) : rows
  const cols = Object.keys(processed[0])
  const colList = cols.map(c => `"${c}"`).join(', ')

  let inserted = 0
  const BATCH = 100
  for (let i = 0; i < processed.length; i += BATCH) {
    const batch = processed.slice(i, i + BATCH)
    const placeholders = batch.map((_, ri) =>
      `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', ')})`
    ).join(', ')
    const values = batch.flatMap(r => cols.map(c => r[c]))
    await TARGET.query(
      `INSERT INTO "${tableName}" (${colList}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values
    )
    inserted += batch.length
  }

  console.log(`  ✓  ${tableName}: ${inserted} filas`)
  return inserted
}

async function truncateAll() {
  // Orden: más dependientes primero
  const tables = [
    'trusted_devices', 'post_likes', 'saved_promos', 'promo_reports',
    'community_posts', 'promo_requirements', 'promos',
    'user_cards', 'user_wallets', 'user_banks', 'financial_profiles',
    'sessions', 'accounts', 'users',
    'commerces', 'bank_modo_codes', 'card_segments', 'bank_segments',
    'card_networks', 'wallets', 'banks', 'categories',
    'finance_items', 'financial_account_types', 'currencies',
  ]
  for (const t of tables) {
    await TARGET.query(`DELETE FROM "${t}"`)
  }
  console.log('✓ CockroachDB limpia')
}

async function main() {
  console.log('Conectando a Supabase y CockroachDB...')
  await SOURCE.query('SELECT 1')
  await TARGET.query('SELECT 1')
  console.log('Conexiones OK\n')

  console.log('=== Limpiando CockroachDB ===')
  await truncateAll()

  console.log('=== Datos de referencia ===')
  await copyTable('currencies',              { orderBy: 'id' })
  await copyTable('financial_account_types', { orderBy: 'id' })
  await copyTable('categories',              { orderBy: 'order' })
  await copyTable('card_networks',           { orderBy: 'id' })
  await copyTable('banks',                   { orderBy: 'id' })
  await copyTable('wallets',                 { orderBy: 'id' })
  await copyTable('bank_segments',           { orderBy: 'id' })
  await copyTable('card_segments',           { orderBy: 'id' })
  await copyTable('bank_modo_codes',         {
    orderBy: 'id',
    // Supabase tiene id como Int, CockroachDB como BigInt — convertir
    transform: r => ({ ...r, id: BigInt(r.id) })
  })

  console.log('\n=== Comercios ===')
  await copyTable('commerces', { orderBy: 'id' })

  console.log('\n=== Usuarios y perfiles ===')
  await copyTable('users',              { orderBy: 'createdAt' })
  await copyTable('accounts',           { orderBy: 'id' })
  await copyTable('financial_profiles', { orderBy: 'id' })
  await copyTable('user_banks',         { orderBy: 'createdAt' })
  await copyTable('user_wallets',       { orderBy: 'createdAt' })
  await copyTable('user_cards',         { orderBy: 'createdAt' })
  // Sessions y tokens no vale la pena migrar (expiran)
  await copyTable('sessions',           { skip: true })
  await copyTable('verification_tokens',{ skip: true })
  await copyTable('trusted_devices',    { skip: true })

  console.log('\n=== Promos ===')
  await copyTable('promos',             { orderBy: 'createdAt' })
  await copyTable('promo_requirements', { orderBy: 'id' })

  console.log('\n=== Comunidad y finanzas ===')
  await copyTable('community_posts', { orderBy: 'createdAt' })
  await copyTable('post_likes',      { orderBy: 'createdAt' })
  await copyTable('saved_promos',    { orderBy: 'createdAt' })
  await copyTable('promo_reports',   { orderBy: 'createdAt' })
  await copyTable('finance_items',   { orderBy: 'createdAt' })

  console.log('\n✅ Migración completada!')
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exit(1) })
  .finally(() => { SOURCE.end(); TARGET.end() })
