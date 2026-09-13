import { describe, expect, it } from 'vitest';
import { mergeCatalogSite } from '../lib/catalog-merge';

describe('catalogue site merge', () => {
  it('preserves a diver-edited depth when the source is blank', () => {
    expect(mergeCatalogSite({ maxDepthM: 22 }, { maxDepthM: null }).maxDepthM).toBe(22);
  });

  it('fills fields that are still blank', () => {
    const result = mergeCatalogSite({ description: '', hazards: '' }, { description: 'Shallow reef', hazards: 'Boat traffic' });
    expect(result.description).toBe('Shallow reef');
    expect(result.hazards).toBe('Boat traffic');
  });

  it('keeps weather and other explicit boolean choices', () => {
    expect(mergeCatalogSite({ showWeather: true }, { showWeather: false }).showWeather).toBe(true);
  });
});
