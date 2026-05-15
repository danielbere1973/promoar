// lib/scrapers/types.ts

export interface CardNetworkWithType {
  network: string;
  type: 'CREDIT' | 'DEBIT' | null;
  cardNetworkName?: string; // nombre exacto en la DB, ej: "Visa Crédito", "American Express Banco"
  segmentName?: string;     // nombre del segmento en la DB, ej: "Gold", "Mastercard Black Macro Selecta"
}

export interface ScrapedPromo {
  title: string;
  description: string;
  sourceText?: string;
  sourceUrl?: string;
  discount: string;
  discountType: string;
  cap?: number | null;
  capPeriod?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;
  capTarget?: 'USER' | 'CARD' | 'ACCOUNT' | 'TRANSACCION' | null;
  minPurchase?: number | null;
  stackable?: boolean | null;
  singleUse?: boolean | null;
  validFrom?: Date | string;
  validUntil?: Date | string | null;
  specificDates?: any;
  validDays?: number;
  bankNames?: Array<string | { name: string; bcraCode?: string }>;
  walletNames?: string[];
  cardNetworks?: CardNetworkWithType[];  // ← ACTUALIZADO
  cardType?: 'CREDIT' | 'DEBIT' | 'PREPAID' | null;
  cardTier?: 'CLASSIC' | 'GOLD' | 'PLATINUM' | 'SIGNATURE' | 'BLACK' | 'INFINITE' | 'EMINENT' | 'SELECTA' | null;
  paymentChannel?: 'QR' | 'NFC' | 'TARJETA_FISICA' | 'TRANSFERENCIA' | 'DINERO_EN_CUENTA' | 'ANY';
  accountType?: 'ANY' | 'HABERES' | 'JUBILADO' | 'ANSES' | 'SAVINGS' | 'CHECKING';
  provinces?: string[];
  storeName?: string;
  storeLogoUrl?: string;
  categoria?: string;
  segment?: string;
  note?: string;
}

export interface Scraper {
  name: string;
  run(categoria?: string): Promise<ScrapedPromo[]>;
}
