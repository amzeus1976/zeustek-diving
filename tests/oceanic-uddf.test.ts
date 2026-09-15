import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OCEANIC_OFFSET_TRANSFORM,
  parseOceanicUddf,
  repairOceanicTimestamp,
} from '../lib/offline/oceanic-uddf';
const fixture = (name: string) =>
  new Uint8Array(readFileSync(resolve(process.cwd(), 'tests/fixtures', name)));
describe('T12 Oceanic+ UDDF parser', () => {
  it('parses the bounded fixture and repairs only detected Oceanic offsets', () => {
    const doc = parseOceanicUddf(fixture('oceanic-plus-minimal.uddf'));
    expect(doc.sites).toHaveLength(2);
    expect(doc.gases).toHaveLength(2);
    expect(doc.segments).toHaveLength(2);
    expect(doc.waypointCount).toBe(5);
    expect(doc.segments[0]?.rawTimestamp).toBe('2026-09-05T11:58:12.000+00:01');
    expect(doc.segments[0]?.normalisedTimestamp).toBe(
      '2026-09-05T11:58:12.000+01:00',
    );
    expect(doc.segments[0]?.timestampTransforms).toContain(
      OCEANIC_OFFSET_TRANSFORM,
    );
    expect(doc.segments[0]?.tankPressureBeginBar).toBe(200);
    expect(doc.segments[0]?.minimumTemperatureC).toBe(13);
  });
  it('does not rewrite a normal +01:00 timestamp or non-Oceanic input', () => {
    expect(
      repairOceanicTimestamp('2026-01-01T12:00:00+01:00', true).transforms,
    ).toEqual([]);
    expect(
      repairOceanicTimestamp('2026-01-01T12:00:00+00:01', false).value,
    ).toContain('+00:01');
  });
  it('rejects DTD/entity XML', () => {
    const unsafe = `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY boom "x">]><uddf version="3.2.1" xmlns="http://www.streit.cc/uddf/3.2/"><generator><manufacturer><contact><homepage>https://www.oceanicworldwide.com/it/oceanic-plus/</homepage></contact></manufacturer></generator></uddf>`;
    expect(() => parseOceanicUddf(unsafe)).toThrow(/Unsafe XML/);
  });
  it('rejects malformed XML before any staging or canonical write', () => {
    expect(() =>
      parseOceanicUddf(
        '<uddf><profiledata><repetitiongroup></profiledata></uddf>',
      ),
    ).toThrow(/Malformed XML/);
  });
  it('keeps Oceanic summary max depth and source duration separate from samples', () => {
    const doc = parseOceanicUddf(fixture('oceanic-plus-minimal.uddf'));
    const first = doc.segments[0]!;
    expect(first.greatestDepthM).toBe(10.2);
    expect(Math.max(...first.waypoints.map((p) => p.depthM ?? 0))).toBe(10);
    expect(first.sourceDurationSec).toBe(20);
    expect(first.finalSampleElapsedSec).toBe(30);
  });
});
