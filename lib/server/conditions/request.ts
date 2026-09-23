import type {
  ConditionsProvider,
  ConditionsRequest,
  ConditionsSelection,
} from '../../weather/conditions-model';
const providers = new Set([
  'auto',
  'open-meteo',
  'met-office',
  'xweather',
  'tomorrow',
  'wwo',
  'met-norway',
  'copernicus',
  'swellcloud',
]);
export function parseConditionsRequest(url: URL): ConditionsRequest {
  const p = url.searchParams;
  const latitude = Number(p.get('latitude')),
    longitude = Number(p.get('longitude'));
  if (
    !p.has('latitude') ||
    !p.has('longitude') ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  )
    throw new Error('Valid Site coordinates are required.');
  const date = p.get('date') ?? new Date().toISOString().slice(0, 10);
  const time = p.get('time') ?? '12:00';
  const provider = p.get('provider') ?? 'open-meteo';
  const mode = p.get('mode') ?? 'forecast';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ||
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    !providers.has(provider) ||
    !['forecast', 'historical', 'seasonal'].includes(mode)
  )
    throw new Error('A valid date, time and provider are required.');
  const depth = p.has('depth') ? Number(p.get('depth')) : undefined;
  if (
    depth !== undefined &&
    (!Number.isFinite(depth) || depth < 0 || depth > 1000)
  )
    throw new Error('Planned depth is invalid.');
  return {
    latitude,
    longitude,
    date,
    time,
    provider: provider as ConditionsSelection,
    mode: mode as ConditionsRequest['mode'],
    siteId: (p.get('siteId') ?? '').slice(0, 120),
    siteName: (p.get('siteName') ?? '').slice(0, 160),
    siteType:
      p.get('siteType') === 'inland'
        ? 'inland'
        : p.get('siteType') === 'coastal'
          ? 'coastal'
          : 'unknown',
    marine: p.get('marine') === 'true',
    ...(p.get('operatorId')
      ? { operatorId: p.get('operatorId')!.slice(0, 40) }
      : {}),
    ...(depth !== undefined ? { plannedDepthM: depth } : {}),
    disabledProviders: (p.get('disabled') ?? '')
      .split(',')
      .filter((id) => providers.has(id) || id === 'operator')
      .slice(0, 12) as ConditionsProvider[],
  };
}
