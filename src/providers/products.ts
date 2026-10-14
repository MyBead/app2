import { PRODUCT_DATABASES, parseProductJson, productApiUrl, type ScannedProduct } from '../core/barcode';

const TIMEOUT_MS = 10_000;
// Open Food Facts asks API clients to identify themselves.
const HEADERS = { 'User-Agent': 'Okazje/1.0 (personal Android app)', Accept: 'application/json' };

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
    // 404 is the API's "unknown product" answer, with a JSON body.
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The product behind a barcode from Open Food / Beauty / Products Facts, in that order.
 * Null when none of them knows it; throws only when no database could be reached.
 */
export async function lookupProduct(code: string): Promise<ScannedProduct | null> {
  let reached = false;
  let lastError: unknown;
  for (const base of PRODUCT_DATABASES) {
    try {
      const product = parseProductJson(code, (await fetchJson(productApiUrl(base, code))) as never);
      reached = true;
      if (product) return product;
    } catch (e) {
      lastError = e;
    }
  }
  if (!reached) throw lastError instanceof Error ? lastError : new Error(String(lastError));
  return null;
}
