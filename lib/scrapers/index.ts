import { Scraper } from './types';

// ─── Supermercados y comercios ─────────────────────────────────────────────────
import { CotoScraper } from './coto';
import { DiarcoScraper } from './diarco';
import { JumboScraper } from './jumbo';
import { DiscoScraper } from './disco';
import { VeaScraper } from './vea';
import { ChangoMasScraper } from './changomas';
import { CarrefourScraper } from './carrefour';
import { DIAScraper } from './dia';

// ─── Billeteras digitales ──────────────────────────────────────────────────────
import { ModoScraper } from './modo';
import { MercadoPagoScraper } from './mercadopago';
import { CuentaDNIScraper } from './cuentadni'; // V3: cheerio + GetBeneficioData2 (sin Playwright)
import { OpenpayScraper } from './openpay'; // Posnet de BBVA
import { ClubLaNacionScraper } from './clublanacion';
import { Clarin365Scraper } from './clarin365';

// ─── Tarjetas de crédito ───────────────────────────────────────────────────────
import { VisaScraper } from './visa';
import { AmexScraper } from './amex';
import { NaranjaXScraper } from './naranjax';
import { CabalScraper } from './cabal';   // también incluye Banco Credicoop

// ─── Bancos ────────────────────────────────────────────────────────────────────
import { GaliciaScraper } from './galicia';
import { BrubankScraper } from './brubank';
import { BBVAScraper } from './bbva';
import { SantanderScraper } from './santander';
import { MacroScraper } from './macro';
import { ICBCScraper } from './icbc';
import { BancoCiudadScraper } from './bancociudad';
import { PatagoniaScraper } from './patagonia';
import { SupervielleScraper } from './supervielle';
import { BNAScraper } from './bna';
// ProvinciaScraper reemplazado por CuentaDNIScraper V3 (cheerio, sin Playwright)

export const SUPERMERCADO_SCRAPERS: Scraper[] = [
  CotoScraper,
  DiarcoScraper,
  JumboScraper,
  DiscoScraper,
  VeaScraper,
  ChangoMasScraper,
  CarrefourScraper,
  DIAScraper,
];

export const WALLET_SCRAPERS: Scraper[] = [
  ModoScraper,
  MercadoPagoScraper,
  CuentaDNIScraper,
  OpenpayScraper,
  ClubLaNacionScraper,
  Clarin365Scraper,
];

export const TARJETA_SCRAPERS: Scraper[] = [
  VisaScraper,
  AmexScraper,
  NaranjaXScraper,
  CabalScraper,
];

export const BANCO_SCRAPERS: Scraper[] = [
  BrubankScraper,
  GaliciaScraper,
  BBVAScraper,
  SantanderScraper,
  MacroScraper,
  BNAScraper,
  BancoCiudadScraper,
  SupervielleScraper,
  PatagoniaScraper,
  ICBCScraper,
  CabalScraper,   // Banco Credicoop
];

export const ALL_SCRAPERS: Scraper[] = [
  ...SUPERMERCADO_SCRAPERS,  // incluye DIAScraper
  ...WALLET_SCRAPERS,
  ...TARJETA_SCRAPERS,
  // Bancos — excluimos CabalScraper para no duplicarlo (ya está en TARJETA_SCRAPERS)
  BrubankScraper,
  GaliciaScraper,
  BBVAScraper,
  SantanderScraper,
  MacroScraper,
  BNAScraper,
  BancoCiudadScraper,
  SupervielleScraper,
  PatagoniaScraper,
  ICBCScraper,
];

export * from './types';
