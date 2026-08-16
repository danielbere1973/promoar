import { NextRequest } from 'next/server'
import { getToken, type JWT } from 'next-auth/jwt'

// Wrapper de getToken() con secureCookie forzado — next-auth v4 deriva
// secureCookie de si NEXTAUTH_URL empieza con "https://", no del request
// real. En Preview de Vercel NEXTAUTH_URL puede quedar mal configurada
// (ej. apuntando a localhost), lo que hace que busque la cookie de sesión
// sin el prefijo __Secure- y nunca la encuentre aunque el login haya sido
// exitoso. Usar esta función en vez de getToken() directo en cualquier
// route handler que necesite leer la sesión.
export async function getAuthToken(req: NextRequest): Promise<JWT | null> {
  return getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  })
}

/**
 * Obtiene el email del usuario autenticado desde el token JWT.
 * Más seguro y confiable que confiar en headers enviados por el cliente.
 */
export async function getAuthenticatedEmail(req: NextRequest): Promise<string | null> {
  const token = await getAuthToken(req)
  return token?.email || null
}
