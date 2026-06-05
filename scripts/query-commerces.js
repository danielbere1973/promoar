const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const p = new PrismaClient()
p.commerce.findMany({
  where: { logoUrl: null, promos: { some: { status: 'ACTIVE' } } },
  select: { name: true, slug: true, _count: { select: { promos: { where: { status: 'ACTIVE' } } } } },
  orderBy: { promos: { _count: 'desc' } },
}).then(r => {
  const filtered = r.filter(x => x._count.promos >= 1)
  const header = 'name,slug,promos_activas'
  const lines = filtered.map(x => `"${x.name.replace(/"/g, '""')}",${x.slug},${x._count.promos}`)
  fs.writeFileSync('commerces-sin-logo.csv', [header, ...lines].join('\n'), 'utf8')
  console.log(`Total con 5+ promos sin logo: ${filtered.length}`)
  p.$disconnect()
})
