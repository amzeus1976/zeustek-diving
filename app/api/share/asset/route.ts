import { env } from 'cloudflare:workers';
import {
  sharingOwner,
  sharingHeaders,
  sharingJson,
  sha256,
  boundedBytes,
} from '@/lib/server/sharing-access';
import {
  activeShare,
  ownedShareAsset,
  ensureShareSchema,
} from '@/lib/server/share-links';
import { opaqueId } from '@/lib/sharing/public-profile';
import { shareText } from '@/lib/sharing/share-links';
import { sanitizePublicationRaster } from '@/lib/sharing/public-photo';
import { sanitizeSharePdf } from '@/lib/sharing/share-pdf';
const unavailable = () =>
  sharingJson({ error: 'This shared snapshot is unavailable.' }, 404);
export async function POST(request: Request) {
  const access = await sharingOwner(request);
  if (access.error) return access.error;
  let derivative: { bytes: Uint8Array; contentType: string }, label: string;
  try {
    const encoded = request.headers.get('x-share-asset-label') ?? '';
    if (encoded.length > 900) throw new Error('Label too large.');
    label = shareText(decodeURIComponent(encoded), 100).trim();
    if (!label) throw new Error('Label required.');
    const mime = request.headers.get('content-type'),
      bytes = await boundedBytes(request, 2 * 1024 * 1024);
    if (mime === 'application/pdf') derivative = await sanitizeSharePdf(bytes);
    else derivative = sanitizePublicationRaster(bytes, mime ?? '');
  } catch {
    return sharingJson(
      {
        error:
          'Choose a PNG/JPEG up to 2 MB and 2048px per side, or a supported static PDF up to 2 MB and 20 pages. Encrypted, interactive, signed, layered, rotated/cropped and compressed-object PDFs are unsupported. Export a plain static PDF. Originals remain private.',
      },
      400,
    );
  }
  try {
    await ensureShareSchema(env.DB);
    const hash = await sha256(derivative.bytes),
      owner = access.user.userId;
    const existing = await env.DB.prepare(
      'SELECT id,label,content_type AS contentType,byte_length AS bytes FROM dive_share_assets WHERE owner_user_id=? AND content_hash=? AND content_type=? ORDER BY created_at LIMIT 1',
    )
      .bind(owner, hash, derivative.contentType)
      .first();
    if (existing) return sharingJson(existing);
    const id = crypto.randomUUID(),
      key = `share-derivative/${crypto.randomUUID()}`;
    await env.FILES.put(key, derivative.bytes, {
      httpMetadata: { contentType: derivative.contentType },
    });
    try {
      const inserted = await env.DB.prepare(
        'INSERT INTO dive_share_assets (id,owner_user_id,object_key,content_type,label,byte_length,content_hash,created_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM dive_share_assets WHERE owner_user_id=?)<100 RETURNING id',
      )
        .bind(
          id,
          owner,
          key,
          derivative.contentType,
          label,
          derivative.bytes.length,
          hash,
          Date.now(),
          owner,
        )
        .first();
      if (!inserted) {
        await env.FILES.delete(key);
        return sharingJson(
          {
            error:
              'Prepared attachment limit reached. Existing snapshots remain available.',
          },
          409,
        );
      }
    } catch (error) {
      await env.FILES.delete(key);
      throw error;
    }
    return sharingJson({
      id,
      label,
      contentType: derivative.contentType,
      bytes: derivative.bytes.length,
    });
  } catch {
    return sharingJson(
      {
        error:
          'Attachment preparation could not be completed. Reopen the prepared attachment list before retrying. Nothing has been published.',
      },
      503,
    );
  }
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams,
      id = params.get('id');
    if (!opaqueId(id)) return unavailable();
    const preview = params.get('preview') === '1';
    let owner: string;
    const shared = preview ? null : await activeShare(env.DB, request);
    if (preview) {
      const access = await sharingOwner();
      if (access.error) return access.error;
      owner = access.user.userId;
    } else {
      if (!shared) return unavailable();
      if (
        !shared.snapshot.attachments.some((asset) => asset.id === id) &&
        shared.snapshot.profile?.photoId !== id
      )
        return unavailable();
      owner = shared.link.owner_user_id;
    }
    const selectedPhoto = shared?.snapshot.profile?.photoId === id;
    const row = await ownedShareAsset(env.DB, owner, id);
    if (!row) return unavailable();
    const contentType = row.content_type;
    if (!['image/png', 'image/jpeg', 'application/pdf'].includes(contentType))
      return unavailable();
    if (selectedPhoto && !['image/png', 'image/jpeg'].includes(contentType))
      return unavailable();
    const file = await env.FILES.get(row.object_key);
    if (!file) return unavailable();
    const bytes = await boundedBytes(new Response(file.body), 4 * 1024 * 1024);
    if (
      row &&
      (bytes.byteLength !== row.byte_length ||
        (await sha256(bytes)) !== row.content_hash)
    )
      return unavailable();
    if (shared) {
      const current = await activeShare(env.DB, request, false);
      if (
        !current ||
        current.link.id !== shared.link.id ||
        current.link.revision !== shared.link.revision
      )
        return unavailable();
    }
    return new Response(bytes, {
      headers: {
        ...sharingHeaders,
        'content-type': contentType,
        'content-disposition':
          contentType === 'application/pdf'
            ? 'attachment; filename="shared-document.pdf"'
            : 'inline',
        'content-security-policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return error instanceof Error && error.message === 'SHARE_RATE_LIMIT'
      ? Response.json(
          { error: 'Too many requests.' },
          { status: 429, headers: { ...sharingHeaders, 'retry-after': '60' } },
        )
      : unavailable();
  }
}
