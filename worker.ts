import application from 'vinext/server/fetch-handler';
import { sharingHeaders } from './lib/sharing/response-headers';

// The framework normalises trailing slashes before route middleware runs.
// Apply shared-page privacy headers at the response boundary, including redirects.
const worker = {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const response = await application.fetch(request, env, ctx);
    if (!/^\/share(?:\/|$)/.test(new URL(request.url).pathname))
      return response;
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(sharingHeaders))
      headers.set(name, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
export default worker;
