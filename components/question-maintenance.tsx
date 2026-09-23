'use client';
import { useState } from 'react';
import {
  QUESTION_DIFFICULTIES,
  type Question,
  type QuestionSet,
} from '../lib/knowledge-tests';
import {
  maintainQuestion,
  questionQualityRequest,
  validateQuestionAdvice,
  type QuestionAdvice,
} from '../lib/offline/question-maintenance';
import styles from './question-maintenance.module.css';
export function QuestionMaintenance({
  set,
  question,
  saved,
  opened,
}: {
  set: QuestionSet;
  question: Question;
  saved: () => Promise<void>;
  opened: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Question>(() => structuredClone(question));
  const [action, setAction] = useState<'edit' | 'replace' | 'remove'>('edit');
  const [reason, setReason] = useState('');
  const [approvedValue, setApprovedValue] = useState<string | null>(null);
  const [advice, setAdvice] = useState<QuestionAdvice | null>(null);
  const [decisions, setDecisions] = useState<Array<'' | 'accept' | 'reject'>>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const approvalValue = JSON.stringify({
    draft,
    action,
    reason,
    advice,
    decisions,
  });
  const approved = approvedValue === approvalValue;
  const setApproved = (value: boolean) =>
    setApprovedValue(value ? approvalValue : null);
  async function exportRequest() {
    try {
      const request = await questionQualityRequest(set, question);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(request, null, 2)], {
          type: 'application/json',
        }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'zeustek-question-quality-request.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('The review request could not be created.');
    }
  }
  async function importAdvice(file: File) {
    try {
      if (file.size > 128000)
        throw new Error('Advice must be smaller than 128 KB.');
      const request = await questionQualityRequest(set, question);
      const result = validateQuestionAdvice(
        JSON.parse(await file.text()),
        request.target,
      );
      setAdvice(result);
      setDecisions(result.findings.map(() => ''));
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Invalid advice.');
    }
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      await maintainQuestion({
        setId: set.setId,
        setVersion: set.version,
        questionId: question.id,
        action,
        question: draft,
        reason,
        approved,
        ...(advice
          ? { advice, decisions: decisions as Array<'accept' | 'reject'> }
          : {}),
      });
      await saved();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Question change could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <button
        className="focus-secondary"
        onClick={() => {
          setOpen(true);
          opened();
        }}
      >
        Edit, replace or remove this question
      </button>
    );
  return (
    <section className={styles.panel} aria-label="Single-question maintenance">
      <h3>Single-question maintenance</h3>
      <p>
        A new bank version will be created. Historical attempts and the previous
        bank remain unchanged.
      </p>
      <fieldset disabled={busy}>
        <label>
          Action
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value as typeof action);
              setApproved(false);
            }}
          >
            <option value="edit">Edit this question</option>
            <option value="replace">
              Replace with a new question identity
            </option>
            <option value="remove">Remove from the next version</option>
          </select>
        </label>
        {action !== 'remove' && (
          <div className={styles.grid}>
            <label>
              Question
              <textarea
                value={draft.prompt}
                onChange={(e) => {
                  setDraft({ ...draft, prompt: e.target.value });
                  setApproved(false);
                }}
              />
            </label>
            <label>
              Explanation
              <textarea
                value={draft.explanation}
                onChange={(e) =>
                  setDraft({ ...draft, explanation: e.target.value })
                }
              />
            </label>
            <label>
              Topic
              <input
                value={draft.topic}
                onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
              />
            </label>
            <label>
              Subtopic
              <input
                value={draft.exactTopic ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, exactTopic: e.target.value })
                }
              />
            </label>
            <label>
              Learning objective
              <input
                value={draft.objective ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, objective: e.target.value })
                }
              />
            </label>
            <label>
              Difficulty
              <select
                value={draft.difficulty}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    difficulty: e.target.value as Question['difficulty'],
                  })
                }
              >
                {[...new Set([...QUESTION_DIFFICULTIES, draft.difficulty])].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Type
              <select
                value={draft.type}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    type: e.target.value as Question['type'],
                  })
                }
              >
                {[
                  'single-choice',
                  'multiple-response',
                  'missing-word',
                  'diagram-labels',
                  'scenario-response',
                  'multiple-choice',
                  'fill-gap',
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Answer choices · one per line
              <textarea
                value={draft.options?.join('\n') ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, options: e.target.value.split('\n') })
                }
              />
            </label>
            <label>
              Correct answers · one per line
              <textarea
                value={draft.answers.join('\n')}
                onChange={(e) =>
                  setDraft({ ...draft, answers: e.target.value.split('\n') })
                }
              />
            </label>
            <details>
              <summary>Distractor explanations</summary>
              <p>Review explanations when changing answer choices.</p>
              {(draft.options ?? [])
                .filter((option) => option && !draft.answers.includes(option))
                .map((option, index) => (
                  <label key={`${option}:${index}`}>
                    Why “{option}” is incorrect
                    <textarea
                      value={draft.incorrectExplanations?.[option] ?? ''}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          incorrectExplanations: {
                            ...draft.incorrectExplanations,
                            [option]: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ))}
            </details>
            <label>
              Source / provenance
              <textarea
                value={draft.provenance}
                onChange={(e) =>
                  setDraft({ ...draft, provenance: e.target.value })
                }
              />
            </label>
            <label>
              Diagram URL
              <input
                value={draft.diagramImage ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, diagramImage: e.target.value })
                }
              />
            </label>
            <label>
              Study references · one per line
              <textarea
                value={draft.studySources?.join('\n') ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    studySources: e.target.value.split('\n').filter(Boolean),
                  })
                }
              />
            </label>
          </div>
        )}
        {action === 'remove' && (
          <p>
            The question is removed only from future selection in the new bank.
            Referenced historical content is retained. To temporarily disable
            it, use Mark needs review below.
          </p>
        )}
        <label>
          Reason for this change
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <details>
          <summary>Advisory AI quality review</summary>
          <p>
            Check missing context, ambiguity, answer leakage, distractors and
            readability. Export this one question, review it with your chosen AI
            tool, and import the matching advice JSON. No question is sent
            automatically.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className="focus-secondary"
              onClick={() => void exportRequest()}
            >
              Export question review request
            </button>
            <label>
              Import advisory response
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importAdvice(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          {advice && (
            <div>
              <p>{advice.summary}</p>
              <p>
                Accepted findings must be applied manually in the fields above
                before you approve the final question.
              </p>
              {advice.findings.map((finding, index) => (
                <label key={index}>
                  <b>{finding.criterion}</b>
                  <span>{finding.detail}</span>
                  <select
                    aria-label={`Decision on finding ${index + 1}`}
                    value={decisions[index] ?? ''}
                    onChange={(e) =>
                      setDecisions((values) =>
                        values.map((value, i) =>
                          i === index
                            ? (e.target.value as '' | 'accept' | 'reject')
                            : value,
                        ),
                      )
                    }
                  >
                    <option value="">Choose a decision</option>
                    <option value="accept">Accept finding</option>
                    <option value="reject">Reject finding</option>
                  </select>
                </label>
              ))}
            </div>
          )}
        </details>
        <label className={styles.approval}>
          <input
            type="checkbox"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
          />
          I reviewed the final change and approve a new bank version.
        </label>
        <button
          type="button"
          className="focus-primary"
          disabled={
            !approved || !reason.trim() || decisions.some((value) => !value)
          }
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : 'Save new bank version'}
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
