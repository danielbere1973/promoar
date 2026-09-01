import { prisma } from '../lib/prisma';

async function main() {
  const email = 'litadescuentos@gmail.com';
  const user = await prisma.user.findUnique({
    where: { email },
    include: { financialProfile: true }
  });

  if (!user || !user.financialProfile) {
    console.log('Usuario o perfil no encontrado');
    return;
  }

  try {
    const newCard = await prisma.userCard.create({
      data: {
        financialProfileId: user.financialProfile.id,
        cardType: 'ACCOUNT' as any, // Cast to any because the generated client might not be fully re-indexed by IDE yet
        bankAccountType: 'CA',
        currency: 'ARS',
      }
    });
    console.log('✅ Éxito al crear cuenta:', newCard.id);
    
    // Cleanup
    await prisma.userCard.delete({ where: { id: newCard.id } });
    console.log('✅ Cleanup exitoso');
  } catch (error) {
    console.error('❌ Error al crear cuenta:', error);
  }
}

main().catch(console.error).finally(() => process.exit(0));
