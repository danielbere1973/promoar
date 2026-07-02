import { Client } from 'pg'

const NEON_URL = 'postgresql://neondb_owner:npg_3NnDXmfLcI8W@ep-fragrant-bird-am3uvyq5-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'

async function main() {
  const client = new Client({ connectionString: NEON_URL })
  await client.connect()

  // Drop all tables in public schema
  const res = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `)
  const tables = res.rows.map((r: any) => r.tablename)
  console.log(`Borrando ${tables.length} tablas...`)

  if (tables.length > 0) {
    await client.query(`DROP TABLE IF EXISTS ${tables.map((t: string) => `"${t}"`).join(', ')} CASCADE`)
    console.log('Tablas borradas.')
  } else {
    console.log('No había tablas.')
  }

  // Drop all enums
  const enumRes = await client.query(`
    SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  `)
  const enums = enumRes.rows.map((r: any) => r.typname)
  for (const e of enums) {
    await client.query(`DROP TYPE IF EXISTS "${e}" CASCADE`)
  }
  console.log(`${enums.length} enums borrados.`)

  await client.end()
}

main().catch(console.error)
