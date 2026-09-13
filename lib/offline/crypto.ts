import { gunzipSync, gzipSync } from 'fflate';
import { canonicalBytes, sha256Hex } from './canonical';
import type { JsonValue } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAGIC = encoder.encode('ZTO1');
const buffer = (value: Uint8Array) => value.slice().buffer as ArrayBuffer;

function uuidBytes(uuid: string): Uint8Array {
  const value = uuid.replaceAll('-', '');
  if (!/^[0-9a-f]{32}$/i.test(value)) throw new TypeError('Expected UUID');
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

function bytesUuid(bytes: Uint8Array): string {
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

async function objectKey(vmk: CryptoKey, vaultId: string, objectId: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', await crypto.subtle.exportKey('raw', vmk), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(vaultId), info: encoder.encode(`zeustek-object-v1:${objectId}`) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  );
}

export async function importVmk(bytes: Uint8Array): Promise<CryptoKey> {
  if (bytes.byteLength !== 32) throw new TypeError('VMK must be 32 bytes');
  return crypto.subtle.importKey('raw', buffer(bytes), 'AES-GCM', true, ['encrypt', 'decrypt']);
}

export async function encryptObject(input: { vmk: CryptoKey; vaultId: string; objectId: string; payload: JsonValue }) {
  const header = new Uint8Array(50);
  header.set(MAGIC, 0);
  header[4] = 1;
  header[5] = 0;
  header.set(uuidBytes(input.vaultId), 6);
  header.set(uuidBytes(input.objectId), 22);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  header.set(iv, 38);
  const key = await objectKey(input.vmk, input.vaultId, input.objectId, ['encrypt']);
  const compressed = gzipSync(canonicalBytes(input.payload), { level: 6 });
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buffer(iv), additionalData: buffer(header) }, key, buffer(compressed)));
  const envelope = new Uint8Array(header.byteLength + cipher.byteLength);
  envelope.set(header);
  envelope.set(cipher, header.byteLength);
  return { bytes: envelope, sha256: await sha256Hex(envelope) };
}

export async function decryptObject(input: { vmk: CryptoKey; envelope: Uint8Array; expectedVaultId: string; expectedObjectId: string }): Promise<JsonValue> {
  if (input.envelope.byteLength < 66) throw new Error('ZT-CRYPTO-004 UNSUPPORTED_ENVELOPE_VERSION');
  const header = input.envelope.slice(0, 50);
  if (!MAGIC.every((byte, index) => header[index] === byte) || header[4] !== 1) throw new Error('ZT-CRYPTO-004 UNSUPPORTED_ENVELOPE_VERSION');
  const vaultId = bytesUuid(header.slice(6, 22));
  const objectId = bytesUuid(header.slice(22, 38));
  if (vaultId !== input.expectedVaultId) throw new Error('ZT-CRYPTO-003 WRONG_VAULT');
  if (objectId !== input.expectedObjectId) throw new Error('ZT-CRYPTO-002 OBJECT_AUTHENTICATION_FAILED');
  const key = await objectKey(input.vmk, vaultId, objectId, ['decrypt']);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buffer(header.slice(38, 50)), additionalData: buffer(header) }, key, buffer(input.envelope.slice(50)));
    return JSON.parse(decoder.decode(gunzipSync(new Uint8Array(plain)))) as JsonValue;
  } catch {
    throw new Error('ZT-CRYPTO-002 OBJECT_AUTHENTICATION_FAILED');
  }
}
