export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { email, token, password } = await req.json()

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.verificationCode !== token) {
      return NextResponse.json({ error: 'Link inválido o expirado' }, { status: 400 })
    }

    if (user.codeExpires && new Date() > user.codeExpires) {
      return NextResponse.json({ error: 'El link expiró' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { email },
      data: {
        password: hashed,
        verificationCode: null,
        codeExpires: null,
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en nueva-password:', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}