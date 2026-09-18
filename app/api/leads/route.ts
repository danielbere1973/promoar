import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, commerceId, promoId } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ message: 'Invalid email' }, { status: 400 })
    }

    const lead = await prisma.anonymousLead.create({
      data: {
        email,
        commerceId: commerceId || null,
        promoId: promoId || null,
      },
    })

    return NextResponse.json({ success: true, leadId: lead.id })
  } catch (error) {
    console.error('Error saving lead:', error)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
