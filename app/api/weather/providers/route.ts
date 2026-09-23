import { getChatGPTUser } from '../../../chatgpt-auth';
import { env } from 'cloudflare:workers';
import {
  providerStatuses,
  hydrateProviderChecks,
  checkProvider,
  type ConditionsEnvironment,
} from '@/lib/server/conditions/service';
import type { ConditionsProvider, ConditionsSelection } from '@/lib/weather/conditions-model';
export async function GET() {
  if (!(await getChatGPTUser()))
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  await hydrateProviderChecks(env as unknown as ConditionsEnvironment);
  return Response.json(
    {
      defaultProvider: 'open-meteo',
      providers: providerStatuses(env as unknown as ConditionsEnvironment),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(request: Request) {
  if (!(await getChatGPTUser()))
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid provider check.' }, { status: 400 });
  }
  const id =
    body && typeof body === 'object' && 'provider' in body
      ? String(body.provider)
      : '';
  const runtime = env as unknown as ConditionsEnvironment;
  if (
    !providerStatuses(runtime).some(
      (row) =>
        row.id === id && row.configured && id !== 'auto' && id !== 'open-meteo',
    )
  )
    return Response.json(
      { error: 'Configure this provider server-side before checking access.' },
      { status: 400 },
    );
  const now = new Date();
  const result = await checkProvider(id as ConditionsProvider, runtime, {
    latitude: id === 'met-norway' ? 60.1 : 50.8,
    longitude: id === 'met-norway' ? 5 : -1.1,
    siteId: '',
    siteName: 'Provider access check',
    siteType: 'coastal',
    marine: true,
    provider: id as ConditionsSelection,
    date: now.toISOString().slice(0, 10),
    time: now.toISOString().slice(11, 16),
    timeZone: 'UTC',
    mode: 'forecast',
  });
  return Response.json(
    { result, providers: providerStatuses(runtime) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
