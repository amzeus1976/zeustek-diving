import { canonicalUrl, type NewsStory } from './record-identity';
import type { NewsArticleRecord } from './offline/dive-planning';
type State = NewsArticleRecord['state'];
type NewsRecord = NewsStory & {
  entityId: string;
  state: State;
  reaction?: NewsArticleRecord['reaction'];
  reactionAt?: string;
};
export function newsRecordForStory<T extends NewsRecord>(
  story: NewsStory,
  records: T[],
): T | undefined {
  const links = new Set(
    [story.link, ...(story.sources ?? []).map((source) => source.link)].map(
      canonicalUrl,
    ),
  );
  const matches = records.filter((record) =>
    [record.link, ...(record.sources ?? []).map((source) => source.link)].some(
      (link) => links.has(canonicalUrl(link)),
    ),
  );
  // A previously hidden constituent remains hidden after a different feed becomes primary.
  return (
    matches.find((record) => record.state === 'deleted') ??
    matches.find((record) => record.state === 'archived') ??
    matches.find((record) => record.state === 'saved') ??
    matches[0]
  );
}
/** Explicit DTO prevents mailbox IDs or future provider metadata becoming a News record. */
export function newsArticleInput(
  story: NewsStory,
  state: State,
  current?: NewsRecord,
) {
  return {
    source: story.source,
    title: story.title,
    link: canonicalUrl(story.link),
    summary: story.summary,
    publishedAt: story.publishedAt,
    sources: (story.sources?.length ? story.sources : [story]).map(
      (source) => ({
        source: source.source,
        link: source.link,
        ...(source.title ? { title: source.title } : {}),
        ...(source.summary ? { summary: source.summary } : {}),
        ...(source.publishedAt ? { publishedAt: source.publishedAt } : {}),
      }),
    ),
    state,
    ...(current?.reaction
      ? {
          reaction: current.reaction,
          ...(current.reactionAt ? { reactionAt: current.reactionAt } : {}),
        }
      : {}),
    ...(current ? { entityId: current.entityId } : {}),
  };
}
