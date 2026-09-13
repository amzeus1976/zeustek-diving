import canonicalize from 'canonicalize';
import type { JsonValue } from './types';

const encoder = new TextEncoder();

export function canonicalBytes(value: JsonValue): Uint8Array {
  const result = canonicalize(value);
  if (typeof result !== 'string') throw new TypeError('Value is not canonical JSON');
  return encoder.encode(result);
}

export async function sha256Hex(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function recordHash(value: JsonValue | null): Promise<string> {
  return sha256Hex(canonicalBytes(value));
}
