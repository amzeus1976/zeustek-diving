import { ArrowRight, Construction } from 'lucide-react';
import { WORKFLOW_ROUTES } from '../../lib/workflow/workflow-model';

export function WorkflowPlaceholder({ route, go }: { route: string; go: (next: string) => void }) {
  const item = WORKFLOW_ROUTES.find((candidate) => candidate.route === route);
  return <main>
    <header className="focus-heading"><div><span>WORKFLOW DESTINATION</span><h1>{item?.label ?? route}</h1><p>{item?.description ?? 'This workflow destination is being prepared.'}</p></div></header>
    <section className="focus-card focus-empty"><Construction size={32}/><h2>Coming in {item?.futureTask ?? 'a future task'}</h2><p>This destination is reserved now so navigation and older deep links stay stable. No data has been created or migrated.</p><button className="focus-primary" onClick={() => go('Overview')}>Return to Overview <ArrowRight size={16}/></button></section>
  </main>;
}
