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

/** Longest inflection ending accepted after a keyword: "kurczak" → "kurczakiem", not "kawa" → "kawałkami". */
const MAX_ENDING = 3;
/** "Ekspres do kawy", "Karma dla kota": the product is *for* the keyword, not the keyword itself. */
const PURPOSE_WORDS = new Set(['do', 'dla']);

function inflectionOf(word: string, keyword: string): boolean {
  if (word.startsWith(keyword)) return word.length - keyword.length <= MAX_ENDING;
  // "masło" → "masła": Polish often changes the last vowel.
  const stem = keyword.slice(0, -1);
  return keyword.length >= 5 && word.startsWith(stem) && word.length - stem.length <= MAX_ENDING;
}

/**
 * True when every word of `keyword` appears in `text` as itself or an inflected form, ignoring
 * case and diacritics: "kawa" matches "Kawa mielona" and "kawy", "masło" matches "masła".
 * Words right after "do"/"dla" don't count ("Przyprawa do kurczaka" is not chicken).
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  const kw = words(keyword);
  if (kw.length === 0) return false;
  const tw = words(text);
  return kw.every((k) => tw.some((w, i) => inflectionOf(w, k) && !(i > 0 && PURPOSE_WORDS.has(tw[i - 1]))));
}

/** Search-as-you-type: every typed word is a prefix of some word ("kurcz" finds "kurczakiem"). */
export function matchesSearch(text: string, query: string): boolean {
  const qw = words(query);
  const tw = words(text);
  return qw.length > 0 && qw.every((q) => tw.some((w) => w.startsWith(q)));
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
