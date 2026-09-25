/** Keep the source of a versioned Professional Evidence link until the link is removed. */
export const PROFESSIONAL_EVIDENCE_DELETE_CONSTRAINT = " AND json_extract(dive_records.data_json,'$.payload.rubricId') IS NULL AND NOT EXISTS (SELECT 1 FROM dive_records link WHERE link.user_id=? AND link.kind='professional-evidence' AND link.deleted_at IS NULL AND json_extract(link.data_json,'$.evidenceType')='requirement-link' AND json_extract(link.data_json,'$.payload.sourceKind')='professional-evidence' AND json_extract(link.data_json,'$.payload.sourceId')=?)";

export const professionalEvidenceDeleteBindings = (ownerUserId: string, id: string) => [ownerUserId, id];

/** Scored attempts are append-only; later attachment updates may add source material. */
export function professionalEvidenceRevisionAllowed(previous: Record<string, unknown>, next: Record<string, unknown>) {
  const oldPayload = previous.payload;
  if (!oldPayload || typeof oldPayload !== 'object' || !('rubricId' in oldPayload) || !oldPayload.rubricId) return true;
  const stable = (record: Record<string, unknown>) => {
    const { attachmentIds: _attachments, modifiedAt: _modifiedAt, createdAt: _createdAt, ...identityAndAssessment } = record;
    return canonicalize(identityAndAssessment);
  };
  return stable(previous) === stable(next);
}
import canonicalize from 'canonicalize';
