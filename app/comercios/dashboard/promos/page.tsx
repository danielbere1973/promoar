import React from 'react'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import PromosManager from './PromosManager'

export default async function PromosDirectasPage() {
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
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Promociones Directas</h1>
        <p className="text-gray-500 mt-2">
          Cargá tus propios descuentos de góndola (ej. &quot;2da al 50%&quot;), independientes de las promociones bancarias. Se muestran en la app con el sello &quot;Promo del Local&quot;.
        </p>
      </div>

      {!userCommerce.commerce.defaultCategoryId && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-4">
          Tu comercio todavía no tiene una categoría asignada, así que no vas a poder publicar promociones todavía. Contactá a soporte para que te la asignen.
        </div>
      )}

      <div className="bg-white shadow rounded-lg border border-gray-200">
        <PromosManager commerceId={userCommerce.commerce.id} />
      </div>
    </div>
  )
}
