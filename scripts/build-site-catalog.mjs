import { mkdir, readFile, writeFile } from 'node:fs/promises';

const OUT = new URL('../public/site-catalog.json', import.meta.url);
const clean = (value = '') =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&deg;/gi, '°')
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/\s+/g, ' ')
    .trim();

const clip = (value, length = 1600) =>
  value && value.length > length
    ? `${value.slice(0, length - 1).trim()}…`
    : value;

function fieldMap(html) {
  const fields = new Map();
  for (const match of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const paragraph = match[1];
    const label = paragraph.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
    if (!label) continue;
    const key = clean(label[1])
      .replace(/\s*:\s*$/, '')
      .toLowerCase();
    const value = clean(paragraph.replace(label[0], ''));
    if (key && value) fields.set(key, value);
  }
  return fields;
}

function pick(fields, ...labels) {
  for (const label of labels) {
    const exact = fields.get(label.toLowerCase());
    if (exact) return exact;
    const partial = [...fields].find(([key]) =>
      key.startsWith(label.toLowerCase()),
    );
    if (partial) return partial[1];
  }
  return '';
}

function difficulty(text) {
  const value = text.toLowerCase();
  if (/technical|cave|overhead|trimix|very experienced|expert/.test(value))
    return 'technical';
  if (/experienced|advanced|deep|rescue/.test(value)) return 'advanced';
  if (/novice|beginner|open water|all levels|training/.test(value))
    return 'beginner';
  return 'intermediate';
}

async function parallel(items, concurrency, worker) {
  let cursor = 0;
  const results = [];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        try {
          const result = await worker(items[index], index);
          if (result) results.push(result);
        } catch (error) {
          console.warn(`Skipped ${items[index]}: ${error.message}`);
        }
      }
    }),
  );
  return results;
}

async function buildFinstrokes() {
  const sitemap = await fetch('https://www.finstrokes.com/sitemap').then((r) =>
    r.text(),
  );
  const paths = [
    ...new Set(
      [
        ...sitemap.matchAll(
          /href="(\/(?:inland-dive|shore-dive|boat-dive)\/[^"?#]+)"/gi,
        ),
      ].map((match) => match[1]),
    ),
  ];
  return parallel(paths, 7, async (path) => {
    const sourceUrl = `https://www.finstrokes.com${path}`;
    const html = await fetch(sourceUrl).then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.text();
    });
    const fields = fieldMap(html);
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const name = clean(
      titleMatch?.[1] || path.split('/').at(-1).replaceAll('-', ' '),
    );
    const coordinates = pick(fields, 'lat & long', 'lat and long', 'gps');
    const coordinateMatch = coordinates.match(
      /(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/,
    );
    const depthText = pick(fields, 'depth', 'maximum depth');
    const depths = [...depthText.matchAll(/(\d+(?:\.\d+)?)\s*m\b/gi)].map(
      (match) => Number(match[1]),
    );
    const experience = pick(fields, 'suggested experience', 'experience');
    const underwater = pick(fields, 'underwater directions', 'underwater');
    const comments = pick(fields, 'other comments', 'comments');
    const phone = pick(fields, 'nearest public phone', 'public phone');
    const pub = pick(fields, 'pub');
    const cafe = pick(fields, 'cafe');
    const postcode =
      coordinates.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i)?.[0] || '';
    return {
      catalogId: `finstrokes:${path}`,
      name,
      alternativeNames: pick(fields, 'alternative names'),
      location:
        pick(fields, 'location', 'distance from birmingham') || coordinates,
      postcode,
      latitude: coordinateMatch ? Number(coordinateMatch[1]) : null,
      longitude: coordinateMatch ? Number(coordinateMatch[2]) : null,
      siteType: path.includes('/inland-dive/')
        ? 'inland'
        : path.includes('/boat-dive/')
          ? 'boat'
          : 'shore',
      difficulty: difficulty(experience),
      access: clip(pick(fields, 'travel directions', 'directions')),
      parking: clip(pick(fields, 'parking directions', 'parking')),
      amenities: clip(
        [phone, pick(fields, 'toilets', 'facilities')]
          .filter(Boolean)
          .join(' · '),
      ),
      entryExit: clip(
        pick(fields, 'site entry/exit', 'site entry', 'entry/exit'),
      ),
      airFill: clip(
        pick(fields, 'air & nitrox', 'air and nitrox', 'air fills'),
      ),
      mobileSignal: clip(pick(fields, 'mobile network service', 'mobile')),
      accommodation: clip(pick(fields, 'accommodation')),
      nearbyFood: clip(
        [pub && `Pub: ${pub}`, cafe && `Cafe: ${cafe}`]
          .filter(Boolean)
          .join(' · '),
      ),
      website: sourceUrl,
      sourceName: 'Finstrokes',
      sourceUrl,
      showWeather: false,
      maxDepthM: depths.length ? Math.max(...depths) : null,
      hazards: clip(pick(fields, 'site hazards', 'hazards')),
      notes: clip(
        [
          pick(fields, 'type of dive'),
          experience && `Suggested experience: ${experience}`,
          underwater && `Underwater: ${underwater}`,
          comments,
        ]
          .filter(Boolean)
          .join('\n\n'),
        3600,
      ),
    };
  });
}

