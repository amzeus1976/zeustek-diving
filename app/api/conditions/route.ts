import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import {
  conditionsService,
  type ConditionsEnvironment,
} from '@/lib/server/conditions/service';
import { parseConditionsRequest } from '@/lib/server/conditions/request';
import { GET as legacyWeather } from '../site-weather/route';
export async function GET(request: Request) {
  if (!(await getChatGPTUser()))
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  const url = new URL(request.url);
  let input;
  try {
    input = parseConditionsRequest(url);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Invalid conditions request.',
      },
      { status: 400 },
    );
  }
  const legacyUrl = new URL(request.url);
  legacyUrl.searchParams.set('provider', 'open-meteo');
  if (input.mode === 'seasonal')
    legacyUrl.searchParams.set('planning', 'seasonal');
  const result = await conditionsService(
    input,
    env as unknown as ConditionsEnvironment,
    {
      enrichment: url.searchParams.get('enrichment') === 'true',
      legacy: async () => {
        const response = await legacyWeather(new Request(legacyUrl, request));
        return response.json();
      },
    },
  );
  return Response.json(result, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
