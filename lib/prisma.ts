import { PrismaClient } from '@prisma/client'
import dns from 'dns'

try {
  dns.setDefaultResultOrder?.('ipv4first')
} catch {}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

globalForPrisma.prisma = prisma