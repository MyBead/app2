import type { StoreId } from './types';

export interface StoreInfo {
  id: StoreId;
  name: string;
  color: string;
  textColor: string;
  website: string;
  loyaltyApp: string;
  /** Pages scraped for offers, tried in order. Can be overridden in settings. */
  sourceUrls: string[];
}

export const STORES: Record<StoreId, StoreInfo> = {
  lidl: {
    id: 'lidl',
    name: 'Lidl',
    color: '#0050AA',
    textColor: '#FFF000',
    website: 'https://www.lidl.pl',
    loyaltyApp: 'Lidl Plus',
    sourceUrls: ['https://www.lidl.pl/c/promocje/s10008614', 'https://www.lidl.pl/'],
  },
  biedronka: {
    id: 'biedronka',
    name: 'Biedronka',
    color: '#E30613',
    textColor: '#FFFFFF',
    website: 'https://www.biedronka.pl',
    loyaltyApp: 'Moja Biedronka',
    sourceUrls: ['https://www.biedronka.pl/pl/promocje', 'https://www.biedronka.pl/pl'],
  },
  zabka: {
    id: 'zabka',
    name: 'Żabka',
    color: '#00843D',
    textColor: '#FFFFFF',
    website: 'https://www.zabka.pl',
    loyaltyApp: 'Żappka',
    sourceUrls: ['https://www.zabka.pl/promocje'],
  },
  kaufland: {
    id: 'kaufland',
    name: 'Kaufland',
    color: '#E10915',
    textColor: '#FFFFFF',
    website: 'https://www.kaufland.pl',
    loyaltyApp: 'Kaufland Card',
    sourceUrls: ['https://www.kaufland.pl/oferta/przeglad.html', 'https://www.kaufland.pl/oferta.html'],
  },
};

export const STORE_IDS = Object.keys(STORES) as StoreId[];
