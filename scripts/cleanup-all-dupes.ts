import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, title: true, commerceId: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, // más nuevas primero
  })

  const groups = new Map<string, typeof promos>()
  for (const p of promos) {
    const key = `${p.title}|${p.commerceId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  const dupeIds: string[] = []
  for (const group of groups.values()) {
    if (group.length > 1) {
      // El primero es el más nuevo (desc), los demás son duplicados
      for (const p of group.slice(1)) dupeIds.push(p.id)
    }
  }

  console.log(`Eliminando ${dupeIds.length} duplicados (guardando el más nuevo de cada grupo)...`)

  // Borrar en batches para no saturar la conexión
  let deleted = 0
  for (let i = 0; i < dupeIds.length; i += 100) {
    const batch = dupeIds.slice(i, i + 100)
    const { count } = await prisma.promo.deleteMany({ where: { id: { in: batch } } })
    deleted += count
    console.log(`  Batch ${Math.floor(i/100)+1}: ${deleted}/${dupeIds.length}`)
  }

  console.log(`✅ Eliminados: ${deleted}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