const DIVEMAP_QUERY = `query searchFeatures($q:String!,$exclude:String){searchFeatures(q:$q,exclude:$exclude){feature{id name type icon position{lat lng plusCode} county region country{name iso3166} summary{short}} similarity matchedWreckId}}`;
const DIVEMAP_DETAIL_QUERY = `query featureDetail($id:String!){feature(id:$id){id name alternateNames icon position{lat lng plusCode} depths{confidence maxComputed avgComputed minComputed gebco} district county region country{name iso3166} countryDistance{m nm} positionConfidence summary{description short} data{description{value} descriptionDive{value} descriptionBiodiversity{value} descriptionTides{value} descriptionHistory{value} hazards{value} facilities{value} charges{value} contact{value} website{value}}}}`;

const detailValue = (field) => String(field?.value ?? '').trim();

async function diveMapDetail(id) {
  const response = await fetch('https://divemap.uk/gql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: DIVEMAP_DETAIL_QUERY, variables: { id } }),
  });
  if (!response.ok) throw new Error(String(response.status));
  const result = await response.json();
  return result.data?.feature ?? null;
}

async function enrichDiveMapSite(site) {
  const id = String(site.catalogId ?? '').replace(/^divemap:/, '');
  if (!id) return site;
  try {
    const feature = await diveMapDetail(id);
    if (!feature) return site;
    const maxDepthM = Number(feature.depths?.maxComputed);
    const bathymetricDepthM = Math.abs(Number(feature.depths?.gebco));
    const description = detailValue(feature.data?.description);
    const diving = detailValue(feature.data?.descriptionDive);
    const biodiversity = detailValue(feature.data?.descriptionBiodiversity);
    const tides = detailValue(feature.data?.descriptionTides);
    const history = detailValue(feature.data?.descriptionHistory);
    const charges = detailValue(feature.data?.charges);
    const contact = detailValue(feature.data?.contact);
    const suppliedWebsite = detailValue(feature.data?.website);
    return {
      ...site,
      name: feature.name || site.name,
      alternativeNames: (feature.alternateNames ?? []).join(', ') || site.alternativeNames,
      location: [feature.district, feature.county, feature.region, feature.country?.name].filter(Boolean).join(', ') || site.location,
      latitude: feature.position?.lat == null ? site.latitude : Number(feature.position.lat),
      longitude: feature.position?.lng == null ? site.longitude : Number(feature.position.lng),
      plusCode: feature.position?.plusCode || '',
      positionConfidence: feature.positionConfidence == null ? null : Number(feature.positionConfidence),
      unconfirmed: feature.positionConfidence != null && Number(feature.positionConfidence) < 0.5,
      depthConfidence: feature.depths?.confidence == null ? null : Number(feature.depths.confidence),
      bathymetricDepthM: Number.isFinite(bathymetricDepthM) ? bathymetricDepthM : null,
      maxDepthM: Number.isFinite(maxDepthM) ? maxDepthM : site.maxDepthM,
      description,
      diving,
      biodiversity,
      tides,
      history,
      amenities: detailValue(feature.data?.facilities) || site.amenities,
      hazards: detailValue(feature.data?.hazards) || site.hazards,
      website: /^https?:\/\//i.test(suppliedWebsite) ? suppliedWebsite : site.website,
      notes: clip([
        feature.summary?.description,
        description,
        diving,
        biodiversity && `Biodiversity: ${biodiversity}`,
        tides && `Tides: ${tides}`,
        history && `History: ${history}`,
        charges && `Charges: ${charges}`,
        contact && `Contact: ${contact}`,
      ].filter(Boolean).join('\n\n') || site.notes, 6000),
    };
  } catch (error) {
    console.warn(`Kept search-only data for ${site.name}: ${error.message}`);
    return site;
  }
}

