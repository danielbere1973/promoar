import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = await getAuthToken(req)
  return NextResponse.json({ 
    token: token ? 'EXISTE' : 'NULL',
    email: token?.email || 'N/A',
    role: (token as any)?.role || 'N/A'
  })
}
