import { Scraper } from './types';
import { CotoScraper } from './coto';
import { ModoScraper } from './modo';
import { DiarcoScraper } from './diarco';
import { JumboScraper } from './jumbo';
import { DiscoScraper } from './disco';
import { VeaScraper } from './vea';
import { ChangoMasScraper } from './changomas';

export const ALL_SCRAPERS: Scraper[] = [
  CotoScraper,
  ModoScraper,
  DiarcoScraper,
  JumboScraper,
  DiscoScraper,
  VeaScraper,
  ChangoMasScraper,
];

export * from './types';
