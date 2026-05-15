import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const handler = NextAuth({
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

        // En desarrollo: saltear 2FA siempre
        if (process.env.NODE_ENV === 'development') {
          return { id: user.id, email: user.email, name: user.name, role: user.role }
        }

        // Si viene con skipTwoFactor=true significa que ya verificó el código
        if (credentials.skipTwoFactor === 'true') {
          return { id: user.id, email: user.email, name: user.name, role: user.role }
        }

        // Verificar si el dispositivo es de confianza
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

        // Requerir 2FA
        throw new Error('2FA_REQUIRED')
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google OAuth: crear o recuperar usuario automáticamente
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
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        // Para Google, buscar el id real en la DB
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
})

export { handler as GET, handler as POST }