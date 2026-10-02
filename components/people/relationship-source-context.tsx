'use client';
import type { RelationshipSourceContext } from '../../lib/operators/relationship-source-context';
import { workflowDestinationUrl } from '../../lib/workflow/workflow-destination';

export function RelationshipSourceContextCard({ context, go, manage }: { context: RelationshipSourceContext; go?: ((destination: string) => void) | undefined; manage?: (() => void) | undefined }) {
  return <section className="focus-card" aria-label="Linked relationship source">
    <h2>{context.kind === 'person-operator-link' ? 'Linked affiliation' : 'Linked entity relationship'}</h2>
    <output>{context.message}</output>
    {context.label && <p>{context.label} · {context.status}</p>}
    {(context.startDate || context.endDate) && <p>Start: {context.startDate || 'Not recorded'} · End: {context.endDate || 'Not recorded'}</p>}
    {context.endpoints.length > 0 && <ul>{context.endpoints.map(endpoint => {
      const destination = workflowDestinationUrl({ route: endpoint.route, recordId: endpoint.id });
      return <li key={`${endpoint.route}:${endpoint.id}`}>{endpoint.available
        ? <a href={`/${destination}`} onClick={go ? event => { event.preventDefault(); go(destination); } : undefined}>{endpoint.label}</a>
        : <span>{endpoint.label} · unavailable on this device</span>}</li>;
    })}</ul>}
    {context.canManage && manage && <button className="focus-secondary" onClick={manage}>Manage this relationship</button>}
  </section>;
}
