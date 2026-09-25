import { describe, expect, it } from 'vitest';
import { initialElapsedRuntime } from '../lib/dive-elapsed-runtime';

describe('Dive elapsed runtime editing', () => {
  it('uses the recorded actual runtime even when a bottom-time suggestion differs', () => {
    expect(initialElapsedRuntime(44, 39)).toBe('44');
  });

  it('uses the suggested runtime only for a new or missing recording', () => {
    expect(initialElapsedRuntime(null, 39)).toBe('39');
    expect(initialElapsedRuntime(undefined, null)).toBe('');
  });
});
