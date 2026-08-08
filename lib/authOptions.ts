import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  // next-auth v4 calcula useSecureCookies a partir de si NEXTAUTH_URL empieza
  // con "https://" — no a partir del request real. Si NEXTAUTH_URL quedó en
  // "http://localhost:3000" (valor de .env local, probablemente copiado tal
  // cual a las env vars de Vercel), en Preview (que SIEMPRE es https) NextAuth
  // setea la cookie de sesión SIN el prefijo __Secure- ni el flag Secure.
  // El login "funciona" (POST exitoso, cookie seteada) pero el middleware,
  // que sí espera esa cookie con prefijo seguro en un host https, nunca la
  // encuentra — por eso cualquier ruta protegida (/perfil, etc.) rebota a
  // /login aunque el usuario ya inició sesión. Forzar true acá evita depender
  // de que NEXTAUTH_URL esté bien seteado por entorno en Vercel.
  useSecureCookies: process.env.NODE_ENV === 'production',
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
        deviceToken: { label: 'Device Token', type: 'text' },
        skipTwoFactor: { label: 'Skip 2FA', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const cleanEmail = credentials.email.toLowerCase().trim()

        const user = await prisma.user.findUnique({
          where: { email: cleanEmail },
        })

        if (!user || !user.password) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        if (process.env.NODE_ENV === 'development') {
          return { id: user.id, email: user.email, name: user.name, role: user.role }
        }

        if (credentials.skipTwoFactor === 'true') {
          return { id: user.id, email: user.email, name: user.name, role: user.role }
        }

        const deviceToken = credentials.deviceToken
        if (deviceToken) {
          const trusted = await prisma.trustedDevice.findFirst({
            where: {
              userId: user.id,
              token: deviceToken,
              expiresAt: { gt: new Date() },
            },
          })
          if (trusted) {
            return { id: user.id, email: user.email, name: user.name, role: user.role }
          }
        }

        throw new Error('2FA_REQUIRED')
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        const existing = await prisma.user.findUnique({ where: { email: user.email } })
        if (!existing) {
          await prisma.user.create({
            data: {
              email:         user.email,
              name:          user.name ?? '',
              emailVerified: new Date(),
              role:          'USER',
            },
          })
        }
      }
      if (user.email) {
        await prisma.user.update({
          where: { email: user.email },
          data: { lastLoginAt: new Date() },
        })
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'google' && user.email) {
          const dbUser = await prisma.user.findUnique({ where: { email: user.email } })
          token.id   = dbUser?.id
          token.role = dbUser?.role ?? 'USER'
        } else {
          token.id   = user.id
          token.role = (user as any).role
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id   = token.id
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
}
