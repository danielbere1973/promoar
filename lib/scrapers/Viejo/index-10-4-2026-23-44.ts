import { Scraper } from './types';
import { CotoScraper } from './coto';
import { ModoScraper } from './modo';

export const ALL_SCRAPERS: Scraper[] = [
  CotoScraper,
  ModoScraper,
];

export * from './types';
