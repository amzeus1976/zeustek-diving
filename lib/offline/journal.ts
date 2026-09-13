import { mutateEntity } from './mutations';

export async function saveJournalEntry(input: { title: string; content: string; rating: number | null; occurredAt: string }) {
  return mutateEntity({
    module: 'journal',
    entityType: 'entry',
    schemaVersion: 1,
    operation: 'create',
    record: {
      title: input.title.trim().slice(0, 255),
      content: input.content.slice(0, 100000),
      contentFormat: 'html',
      rating: input.rating,
      occurredAt: input.occurredAt,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
      provenance: { kind: 'user-opinion', source: 'manual' },
    },
  });
}
