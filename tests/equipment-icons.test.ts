import { describe, expect, it } from 'vitest';
import {
  agencyLogoSource,
  equipmentIconSource,
  DEFAULT_GEAR_CATEGORY_ICONS,
} from '../lib/offline/dive-planning';

describe('equipment category icons', () => {
  it('uses the supplied built-in artwork for known categories', () => {
    expect(equipmentIconSource('Computer', [])).toBe(
      '/equipment-icons/computer.png',
    );
    expect(DEFAULT_GEAR_CATEGORY_ICONS.SPG).toBe('/equipment-icons/spg.png');
  });

  it('uses a privately uploaded mapping and falls back for new categories', () => {
    expect(
      equipmentIconSource('Computer', [
        {
          group: 'equipment-icon',
          value: 'Computer',
          iconMediaId: 'custom-icon-id',
        },
      ]),
    ).toBe('/api/media?id=custom-icon-id');
    expect(equipmentIconSource('DPV / scooter', [])).toBe(
      '/brand/icons/zeustek-single/06_water_entry_and_dive_types/other.png',
    );
  });

  it('resolves uploaded and linked training-agency logos', () => {
    expect(
      agencyLogoSource('PADI', [
        {
          group: 'agency-logo',
          value: 'PADI',
          iconUrl: 'https://example.com/padi.png',
        },
      ]),
    ).toBe('/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fpadi.png');
    expect(
      agencyLogoSource('BSAC', [
        {
          group: 'agency-logo',
          value: 'BSAC',
          iconMediaId: 'private-logo',
        },
      ]),
    ).toBe('/api/media?id=private-logo');
  });
});
