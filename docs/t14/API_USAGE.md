# ZeusTek read-only API usage

This guide describes the implemented version 1 API. The owner enables access by issuing a separate, scoped key for each client. Approval of the feature does not automatically publish private records or issue a key.

Production origin: `https://dive.amzeus.co.uk`

Human-readable guide: [API usage guide](https://dive.amzeus.co.uk/api/v1/openapi). Browsers receive a readable page. Machine-readable contract: [OpenAPI 3.1 JSON](https://dive.amzeus.co.uk/api/v1/openapi?format=json); API clients requesting `application/json` also receive JSON from the original URL. Use the contract from the accepted deployment; this guide accompanies app1.0.72 and additive contract1.1.0, under the same version1 endpoints.

## Enable a client

1. Sign in as the owner and open **Site Configuration → Read-only API integrations**.
2. Choose **AMZeus** or **ZeusTek**. Use a separate key for each client.
3. Set an expiry in the future, within one year.
4. Enable the required scopes, then select the exact saved cloud records and fields. Each section has independent Minimise/Maximise controls, a selection count and a bounded list. **Select all matching** explicitly selects current matching saved records across pages, preserving prior choices up to1000. Cancel/error/overflow retains the prior selection. **Select all fields** is a separate choice. Nothing is selected automatically; newly saved records never join an existing key.
5. Review **Selected access**, confirm the displayed client/records/fields/expiry, then create the key.
6. Copy the newly displayed key once into that client's server-side secret manager. The server stores a verifier, not the recoverable secret. Do not put the key in this guide, browser JavaScript, a public repository, a URL, logs, screenshots or support exports.

New records are not automatically added to an existing key's consent. Create a replacement with the intended selection when permissions must change. At most 20 unrevoked, unexpired keys can exist for the owner. Viewing Settings or the API contract does not issue a key.

## Authentication and request rules

Use HTTPS and an `Authorization: Bearer` header:

```http
GET /api/v1/dives?limit=25 HTTP/1.1
Host: dive.amzeus.co.uk
Authorization: Bearer <YOUR_CLIENT_KEY>
Accept: application/json
```

Keys have the form `ZT1.<opaque-key-id>.<secret>`. The example is a placeholder, not a credential. Each request validates the key, expiry, revocation, scope, owner and current object access. Authentication by an integration key does not grant access to private application pages, backups, Person records or write operations. Existing ChatGPT sign-in continues to serve the private application.

Only `GET` and `HEAD` are supported. The only query parameters are `limit` and `cursor`; duplicate parameters and unsupported parameters are rejected. Keys in query strings are unsupported. This API intentionally provides no permissive browser CORS: call it from the integrating application's server.

## Resources and selectable fields

| Endpoint / scope | Selected data | Field consent |
| --- | --- | --- |
| `/api/v1/dives` / `dives` | Selected owner Dives | `date`, `site`, `depth`, `duration`, `mode` |
| `/api/v1/awards` / `awards` | Selected owner Certification/award records | `title`, `agency`, `date`, `track` |
| `/api/v1/equipment` / `equipment` | Selected owner equipment | `name`, `category`, `maker`, `model` |
| `/api/v1/equipment-usage` / `equipment-usage` | Saved equipment evidence for selected owner Dives | No optional detail fields; references are separately consented |
| `/api/v1/gas-plans` / `gas-plans` | Selected canonical saved Gas Plans | `name`, `status`, `depth`, `duration`, `rmv`, `supplies` |
| `/api/v1/dive-plans` / `dive-plans` | Selected saved Dive Plan/calendar records | `name`, `status`, `start`, `end`, `site`, `depth`, `duration` |
| `/api/v1/trips` / `trips` | Selected Trips & Expeditions | `name`, `status`, `start`, `end`, `destination`, `itinerary` |

The `depth` selection produces `depthM`; `duration` produces `durationMin`. Fields not consented, or without a supported saved value, are omitted. Every result has an opaque `id`. IDs are scoped to the issued key/resource and are not private canonical, account or import IDs. Do not compare IDs between independent keys or assume stability across rotation.

The API excludes certification numbers, cylinder serial numbers, private contacts, emergency/medical information, private notes, teams/guests, booking references/payments, private attachments, other people's records and unrestricted backup JSON. Planning/trip access requires its own exact scope/record/field consent; existing keys gain no additional access. Selected site/location/destination or itinerary titles are disclosed when enabled: review them before granting access. Plain text must be escaped by consumers when displayed as HTML.

### Saved planning inputs

Planning endpoints read saved inputs only; they never call a gas/depth engine or assess readiness. A saved `ready` status is the recorded lifecycle value, not a new safety assertion. Dates retain their original precision. Gas Plan `depth`/`duration` are saved planned depth/bottom time; Dive Plan duration follows saved planned runtime, duration, maximum duration, then legacy bottom time. `rmv` produces `rmvLitresMin`.

`supplies` contains at most100 saved cylinder-input summaries: `role`, `gas`, `oxygenFraction`, `heliumFraction`, `volumeLitres`, `startPressureBar`, `reservePressureBar` where explicitly saved. Volume is the saved override only; inventory-only references do not invent volume or gas composition. Canonical cylinder/fill/analysis IDs, serials, notes and full calculation snapshots are excluded. `omittedSupplyCount` reports additional saved entries.

Trip `itinerary` contains at most100 redacted entries with only saved `kind`, `title`, `start`, `end`, `location`; `omittedItineraryCount` reports additional entries. No segment IDs, booking references, costs, attachments, guests or private notes are returned. Missing saved values are omitted, never inferred.

### Units and provenance

- `depthM`: saved maximum depth, in metres.
- `durationMin`: saved total elapsed runtime, in minutes; saved bottom time is used only if elapsed runtime is absent.
- Dates retain their saved precision, including month-only values. Do not invent a day or timezone.
- Gas Plan RMV is litres/minute, supply pressure is bar, and saved volume override is litres. No shared-cylinder accessibility or per-cylinder reserve sufficiency is inferred by this API.
- Award `track` is `recreational-display`, `technical-display`, `professional-display` or `unclassified`. Master Scuba Diver can be a recreational display award. Display ranking grants no depth limit, permission, professional capability or physiological clearance.
- The API reads currently accessible canonical records within the key's explicit consent. A deleted or no-longer-accessible record is not returned. It is not a historical frozen public snapshot.

### Historical equipment usage

Equipment usage relies on saved direct `equipmentIds` or a saved loadout snapshot with its recorded overrides. Today's loadout cannot prove what was used on an old Dive.

An equipment-usage item contains:

- `id`: opaque usage object ID.
- `diveId`: present only when the corresponding Dive is separately selected under this same key's `dives` scope and remains owner-accessible.
- `status`: `confirmed` when accessible, separately selected equipment evidence exists; otherwise `hire` when the saved Dive explicitly says hire gear, or `unknown`.
- `provenance`: `saved-equipment-ids`, `saved-loadout-snapshot` or `no-saved-evidence`.
- `equipment`: references only to still-accessible equipment separately selected under the same key's `equipment` scope. Each reference includes its evidence provenance.
- `withheldEvidenceCount`: number of saved references unavailable under that explicit equipment consent. No identity or private details are disclosed.

To show a useful joined usage view, explicitly consent the relevant Dives in both `dives` and `equipment-usage`, and the corresponding equipment in `equipment`. An empty equipment list or `unknown` is not proof that no equipment was used. A `confirmed` result does not establish that every item has been disclosed or that equipment was safe/serviceable.

## Pagination and responses

`limit` defaults to 25 and accepts integers from 1 to 100. Follow `nextCursor` until it is `null`; the cursor is signed and bound to the key, owner and resource. Treat it as opaque, URL-encode it and do not reuse it with another key or endpoint. Ordering is by opaque object ID, not Dive date or award rank. Collections contain selected records only; an empty page is valid.

Example response, using fabricated data:

```json
{
  "version": "1",
  "resource": "dives",
  "units": {"depth": "metres", "duration": "minutes"},
  "provenance": "Current owner-consented canonical records; display awards grant no permissions",
  "items": [{
    "id": "11111111-1111-4111-8111-111111111111",
    "date": "2026-10-03",
    "site": "Example dive site",
    "depthM": 12.5,
    "durationMin": 35
  }],
  "nextCursor": null
}
```

`HEAD` uses the same permissions/rate limit but returns no body. It does not enumerate data.

### Server-side JavaScript example

Load `ZEUSTEK_API_KEY` from your server's secret manager. Do not use this example in a public browser bundle.

```js
const origin = 'https://dive.amzeus.co.uk';
const key = process.env.ZEUSTEK_API_KEY;
if (!key) throw new Error('Configure the client API key securely.');

async function readSelectedDives() {
  const items = [];
  let cursor = null;
  do {
    const url = new URL('/api/v1/dives', origin);
    url.searchParams.set('limit', '100');
    if (cursor !== null) url.searchParams.set('cursor', cursor);
    const response = await fetch(url, {
      headers: {Authorization: `Bearer ${key}`, Accept: 'application/json'},
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      // Report only status, never headers, key or raw response records.
      throw new Error(`ZeusTek read failed: HTTP ${response.status}`);
    }
    const page = await response.json();
    if (page.version !== '1' || page.resource !== 'dives' ||
        !Array.isArray(page.items) ||
        !(page.nextCursor === null || typeof page.nextCursor === 'string')) {
      throw new Error('Unexpected ZeusTek response.');
    }
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== null);
  return items;
}
```

Production consumers should additionally validate returned objects against OpenAPI, bound their total processing, escape displayed text, and implement controlled backoff for transient failures. Do not log the request's Authorization header or returned private records.

## Errors and limits

| Status | Meaning / action |
| --- | --- |
| `400` | Unsupported query, invalid limit/cursor or non-HTTPS request. Correct the request; do not guess cursor contents. |
| `401` | Key invalid, expired or revoked. Ask the owner to verify its metadata or provide an approved replacement. |
| `403` | Requested resource outside this key's selected scopes. Do not switch to another owner's key. |
| `405` | Write/unsupported method. Only GET/HEAD are allowed. |
| `429` | 60 authenticated, in-scope requests per key per minute exceeded. Respect `Retry-After` in seconds; GET and HEAD share the limit. A later evidence/503 failure still consumes its request slot. |
| `503` | Selected evidence temporarily unavailable. Back off; do not fall back to unrestricted backup exports. |

Errors use a redacted JSON `error` message. Responses use private/no-store cache boundaries. Integration clients must not persist responses in a public/CDN/PWA cache. Revocation prevents future requests; it cannot erase data a consumer already copied.

## Rotate, revoke and recover

- **Rotate key** preserves its existing client, scopes and record selections, uses the expiry currently shown in Settings, and invalidates the previous key atomically. Save the replacement once in the client's server secret manager. Opaque object IDs change with the new key.
- **Revoke key** stops future requests immediately. Revoke an unused key before creating another if the active-key limit is reached.
- If a key is lost, it cannot be read back. Rotate or issue an explicitly selected replacement; never weaken authentication to recover it.
- Connection secrets and API key material are excluded from ordinary application backups, downloads, diagnostics and support exports. Restoring ordinary records does not restore integration credentials; review and reauthorise connections/keys separately.
- Keep AMZeus and ZeusTek keys separate. Do not forward one client's key to another service or automatically expand consent when new records are created.

## Owner acceptance checklist

Verify the client label, selected records/fields and expiry before issuance. With a dummy key, verify permitted reads, out-of-scope denial, pagination, expiry/revocation, historical equipment provenance and safe error handling. Production issuance and actual client configuration are distinct from deploying the API capability; report their actual state separately. This API has no Gmail sync, public-profile publish or record-write operation.

## Public-profile address

The human visitor page is [https://dive.amzeus.co.uk/public-profile](https://dive.amzeus.co.uk/public-profile). Anonymous visitors also see the approved landing snapshot at the site root. When publication is disabled, visitors receive the generic welcome. The signed-in owner's Site Configuration → Public profile card displays this exact current-site URL and links to it. Publication remains a separate explicit visitor-preview/publish/update/revoke action; an API key never publishes the profile.
