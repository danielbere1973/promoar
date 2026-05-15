import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedEmail } from '@/lib/auth'
import { PostType } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    
    // Filtro por tipo si viene en querystring (y no es 'todos')
    const filter = type && type !== 'todos' ? { type: type.toUpperCase() as PostType } : {}

    const posts = await prisma.communityPost.findMany({
      where: {
        status: 'active',
        ...filter,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Límite para demo
    })

    // Agregamos info de Likes y formateamos
    // En una DB real deberíamos cruzarlo con los `userLikes` del usuario actual para saber si le dio like,
    // pero acá confiaremos en el cache de 'likes'.
    return NextResponse.json({ posts })
  } catch (error) {
    console.error('[GET /api/comunidad]', error)
    return NextResponse.json({ error: 'Error al listar posts' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const email = await getAuthenticatedEmail(req)
    if (!email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
       return NextResponse.json({ error: 'Usuario inválido' }, { status: 401 })
    }

    const { type, body, commerce, location } = await req.json()
    if (!type || !body) {
       return NextResponse.json({ error: 'Datos insuficientes' }, { status: 400 })
    }

    const newPost = await prisma.communityPost.create({
      data: {
        authorId: user.id,
        type: type.toUpperCase() as PostType,
        body,
        commerce: commerce || null,
        location: location || null,
      },
      include: {
        author: { select: { id: true, name: true, email: true } }
      }
    })

    return NextResponse.json({ post: newPost })
  } catch (error) {
    console.error('[POST /api/comunidad]', error)
    return NextResponse.json({ error: 'Error al crear post' }, { status: 500 })
  }
}
