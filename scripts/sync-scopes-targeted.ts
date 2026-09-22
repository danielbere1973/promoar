import { prisma } from '../lib/prisma';

async function main() {
  console.log('--- ACTUALIZANDO PROMOS ESPECÍFICAS (UBER, RAPPI, PERSONAL PAY, COLECTIVO) ---');

  // 1. Limpiar "Próximamente" en Colectivo y otros comercios
  const proxRes = await prisma.promo.updateMany({
    where: {
      commerceNote: { contains: 'Próximamente' },
    },
    data: {
      commerceNote: null,
    },
  });
  console.log(`Promos limpiadas de 'Próximamente': ${proxRes.count}`);

  // 2. Uber ICBC (cmsbdcesh0igleulvwwgs0i8g)
  const uberRes = await prisma.promo.updateMany({
    where: {
      title: { contains: 'UBER' },
      sourceText: { contains: 'AEROPUERTO' },
    },
    data: {
      commerceNote: 'Solo viajes hacia/desde Aeropuertos · Tope $20.000',
    },
  });
  console.log(`Promos Uber Aeropuerto actualizadas: ${uberRes.count}`);

  // 3. Traer beneficios reales de Personal Pay desde la API
  try {
    const res = await fetch('https://www.personal.com.ar/pay/api/benefits?offset=0&limit=200', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    if (res.ok) {
      const json = await res.json();
      const benefits: any[] = json.data?.benefits ?? [];
      console.log(`Beneficios de Personal Pay recibidos de la API: ${benefits.length}`);

      const ppWallet = await prisma.wallet.findFirst({ where: { name: 'Personal Pay' } });
      if (ppWallet) {
        for (const item of benefits) {
          const storeName = (item.title || '').trim();
          const variant = (item.name || '').trim();
          const discountStr = (item.discounts || '').trim();
          const pct = parseInt(discountStr.replace('%', ''));

          if (!storeName || !variant || !pct) continue;
          if (/total\s+de\s+la\s+(?:compra|cuenta)/i.test(variant)) continue;

          // Buscar promos en la DB de este comercio con Personal Pay y este %
          const noteText = variant.includes('suscripción') || variant.includes('Rappi Pro')
            ? `Solo suscripción ${variant}`
            : `Solo en: ${variant}`;

          const updated = await prisma.promo.updateMany({
            where: {
              status: 'ACTIVE',
              commerce: { name: { equals: storeName, mode: 'insensitive' } },
              requirements: {
                some: {
                  walletId: ppWallet.id,
                  discountValue: pct,
                },
              },
            },
            data: {
              commerceNote: noteText,
            },
          });

          if (updated.count > 0) {
            console.log(`[PP ENRICHED] ${storeName} (${pct}%) -> "${noteText}" (${updated.count} promos)`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error consultando API Personal Pay:', err);
  }

  // 4. Invalidad caches para que localhost y la app lo reflejen inmediatamente
  console.log('Finalizado.');
}

main().finally(() => prisma.$disconnect());
