// Cuenta DNI Scraper V3
// Fuente: https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios
// Técnica: cheerio para extraer IDs → GetBeneficioData2 para datos estructurados
// Billetera: Cuenta DNI (Banco Provincia de Buenos Aires)

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Scraper, ScrapedPromo } from './types';

const LIST_URL   = 'https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios';
const DETAIL_URL = 'https://www.bancoprovincia.com.ar/cuentadni/Home/GetBeneficioData2';
const WALLET_NAME = 'Cuenta DNI';
const BANK_NAME   = 'Banco Provincia';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
  'Referer': 'https://www.bancoprovincia.com.ar/cuentadni/',
};

// Bitmask: bit 0=dom, 1=lun, 2=mar, 3=mie, 4=jue, 5=vie, 6=sab
function parseTituloFecha(texto: string): number {
  const t = (texto ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/TODOS LOS DIAS|LUNES A DOMINGO/.test(t)) return 127;
  if (/LUNES A VIERNES/.test(t)) return 0b0111110;
  if (/LUNES A JUEVES/.test(t))  return 0b0011110;
  if (/SABADOS Y DOMINGOS|FIN DE SEMANA/.test(t)) return 0b1000001;
  if (/LUNES Y MARTES/.test(t))  return 0b0000110;
  if (/MIERCOLES Y JUEVES/.test(t)) return 0b0011000;
  if (/JUEVES Y VIERNES/.test(t)) return 0b0110000;
  if (/VIERNES Y SABADOS/.test(t)) return 0b1100000;

  let mask = 0;
  if (t.includes('DOMINGO'))   mask |= 1 << 0;
  if (t.includes('LUNES'))     mask |= 1 << 1;
  if (t.includes('MARTES'))    mask |= 1 << 2;
  if (t.includes('MIERCOLES')) mask |= 1 << 3;
  if (t.includes('JUEVES'))    mask |= 1 << 4;
  if (t.includes('VIERNES'))   mask |= 1 << 5;
  if (t.includes('SABADO'))    mask |= 1 << 6;
  return mask || 127;
}

function parsePaymentChannel(legal: string): string {
  const l = (legal ?? '').toUpperCase();
  if (l.includes('NFC') || l.includes('SIN CONTACTO')) return 'NFC';
  if (l.includes('QR') || l.includes('ESCANEANDO')) return 'QR';
  return 'ANY';
}

function inferCategoria(rubro: string, titulo: string): string {
  const t = (rubro + ' ' + titulo).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/SUPERMERCADO|COTO|JUMBO|DISCO|VEA|CARREFOUR|DIARCO|CHANGOMAS|\bDIA\b|ALMACEN|MAYORISTA/.test(t)) return 'Supermercados';
  if (/FARMACIA|PERFUMERIA|DROGUERIA|OPTICA|SALUD/.test(t)) return 'Farmacias';
  if (/GASTRONOM|RESTAURAN|CAFE|BUFFET|COMIDA|HELADERIA|PANADERIA|DESAYUNO/.test(t)) return 'Gastronomía';
  if (/LIBRERIA|LIBRO/.test(t)) return 'Librerías';
  if (/TRANSPORTE|COLECTIVO|SUBTE|SUBE/.test(t)) return 'Transporte';
  if (/MASCOTA|PET|VETERINARIA/.test(t)) return 'Petshops';
  if (/COMBUSTIBLE|YPF|SHELL|AXION|NAFTA/.test(t)) return 'Combustible';
  if (/INDUMENTARIA|ROPA|MODA|CALZADO/.test(t)) return 'Indumentaria';
  if (/TECNOLOGIA|ELECTRONICA|COMPUTACION|CELULAR/.test(t)) return 'Tecnología';
  return 'Otros';
}

function msToDate(ms: number): string {
  const d = new Date(ms);
  return d.toISOString().split('T')[0];
}

export const CuentaDNIScraper: Scraper = {
  name: 'cuenta dni',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[CuentaDNI] Iniciando scraper V3...');

    // Paso 1: obtener IDs desde el HTML
    const { data: html } = await axios.get(LIST_URL, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(html);

    const idSet = new Set<number>();
    const rawIds: string[] = [];
    $('.callModalCDNI').each((_, el) => {
      const rawId = $(el).attr('id') ?? '';
      rawIds.push(rawId);
      const match = rawId.match(/-(\d+)$/);
      if (match) idSet.add(Number(match[1]));
    });

    const ids = Array.from(idSet);
    console.log(`[CuentaDNI] IDs en HTML: ${rawIds.join(' | ')}`);
    console.log(`[CuentaDNI] IDs únicos: ${ids.length} → ${ids.join(', ')}`);

    if (ids.length === 0) {
      console.log('[CuentaDNI] No se encontraron IDs en el HTML');
      return [];
    }

    // Paso 2: obtener detalle de cada beneficio
    const promos: ScrapedPromo[] = [];

    for (const id of ids) {
      try {
        const { data } = await axios.get(DETAIL_URL, {
          params: { idBeneficio: id },
          headers: HEADERS,
          timeout: 10000,
        });

        const ben = data?.Entity?.Beneficio;
        if (!ben) continue;

        const storeName = ben.titulo ?? '';
        if (!storeName) continue;

        const discount    = Number(ben.porcentaje ?? 0);
        const cuotas      = Number(ben.cuotas ?? 0);
        if (discount <= 0 && cuotas <= 0) continue;

        const rubros: any[] = data?.Entity?.Rubros ?? [];
        const rubroNombre   = rubros[0]?.nombre ?? '';
        const categoria     = inferCategoria(rubroNombre, storeName);

        const tituloFecha   = ben.titulo_fecha ?? '';
        const validDays     = parseTituloFecha(tituloFecha);
        console.log(`[CuentaDNI] ID ${id} titulo_fecha="${tituloFecha}" validDays=${validDays}`);

        const legal         = ben.legal ?? '';
        const paymentChannel = parsePaymentChannel(legal);

        // Fechas en ms (formato /Date(ms)/)
        const fechaDesde = ben.fecha_desde?.match(/\d+/)?.[0];
        const fechaHasta = ben.fecha_hasta?.match(/\d+/)?.[0];
        const validFrom  = fechaDesde ? msToDate(Number(fechaDesde)) : undefined;
        const validUntil = fechaHasta ? msToDate(Number(fechaHasta)) : undefined;

        const title = `Cuenta DNI — ${discount > 0 ? `${discount}%` : `${cuotas} CSI`} en ${storeName}`;
        const sourceUrl = `https://www.bancoprovincia.com.ar/cuentadni/beneficios/${ben.url ?? id}`;

        promos.push({
          title,
          description: ben.bajada ?? title,
          sourceText: legal.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000),
          sourceUrl,
          discount:     discount > 0 ? String(discount) : String(cuotas),
          discountType: discount > 0 ? 'PERCENTAGE_REINTEGRO' as any : 'CUOTAS_SIN_INTERES' as any,
          storeName,
          categoria,
          validDays,
          validFrom,
          validUntil,
          bankNames: [BANK_NAME],
          walletNames: [WALLET_NAME],
          paymentChannel: paymentChannel as any,
        });

        console.log(`[CuentaDNI] ID ${id}: ${storeName} — ${discount}% — ${tituloFecha} (mask:${validDays})`);

        // Pequeña pausa para no saturar
        await new Promise(r => setTimeout(r, 300));

      } catch (err) {
        console.error(`[CuentaDNI] Error en ID ${id}:`, err);
      }
    }

    console.log(`[CuentaDNI] Total: ${promos.length} promos`);
    return promos;
  },
};
