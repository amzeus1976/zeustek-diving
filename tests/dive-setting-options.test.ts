import { describe, expect, it } from 'vitest';
import { DIVE_SETTING_VALUES, diveSettingValue, otherSavedDiveSettings } from '../lib/dive-setting-options';
describe('shared dive settings', () => {
  it('keeps identically named feature and activity independent', () => {
    expect(diveSettingValue('Mode', 'Cave / Cavern')).not.toBe(diveSettingValue('Primary bottom/feature', 'Cave / Cavern'));
    expect(new Set(DIVE_SETTING_VALUES).size).toBe(DIVE_SETTING_VALUES.length);
  });
  it('preserves ambiguous older selections without guessing a new subtype', () => {
    expect(otherSavedDiveSettings(['Pool', 'Reef', 'Muck', 'Lake', 'Macro', 'Cave / Cavern'])).toEqual(['Pool', 'Cave / Cavern']);
  });
});
