const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
        cardType: 'ACCOUNT',
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
  } finally {
    await prisma.$disconnect();
  }
}

main();
