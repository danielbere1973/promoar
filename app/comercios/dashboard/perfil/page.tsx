import React from 'react'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import PerfilForm from './PerfilForm'

export default async function PerfilPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/comercios/registro')

  const userCommerce = await prisma.userCommerce.findFirst({
    where: { userId: session.user.id, status: 'APPROVED' },
    include: { commerce: true }
  })

  if (!userCommerce) redirect('/comercios/registro')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Perfil de Marca</h1>
        <p className="text-gray-500 mt-2">
          Actualizá la información pública de tu comercio. Estos datos se mostrarán a los usuarios cuando vean tus promociones.
        </p>
      </div>
      
      <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
        <PerfilForm commerce={userCommerce.commerce} />
      </div>
    </div>
  )
}
