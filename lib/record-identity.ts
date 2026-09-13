export const DIVE_RECORD_KINDS = ['dive','equipment','equipment-set','site','trip','certification','training-progress','person','album','catalog-option','dashboard-settings','bucket-list','gear-wishlist','gear-wishlist-group','price-store','price-store-settings','news-source','news-article','news-preferences','gmail-news','dive-media','operator','question-set','test-attempt','skill_evidence','conservation_activity','conservation-programme'] as const;
export function normaliseText(value: unknown) { return typeof value === 'string' ? value.normalize('NFKC').trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' ') : ''; }
export function canonicalUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol)) return ''; url.hash = ''; for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key); url.searchParams.sort(); url.hostname = url.hostname.toLowerCase(); url.pathname = url.pathname.replace(/\/$/, '') || '/'; return url.toString(); } catch { return ''; }
}
export function recordIdentity(kind: string, input: object) {
  const record=input as Record<string,unknown>;
  const t = (key: string) => normaliseText(record[key]);
  if (kind === 'dive-media') return canonicalUrl(record.url) || (t('title') ? `${t('title')}|${t('creator')}|${t('format')}` : '');
  if (kind === 'news-article') return canonicalUrl(record.link);
  if (kind === 'training-progress') return `${t('agency')}|${t('courseId')}`;
  if (kind === 'question-set') return `${t('setId')}|${record.version}`;
  if (kind === 'dive') return t('date') && t('timeIn') && t('site') ? `${t('date')}|${t('timeIn')}|${t('site')}|${record.maxDepthM}` : '';
  if (kind === 'equipment') return t('serialNumber') ? `${t('manufacturer')}|${t('serialNumber')}` : '';
  if (kind === 'person') return t('email') || (t('agency') && t('membershipNumber') ? `${t('agency')}|${t('membershipNumber')}` : '');
  if (kind === 'site') return t('name') && record.latitude != null && record.longitude != null ? `${t('name')}|${record.latitude}|${record.longitude}` : '';
  if (kind === 'operator') return canonicalUrl(record.website) || (t('name') && t('location') ? `${t('name')}|${t('location')}` : '');
  return '';
}
export type NewsSource = { source: string; link: string; title?: string; summary?: string; publishedAt?: string };
export type NewsStory = { title: string; link: string; source: string; summary: string; publishedAt: string; sources?: NewsSource[] };
const NEWS_TITLE_STOP_WORDS=new Set(['a','an','and','at','aboard','after','before','by','diver','divers','diving','for','from','in','near','of','off','on','scuba','the','to','with']);
const NEWS_EVENT_TERMS=new Set(['accident','attack','boat','cylinder','dead','death','failure','fatal','injured','killed','missing','rescue','rescued']);
const NEWS_TERM_ALIASES:Record<string,string>={tank:'cylinder',tanks:'cylinder',cylinders:'cylinder',exploded:'failure',explodes:'failure',exploding:'failure',explosion:'failure',blast:'failure',blasts:'failure',rupture:'failure',ruptured:'failure',injuries:'injured',injury:'injured',serious:'injured',seriously:'injured'};
function newsTitleTerms(value:string){return new Set((normaliseText(value).match(/[\p{L}\p{N}]+/gu)??[]).map(term=>NEWS_TERM_ALIASES[term]??term).filter(term=>term.length>2&&!NEWS_TITLE_STOP_WORDS.has(term)));}
function sameNewsIncident(left:NewsStory,right:NewsStory){
  const leftDay=Date.parse(left.publishedAt),rightDay=Date.parse(right.publishedAt);
  if(!Number.isFinite(leftDay)||!Number.isFinite(rightDay)||Math.abs(leftDay-rightDay)>=7*86400000)return false;
  const leftHeadline=normaliseText(left.title).replace(/[^\p{L}\p{N} ]/gu,''),rightHeadline=normaliseText(right.title).replace(/[^\p{L}\p{N} ]/gu,'');
  if(leftHeadline.length>25&&leftHeadline===rightHeadline)return true;
  const leftTerms=newsTitleTerms(left.title),rightTerms=newsTitleTerms(right.title);
  const shared=[...leftTerms].filter(term=>rightTerms.has(term));
  return shared.length>=2&&shared.some(term=>!NEWS_EVENT_TERMS.has(term))&&shared.length/Math.min(leftTerms.size||1,rightTerms.size||1)>=.4;
}
export function groupNewsStories<T extends NewsStory>(stories: T[]): Array<T & NewsStory> {
  const grouped = new Map<string, T>(); const urls = new Set<string>();
  for (const story of stories) {
    const link = canonicalUrl(story.link); if (!link || urls.has(link)) continue; urls.add(link);
    const match = [...grouped.entries()].find(([, item]) => sameNewsIncident(story,item));
    const provenance = story.sources?.length ? story.sources : [{source: story.source, link, title: story.title, summary: story.summary, publishedAt: story.publishedAt}];
    if (match) match[1].sources = [...new Map([...(match[1].sources ?? []), ...provenance].map(item=>[canonicalUrl(item.link),item])).values()];
    else grouped.set(link, {...story, link, sources: provenance});
  }
  return [...grouped.values()];
}
