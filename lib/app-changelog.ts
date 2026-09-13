// Read-only release history. package.json remains the current-version authority.
export const appChangelog = [
  {
    version: '1.0.4',
    date: '2026-09-12',
    title: 'Neutral dark workspace',
    changes: [
      'Replaced the warm brown page-level glow with a black and charcoal background that matches the navigation surfaces.',
      'Kept orange as an intentional accent on controls, status details and highlighted content.',
    ],
  },
  {
    version: '1.0.3',
    date: '2026-09-12',
    title: 'Conservation & AWARE',
    changes: [
      'Record conservation observations, debris surveys/removals and learning evidence using existing Dive, Site and Person references.',
      'Calculated totals distinguish surveyed debris from actual removals and retain unknown measurements.',
      'Capture sourced programme requirement versions without claiming certification or remote submission.',
      'Link private uploaded photos, videos and evidence files; local activity edits and saved references remain available without a connection.',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-09-12',
    title: 'One Dive: Overview, Debrief and Story',
    changes: [
      'Added three labelled views to the existing Dive detail, with shared facts and locally saved reflections.',
      'Debrief links shared skill evidence; Story features existing media without copying or deleting originals.',
      'Plan-derived logs retain an immutable originating Plan revision for comparison with actual Dive facts.',
      'Saved media references remain available offline, and failed local saves prevent accidental navigation loss.',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-09-12',
    title: 'Version and changelog baseline',
    changes: [
      'Added the current app version to the navigation footer with a link to this changelog.',
      'Recorded the existing pages and release rollback point before expansion work.',
      'Existing dive records, sharing, sync, backups and features are unchanged.',
    ],
  },
] as const;
