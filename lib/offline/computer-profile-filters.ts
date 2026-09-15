import type { ComputerProfileRecord } from './computer-import';

export type StoredComputerProfile = ComputerProfileRecord & {
  entityId: string;
};

export interface ComputerProfileFilters {
  search: string;
  status: 'all' | 'unlinked' | 'linked' | 'excluded';
  dateFrom: string;
  dateTo: string;
  sourceId: string;
  possibleDiveId: string;
}

export function filterComputerProfiles(
  profiles: StoredComputerProfile[],
  filters: ComputerProfileFilters,
  possibleDiveIds: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
) {
  const needle = filters.search.trim().toLowerCase();
  return profiles
    .filter((profile) => {
      const timestamp = profile.summary.normalisedTimestamp ?? '';
      const linked = Boolean(profile.targetDiveId);
      if (filters.status === 'linked' && !linked) return false;
      if (
        filters.status === 'unlinked' &&
        (linked || profile.disposition === 'excluded')
      )
        return false;
      if (filters.status === 'excluded' && profile.disposition !== 'excluded')
        return false;
      if (filters.dateFrom && timestamp.slice(0, 10) < filters.dateFrom)
        return false;
      if (filters.dateTo && timestamp.slice(0, 10) > filters.dateTo)
        return false;
      if (
        filters.sourceId !== 'all' &&
        profile.importId !== filters.sourceId &&
        profile.latestImportId !== filters.sourceId &&
        !profile.sourceVersions?.some(
          (version) => version.importId === filters.sourceId,
        )
      )
        return false;
      if (
        filters.possibleDiveId !== 'all' &&
        !possibleDiveIds.get(profile.entityId)?.has(filters.possibleDiveId)
      )
        return false;
      if (!needle) return true;
      return [
        profile.sourceDiveId,
        profile.sourceFileName,
        profile.sourceAdapterKey,
        profile.sourceSite?.name,
        profile.sourceSite?.location,
        profile.sourceGas?.name,
        timestamp,
      ].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(needle),
      );
    })
    .sort((left, right) =>
      String(right.summary.normalisedTimestamp ?? '').localeCompare(
        String(left.summary.normalisedTimestamp ?? ''),
      ),
    );
}
