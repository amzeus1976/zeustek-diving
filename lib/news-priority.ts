export type NewsPriorityPreferences = {
  interestedKeywords: string[];
  mutedKeywords: string[];
  mutedMode: 'hide' | 'deprioritize';
};

export type PrioritisedArticle = {
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
};

export type NewsFeedback = PrioritisedArticle & {
  reaction?: 'shaka' | 'okay' | 'not-interested';
};

const STOP_WORDS = new Set(['about','after','again','against','also','another','been','before','being','between','could','diver','divers','diving','from','have','into','more','news','over','scuba','some','than','that','their','there','these','they','this','through','under','very','what','when','where','which','while','with','would','your']);

function cleanKeywords(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

export function normaliseNewsKeywords(value: string) {
  return cleanKeywords(value.split(/[\n,]/));
}

export function priorityForArticle(article: PrioritisedArticle, preferences: NewsPriorityPreferences) {
  const title = article.title.toLowerCase();
  const summary = article.summary.toLowerCase();
  const source = article.source.toLowerCase();
  const interestedMatches = cleanKeywords(preferences.interestedKeywords).filter((keyword) => title.includes(keyword) || summary.includes(keyword) || source.includes(keyword));
  const mutedMatches = cleanKeywords(preferences.mutedKeywords).filter((keyword) => title.includes(keyword) || summary.includes(keyword) || source.includes(keyword));
  const score = interestedMatches.reduce((total, keyword) => total + (title.includes(keyword) ? 8 : 0) + (source.includes(keyword) ? 4 : 0) + (summary.includes(keyword) ? 2 : 0), 0) - mutedMatches.length * 50;
  return { score, interestedMatches, mutedMatches };
}

function feedbackTokens(article: PrioritisedArticle) {
  return [...new Set(`${article.title} ${article.source} ${article.summary}`.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g)?.filter((word) => !STOP_WORDS.has(word)) ?? [])];
}

export function learnedNewsProfile(feedback: NewsFeedback[]) {
  const weights = new Map<string, number>();
  let ratingCount = 0;
  for (const item of feedback) {
    if (!item.reaction) continue;
    ratingCount += 1;
    const value = item.reaction === 'shaka' ? 3 : item.reaction === 'okay' ? 1 : -4;
    for (const token of feedbackTokens(item)) weights.set(token, (weights.get(token) ?? 0) + value);
  }
  const ranked = [...weights].sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]) || left[0].localeCompare(right[0]));
  return {
    ratingCount,
    weights,
    liked: ranked.filter(([, weight]) => weight > 1).slice(0, 6).map(([word]) => word),
    avoided: ranked.filter(([, weight]) => weight < 0).slice(0, 6).map(([word]) => word),
  };
}

export function learnedPriorityForArticle(article: PrioritisedArticle, feedback: NewsFeedback[]) {
  const profile = learnedNewsProfile(feedback);
  return feedbackTokens(article).reduce((total, token) => total + (profile.weights.get(token) ?? 0), 0);
}

export function sortNewsByPriority<T extends PrioritisedArticle>(articles: T[], preferences: NewsPriorityPreferences, feedback: NewsFeedback[] = []) {
  return [...articles]
    .filter((article) => preferences.mutedMode !== 'hide' || !priorityForArticle(article, preferences).mutedMatches.length)
    .sort((left, right) => priorityForArticle(right, preferences).score + learnedPriorityForArticle(right, feedback) - priorityForArticle(left, preferences).score - learnedPriorityForArticle(left, feedback) || Date.parse(right.publishedAt || '0') - Date.parse(left.publishedAt || '0'));
}
