const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  console.log("Generando reporte CSV para Excel...");
  
  const promos = await prisma.promo.findMany({
    include: {
      commerce: true,
      requirements: {
        include: {
          bank: true,
          wallet: true,
          cardNetwork: true,
        }
      }
    },
    orderBy: {
      commerce: {
        name: 'asc'
      }
    }
  });

  const headers = [
    "Comercio",
    "Titulo",
    "Descripcion",
    "Fecha Inicio",
    "Fecha Fin",
    "Fechas Especiales",
    "Tipo Beneficio",
    "Valor Beneficio",
    "Tope Reintegro",
    "Monto Minimo",
    "Entidad",
    "Red de Tarjeta",
    "Tipo de Tarjeta",
    "Medio de Pago",
    "URL de Origen",
    "Scraper Identificado"
  ];

  const csvRows = [headers.join(";")];

  for (const promo of promos) {
    const requirements = promo.requirements.length > 0 ? promo.requirements : [null];

    for (const req of requirements) {
      const row = [
        escapeCsv(promo.commerce?.name || ""),
        escapeCsv(promo.title || ""),
        escapeCsv((promo.description || "").replace(/\n/g, ' ')),
        promo.validFrom ? new Date(promo.validFrom).toLocaleDateString('es-AR') : "",
        promo.validUntil ? new Date(promo.validUntil).toLocaleDateString('es-AR') : "",
        escapeCsv(promo.specificDates || ""),
        req ? req.discountType : "",
        req ? req.discountValue : "",
        req ? (req.cap || "") : "",
        req ? (req.minPurchase || "") : "",
        escapeCsv(req ? (req.bank?.name || req.wallet?.name || "") : ""),
        escapeCsv(req ? (req.cardNetwork?.name || "") : ""),
        req ? (req.cardType || "") : "",
        req ? (req.paymentChannel || "") : "",
        escapeCsv(promo.sourceUrl || ""),
        escapeCsv(identifyScraper(promo.sourceUrl))
      ];
      csvRows.push(row.join(";"));
    }
  }

  // Use UTF-8 with BOM for Excel compatibility with accents
  fs.writeFileSync('reporte_promos.csv', '\ufeff' + csvRows.join("\n"));
  
  console.log(`Reporte generado exitosamente: reporte_promos.csv`);
  console.log(`Total de filas: ${csvRows.length - 1}`);
}

function identifyScraper(url) {
  if (!url) return "Manual / Desconocido";
  const u = url.toLowerCase();
  if (u.includes('coto.com.ar')) return "Coto";
  if (u.includes('diarco.com.ar')) return "Diarco";
  if (u.includes('jumbo.com.ar')) return "Jumbo";
  if (u.includes('disco.com.ar')) return "Disco";
  if (u.includes('vea.com.ar')) return "Vea";
  if (u.includes('changomas.com.ar') || u.includes('masonline.com.ar')) return "ChangoMas";
  if (u.includes('carrefour.com.ar')) return "Carrefour";
  if (u.includes('modo.com.ar')) return "MODO";
  if (u.includes('mercadopago.com.ar')) return "Mercado Pago";
  if (u.includes('bancoprovincia.com.ar/cuentadni')) return "Cuenta DNI";
  if (u.includes('visa.com.ar')) return "Visa";
  if (u.includes('americanexpress.com')) return "Amex";
  if (u.includes('naranjax.com')) return "NaranjaX";
  if (u.includes('cabal.coop')) return "Cabal";
  if (u.includes('galicia.ar')) return "Galicia";
  if (u.includes('bbva.com.ar')) return "BBVA";
  if (u.includes('santander.com.ar')) return "Santander";
  if (u.includes('macro.com.ar')) return "Macro";
  if (u.includes('icbc.com.ar')) return "ICBC";
  if (u.includes('bancociudad.com.ar')) return "Banco Ciudad";
  if (u.includes('bancopatagonia.com.ar')) return "Patagonia";
  if (u.includes('supervielle.com.ar')) return "Supervielle";
  if (u.includes('bna.com.ar') || u.includes('semananacion.com.ar')) return "BNA";
  if (u.includes('bancoprovincia.com.ar')) return "Banco Provincia";
  
  return "Otro Scraper";
}


function escapeCsv(text) {
  if (!text) return "";
  // Escape quotes by doubling them
  const escaped = text.toString().replace(/"/g, '""');
  return `"${escaped}"`;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
