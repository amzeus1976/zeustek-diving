import type { OperatorRecord, PersonRecord, Stored } from '../offline/dive-planning';
import { personDisplayName } from '../offline/people-profiles';
import { entityRelationLabel, relationshipStatus, type EntityRelation, type PersonEntityLink } from './entity-relationships';

export interface RelationshipSourceRequest {
  kind: 'person-operator-link' | 'operator-operator-link';
  relationshipId: string;
  endpointId: string;
}
export interface RelationshipSourceContext {
  kind: RelationshipSourceRequest['kind'];
  relationshipId: string;
  sourceId: string;
  state: 'available' | 'missing-source' | 'unavailable-endpoint' | 'mismatched-source';
  message: string;
  canManage: boolean;
  label?: string;
  status?: ReturnType<typeof relationshipStatus>;
  startDate?: string;
  endDate?: string;
  endpoints: Array<{ route: 'People' | 'Dive Centres'; id: string; label: string; available: boolean }>;
}
interface RelationshipSources {
  people: ReadonlyArray<Stored<PersonRecord>>;
  operators: ReadonlyArray<Stored<OperatorRecord>>;
  personLinks: ReadonlyArray<PersonEntityLink>;
  entityLinks: ReadonlyArray<EntityRelation>;
}

/** Read-only direction projection: retained date evidence is validated only by Save. */
export function retainedEntityRelationLabel(link: EntityRelation, endpointId: string) {
  const { startDate: _startDate, endDate: _endDate, ...undated } = link;
  return entityRelationLabel(undated, endpointId);
}

/** Resolve only the requested canonical source. This creates no record or editor draft. */
export function resolveRelationshipSourceContext(request: RelationshipSourceRequest, sources: RelationshipSources, on = new Date().toISOString().slice(0, 10)): RelationshipSourceContext | null {
  if (!request.relationshipId) return null;
  const base = { kind: request.kind, relationshipId: request.relationshipId, sourceId: request.endpointId };
  const source = request.kind === 'person-operator-link'
    ? sources.personLinks.find(row => row.entityId === request.relationshipId)
    : sources.entityLinks.find(row => row.entityId === request.relationshipId);
  if (!source) return { ...base, state: 'missing-source', message: 'The requested relationship is unavailable on this device. No other relationship has been opened.', canManage: false, endpoints: [] };

  const operator = (id: string): RelationshipSourceContext['endpoints'][number] => {
    const row = sources.operators.find(item => item.entityId === id);
    return { route: 'Dive Centres', id, label: row?.name || 'Unavailable Dive Entity', available: Boolean(row) };
  };
  let endpoints: RelationshipSourceContext['endpoints'], matches: boolean, label: string;
  if (request.kind === 'person-operator-link') {
    const link = source as PersonEntityLink, person = sources.people.find(row => row.entityId === link.personId);
    endpoints = [{ route: 'People', id: link.personId, label: person ? personDisplayName(person) : 'Unavailable Person', available: Boolean(person) }, operator(link.operatorId)];
    matches = Boolean(request.endpointId) && request.endpointId === link.personId;
    label = link.role || 'Associated';
  } else {
    const link = source as EntityRelation;
    endpoints = [operator(link.fromOperatorId), operator(link.toOperatorId)];
    matches = Boolean(request.endpointId) && [link.fromOperatorId, link.toOperatorId].includes(request.endpointId);
    label = retainedEntityRelationLabel(link, matches ? request.endpointId : link.fromOperatorId);
  }
  const available = endpoints.every(endpoint => endpoint.available);
  const sourceAvailable = endpoints.some(endpoint => endpoint.id === request.endpointId && endpoint.available && (request.kind !== 'person-operator-link' || endpoint.route === 'People'));
  return {
    ...base, state: !matches ? 'mismatched-source' : available ? 'available' : 'unavailable-endpoint',
    message: !matches ? 'The requested profile does not match this relationship. No other profile has been selected.'
      : available ? 'This is the exact linked relationship. Changes require Save in its existing relationship editor.'
        : 'This relationship is recorded, but a linked endpoint is unavailable on this device. No other endpoint has been selected.',
    canManage: matches && sourceAvailable, label, status: relationshipStatus(source, on),
    ...(source.startDate ? { startDate: source.startDate } : {}), ...(source.endDate ? { endDate: source.endDate } : {}), endpoints,
  };
}
