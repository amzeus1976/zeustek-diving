const supported = new Set(['USD','EUR','CAD','AUD','NZD','JPY','CHF','SEK','NOK','DKK','ZAR']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = (url.searchParams.get('from') ?? '').toUpperCase();
  const amount = Number(url.searchParams.get('amount'));
  if (!supported.has(from) || !Number.isFinite(amount) || amount < 0)
    return Response.json({ error: 'Invalid currency conversion' }, { status: 400 });
  const response = await fetch(`https://api.frankfurter.dev/v2/rate/${from}/GBP`, {
    headers: { accept: 'application/json' },
    cf: { cacheTtl: 21600, cacheEverything: true },
  } as RequestInit);
  if (!response.ok) return Response.json({ error: 'Exchange rate unavailable' }, { status: 502 });
  const result = await response.json() as { rate?: number; date?: string };
  if (!Number.isFinite(result.rate)) return Response.json({ error: 'Exchange rate unavailable' }, { status: 502 });
  return Response.json({ gbp: amount * Number(result.rate), rate: result.rate, date: result.date });
}
