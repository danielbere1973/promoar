import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'
const REDIRECT_URI = `${BASE_URL}/api/ml-oauth/callback`

export async function GET() {
  const clientId = process.env.ML_CLIENT_ID
  // DEBUG — sin auth, solo para verificar valores
  return NextResponse.json({ clientId: clientId || '(no configurado)', redirectUri: REDIRECT_URI })
}
