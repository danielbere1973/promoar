import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Obtiene el email del usuario autenticado desde el token JWT.
 * Más seguro y confiable que confiar en headers enviados por el cliente.
 */
export async function getAuthenticatedEmail(req: NextRequest): Promise<string | null> {
  const token = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET 
  })
  return token?.email || null
}
