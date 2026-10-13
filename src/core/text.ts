/** Lowercase and strip Polish diacritics so "Masło" matches "maslo" and vice versa. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9а-яё%+]+/g, ' ')
    .trim();
}

export function words(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(' ') : [];
}

/**
 * True when every word of `keyword` is a prefix of some word in `text`, so "kawa" matches
 * "Kawa mielona". Keywords of 5+ letters also match with the last letter dropped, so
 * "masło" matches "masła". Prefix matching handles Polish inflection at the cost of
 * occasional false hits ("kawa" also matches "kawałek").
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  const kw = words(keyword);
  if (kw.length === 0) return false;
  const tw = words(text);
  return kw.every((k) => tw.some((w) => w.startsWith(k) || (k.length >= 5 && w.startsWith(k.slice(0, -1)))));
}

export function slugify(text: string): string {
  return normalize(text).replace(/[%+]/g, '').replace(/\s+/g, '-').slice(0, 80);
}

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  oacute: 'ó',
  Oacute: 'Ó',
  eacute: 'é',
  aacute: 'á',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  bdquo: '„',
  rdquo: '”',
  ldquo: '“',
  laquo: '«',
  raquo: '»',
  reg: '®',
  trade: '™',
  deg: '°',
};

export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => NAMED_ENTITIES[name] ?? m)
    .replace(/&amp;/g, '&');
}

export function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}
