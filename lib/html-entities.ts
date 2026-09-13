const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', apos: "'", gt: '>', hellip: '…', laquo: '«', ldquo: '“', lsquo: '‘',
  lt: '<', mdash: '—', nbsp: ' ', ndash: '–', quot: '"', raquo: '»', rdquo: '”', rsquo: '’',
};

export function decodeHtmlEntities(value: string) {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded
      .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
      .replace(/&#(x[0-9a-f]+|\d+);?/gi, (match, code: string) => {
        const value = code[0]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(1), 16) : Number.parseInt(code, 10);
        return Number.isSafeInteger(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match;
      });
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}
