export interface ScrapedPromo {
  title: string;
  description: string;
  sourceText?: string;      // Párrafo legal completo
  discount?: string;        // Ej: "20"
  discountType?: string;    // Ej: "PERCENTAGE_REINTEGRO"
  cap?: number;             // Tope en $
  capPeriod?: string;       // "MONTHLY","WEEKLY","PER_TRANSACTION"
  capTarget?: string;       // "USER","CARD","ACCOUNT","TRANSACCION"
  minPurchase?: number;     // Compra mínima en $
  stackable?: boolean;      // Acumulable con otras promos
  validFrom?: string;       // ISO date
  validUntil?: string;      // ISO date
  specificDates?: string[]; // ["2026-04-25","2026-04-26"]
  validDays?: number;       // Bitmask 0=dom..6=sab
  bankNames?: string[];     // Puede ser múltiples bancos
  walletName?: string;
  cardNetworkName?: string;
  cardType?: string;        // "CREDIT","DEBIT","PREPAID"
  paymentChannel?: string;  // "QR","NFC","TARJETA_FISICA","ANY"
  accountType?: string;     // "ANY","HABERES","JUBILADO","ANSES"
  storeName?: string;
  categoria?: string;
  sourceUrl?: string;
}

export interface Scraper {
  name: string;
  run(): Promise<ScrapedPromo[]>;
}
