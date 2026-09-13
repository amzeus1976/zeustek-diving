import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from '../lib/html-entities';

describe('HTML entity decoding', () => {
  it('decodes decimal, hexadecimal and named punctuation', () => {
    expect(decodeHtmlEntities('Dolphins&#8217; social &#x26; hunting &mdash; today')).toBe('Dolphins’ social & hunting — today');
  });

  it('decodes entities that were encoded more than once', () => {
    expect(decodeHtmlEntities('Dolphins&amp;#8217; Social')).toBe('Dolphins’ Social');
  });
});
