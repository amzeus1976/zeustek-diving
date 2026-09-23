import { describe, it, expect } from 'vitest';
import { canonicalUrl, groupNewsStories } from '../lib/record-identity';
import { newsArticleInput, newsRecordForStory } from '../lib/news-records';
const article = {
  source: 'Newsletter',
  title: 'A new conservation project at Swanage pier',
  link: 'https://mail.google.com/mail/u/0/#inbox/a12',
  summary: 'Local divers record seagrass.',
  publishedAt: '2026-09-23T12:00:00Z',
};
describe('T14 News record boundary and source preservation', () => {
  it('preserves mailbox message identity while dropping web tracking', () => {
    expect(canonicalUrl(article.link)).not.toBe(
      canonicalUrl(article.link.replace('a12', 'b13')),
    );
    expect(
      canonicalUrl('https://example.com/story?utm_source=mail#heading'),
    ).toBe('https://example.com/story');
  });
  it('never carries a Gmail entity ID into a news update', () => {
    const mail = {
      ...article,
      entityId: 'gmail_message:a12',
      gmailMessageId: 'a12',
    };
    expect(newsArticleInput(mail, 'deleted')).not.toHaveProperty('entityId');
    expect(
      newsArticleInput(mail, 'deleted', {
        ...article,
        entityId: 'canonical-news',
        state: 'saved',
      }),
    ).toMatchObject({ entityId: 'canonical-news', state: 'deleted' });
    expect(newsArticleInput(mail, 'deleted')).not.toHaveProperty(
      'gmailMessageId',
    );
  });
  it('retains every source when a grouped story occurs again by the same URL', () => {
    const secondary = {
      source: 'Local report',
      link: 'https://example.com/swanage',
      title: article.title,
      summary: 'A second perspective.',
      publishedAt: article.publishedAt,
    };
    const input = [
      { ...article, sources: [{ ...article }, secondary] },
      {
        ...article,
        sources: [{ source: 'Agency', link: 'https://example.com/agency' }],
      },
    ];
    const before = JSON.stringify(input);
    const grouped = groupNewsStories(input);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.sources).toHaveLength(3);
    expect(grouped[0]?.summary).toContain('A second perspective.');
    expect(JSON.stringify(input)).toBe(before);
  });
  it('finds saved or deleted state through any original source after regrouping', () => {
    const record = {
      ...article,
      entityId: 'canonical-news',
      state: 'deleted' as const,
    };
    const regrouped = {
      ...article,
      link: 'https://example.com/new-primary',
      sources: [{ source: article.source, link: article.link }],
    };
    expect(newsRecordForStory(regrouped, [record])?.entityId).toBe(
      record.entityId,
    );
  });
});
