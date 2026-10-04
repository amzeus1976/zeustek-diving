import {afterEach, describe, expect, it, vi} from 'vitest';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {CollapsibleWorkCard} from '../components/workflow/collapsible-work-card';

afterEach(()=>vi.unstubAllGlobals());

function markup(defaultMinimized=false,defaultExpanded=false){
  const props={
    id:'fixture-card',title:'Fixture records',defaultMinimized,defaultExpanded,rowCount:8,previewLimit:5,
    children:createElement('p',null,'Saved record evidence'),
  };
  return renderToString(createElement(CollapsibleWorkCard,props));
}

describe('remembered work-card preferences and initial hydration',()=>{
  it('renders the same initial markup with a remembered collapsed preference as without browser storage',()=>{
    vi.stubGlobal('localStorage',undefined);
    const server=markup();
    const getItem=vi.fn(()=>JSON.stringify({minimized:true,expanded:true}));
    vi.stubGlobal('localStorage',{getItem,setItem:vi.fn()});
    expect(markup()).toBe(server);
    expect(getItem).not.toHaveBeenCalled();
    expect(server).toContain('Collapse Fixture records');
    expect(server).toContain('Saved record evidence');
    expect(server).toContain('Show more (3)');
  });

  it('keeps explicit initially collapsed/expanded defaults stable against the opposite remembered preference',()=>{
    vi.stubGlobal('localStorage',undefined);
    const server=markup(true,true);
    vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({minimized:false,expanded:false}),setItem:vi.fn()});
    expect(markup(true,true)).toBe(server);
    expect(server).toContain('Expand Fixture records');
    expect(server).not.toContain('Saved record evidence');
  });

  it('does not access or write unavailable/corrupt browser storage during the first render',()=>{
    const getItem=vi.fn(()=>'{invalid JSON');const setItem=vi.fn(()=>{throw Error('Storage unavailable');});
    vi.stubGlobal('localStorage',{getItem,setItem});
    expect(()=>markup()).not.toThrow();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
