import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userCommerces = await prisma.userCommerce.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      commerce: { select: { id: true, name: true, logoUrl: true } }
    }
  })

  // Sort PENDING first, then APPROVED, then REJECTED
  const statusOrder = { PENDING: 0, APPROVED: 1, REJECTED: 2 }
  userCommerces.sort((a, b) => {
    return (statusOrder[a.status as keyof typeof statusOrder] ?? 99) - (statusOrder[b.status as keyof typeof statusOrder] ?? 99)
  })

  return NextResponse.json({ userCommerces })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id, status } = await request.json()
    
    if (!id || !['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    const updated = await prisma.userCommerce.update({
      where: { id },
      data: { status },
      include: {
        user: true,
        commerce: true
      }
    })

    // Si se aprueba, mandar mail opcional
    if (status === 'APPROVED' && process.env.RESEND_API_KEY && updated.user.email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'PromoAR B2B <noreply@promoar.com.ar>',
          to: updated.user.email,
          subject: '¡Tu cuenta de comercio en PromoAR fue aprobada!',
          html: `
            <div style="font-family: sans-serif; color: #333;">
              <h2>¡Hola ${updated.user.name || ''}!</h2>
              <p>Tu solicitud para administrar el comercio <strong>${updated.commerce.name}</strong> en PromoAR ha sido <strong>APROBADA</strong>.</p>
              <p>Ya podés ingresar al Dashboard B2B para gestionar tus sucursales y ver estadísticas.</p>
              <br/>
              <a href="https://promoar.vercel.app/comercios/dashboard" style="background: #1E3A8A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir al Dashboard B2B</a>
              <br/><br/>
              <p>Saludos,<br/>El equipo de PromoAR</p>
            </div>
          `
        })
      } catch(e) {
        console.error('Error enviando mail de aprobación B2B:', e)
      }
    }

    return NextResponse.json({ ok: true, userCommerce: updated })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
