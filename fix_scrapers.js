const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.scraperRun.updateMany({
    where: {
      status: 'running'
    },
    data: {
      status: 'error',
      finishedAt: new Date(),
      message: 'Aborted due to timeout / Auth failure'
    }
  })
  console.log(`Marcadas como error ${result.count} corridas atascadas.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
