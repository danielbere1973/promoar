import React from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export default async function CommerceDashboardOverview() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) return null;

  const userCommerces = await prisma.userCommerce.findMany({
    where: { userId: session.user.id, status: 'APPROVED' },
    include: { commerce: true },
  });

  if (!userCommerces.length) return null;

  const commerce = userCommerces[0].commerce;

  // Estadísticas mock por ahora (en el futuro se pueden sacar de PromoClick / PromoUsage)
  const stats = [
    { name: 'Vistas del perfil (30 días)', stat: '12,450' },
    { name: 'Clics salientes a tu web', stat: '840' },
    { name: 'Promos guardadas por usuarios', stat: '3,210' },
    { name: 'Promos activas hoy', stat: commerce.activePromoCount.toString() },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        ¡Hola, equipo de {commerce.name}!
      </h1>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.name} className="relative bg-white pt-5 px-4 pb-12 sm:pt-6 sm:px-6 shadow rounded-lg overflow-hidden border border-gray-100">
            <dt>
              <div className="absolute bg-blue-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <p className="ml-16 text-sm font-medium text-gray-500 truncate">{item.name}</p>
            </dt>
            <dd className="ml-16 pb-6 flex items-baseline sm:pb-7">
              <p className="text-2xl font-semibold text-gray-900">{item.stat}</p>
            </dd>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">Módulos Disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">📍 Gestión de Sucursales</h3>
            <p className="mt-2 text-sm text-gray-600">
              Mantené actualizado tu mapa de sucursales adheridas para que los usuarios cercanos vean tus promociones.
            </p>
            <a href="/comercios/dashboard/sucursales" className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500">
              Ir a Sucursales &rarr;
            </a>
          </div>

          <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">🛒 Promociones Directas</h3>
            <p className="mt-2 text-sm text-gray-600">
              Cargá tus propios descuentos de góndola (ej. "2da al 50%") independientes de las promociones bancarias.
            </p>
            <a href="/comercios/dashboard/promos" className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500">
              Ir a Promociones &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
