import { describe, expect, it } from 'vitest';
import { learnedNewsProfile, normaliseNewsKeywords, priorityForArticle, sortNewsByPriority } from '../lib/news-priority';

const article = (title: string, summary = '', source = 'Dive feed', publishedAt = '2026-08-01T00:00:00Z') => ({ title, summary, source, publishedAt });

describe('news priority', () => {
  it('normalises comma and line separated keywords', () => {
    expect(normaliseNewsKeywords('Wreck,  TEC\nWreck')).toEqual(['wreck', 'tec']);
  });

  it('weights title matches above summary matches', () => {
    expect(priorityForArticle(article('Wreck diving', 'tec update'), { interestedKeywords: ['wreck', 'tec'], mutedKeywords: [], mutedMode: 'hide' }).score).toBe(10);
  });

  it('hides muted stories or pushes them to the bottom', () => {
    const stories = [article('Competition results'), article('New wreck discovered')];
    expect(sortNewsByPriority(stories, { interestedKeywords: ['wreck'], mutedKeywords: ['competition'], mutedMode: 'hide' }).map((item) => item.title)).toEqual(['New wreck discovered']);
    expect(sortNewsByPriority(stories, { interestedKeywords: ['wreck'], mutedKeywords: ['competition'], mutedMode: 'deprioritize' }).map((item) => item.title)).toEqual(['New wreck discovered', 'Competition results']);
  });

  it('learns recurring preferences from emoji reactions', () => {
    const feedback = [
      { ...article('New wreck discovered in Malta'), reaction: 'shaka' as const },
      { ...article('Wreck photography guide'), reaction: 'shaka' as const },
      { ...article('Freediving competition results'), reaction: 'not-interested' as const },
    ];
    const profile = learnedNewsProfile(feedback);
    expect(profile.ratingCount).toBe(3);
    expect(profile.liked).toContain('wreck');
    expect(profile.avoided).toContain('freediving');
    expect(sortNewsByPriority([article('Freediving championship'), article('Wreck expedition')], { interestedKeywords: [], mutedKeywords: [], mutedMode: 'deprioritize' }, feedback)[0]?.title).toBe('Wreck expedition');
  });
});
