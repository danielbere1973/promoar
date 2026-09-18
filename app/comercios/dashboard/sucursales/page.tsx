import React from 'react'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import SucursalesManager from './SucursalesManager'

export default async function SucursalesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/comercios/registro')

  const userCommerce = await prisma.userCommerce.findFirst({
    where: { userId: session.user.id, status: 'APPROVED' },
    include: { commerce: true }
  })

  if (!userCommerce) redirect('/comercios/registro')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mis Sucursales</h1>
        <p className="text-gray-500 mt-2">
          Gestioná las ubicaciones físicas de tu comercio. Estas sucursales son las que los usuarios verán en el mapa de promociones.
        </p>
      </div>
      
      <div className="bg-white shadow rounded-lg border border-gray-200">
        <SucursalesManager commerceId={userCommerce.commerce.id} />
      </div>
    </div>
  )
}
