'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { submitCommerceRegistration } from './actions';

export default function MerchantRegistrationPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    
    const result = await submitCommerceRegistration(formData);
    
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(true);
    }
    
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">¡Solicitud Enviada!</h2>
          <p className="mt-2 text-sm text-gray-600">
            Hemos recibido tu solicitud. Nuestro equipo la revisará manualmente para verificar tu identidad y te notificaremos por email.
          </p>
          <div className="mt-6">
            <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              Volver a la página principal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Unite a PromoAR para Comercios
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Gestioná tus sucursales, accedé a métricas y publicá promociones directas.
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" action={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="mb-4">
              <label htmlFor="commerce-name" className="sr-only">Nombre del Comercio</label>
              <input
                id="commerce-name"
                name="commerceName"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Nombre del Comercio (ej. Coto, Frávega)"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="corporate-email" className="sr-only">Email / Teléfono de Contacto</label>
              <input
                id="corporate-email"
                name="email"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email o Teléfono para validarte"
              />
            </div>
            <div>
              <label htmlFor="role" className="sr-only">Tu Cargo</label>
              <input
                id="role"
                name="role"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Cargo (ej. Gerente o Dueño)"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70"
            >
              {loading ? 'Enviando...' : 'Solicitar Acceso'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            ¿Ya tenés cuenta aprobada?{' '}
            <Link href="/comercios/dashboard" className="font-medium text-blue-600 hover:text-blue-500">
              Ingresá al Dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
