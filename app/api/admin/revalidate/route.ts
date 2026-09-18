import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  const tag = request.nextUrl.searchParams.get('tag')
  const path = request.nextUrl.searchParams.get('path')

  // Validar token de seguridad usando ADMIN_SECRET o NEXTAUTH_SECRET como fallback
  const expectedSecret = process.env.ADMIN_SECRET || process.env.NEXTAUTH_SECRET

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
  }

  if (!tag && !path) {
    return NextResponse.json({ message: 'Missing tag or path param' }, { status: 400 })
  }

  try {
    if (tag) {
      revalidateTag(tag)
    }
    if (path) {
      revalidatePath(path)
    }
    return NextResponse.json({ 
      revalidated: true, 
      now: Date.now(), 
      tag, 
      path 
    })
  } catch (err) {
    console.error('Error in revalidate route:', err)
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 })
  }
}
