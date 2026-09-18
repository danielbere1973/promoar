import React from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export default async function CommerceDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/comercios/registro');
  }

  // Verificar si el usuario tiene algún comercio vinculado y aprobado
  const userCommerces = await prisma.userCommerce.findMany({
    where: {
      userId: session.user.id,
      status: 'APPROVED',
    },
    include: {
      commerce: true,
    },
  });

  if (userCommerces.length === 0) {
    // Podría estar pendiente, o no tener ninguno
    const pendingCommerces = await prisma.userCommerce.findFirst({
      where: { userId: session.user.id, status: 'PENDING' },
    });
    
    if (pendingCommerces) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
          <div className="bg-white p-8 rounded-lg shadow max-w-md text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Solicitud en Revisión</h2>
            <p className="text-gray-600">
              Tu solicitud para administrar el comercio está siendo revisada por nuestro equipo. 
              Te notificaremos por email cuando sea aprobada.
            </p>
          </div>
        </div>
      );
    }
    
    redirect('/comercios/registro');
  }

  const activeCommerce = userCommerces[0].commerce;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Sidebar B2B */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 hidden md:block">
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center px-6 border-b border-gray-200">
            <span className="text-lg font-bold text-gray-900 truncate">
              {activeCommerce.name}
            </span>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            <Link href="/comercios/dashboard" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-900 bg-gray-100">
              Resumen (Analytics)
            </Link>
            <Link href="/comercios/dashboard/sucursales" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900">
              Mis Sucursales
            </Link>
            <Link href="/comercios/dashboard/promos" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900">
              Promociones Directas
            </Link>
            <Link href="/comercios/dashboard/perfil" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900">
              Perfil de Marca
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
