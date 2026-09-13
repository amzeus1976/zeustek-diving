export async function GET() {
  return Response.json({
    service: 'zeustek-relay',
    status: 'ok',
    protocolVersion: 1,
    zeroKnowledge: true,
    driveConnected: false,
    note: 'Google Drive authorization is required before object transport is enabled.',
  }, { headers: { 'cache-control': 'no-store' } });
}
