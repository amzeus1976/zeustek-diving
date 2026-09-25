export function initialElapsedRuntime(recorded: number | null | undefined, suggested: number | null): string {
  if (recorded != null && Number.isFinite(recorded) && recorded > 0) return recorded.toString();
  return suggested != null && Number.isFinite(suggested) && suggested > 0 ? suggested.toString() : '';
}
