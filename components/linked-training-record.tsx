import type {Stored,TrainingProgressRecord} from '../lib/offline/dive-planning';
/** Exact source evidence stays distinct from the Course Map's combined per-course projection. */
export function LinkedTrainingRecord({record}:{record:Stored<TrainingProgressRecord>|null}){
 return <section className="focus-card" aria-label="Linked training record"><h2>{record?.courseTitle||'Linked training record'}</h2>{record?<><p>{record.agency} · {record.status}</p><p>{record.metRequirementIds?.length??0} recorded requirements · Last updated {record.modifiedAt.slice(0,10)}</p><p>This is the exact saved training record linked from Calendar. The course map below keeps its normal combined progress view.</p></>:<p role="alert">This exact training record is unavailable. Refresh Planned Training to try again; no other record has been substituted.</p>}</section>;
}
