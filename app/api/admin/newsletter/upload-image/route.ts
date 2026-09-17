export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getAuthToken } from '@/lib/auth'

// POST — sube una imagen para insertar en el compositor de newsletter
export async function POST(req: NextRequest) {
  const token = await getAuthToken(req)
  if (!token || token.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const archivo = formData.get('file')
  if (!(archivo instanceof File)) return NextResponse.json({ error: 'Archivo inválido' }, { status: 400 })
  if (!archivo.type.startsWith('image/')) return NextResponse.json({ error: 'Solo se pueden subir imágenes' }, { status: 400 })

  try {
    const blob = await put(`newsletter/${archivo.name}`, archivo, {
      access: 'public',
      addRandomSuffix: true,
    })
    return NextResponse.json({ url: blob.url })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al subir la imagen' }, { status: 500 })
  }
}
