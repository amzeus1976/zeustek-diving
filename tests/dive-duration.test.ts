import { describe, expect, it } from 'vitest';
import { formatDiveDuration } from '../lib/dive-duration';

describe('dive duration formatting', () => {
  it('shows accumulated hours and remaining minutes', () => {
    expect(formatDiveDuration(2615)).toBe('43h 35m');
  });

  it('shows zero remaining minutes for exact hours', () => {
    expect(formatDiveDuration(60)).toBe('1h 0m');
  });

  it('keeps shorter totals in minutes', () => {
    expect(formatDiveDuration(23)).toBe('23m');
  });
});
