import { prisma } from '../lib/prisma';

async function main() {
  const u = await prisma.user.findUnique({
    where: { email: 'litadescuentos@gmail.com' },
    include: {
      financialProfile: {
        include: {
          banks: { include: { bank: true } },
          wallets: { include: { wallet: true } },
          cards: { include: { bank: true, wallet: true, cardNetwork: true } }
        }
      }
    }
  });

  if (!u) { console.log('Usuario no encontrado'); return; }

  console.log('userId:', u.id);
  console.log('role:', u.role);
  console.log('financialProfile:', u.financialProfile ? 'EXISTE' : 'NULL - NO TIENE PERFIL');

  if (u.financialProfile) {
    console.log('\nBanks:', u.financialProfile.banks.map(b => b.bank.name));
    console.log('Wallets:', u.financialProfile.wallets.map(w => w.wallet.name));
    console.log('Cards:');
    u.financialProfile.cards.forEach(c => {
      console.log(`  bank=${c.bank?.name ?? 'null'} wallet=${c.wallet?.name ?? 'null'} net=${c.cardNetwork?.name ?? 'null'} type=${c.cardType} payroll=${c.isPayroll} pensioner=${c.isPensioner}`);
    });
  }
}

main().catch(console.error).finally(() => process.exit(0));
