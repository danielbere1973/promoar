import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  return NextResponse.json({ 
    token: token ? 'EXISTE' : 'NULL',
    email: token?.email || 'N/A',
    role: (token as any)?.role || 'N/A'
  })
}
