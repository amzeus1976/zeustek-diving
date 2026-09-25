/** Keep the source of a versioned Professional Evidence link until the link is removed. */
export const PROFESSIONAL_EVIDENCE_DELETE_CONSTRAINT = " AND NOT EXISTS (SELECT 1 FROM dive_records link WHERE link.user_id=? AND link.kind='professional-evidence' AND link.deleted_at IS NULL AND json_extract(link.data_json,'$.evidenceType')='requirement-link' AND json_extract(link.data_json,'$.payload.sourceKind')='professional-evidence' AND json_extract(link.data_json,'$.payload.sourceId')=?)";

export const professionalEvidenceDeleteBindings = (ownerUserId: string, id: string) => [ownerUserId, id];
