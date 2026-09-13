function hasUserValue(value: unknown) {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function mergeCatalogSite(
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>,
) {
  if (!existing) return incoming;
  const merged = { ...incoming };
  for (const [key, value] of Object.entries(existing)) {
    if (hasUserValue(value)) merged[key] = value;
  }
  return merged;
}
