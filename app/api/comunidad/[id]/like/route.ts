import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedEmail } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const email = await getAuthenticatedEmail(req)
    if (!email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return NextResponse.json({ error: 'Usuario invalido' }, { status: 401 })

    const postId = params.id
    
    const existingLike = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
    })

    if (existingLike) {
      // Quitar Like
      await prisma.postLike.delete({
        where: { postId_userId: { postId, userId: user.id } }
      })
      await prisma.communityPost.update({
        where: { id: postId },
        data: { likes: { decrement: 1 } }
      })
      return NextResponse.json({ liked: false })
    } else {
      // Dar Like
      await prisma.postLike.create({
        data: { postId, userId: user.id }
      })
      await prisma.communityPost.update({
        where: { id: postId },
        data: { likes: { increment: 1 } }
      })
      return NextResponse.json({ liked: true })
    }

  } catch (error) {
    console.error('[POST /api/comunidad/[id]/like]', error)
    return NextResponse.json({ error: 'Error al procesar like' }, { status: 500 })
  }
}