async function buildDiveMap() {
  const terms = [
    ...'abcdefghijklmnopqrstuvwxyz',
    'dive',
    'diving',
    'site',
    'shore',
    'beach',
    'bay',
    'cove',
    'head',
    'point',
    'rock',
    'rocks',
    'reef',
    'wall',
    'wreck',
    'ship',
    'boat',
    'pier',
    'harbour',
    'quarry',
    'lake',
    'loch',
    'reservoir',
    'river',
    'bridge',
    'pool',
    'cave',
    'island',
    'sound',
    'channel',
    'sands',
    'bank',
    'ledge',
    'pinnacle',
    'drop',
    'slipway',
    'jetty',
    'training',
    'scuba',
    'cornwall',
    'devon',
    'dorset',
    'kent',
    'sussex',
    'essex',
    'norfolk',
    'suffolk',
    'yorkshire',
    'cumbria',
    'northumberland',
    'lancashire',
    'cheshire',
    'derbyshire',
    'wales',
    'anglesey',
    'pembroke',
    'swansea',
    'scotland',
    'highland',
    'argyll',
    'fife',
    'orkney',
    'shetland',
    'ireland',
    'man',
    'jersey',
    'guernsey',
    'plymouth',
    'portland',
    'weymouth',
    'poole',
    'brighton',
    'dover',
    'newcastle',
    'liverpool',
    'bristol',
    'cardiff',
    'oban',
    'ullapool',
    'scapa',
  ];
  const found = new Map();
  await parallel([...new Set(terms)], 6, async (term) => {
    const response = await fetch('https://divemap.uk/gql', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        query: DIVEMAP_QUERY,
        variables: { q: term, exclude: null },
      }),
    });
    if (!response.ok) throw new Error(String(response.status));
    const result = await response.json();
    for (const row of result.data?.searchFeatures ?? []) {
      const feature = row.feature;
      if (!feature?.id || feature.type !== 'UNDERWATER') continue;
      if (!/^(GB|IE|IM|JE|GG)/.test(feature.country?.iso3166 ?? '')) continue;
      found.set(feature.id, feature);
    }
  });
  const sites = [...found.values()].map((feature) => {
    const sourceUrl = `https://divemap.uk/?feature=${encodeURIComponent(feature.id)}`;
    const icon = String(feature.icon ?? '');
    const siteType = /INLAND|QUARRY|LAKE/.test(icon)
      ? 'inland'
      : /WRECK/.test(icon)
        ? 'boat'
        : 'shore';
    return {
      catalogId: `divemap:${feature.id}`,
      name: feature.name,
      alternativeNames: '',
      location: [feature.county, feature.region, feature.country?.name]
        .filter(Boolean)
        .join(', '),
      postcode: '',
      latitude:
        feature.position?.lat == null ? null : Number(feature.position.lat),
      longitude:
        feature.position?.lng == null ? null : Number(feature.position.lng),
      siteType,
      difficulty: /CAVE/.test(icon)
        ? 'technical'
        : /WRECK/.test(icon)
          ? 'advanced'
          : 'intermediate',
      access: '',
      parking: '',
      amenities: '',
      entryExit: '',
      airFill: '',
      mobileSignal: '',
      accommodation: '',
      nearbyFood: '',
      website: sourceUrl,
      sourceName: 'DiveMap',
      sourceUrl,
      showWeather: false,
      maxDepthM: null,
      hazards: '',
      notes: clip(
        feature.summary?.short ||
          `DiveMap classification: ${icon.replaceAll('_', ' ').toLowerCase()}.`,
      ),
    };
  });
  return parallel(sites, 10, enrichDiveMapSite);
}

let catalog;
if (process.argv.includes('--enrich-existing')) {
  catalog = JSON.parse(await readFile(OUT, 'utf8'));
  const diveMapSites = catalog.sites.filter((site) => site.sourceName === 'DiveMap');
  const enriched = await parallel(diveMapSites, 10, enrichDiveMapSite);
  const byId = new Map(enriched.map((site) => [site.catalogId, site]));
  catalog = {
    ...catalog,
    generatedAt: new Date().toISOString(),
    sites: catalog.sites.map((site) => byId.get(site.catalogId) ?? site),
  };
} else {
  const [finstrokes, divemap] = await Promise.all([buildFinstrokes(), buildDiveMap()]);
  catalog = {
    generatedAt: new Date().toISOString(),
    sources: [
      { name: 'Finstrokes', url: 'https://www.finstrokes.com/sitemap', count: finstrokes.length },
      { name: 'DiveMap', url: 'https://divemap.uk/', count: divemap.length },
    ],
    sites: [...finstrokes, ...divemap],
  };
}
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(OUT, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${catalog.sites.length} enriched catalogue sites.`);
