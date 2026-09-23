'use client';
import { useState } from 'react';
import type { ProfessionalRequirementDefinition } from '../lib/offline/professional-development';
export function ProfessionalRequirementBuilder({
  value,
  change,
}: {
  value: string;
  change: (next: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<
    'manual' | 'document' | 'assessment' | 'count'
  >('manual');
  const [metric, setMetric] = useState('logged-dives');
  const [minimum, setMinimum] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  let rows: ProfessionalRequirementDefinition[] = [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    /* Raw editor retains invalid drafts until repaired. */
  }
  function add() {
    try {
      if (!label.trim())
        throw new Error('Name the requirement from your source.');
      if (!Array.isArray(JSON.parse(value)))
        throw new Error(
          'Repair the advanced requirements list before adding a row.',
        );
      if (
        kind === 'count' &&
        (!minimum.trim() ||
          !Number.isFinite(Number(minimum)) ||
          Number(minimum) < 0)
      )
        throw new Error('Enter the minimum stated by your source.');
      const row: ProfessionalRequirementDefinition = {
        key: crypto.randomUUID(),
        label: label.trim(),
        kind,
        rule: kind === 'count' ? { metric, min: Number(minimum) } : {},
        notes: notes.trim(),
      };
      change(JSON.stringify([...rows, row], null, 2));
      setLabel('');
      setNotes('');
      setMinimum('');
      setError('');
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'The requirement could not be added.',
      );
    }
  }
  return (
    <section
      style={{ gridColumn: '1 / -1', minWidth: 0 }}
      aria-label="Requirement builder"
    >
      <h3>Build the captured requirements</h3>
      <p>
        Copy each requirement from the dated source you checked. ZeusTek
        supplies no default agency thresholds. Manual, document and assessment
        requirements remain for review against their linked evidence.
      </p>
      <div className="record-fields">
        <label>
          Requirement label
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Exact requirement from the checked source"
          />
        </label>
        <label>
          Requirement type
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="manual">Mentor / manual review</option>
            <option value="document">Document</option>
            <option value="assessment">Assessment</option>
            <option value="count">Count</option>
          </select>
        </label>
        {kind === 'count' && (
          <>
            <label>
              Count source
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                <option value="logged-dives">Canonical logged Dives</option>
                <option value="professional-evidence">
                  Linked professional evidence
                </option>
              </select>
            </label>
            <label>
              Required minimum
              <input
                type="number"
                min="0"
                value={minimum}
                onChange={(e) => setMinimum(e.target.value)}
              />
            </label>
          </>
        )}
        <label>
          Source notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <button
        type="button"
        className="focus-secondary"
        disabled={!label.trim()}
        onClick={add}
      >
        Add requirement to this draft
      </button>
      {error && <p role="alert">{error}</p>}
      <ol>
        {rows.map((row, index) => (
          <li key={row.key}>
            <b>{row.label}</b> · {row.kind}{' '}
            <button
              type="button"
              className="focus-secondary"
              aria-label={`Remove draft requirement ${index + 1}`}
              onClick={() =>
                change(
                  JSON.stringify(
                    rows.filter((_, i) => i !== index),
                    null,
                    2,
                  ),
                )
              }
            >
              Remove from draft
            </button>
          </li>
        ))}
      </ol>
      <p>
        Saving captures the entire list as a new immutable requirement version.
      </p>
    </section>
  );
}
