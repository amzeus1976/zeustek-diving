import { describe, expect, it } from 'vitest';
import { canonicalBytes, sha256Hex } from '@/lib/offline/canonical';
import { decryptObject, encryptObject, importVmk } from '@/lib/offline/crypto';
import { uuidv7 } from '@/lib/offline/uuidv7';

describe('Zeustek cryptographic object foundation', () => {
  it('creates sortable version 7 UUIDs', () => {
    const first = uuidv7(1_700_000_000_000);
    const second = uuidv7(1_700_000_000_001);
    expect(first[14]).toBe('7');
    expect(first < second).toBe(true);
  });

  it('canonicalizes object keys before hashing', async () => {
    const left = await sha256Hex(canonicalBytes({ b: 2, a: 1 }));
    const right = await sha256Hex(canonicalBytes({ a: 1, b: 2 }));
    expect(left).toBe(right);
  });

  it('round-trips a ZTO1 object and rejects tampering', async () => {
    const vmk = await importVmk(crypto.getRandomValues(new Uint8Array(32)));
    const vaultId = uuidv7();
    const objectId = uuidv7();
    const encrypted = await encryptObject({ vmk, vaultId, objectId, payload: { kind: 'event', record: { title: 'Private note' } } });
    expect(new TextDecoder().decode(encrypted.bytes.slice(0, 4))).toBe('ZTO1');
    await expect(decryptObject({ vmk, envelope: encrypted.bytes, expectedVaultId: vaultId, expectedObjectId: objectId })).resolves.toEqual({ kind: 'event', record: { title: 'Private note' } });
    const tampered = encrypted.bytes.slice();
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1;
    await expect(decryptObject({ vmk, envelope: tampered, expectedVaultId: vaultId, expectedObjectId: objectId })).rejects.toThrow('ZT-CRYPTO-002');
  });
});
