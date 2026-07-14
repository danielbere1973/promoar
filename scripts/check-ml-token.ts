import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const keys = ['ml_refresh_token', 'ml_access_token']
  for (const key of keys) {
    const r = await prisma.siteConfig.findUnique({ where: { key } })
    if (r) {
      const preview = r.value.length > 60 ? r.value.slice(0, 60) + '...' : r.value
      console.log(`${key}: ${preview}`)
    } else {
      console.log(`${key}: NO EXISTE en DB`)
    }
  }
}

main().finally(() => prisma.$disconnect())
