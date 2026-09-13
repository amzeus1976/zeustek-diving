// Be conservative: an unverified bargain is less useful than no match.
export function matchesProduct(query: string, title: string): boolean {
  const tokens = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  const ignored = new Set(['with', 'and', 'the', 'for', 'a', 'an']);
  const wanted = tokens(query).filter(token => !ignored.has(token));
  const actual = new Set(tokens(title));
  const accessories=['strap','straps','band','bands','protector','protectors','case','replacement','battery','batteries','charger','cable','mount','cover','covers'];
  if(accessories.some(token=>actual.has(token)&&!wanted.includes(token)))return false;
  return wanted.length >= 2 && wanted.every(token => actual.has(token));
}

export function matchedOffers(value: unknown, query: string): Array<{price: string | number; priceCurrency: string; productTitle: string; url?: string}> {
  const found: ReturnType<typeof matchedOffers> = [];
  function visit(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const object = node as Record<string, any>;
    const types = Array.isArray(object['@type']) ? object['@type'] : [object['@type']];
    if (types.includes('Product') && typeof object.name === 'string' && matchesProduct(query, object.name)) {
      const offers = Array.isArray(object.offers) ? object.offers : [object.offers];
      for (const offer of offers) {
        // Aggregate/lowest prices can describe a cheaper, different variant.
        if (offer?.['@type'] === 'Offer' && offer.price != null && offer.priceCurrency && (!offer.name || matchesProduct(query, offer.name))) {
          found.push({price: offer.price, priceCurrency: offer.priceCurrency, productTitle: object.name, ...(typeof offer.url === 'string' ? {url:offer.url} : {})});
        }
      }
    }
    Object.values(object).forEach(visit);
  }
  visit(value);
  return found;
}
