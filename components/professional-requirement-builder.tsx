'use client';
import { useState } from 'react';
import { PROFESSIONAL_ASSESSMENT_ACTIVITIES, PROFESSIONAL_EVIDENCE_CATEGORIES, type ProfessionalRequirementDefinition } from '../lib/offline/professional-development';
import { SKILL_COMPETENCE_LEVELS, skillRecordName, type CanonicalSkillRecord } from '../lib/offline/dive-context';
import { METRIC_WATER_SKILLS_RUBRIC_2021 } from '../lib/professional-development/water-skills';
export function ProfessionalRequirementBuilder({
  value,
  change,
  skills,
}: {
  value: string;
  change: (next: string) => void;
  skills: CanonicalSkillRecord[];
}) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<
    'manual' | 'document' | 'assessment' | 'count'
  >('manual');
  const [metric, setMetric] = useState('logged-dives');
  const [countEvidenceType, setCountEvidenceType] = useState('assisting');
  const [minimum, setMinimum] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [assessmentSource, setAssessmentSource] = useState<'professional-evidence' | 'canonical-skill' | 'water-skills'>('professional-evidence');
  const [activityCode, setActivityCode] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [skillKey, setSkillKey] = useState('');
  const [minCompetence, setMinCompetence] = useState('competent');
  const [documentType, setDocumentType] = useState('eap');
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
      if (kind === 'assessment' && assessmentSource === 'professional-evidence' && !activityCode)
        throw new Error('Choose the exact assessed activity.');
      if (kind === 'assessment' && assessmentSource === 'canonical-skill' && !skills.some(skill => skill.entityId === skillKey))
        throw new Error('Choose a saved canonical Skill.');
      const activity = PROFESSIONAL_ASSESSMENT_ACTIVITIES.find(item => item.code === activityCode);
      const row: ProfessionalRequirementDefinition = {
        key: crypto.randomUUID(),
        label: label.trim(),
        kind,
        rule: kind === 'count' ? { metric, min: Number(minimum), ...(metric === 'professional-evidence' ? { evidenceType: countEvidenceType, scope: 'requirement' } : {}) }
          : kind === 'document' ? { evidenceType: documentType, scope: 'requirement' }
          : kind === 'assessment' && assessmentSource === 'professional-evidence' && activity
            ? { source: 'professional-evidence', evidenceType: activity.evidenceType, activityCode: activity.code, evaluatorRequired: true, result: 'passed' }
            : kind === 'assessment' && assessmentSource === 'water-skills'
              ? { source: 'water-skills', rubric: structuredClone(METRIC_WATER_SKILLS_RUBRIC_2021) }
            : kind === 'assessment' ? { source: 'canonical-skill', skillKey, minCompetence, evaluatorRequired: true }
            : kind === 'manual' ? { scope: 'requirement', evidenceType: 'mentor-feedback', evaluatorRequired: true, result: 'passed' }
            : {},
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
            {metric === 'professional-evidence' && <label>Exact evidence type
              <select value={countEvidenceType} onChange={event => setCountEvidenceType(event.target.value)}>
                {PROFESSIONAL_EVIDENCE_CATEGORIES.filter(item => item.type !== 'requirement-link').map(item => <option key={item.type} value={item.type}>{item.label}</option>)}
              </select>
            </label>}
          </>
        )}
        {kind === 'document' && <label>Document evidence type
          <select value={documentType} onChange={event => setDocumentType(event.target.value)}>
            <option value="eap">Emergency Assistance Plan</option>
            <option value="site-map">Site map</option>
            <option value="other">Other linked document</option>
          </select>
        </label>}
        {kind === 'assessment' && <>
          <label>Assessment evidence source
            <select value={assessmentSource} onChange={event => setAssessmentSource(event.target.value as typeof assessmentSource)}>
              <option value="professional-evidence">Evaluator-backed professional result</option>
              <option value="canonical-skill">Canonical Skill Evidence</option>
              <option value="water-skills">Five-exercise water-skills progress</option>
            </select>
          </label>
          {assessmentSource === 'professional-evidence' ? <label>Exact activity
            <select value={activityCode} onChange={event => setActivityCode(event.target.value)}>
              <option value="">Choose the activity captured by the source</option>
              {PROFESSIONAL_ASSESSMENT_ACTIVITIES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
          </label> : assessmentSource === 'water-skills' ? <p className="focus-muted">Adds a versioned five-exercise metric progress rubric to this draft. It tracks 15/25 points but does not decide PADI course completion. Review and cite the source before saving the new requirement version.</p> : <>
            <label>Find canonical Skill
              <input value={skillSearch} onChange={event => setSkillSearch(event.target.value)} placeholder="Search saved Skills" />
            </label>
            <label>Exact saved Skill
              <select value={skillKey} onChange={event => setSkillKey(event.target.value)}>
                <option value="">Choose a Skill</option>
                {skills.filter(skill => skill.entityId === skillKey || (skillSearch.trim().length >= 2 && skillRecordName(skill).toLocaleLowerCase('en-GB').includes(skillSearch.trim().toLocaleLowerCase('en-GB')))).slice(0, 60).map(skill => <option key={skill.entityId} value={skill.entityId}>{skillRecordName(skill)}</option>)}
              </select>
            </label>
            <label>Minimum observed competence
              <select value={minCompetence} onChange={event => setMinCompetence(event.target.value)}>
                {SKILL_COMPETENCE_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
              </select>
            </label>
          </>}
        </>}
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
