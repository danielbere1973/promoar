'use server';

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function submitCommerceRegistration(formData: FormData) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return { error: 'Debes iniciar sesión primero para solicitar acceso.' };
  }

  const commerceName = formData.get('commerceName') as string;
  const corporateEmail = formData.get('email') as string;
  const role = formData.get('role') as string;
  const phone = formData.get('phone') as string;

  if (!commerceName || !corporateEmail || !role) {
    return { error: 'Por favor completá todos los campos obligatorios.' };
  }

  try {
    // 1. Buscar si el comercio ya existe (búsqueda simple por nombre)
    // Para simplificar, buscamos por coincidencia exacta (case-insensitive) o creamos uno "fantasma" / pendiente.
    let commerce = await prisma.commerce.findFirst({
      where: {
        name: {
          equals: commerceName,
          mode: 'insensitive'
        }
      }
    });

    // Si no existe, lo creamos y lo dejamos inactivo hasta que el Admin lo revise
    if (!commerce) {
      commerce = await prisma.commerce.create({
        data: {
          name: commerceName,
          slug: commerceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
          active: false, // Inactivo hasta que se apruebe el registro
          locationModel: 'UNKNOWN'
        }
      });
    }

    // 2. Verificar si este usuario ya tiene una solicitud
    const existingClaim = await prisma.userCommerce.findUnique({
      where: {
        userId_commerceId: {
          userId: session.user.id,
          commerceId: commerce.id,
        }
      }
    });

    if (existingClaim) {
      return { error: 'Ya tenés una solicitud en curso para este comercio.' };
    }

    // 3. Crear el vínculo en estado PENDING
    await prisma.userCommerce.create({
      data: {
        userId: session.user.id,
        commerceId: commerce.id,
        role: 'ADMIN',
        status: 'PENDING'
      }
    });

    // Idealmente acá podrías guardar el cargo (role en la empresa) y el teléfono en alguna tabla
    // (Ej. en un modelo CommerceLead o metiéndolo en metadatos del User).
    // Por ahora, con generar el UserCommerce PENDING, ya te va a figurar a vos en la base.

    return { success: true };
  } catch (error: any) {
    console.error('Error registrando comercio:', error);
    return { error: 'Hubo un error al procesar la solicitud. Intentá de nuevo más tarde.' };
  }
}
