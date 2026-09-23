import {describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseWorkflowDestination,workflowDestinationUrl} from '../lib/workflow/workflow-destination';
import {EditorNavigationGuard} from '../lib/editor/navigation-guard';
import {RecordEditorWorkspace} from '../components/shared/record-editor-workspace';

describe('T14 exact record navigation',()=>{
  it('preserves ampersands in route names while decoding legacy record destinations',()=>{
    expect(parseWorkflowDestination('Loadouts & Gas').route).toBe('Loadouts & Gas');
    expect(parseWorkflowDestination('Loadouts & Gas&loadoutId=kit-1')).toMatchObject({route:'Loadouts & Gas',recordId:'kit-1'});
    expect(parseWorkflowDestination('Trips&tripId=trip%26one')).toMatchObject({route:'Trips',recordId:'trip&one'});
    expect(parseWorkflowDestination('?section=Dive+Planning+Centre&planId=p1')).toMatchObject({route:'Dive Plans',recordId:'p1'});
  });
  it('round trips typed record destinations through canonical and legacy query keys',()=>{
    const url=workflowDestinationUrl({route:'Gas Planning',recordId:'gas & / one'});
    expect(new URLSearchParams(url).get('gasPlanId')).toBe('gas & / one');
    expect(parseWorkflowDestination(url)).toMatchObject({route:'Gas Planning',recordId:'gas & / one'});
  });
  it('does not turn external URLs or invalid section names into application destinations',()=>{
    expect(parseWorkflowDestination('https://example.org/?section=People').route).toBe('Overview');
    expect(parseWorkflowDestination('?section=Missing').route).toBe('Overview');
  });
  it('preserves the selected legacy Data Centre tab',()=>{
    expect(parseWorkflowDestination('Imports')).toMatchObject({route:'Data & Backups',params:{tab:'Imports'}});
    expect(parseWorkflowDestination('?section=Backups')).toMatchObject({route:'Data & Backups',params:{tab:'Backups'}});
  });
});

describe('T14 editor navigation protection',()=>{
  it('allows clean navigation and postpones dirty navigation until the editor decides',()=>{
    const guard=new EditorNavigationGuard(), navigate=vi.fn(), requests:Array<()=>void>=[];
    guard.request(navigate);expect(navigate).toHaveBeenCalledTimes(1);
    const release=guard.register(action=>requests.push(action));
    guard.request(navigate);expect(navigate).toHaveBeenCalledTimes(1);
    requests[0]!();expect(navigate).toHaveBeenCalledTimes(2);
    release();guard.request(navigate);expect(navigate).toHaveBeenCalledTimes(3);
  });
  it('an old editor cleanup cannot unregister a newer active editor',()=>{
    const guard=new EditorNavigationGuard(), old=guard.register(()=>{}), pending=vi.fn(), navigate=vi.fn();
    guard.register(pending);old();guard.request(navigate);
    expect(pending).toHaveBeenCalledWith(navigate);expect(navigate).not.toHaveBeenCalled();
  });
  it('renders complex editors as an in-route workspace with labelled save and cancel controls',()=>{
    const html=renderToStaticMarkup(createElement(RecordEditorWorkspace,{label:'Edit Dive Plan',close:()=>{},save:async()=>{},children:createElement('input',{'aria-label':'Plan name'})}));
    expect(html).toContain('data-record-editor-workspace');
    expect(html).not.toContain('<dialog');expect(html).not.toContain('focus-modal-bg');
    expect(html).toContain('Edit Dive Plan');expect(html).toContain('Save');expect(html).toContain('Cancel');
  });
});
