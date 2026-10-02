/** Paging changes presentation only; record identity and the filtered counts are retained. */
export function pageCatalogue<T>(items: readonly T[], requestedPage: number, size = 25) {
  const pageSize = Math.max(1, Math.min(100, Math.floor(size) || 25));
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total/pageSize));
  const page = Math.max(0, Math.min(pages-1, Math.floor(requestedPage) || 0));
  return {items:items.slice(page*pageSize,(page+1)*pageSize), total, pages, page, from:total?page*pageSize+1:0, to:Math.min(total,(page+1)*pageSize)};
}
