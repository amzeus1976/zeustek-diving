// Read-only release history. package.json remains the current-version authority.
export const appChangelog = [
  {
    version: '1.0.11',
    date: '2026-09-13',
    title: 'Protected editors and visible competence guidance',
    changes: [
      'Editable overlays no longer dismiss from backdrop clicks or Escape; explicit Cancel and Close actions now protect changed form values with a discard confirmation.',
      'Skill Evidence keeps the compact competence selector while displaying the selected canonical Skill definition immediately beneath it and through accessible mouse, keyboard and touch help.',
      'Stable competence levels, legacy assessments, canonical Skill IDs and CSV behaviour remain unchanged.',
    ],
  },
  {
    version: '1.0.10',
    date: '2026-09-13',
    title: 'Skill evidence and catalogue UI correction',
    changes: [
      'Skill Evidence now records a stable Foundation, Developing, Competent, Advanced or Mastered level and shows the selected canonical Skill’s own definition while logging or editing.',
      'Legacy numeric competence and free-text assessment values remain intact and readable; changing a Skill definition does not rewrite saved evidence levels.',
      'Made logged Skill Evidence cards compact with accessible Edit, Unlink and Delete icon controls while retaining the existing delete confirmation and full evidence disclosure.',
      'Separated the Skill Catalogue heading from its naturally wrapping action toolbar and preserved responsive search, filtering and CSV actions.',
      'Made Skill Group filtering an explicit searchable multi-select with zero groups selected by default and 75-Skill incremental result batches for large catalogues.',
    ],
  },
  {
    version: '1.0.9',
    date: '2026-09-13',
    title: 'Rich Skill definitions and CSV management',
    changes: [
      'Extended each canonical Skill with a group, description and Skill-specific Foundation, Developing, Competent, Advanced and Mastered definitions without changing existing IDs or evidence references.',
      'Added local CSV preview, selective create/update/archive/restore, exact-ID matching, conservative duplicate checks and a re-importable canonical export.',
      'Added protected cleanup for unused archived Skills; any referenced historical Skill remains readable and cannot be removed by this maintenance action.',
      'Updated Dive → Add skill to search by group, name or description and display Group — Skill name while excluding archived Skills from new evidence choices.',
    ],
  },
  {
    version: '1.0.8',
    date: '2026-09-13',
    title: 'Canonical Skill Catalogue',
    changes: [
      'Resolved Skill Evidence references to human-readable canonical Skill names while preserving every Skill and evidence ID.',
      'Added Settings → Diving Data → Skill Catalogue with search, single add/edit, safe archive/restore and evidence usage counts.',
      'Added reviewed bulk entry with one Skill per line, blank-line handling and case/whitespace duplicate prevention through the same offline-first canonical Skill service.',
      'Made Dive → Add skill searchable and kept catalogue-created and Dive-created Skills immediately available through the same canonical records.',
    ],
  },
  {
    version: '1.0.7',
    date: '2026-09-13',
    title: 'Shared surface palette alignment',
    changes: [
      'Continued SNAG-UI-001 by moving shared navigation, hero, metric-chip, weather, form, technical and notice surfaces from brown/bronze fills to charcoal neutrals.',
      'Kept ZeusTek orange as the primary action/active accent and cyan for weather or other informational data.',
      'The broader page-specific design-system review remains partial and is not marked closed.',
    ],
  },
  {
    version: '1.0.6',
    date: '2026-09-13',
    title: 'Dive skills evidence workflow',
    changes: [
      'Added a visible Add skill flow to Dive Debrief using the shared canonical Skill and dive.skill_evidence records.',
      'Evidence can be created, reopened offline, edited, linked, unlinked without deleting its Skill, or explicitly deleted as a separate action.',
      'The Dive reference and evidence diveId are updated through one domain service, with duplicate Skill definitions prevented by canonical identity.',
    ],
  },
  {
    version: '1.0.5',
    date: '2026-09-13',
    title: 'Conservation reference correction',
    changes: [
      'Fixed existing Dive links so the exact selected canonical record—including legacy IDs and the latest Dive—passes strict existence and entity-type validation.',
      'Replaced duplicate Dive and Site inputs with one oldest-first Dive selector and one offline existing-Site search control.',
      'Added accessible example help and a wider, phone-safe scrolling layout to both Log and Edit conservation activity forms.',
    ],
  },
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
